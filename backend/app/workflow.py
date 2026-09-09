"""Repair-shop workflow and audit records, independent of Fleet's database."""
import json
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict

router = APIRouter()


def service():
    from backend.app import main
    return main


def cents(value):
    return int((Decimal(str(value)) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def migrate(conn):
    additions = {
        'repair_orders': {'revision': 'INTEGER NOT NULL DEFAULT 0', 'work_state': 'TEXT', 'assigned_to': 'TEXT', 'promised_at': 'TEXT', 'invoice_total_cents': 'INTEGER', 'office_seen_event': 'INTEGER NOT NULL DEFAULT 0'},
        'estimate_items': {'kind': "TEXT NOT NULL DEFAULT 'service'", 'decision': "TEXT NOT NULL DEFAULT 'pending'", 'deleted_at': 'TEXT'},
        'inspections': {'urgency': "TEXT NOT NULL DEFAULT 'attention'"},
        'media': {'caption': "TEXT NOT NULL DEFAULT ''", 'area': "TEXT NOT NULL DEFAULT ''"},
    }
    for table, fields in additions.items():
        existing = {r['name'] for r in conn.execute(f'PRAGMA table_info({table})')}
        for field, definition in fields.items():
            if field not in existing:
                conn.execute(f'ALTER TABLE {table} ADD COLUMN {field} {definition}')
                if table == 'estimate_items' and field == 'decision':
                    conn.execute("UPDATE estimate_items SET decision='approved' WHERE approved=1")
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS shop_authorizations (
          order_id INTEGER PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, actor TEXT NOT NULL,
          snapshot TEXT NOT NULL, signature_path TEXT NOT NULL, pdf_path TEXT NOT NULL,
          signed_at TEXT NOT NULL, fingerprint TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS shop_finding_submissions (
          request_key TEXT PRIMARY KEY, order_id INTEGER NOT NULL, actor TEXT NOT NULL, signature TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS shop_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
          actor TEXT NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL,
          detail TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_activity_order ON shop_activity(order_id, id);
        CREATE TABLE IF NOT EXISTS shop_staff (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, last_seen TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS shop_approvals (
          id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
          customer_name TEXT NOT NULL, method TEXT NOT NULL, note TEXT NOT NULL,
          snapshot TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS shop_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
          amount_cents INTEGER NOT NULL, method TEXT NOT NULL, reference TEXT NOT NULL,
          request_key TEXT UNIQUE NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL);
    ''')


def actor(request=None):
    return request.state.shop if request else {'id': 'system', 'name': 'Legacy workflow', 'role': 'SHOP_ADMIN'}


def record(conn, order_id, action, detail, request=None):
    user = actor(request)
    conn.execute('INSERT INTO shop_activity (order_id,actor,actor_name,action,detail,created_at) VALUES (?,?,?,?,?,?)',
                 (order_id, user['id'], user.get('name', ''), action, json.dumps(detail), service().now_iso()))
    conn.execute('UPDATE repair_orders SET revision=revision+1,updated_at=? WHERE id=?', (service().now_iso(), order_id))


def enrich(conn, result):
    authorization = conn.execute('SELECT * FROM shop_authorizations WHERE order_id=?', (result['id'],)).fetchone()
    result['authorization'] = dict(authorization) if authorization else None
    items = result['estimate_items']
    for item in items:
        item['line_total_cents'] = cents(Decimal(str(item['qty'])) * Decimal(str(item['unit_price'])))
    result['totals'] = {kind: sum(i['line_total_cents'] for i in items if i['kind'] == kind and i['decision'] != 'declined') for kind in ('part', 'labor', 'service', 'fee')}
    result['proposed_cents'] = sum(result['totals'].values())
    result['estimate_total'] = result['proposed_cents'] / 100
    result['approved_cents'] = sum(i['line_total_cents'] for i in items if i['decision'] == 'approved')
    result['pending_items'] = sum(i['decision'] == 'pending' and not i['approved'] for i in items)
    result['approval_state'] = 'awaiting_decision' if result['pending_items'] else 'approved' if any(i['approved'] for i in items) else 'no_approved_work'
    result['payments'] = [dict(r) for r in conn.execute('SELECT * FROM shop_payments WHERE order_id=? ORDER BY id', (result['id'],))]
    received = sum(p['amount_cents'] for p in result['payments'])
    if not result['payments']:
        received = result.get('paid_amount_cents') or 0
    due = result['invoice_total_cents'] if result.get('invoice_total_cents') is not None else result['approved_cents']
    result['received_cents'] = received
    result['balance_cents'] = due - received
    result['payment_state'] = 'paid' if (received >= due and (received or result.get('paid_at'))) else 'partial' if received else 'unpaid'
    if not result.get('work_state'):
        status = result['status']
        result['work_state'] = 'complete' if result.get('ready_at') else status if status in ('authorized', 'inspection_complete', 'estimate_ready', 'approved', 'in_progress') else 'needs_review'
    result['activity'] = [dict(r) for r in conn.execute('SELECT * FROM shop_activity WHERE order_id=? ORDER BY id DESC', (result['id'],))]
    result['approvals'] = [dict(r) for r in conn.execute('SELECT * FROM shop_approvals WHERE order_id=? ORDER BY id DESC', (result['id'],))]
    result['unread_updates'] = sum(e['id'] > result['office_seen_event'] and e['action'] in ('Finding added', 'Photo uploaded', 'Repair status changed') for e in result['activity'])
    for finding in result['inspections']:
        events = [e for e in result['activity'] if e['action'] in ('Finding added', 'Photo uploaded') and json.loads(e['detail']).get('finding_id') == finding['id']]
        finding['office_reviewed'] = bool(events) and all(e['id'] <= result['office_seen_event'] for e in events)
    return result


def office(request):
    if request.state.shop['role'] == 'SHOP_MECHANIC':
        raise HTTPException(403, 'Office access is required.')


def editable(order):
    if order['received_cents'] or order.get('paid_at'):
        raise HTTPException(409, 'Payments are already recorded. Pricing is locked; create a new visit for additional work.')


def invalidate_invoice(conn, order_id):
    conn.execute('UPDATE repair_orders SET invoice_total_cents=NULL WHERE id=?', (order_id,))


def checked(conn, order_id, revision):
    conn.execute('BEGIN IMMEDIATE')
    order = service().fetch_order(conn, order_id)
    if order['revision'] != revision:
        raise HTTPException(409, 'This ticket changed. Refresh before saving.')
    return order


class Versioned(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    revision: int = Field(ge=0)


class Line(Versioned):
    description: str = Field(min_length=1, max_length=500)
    kind: Literal['part', 'labor', 'service', 'fee']
    qty: Decimal = Field(gt=0, le=10000, decimal_places=3)
    unit_price: Decimal = Field(ge=0, le=1000000, decimal_places=2)


class Approval(Versioned):
    item_ids: list[int] = Field(min_length=1)
    decision: Literal['approved', 'declined']
    customer_name: str = Field(min_length=1, max_length=200)
    method: Literal['in_person', 'phone', 'written']
    note: str = Field(min_length=1, max_length=2000)


class Assignment(Versioned):
    assigned_to: str | None = None
    promised_at: str | None = None


class Invoice(Versioned):
    amount: Decimal = Field(ge=0, le=99999999, decimal_places=2)
    note: str = Field(min_length=1, max_length=1000)


class Payment(Versioned):
    amount: Decimal = Field(gt=0, le=99999999, decimal_places=2)
    method: Literal['cash', 'card', 'check', 'other']
    reference: str = Field(default='', max_length=200)
    request_key: str = Field(min_length=16, max_length=100)


@router.get('/api/shop-staff')
def staff():
    with service().db() as conn:
        return [dict(r) for r in conn.execute("SELECT id,name,role FROM shop_staff ORDER BY name")]


@router.post('/api/orders/{order_id}/lines')
def add_line(order_id: int, payload: Line, request: Request):
    office(request)
    with service().db() as conn:
        editable(checked(conn, order_id, payload.revision))
        conn.execute('INSERT INTO estimate_items (repair_order_id,description,kind,qty,unit_price) VALUES (?,?,?,?,?)',
                     (order_id, payload.description.strip(), payload.kind, float(payload.qty), float(payload.unit_price)))
        invalidate_invoice(conn, order_id)
        record(conn, order_id, 'Estimate line added', payload.model_dump(mode='json'), request)
        return service().fetch_order(conn, order_id)


@router.put('/api/orders/{order_id}/lines/{item_id}')
def edit_line(order_id: int, item_id: int, payload: Line, request: Request):
    office(request)
    with service().db() as conn:
        order = checked(conn, order_id, payload.revision)
        editable(order)
        old = next((i for i in order['estimate_items'] if i['id'] == item_id), None)
        if not old:
            raise HTTPException(404, 'Line not found')
        conn.execute("UPDATE estimate_items SET description=?,kind=?,qty=?,unit_price=?,decision='pending',approved=0 WHERE id=?",
                     (payload.description.strip(), payload.kind, float(payload.qty), float(payload.unit_price), item_id))
        invalidate_invoice(conn, order_id)
        record(conn, order_id, 'Estimate line revised; approval required', {'before': old, 'after': payload.model_dump(mode='json')}, request)
        return service().fetch_order(conn, order_id)


@router.delete('/api/orders/{order_id}/lines/{item_id}')
def remove_line(order_id: int, item_id: int, payload: Versioned, request: Request):
    office(request)
    with service().db() as conn:
        order = checked(conn, order_id, payload.revision)
        editable(order)
        if not any(i['id'] == item_id for i in order['estimate_items']):
            raise HTTPException(404, 'Line not found')
        conn.execute('UPDATE estimate_items SET deleted_at=? WHERE id=?', (service().now_iso(), item_id))
        invalidate_invoice(conn, order_id)
        record(conn, order_id, 'Estimate line removed', {'item_id': item_id}, request)
        return service().fetch_order(conn, order_id)


@router.post('/api/orders/{order_id}/decisions')
def decision(order_id: int, payload: Approval, request: Request):
    office(request)
    with service().db() as conn:
        order = checked(conn, order_id, payload.revision)
        editable(order)
        selected = [i for i in order['estimate_items'] if i['id'] in payload.item_ids]
        if len(selected) != len(set(payload.item_ids)):
            raise HTTPException(400, 'Select lines belonging to this ticket.')
        for item in selected:
            conn.execute('UPDATE estimate_items SET decision=?,approved=? WHERE id=?', (payload.decision, int(payload.decision == 'approved'), item['id']))
        snapshot = {'decision': payload.decision, 'lines': selected}
        invalidate_invoice(conn, order_id)
        conn.execute('INSERT INTO shop_approvals (order_id,customer_name,method,note,snapshot,actor,created_at) VALUES (?,?,?,?,?,?,?)',
                     (order_id, payload.customer_name.strip(), payload.method, payload.note.strip(), json.dumps(snapshot), actor(request)['id'], service().now_iso()))
        record(conn, order_id, 'Customer decision recorded', {**snapshot, 'customer': payload.customer_name, 'method': payload.method, 'note': payload.note}, request)
        return service().fetch_order(conn, order_id)


@router.put('/api/orders/{order_id}/assignment')
def assign(order_id: int, payload: Assignment, request: Request):
    office(request)
    if payload.promised_at:
        from datetime import datetime
        try:
            if datetime.fromisoformat(payload.promised_at).tzinfo is None:
                raise ValueError()
        except ValueError:
            raise HTTPException(422, 'Promised time must include a timezone.')
    with service().db() as conn:
        checked(conn, order_id, payload.revision)
        if payload.assigned_to and not conn.execute("SELECT 1 FROM shop_staff WHERE id=? AND role IN ('SHOP_MECHANIC','SHOP_ADMIN')", (payload.assigned_to,)).fetchone():
            raise HTTPException(400, 'Choose a technician who has signed into the shop.')
        conn.execute('UPDATE repair_orders SET assigned_to=?,promised_at=? WHERE id=?', (payload.assigned_to, payload.promised_at, order_id))
        record(conn, order_id, 'Assignment updated', payload.model_dump(), request)
        return service().fetch_order(conn, order_id)


@router.post('/api/orders/{order_id}/acknowledge')
def acknowledge(order_id: int, payload: Versioned, request: Request):
    office(request)
    with service().db() as conn:
        checked(conn, order_id, payload.revision)
        last = conn.execute('SELECT COALESCE(MAX(id),0) FROM shop_activity WHERE order_id=?', (order_id,)).fetchone()[0]
        conn.execute('UPDATE repair_orders SET office_seen_event=? WHERE id=?', (last, order_id))
        record(conn, order_id, 'Office reviewed updates', {}, request)
    return {'ok': True}


@router.put('/api/orders/{order_id}/invoice-total')
def invoice_total(order_id: int, payload: Invoice, request: Request):
    office(request)
    with service().db() as conn:
        order = checked(conn, order_id, payload.revision)
        editable(order)
        if not order.get('invoice_path'):
            raise HTTPException(409, 'Upload the invoice first.')
        conn.execute('UPDATE repair_orders SET invoice_total_cents=? WHERE id=?', (cents(payload.amount), order_id))
        record(conn, order_id, 'Invoice total verified', payload.model_dump(mode='json'), request)
        return service().fetch_order(conn, order_id)


@router.post('/api/orders/{order_id}/close-no-charge')
def close_no_charge(order_id: int, payload: Versioned, request: Request):
    office(request)
    with service().db() as conn:
        order = checked(conn, order_id, payload.revision)
        if order['work_state'] != 'complete' or order['invoice_total_cents'] != 0 or order['pending_items'] or order['received_cents']:
            raise HTTPException(409, 'A ready vehicle and verified zero-dollar invoice are required.')
        conn.execute('UPDATE repair_orders SET paid_amount_cents=0,paid_at=COALESCE(paid_at,?) WHERE id=?', (service().now_iso(), order_id))
        record(conn, order_id, 'No-charge visit closed', {}, request)
        return service().fetch_order(conn, order_id)


@router.post('/api/orders/{order_id}/payments')
def payment(order_id: int, payload: Payment, request: Request):
    office(request)
    with service().db() as conn:
        conn.execute('BEGIN IMMEDIATE')
        prior = conn.execute('SELECT * FROM shop_payments WHERE request_key=?', (payload.request_key,)).fetchone()
        if prior:
            if prior['order_id'] != order_id or prior['amount_cents'] != cents(payload.amount) or prior['method'] != payload.method or prior['reference'] != payload.reference:
                raise HTTPException(409, 'Payment request key was already used for a different payment.')
            return service().fetch_order(conn, order_id)
        order = service().fetch_order(conn, order_id)
        if order['revision'] != payload.revision:
            raise HTTPException(409, 'This ticket changed. Refresh before saving.')
        if order['work_state'] != 'complete' or order['invoice_total_cents'] is None or order['pending_items']:
            raise HTTPException(409, 'Mark the vehicle ready and verify the invoice total first.')
        if order.get('paid_at') and not order['payments']:
            raise HTTPException(409, 'A legacy payment is already recorded.')
        amount = cents(payload.amount)
        if amount > order['balance_cents']:
            raise HTTPException(409, 'Payment exceeds the remaining balance.')
        stamp = service().now_iso()
        conn.execute('INSERT INTO shop_payments (order_id,amount_cents,method,reference,request_key,actor,created_at) VALUES (?,?,?,?,?,?,?)',
                     (order_id, amount, payload.method, payload.reference, payload.request_key, actor(request)['id'], stamp))
        total = order['received_cents'] + amount
        conn.execute('UPDATE repair_orders SET paid_amount_cents=?,paid_at=CASE WHEN ?=invoice_total_cents THEN ? ELSE NULL END WHERE id=?', (total, total, stamp, order_id))
        record(conn, order_id, 'Payment recorded', {'amount_cents': amount, 'method': payload.method, 'reference': payload.reference}, request)
        return service().fetch_order(conn, order_id)
