from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from pathlib import Path
from uuid import uuid4
import sqlite3
import json
import os
from urllib.parse import quote
from urllib.request import urlopen

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, Request
from backend.app.access import require_staff
from backend.app.reports import income_report, SHOP_TIMEZONE
from backend.app import workflow
from backend.app import backups
from backend.app import mechanic
from backend.app import checkin
from backend.app import visual
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("SHOP_DATA_DIR", str(BASE_DIR / "data"))).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "shop.sqlite3"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Scarsdale Auto Repair Shop System", dependencies=[Depends(require_staff)])
app.include_router(workflow.router)
app.include_router(backups.router)
app.include_router(mechanic.router)
app.include_router(checkin.router)
app.include_router(visual.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("SHOP_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now_iso():
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


class ShopConnection(sqlite3.Connection):
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()


def db():
    conn = sqlite3.connect(DB_PATH, timeout=30, factory=ShopConnection)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS shop_members (
              fleet_user_id TEXT PRIMARY KEY,
              role TEXT NOT NULL CHECK(role IN ('SHOP_MECHANIC', 'SHOP_OFFICE')),
              updated_by TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS shop_membership_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              fleet_user_id TEXT NOT NULL,
              role TEXT,
              actor TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS customers (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              phone TEXT NOT NULL,
              email TEXT,
              address TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS vehicles (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              customer_id INTEGER NOT NULL,
              plate TEXT,
              vin TEXT,
              year TEXT,
              make TEXT,
              model TEXT,
              mileage TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(customer_id) REFERENCES customers(id)
            );

            CREATE TABLE IF NOT EXISTS repair_orders (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              customer_id INTEGER NOT NULL,
              vehicle_id INTEGER NOT NULL,
              access_code TEXT NOT NULL UNIQUE,
              status TEXT NOT NULL,
              concern TEXT NOT NULL,
              requested_services TEXT NOT NULL,
              diagnostic_fee REAL DEFAULT 0,
              authorization_name TEXT,
              authorized_at TEXT,
              estimate_total REAL DEFAULT 0,
              approved_at TEXT,
              completion_time TEXT,
              invoice_path TEXT,
              invoice_name TEXT,
              paid_at TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY(customer_id) REFERENCES customers(id),
              FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
            );

            CREATE TABLE IF NOT EXISTS inspections (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              repair_order_id INTEGER NOT NULL,
              technician TEXT,
              notes TEXT,
              required_parts TEXT,
              labor_notes TEXT,
              created_at TEXT NOT NULL,
              FOREIGN KEY(repair_order_id) REFERENCES repair_orders(id)
            );

            CREATE TABLE IF NOT EXISTS estimate_items (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              repair_order_id INTEGER NOT NULL,
              description TEXT NOT NULL,
              qty REAL DEFAULT 1,
              unit_price REAL DEFAULT 0,
              approved INTEGER DEFAULT 0,
              FOREIGN KEY(repair_order_id) REFERENCES repair_orders(id)
            );

            CREATE TABLE IF NOT EXISTS media (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              repair_order_id INTEGER NOT NULL,
              kind TEXT NOT NULL,
              original_name TEXT NOT NULL,
              stored_path TEXT NOT NULL,
              uploaded_at TEXT NOT NULL,
              FOREIGN KEY(repair_order_id) REFERENCES repair_orders(id)
            );
            """
        )

        columns = {row["name"] for row in conn.execute("PRAGMA table_info(media)")}
        if "inspection_id" not in columns:
            conn.execute("ALTER TABLE media ADD COLUMN inspection_id INTEGER REFERENCES inspections(id)")
        order_columns = {row["name"] for row in conn.execute("PRAGMA table_info(repair_orders)")}
        if "ready_at" not in order_columns:
            conn.execute("ALTER TABLE repair_orders ADD COLUMN ready_at TEXT")
        if "paid_amount_cents" not in order_columns:
            conn.execute("ALTER TABLE repair_orders ADD COLUMN paid_amount_cents INTEGER")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_created ON repair_orders(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_paid ON repair_orders(paid_at)")
        workflow.migrate(conn)


@app.on_event("startup")
def startup():
    init_db()
    if os.getenv('SHOP_ENV') == 'production':
        backups.start()


@app.on_event('shutdown')
def shutdown():
    backups.stop.set()


class IntakePayload(BaseModel):
    customer_name: str
    phone: str
    email: str | None = None
    address: str | None = None
    plate: str | None = None
    vin: str | None = None
    year: str | None = None
    make: str | None = None
    model: str | None = None
    mileage: str | None = None
    concern: str
    requested_services: list[str] = []
    diagnostic_fee: float = 0
    authorization_name: str


class InspectionPayload(BaseModel):
    technician: str | None = None
    notes: str | None = None
    required_parts: str | None = None
    labor_notes: str | None = None
    urgency: Literal['good', 'attention', 'urgent'] = 'attention'
    status: Literal['inspection_complete', 'in_progress', 'complete'] = "inspection_complete"


class EstimateItemPayload(BaseModel):
    description: str
    qty: float = 1
    unit_price: float = 0


class StatusPayload(BaseModel):
    revision: int | None = Field(default=None, ge=0)
    status: Literal['in_progress', 'complete', 'waiting_parts']
    completion_time: str | None = None


class PaymentPayload(BaseModel):
    amount: Decimal = Field(ge=0, le=99999999, decimal_places=2)


@app.get('/api/session')
def shop_session(request: Request):
    if request.state.shop.get('role'):
        with db() as conn:
            user = request.state.shop
            conn.execute('INSERT INTO shop_staff VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,last_seen=excluded.last_seen',
                         (user['id'], user.get('name', ''), user['role'], now_iso()))
    return request.state.shop


@app.get('/api/reports/income')
def report_income(period: Literal['day', 'month'] = 'day', on: date | None = None):
    with db() as conn:
        conn.execute('BEGIN')
        return income_report(conn, period, on or datetime.now(SHOP_TIMEZONE).date())


def nhtsa_value(results, variable):
    for item in results:
        if item.get("Variable") == variable and item.get("Value"):
            return item["Value"]
    return None


def normalize_lookup(value):
    return "".join((value or "").upper().split())


def order_work_summary(conn, order_id):
    items = conn.execute(
        "SELECT description, qty, unit_price FROM estimate_items WHERE repair_order_id = ? AND approved=1 AND deleted_at IS NULL ORDER BY id",
        (order_id,),
    ).fetchall()
    if not items:
        return []
    return [
        {
            "description": item["description"],
            "qty": item["qty"],
            "unit_price": item["unit_price"],
            "line_total": item["qty"] * item["unit_price"],
        }
        for item in items
    ]


def fetch_order(conn, order_id):
    row = conn.execute(
        """
        SELECT ro.*, c.name customer_name, c.phone, c.email, c.address,
               v.plate, v.vin, v.year, v.make, v.model, v.mileage
        FROM repair_orders ro
        JOIN customers c ON c.id = ro.customer_id
        JOIN vehicles v ON v.id = ro.vehicle_id
        WHERE ro.id = ?
        """,
        (order_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Repair order not found")

    items = conn.execute(
        "SELECT * FROM estimate_items WHERE repair_order_id = ? AND deleted_at IS NULL ORDER BY id",
        (order_id,),
    ).fetchall()
    inspections = conn.execute(
        "SELECT * FROM inspections WHERE repair_order_id = ? ORDER BY id DESC",
        (order_id,),
    ).fetchall()
    media = conn.execute(
        "SELECT * FROM media WHERE repair_order_id = ? ORDER BY id DESC",
        (order_id,),
    ).fetchall()
    result = dict(row)
    result["requested_services"] = [
        item for item in result["requested_services"].split(",") if item
    ]
    result["estimate_items"] = [dict(item) for item in items]
    result["inspections"] = [dict(item) for item in inspections]
    result["media"] = [dict(item) for item in media]
    return workflow.enrich(conn, result)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/vin/{vin}")
def decode_vin(vin: str):
    clean_vin = vin.strip().upper()
    if len(clean_vin) < 11:
        raise HTTPException(status_code=400, detail="Enter a valid VIN before decoding.")
    url = f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/{quote(clean_vin)}?format=json"
    try:
        with urlopen(url, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=502, detail="VIN decoder is unavailable right now.") from exc

    rows = payload.get("Results") or []
    if not rows:
        raise HTTPException(status_code=404, detail="No vehicle information found for that VIN.")
    vehicle = rows[0]
    return {
        "vin": clean_vin,
        "year": vehicle.get("ModelYear") or "",
        "make": vehicle.get("Make") or "",
        "model": vehicle.get("Model") or "",
        "trim": vehicle.get("Trim") or "",
        "body_class": vehicle.get("BodyClass") or "",
        "engine": vehicle.get("EngineModel") or vehicle.get("DisplacementL") or "",
    }


@app.get("/api/plate/{state}/{plate}")
def lookup_plate(state: str, plate: str):
    normalized_plate = normalize_lookup(plate)
    with db() as conn:
        row = conn.execute(
            """
            SELECT plate, vin, year, make, model, mileage
            FROM vehicles
            WHERE UPPER(REPLACE(plate, ' ', '')) = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (normalized_plate,),
        ).fetchone()
        if row and row["vin"]:
            return dict(row)
    raise HTTPException(
        status_code=404,
        detail=(
            "No saved VIN found for that plate yet. Enter the VIN once, and future plate searches "
            "will bring that vehicle back from shop history. DMV plate decoding needs a licensed provider."
        ),
    )


@app.get("/api/history")
def vehicle_history(plate: str | None = None, vin: str | None = None):
    normalized_plate = normalize_lookup(plate)
    normalized_vin = normalize_lookup(vin)
    if not normalized_plate and not normalized_vin:
        raise HTTPException(status_code=400, detail="Enter a plate or VIN to search history.")

    filters = []
    params = []
    if normalized_plate:
        filters.append("UPPER(REPLACE(v.plate, ' ', '')) = ?")
        params.append(normalized_plate)
    if normalized_vin:
        filters.append("UPPER(REPLACE(v.vin, ' ', '')) = ?")
        params.append(normalized_vin)

    with db() as conn:
        rows = conn.execute(
            f"""
            SELECT ro.*, c.name customer_name, c.phone, c.email,
                   v.plate, v.vin, v.year, v.make, v.model, v.mileage
            FROM repair_orders ro
            JOIN customers c ON c.id = ro.customer_id
            JOIN vehicles v ON v.id = ro.vehicle_id
            WHERE {" OR ".join(filters)}
            ORDER BY ro.created_at DESC, ro.id DESC
            """,
            params,
        ).fetchall()
        if not rows:
            raise HTTPException(status_code=404, detail="No vehicle history found for that plate or VIN.")

        vehicle = {
            "plate": rows[0]["plate"],
            "vin": rows[0]["vin"],
            "year": rows[0]["year"],
            "make": rows[0]["make"],
            "model": rows[0]["model"],
            "mileage": rows[0]["mileage"],
        }
        visits = []
        for row in rows:
            detail = fetch_order(conn, row["id"])
            latest_inspection = conn.execute(
                """
                SELECT technician, notes, required_parts, labor_notes, created_at
                FROM inspections
                WHERE repair_order_id = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (row["id"],),
            ).fetchone()
            visits.append(
                {
                    "id": row["id"],
                    "date": row["created_at"],
                    "mileage": row["mileage"],
                    "status": row["status"],
                    "concern": row["concern"],
                    "requested_services": [
                        item for item in row["requested_services"].split(",") if item
                    ],
                    "work_done": order_work_summary(conn, row["id"]),
                    "inspection": dict(latest_inspection) if latest_inspection else None,
                    "inspections": detail["inspections"],
                    "media": detail["media"],
                    "invoice_total": (detail['invoice_total_cents'] if detail['invoice_total_cents'] is not None else detail['approved_cents']) / 100,
                    "invoice_name": row["invoice_name"],
                    "ready_at": row["ready_at"],
                    "paid_at": row["paid_at"],
                    "work_state": detail['work_state'],
                    "payment_state": detail['payment_state'],
                    "approved_cents": detail['approved_cents'],
                    "estimate_items": detail['estimate_items'],
                    "activity": detail['activity'],
                    "authorization": detail['authorization'],
                    "visual_instructions": detail['visual_instructions'],
                }
            )
    return {"vehicle": vehicle, "visits": visits}


@app.delete("/api/dev/clear-data")
def clear_data():
    with db() as conn:
        for table in ["media", "estimate_items", "inspections", "repair_orders", "vehicles", "customers"]:
            conn.execute(f"DELETE FROM {table}")
        for table in ["media", "estimate_items", "inspections", "repair_orders", "vehicles", "customers"]:
            conn.execute("DELETE FROM sqlite_sequence WHERE name = ?", (table,))
    if UPLOAD_DIR.exists():
        for path in UPLOAD_DIR.iterdir():
            if path.is_file():
                path.unlink()
    return {"cleared": True}


@app.post("/api/intake")
def create_intake(payload: IntakePayload, request: Request = None):
    from backend.app import access
    if access.PRODUCTION:
        raise HTTPException(410, 'Refresh the shop and use the signed check-in form.')
    created = now_iso()
    access_code = uuid4().hex[:8].upper()
    services = ",".join(payload.requested_services)
    with db() as conn:
        cursor = conn.execute(
            "INSERT INTO customers (name, phone, email, address, created_at) VALUES (?, ?, ?, ?, ?)",
            (payload.customer_name, payload.phone, payload.email, payload.address, created),
        )
        customer_id = cursor.lastrowid
        cursor = conn.execute(
            """
            INSERT INTO vehicles (customer_id, plate, vin, year, make, model, mileage, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                customer_id,
                payload.plate,
                payload.vin,
                payload.year,
                payload.make,
                payload.model,
                payload.mileage,
                created,
            ),
        )
        vehicle_id = cursor.lastrowid
        cursor = conn.execute(
            """
            INSERT INTO repair_orders (
              customer_id, vehicle_id, access_code, status, concern, requested_services,
              diagnostic_fee, authorization_name, authorized_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                customer_id,
                vehicle_id,
                access_code,
                "authorized",
                payload.concern,
                services,
                payload.diagnostic_fee,
                payload.authorization_name,
                created,
                created,
                created,
            ),
        )
        order_id = cursor.lastrowid
        workflow.record(conn, order_id, 'Intake authorization recorded', {'authorized_by': payload.authorization_name, 'diagnostic_fee': payload.diagnostic_fee}, request)
    return {"id": order_id, "access_code": access_code}


@app.get("/api/orders")
def list_orders():
    with db() as conn:
        rows = conn.execute(
            """
            SELECT ro.id, ro.status, ro.access_code, ro.concern, ro.estimate_total,
                   ro.created_at, ro.updated_at, c.name customer_name, c.phone,
                   v.plate, v.year, v.make, v.model
            FROM repair_orders ro
            JOIN customers c ON c.id = ro.customer_id
            JOIN vehicles v ON v.id = ro.vehicle_id
            ORDER BY ro.updated_at DESC
            """
        ).fetchall()
        summaries = []
        for row in rows:
            detail = fetch_order(conn, row['id'])
            summaries.append({**dict(row), **{key: detail[key] for key in ('work_state','payment_state','balance_cents','assigned_to','promised_at','unread_updates','pending_items')}, 'vin': detail['vin']})
    return summaries


@app.get("/api/orders/{order_id}")
def get_order(order_id: int):
    with db() as conn:
        return fetch_order(conn, order_id)


@app.get("/api/customer/orders/{access_code}")
def customer_order(access_code: str):
    with db() as conn:
        row = conn.execute(
            "SELECT id FROM repair_orders WHERE access_code = ?",
            (access_code.upper(),),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No order found for this code")
        return fetch_order(conn, row["id"])


@app.post("/api/orders/{order_id}/inspection")
def add_inspection(order_id: int, payload: InspectionPayload, request: Request = None):
    created = now_iso()
    with db() as conn:
        conn.execute('BEGIN IMMEDIATE')
        order = fetch_order(conn, order_id)
        if order['work_state'] == 'complete' or order.get('paid_at'):
            raise HTTPException(409, 'This visit is closed for findings. Create a new visit for additional work.')
        conn.execute(
            """
            INSERT INTO inspections (repair_order_id, technician, notes, required_parts, labor_notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                order_id,
                payload.technician,
                payload.notes,
                payload.required_parts,
                payload.labor_notes,
                created,
            ),
        )
        conn.execute(
            "UPDATE repair_orders SET status = ?, updated_at = ? WHERE id = ?",
            (payload.status, created, order_id),
        )
        finding_id = conn.execute('SELECT MAX(id) FROM inspections WHERE repair_order_id=?', (order_id,)).fetchone()[0]
        conn.execute('UPDATE inspections SET urgency=?,technician=? WHERE id=?', (payload.urgency, workflow.actor(request).get('name') if request else payload.technician, finding_id))
        state = 'inspection_complete' if order['work_state'] in ('authorized', 'needs_review') else order['work_state']
        conn.execute('UPDATE repair_orders SET work_state=? WHERE id=?', (state, order_id))
        workflow.record(conn, order_id, 'Finding added', {'finding_id': finding_id, 'urgency': payload.urgency}, request)
        return fetch_order(conn, order_id)


@app.post("/api/orders/{order_id}/estimate-items")
def add_estimate_item(order_id: int, payload: EstimateItemPayload):
    updated = now_iso()
    with db() as conn:
        workflow.editable(fetch_order(conn, order_id))
        from backend.app import access
        if access.PRODUCTION:
            raise HTTPException(410, 'Refresh the shop and use the versioned estimate editor.')
        conn.execute(
            """
            INSERT INTO estimate_items (repair_order_id, description, qty, unit_price)
            VALUES (?, ?, ?, ?)
            """,
            (order_id, payload.description, payload.qty, payload.unit_price),
        )
        total = conn.execute(
            "SELECT COALESCE(SUM(qty * unit_price), 0) total FROM estimate_items WHERE repair_order_id = ?",
            (order_id,),
        ).fetchone()["total"]
        conn.execute(
            "UPDATE repair_orders SET estimate_total = ?, status = ?, updated_at = ? WHERE id = ?",
            (total, "estimate_ready", updated, order_id),
        )
        return fetch_order(conn, order_id)


@app.post("/api/orders/{order_id}/approve")
def approve_estimate(order_id: int):
    updated = now_iso()
    with db() as conn:
        fetch_order(conn, order_id)
        from backend.app import access
        if access.PRODUCTION:
            raise HTTPException(410, 'Refresh the shop and record a customer decision with approval evidence.')
        conn.execute(
            "UPDATE estimate_items SET approved = 1, decision='approved' WHERE repair_order_id = ?",
            (order_id,),
        )
        conn.execute(
            "UPDATE repair_orders SET status = ?, approved_at = ?, updated_at = ? WHERE id = ?",
            ("approved", updated, updated, order_id),
        )
        return fetch_order(conn, order_id)


@app.patch("/api/orders/{order_id}/status")
def update_status(order_id: int, payload: StatusPayload, request: Request = None):
    updated = now_iso()
    with db() as conn:
        conn.execute('BEGIN IMMEDIATE')
        order = fetch_order(conn, order_id)
        if payload.revision is not None and payload.revision != order['revision']:
            raise HTTPException(409, 'This ticket changed. Refresh before saving.')
        if order['work_state'] == 'complete' and payload.status != 'complete':
            raise HTTPException(409, 'Ready vehicles cannot be moved backwards. Create a new visit for additional repairs.')
        if order.get('paid_at') and payload.status != 'complete':
            raise HTTPException(409, 'A paid visit cannot be moved backwards.')
        can_close_declined = payload.status == 'complete' and order['estimate_items'] and not order['pending_items']
        if not order.get('paid_at') and (order['pending_items'] or (not any(i['approved'] for i in order['estimate_items']) and not can_close_declined)):
            raise HTTPException(409, 'Record customer decisions for all estimate lines before starting work.')
        conn.execute(
            "UPDATE repair_orders SET status = ?, completion_time = COALESCE(?, completion_time), ready_at = CASE WHEN ? = 'complete' THEN COALESCE(ready_at, ?) ELSE ready_at END, updated_at = ? WHERE id = ?",
            (payload.status, payload.completion_time, payload.status, updated, updated, order_id),
        )
        conn.execute('UPDATE repair_orders SET work_state=? WHERE id=?', (payload.status, order_id))
        workflow.record(conn, order_id, 'Repair status changed', {'from': order['work_state'], 'to': payload.status}, request)
        return fetch_order(conn, order_id)


@app.post("/api/orders/{order_id}/upload")
def upload_file(
    order_id: int,
    request: Request,
    kind: str = Form(...),
    file: UploadFile = File(...),
    inspection_id: int | None = Form(None),
):
    if kind == 'invoice' and request.state.shop['role'] == 'SHOP_MECHANIC':
        raise HTTPException(403, 'Office access is required for invoices.')
    if kind not in {"invoice", "photo"}:
        raise HTTPException(status_code=400, detail="kind must be invoice or photo")
    timestamp = now_iso()
    suffix = Path(file.filename or "").suffix
    stored_name = f"{order_id}-{kind}-{uuid4().hex}{suffix}"
    stored_path = UPLOAD_DIR / stored_name
    with db() as conn:
        conn.execute('BEGIN IMMEDIATE')
        order = fetch_order(conn, order_id)
        if kind == 'invoice' and (order['received_cents'] or order.get('paid_at')):
            raise HTTPException(409, 'Invoice is locked after payment.')
        if inspection_id is not None:
            finding = conn.execute(
                "SELECT id FROM inspections WHERE id = ? AND repair_order_id = ?",
                (inspection_id, order_id),
            ).fetchone()
            if kind != "photo" or not finding:
                raise HTTPException(status_code=400, detail="Photo must belong to a finding on this ticket")
        try:
            size = 0
            with stored_path.open('wb') as output:
                while chunk := file.file.read(1024 * 1024):
                    size += len(chunk)
                    if size > 20 * 1024 * 1024:
                        raise HTTPException(413, 'Attachments must be 20 MB or smaller.')
                    output.write(chunk)
            if not size:
                raise HTTPException(422, 'The attachment is empty.')
        except Exception:
            stored_path.unlink(missing_ok=True)
            raise
        relative_path = f"uploads/{stored_name}"
        conn.execute(
            """
            INSERT INTO media (repair_order_id, kind, original_name, stored_path, uploaded_at, inspection_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (order_id, kind, file.filename or stored_name, relative_path, timestamp, inspection_id),
        )
        if kind == "invoice":
            conn.execute(
                """
                UPDATE repair_orders
                SET invoice_path = ?, invoice_name = ?, status = ?, invoice_total_cents=NULL, updated_at = ?
                WHERE id = ?
                """,
                (relative_path, file.filename or stored_name, order['status'], timestamp, order_id),
            )
        else:
            conn.execute(
                "UPDATE repair_orders SET updated_at = ? WHERE id = ?",
                (timestamp, order_id),
            )
        workflow.record(conn, order_id, 'Invoice uploaded' if kind == 'invoice' else 'Photo uploaded', {'name': file.filename, 'finding_id': inspection_id}, request)
        return fetch_order(conn, order_id)


@app.post("/api/orders/{order_id}/paid")
def mark_paid(order_id: int, payload: PaymentPayload | None = None):
    updated = now_iso()
    with db() as conn:
        conn.execute('BEGIN IMMEDIATE')
        order = fetch_order(conn, order_id)
        if order['paid_amount_cents'] is not None and order['paid_at']:
            return order
        from backend.app import access
        if access.PRODUCTION:
            raise HTTPException(410, 'Refresh the shop and use verified invoice checkout.')
        amount = payload.amount if payload else Decimal(str(order['estimate_total'])).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if not amount.is_finite() or amount < 0:
            raise HTTPException(400, 'Enter a valid payment amount')
        conn.execute(
            "UPDATE repair_orders SET status = ?, paid_at = COALESCE(paid_at, ?), paid_amount_cents = ?, updated_at = ? WHERE id = ?",
            ("paid", updated, int(amount * 100), updated, order_id),
        )
        return fetch_order(conn, order_id)


@app.get("/api/files/{file_name}")
def get_file(file_name: str, download: bool = False):
    safe_name = Path(file_name).name
    file_path = UPLOAD_DIR / safe_name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if download:
        with db() as conn:
            media = conn.execute('SELECT original_name FROM media WHERE stored_path = ? ORDER BY id DESC LIMIT 1', (f'uploads/{safe_name}',)).fetchone()
        name = Path(media['original_name'].replace('\\', '/')).name if media else safe_name
        return FileResponse(file_path, filename=name or safe_name, content_disposition_type='attachment')
    return FileResponse(file_path, headers={'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'", 'X-Content-Type-Options': 'nosniff'})
