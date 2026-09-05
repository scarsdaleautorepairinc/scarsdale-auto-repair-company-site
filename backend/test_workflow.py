"""Ten fictional workflow cases; all database and upload writes use a temporary directory."""
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.app import main


CASES = [
    ("Coolant and brakes", "Coolant reservoir", "Left caliper"),
    ("Ignition", "Spark plugs", "Ignition coil"),
    ("Suspension", "Front struts", "Tie rod end"),
    ("Oil leaks", "Valve cover gasket", "Oil pan gasket"),
    ("Electrical", "Battery", "Alternator"),
    ("Air conditioning", "AC condenser", "AC hose"),
    ("Tires", "Front tires", "Wheel alignment"),
    ("Inspection", "Headlight bulb", "Wiper blades"),
    ("Exhaust", "Exhaust pipe", "Muffler"),
    ("Long multiline notes", "Coolant hose\nClamp loose", "Brake hose\nFluid seepage"),
]


class WorkflowTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        original_db = main.db

        @contextmanager
        def test_db():
            conn = original_db()
            try:
                with conn:
                    yield conn
            finally:
                conn.close()

        for override in (patch.object(main, "DB_PATH", root / "shop.sqlite3"),
                         patch.object(main, "UPLOAD_DIR", root), patch.object(main, "db", test_db)):
            override.start()
            self.addCleanup(override.stop)
        self.client = self.enterContext(TestClient(main.app))

    def request(self, method, path, expected=200, **kwargs):
        response = self.client.request(method, path, **kwargs)
        self.assertEqual(response.status_code, expected, response.text)
        return response

    def run_case(self, index):
        label, first, second = CASES[index]
        plate, vin = f"TEST{index:03}", f"TESTVIN{index:010}"
        payload = dict(customer_name=f"Fictional Customer {index + 1}", phone="2025550100",
                       plate=plate, vin=vin, year="2020", make="Test", model="Van",
                       mileage=str(40000 + index * 1000), concern=label,
                       requested_services=["Diagnostic"], diagnostic_fee=130,
                       authorization_name="Fictional Customer")
        ticket = self.request("POST", "/api/intake", json=payload).json()
        path = f'/api/orders/{ticket["id"]}'
        self.assertEqual(self.request("GET", path).json()["status"], "authorized")
        finding_ids = []
        for number, part in enumerate((first, second), 1):
            order = self.request("POST", path + "/inspection", json=dict(
                technician=f"Tech {number}", notes=f"Finding: {part}", required_parts=part,
                labor_notes=f"Replace {part} and verify operation"
            )).json()
            finding_id = order["inspections"][0]["id"]
            finding_ids.append(finding_id)
            self.request("POST", path + "/upload", data={"kind": "photo", "inspection_id": finding_id},
                         files={"file": ("part.svg", b'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>', "image/svg+xml")})
        self.request("POST", path + "/upload", data={"kind": "photo", "inspection_id": 999999},
                     files={"file": ("bad.jpg", b"test", "image/jpeg")}, expected=400)
        order = self.request("GET", path).json()
        self.assertEqual([f["required_parts"] for f in order["inspections"]], [second, first])
        self.assertEqual({m["inspection_id"] for m in order["media"]}, set(finding_ids))
        for item in order["media"]:
            self.assertTrue(self.request("GET", "/api/files/" + Path(item["stored_path"]).name).content)
        for part in (first, second):
            self.request("POST", path + "/estimate-items", json={"description": part, "qty": 2, "unit_price": 42.5})
        approved = self.request("POST", path + "/approve").json()
        self.assertEqual(approved["estimate_total"], 170)
        self.assertTrue(all(item["approved"] for item in approved["estimate_items"]))
        self.request("PATCH", path + "/status", json={"status": "in_progress"})
        with patch.object(main, "now_iso", return_value="2026-09-05T12:00:00Z"):
            self.request("PATCH", path + "/status", json={"status": "complete"})
        invoice = b"%PDF-1.4\n% Fictional invoice fixture\n%%EOF"
        with patch.object(main, "now_iso", return_value="2026-09-05T13:00:00Z"):
            self.request("POST", path + "/upload", data={"kind": "invoice"}, files={"file": ("invoice.pdf", invoice, "application/pdf")})
            self.assertEqual(self.request("POST", path + "/paid").json()["status"], "paid")
        customer = self.request("GET", "/api/customer/orders/" + ticket["access_code"].lower()).json()
        self.assertEqual(len(customer["inspections"]), 2)
        self.assertEqual(self.request("GET", "/api/files/" + Path(customer["invoice_path"]).name).content, invoice)
        for params in ({"plate": plate.lower()}, {"vin": vin.lower()}):
            visit = self.request("GET", "/api/history", params=params).json()["visits"][0]
            self.assertEqual(len(visit["inspections"]), 2)
            self.assertEqual(len(visit["media"]), 3)
            self.assertEqual(visit["ready_at"], "2026-09-05T12:00:00Z")
            self.assertEqual(visit["mileage"], payload["mileage"])
            self.assertEqual(len(visit["work_done"]), 2)
        self.assertEqual(self.request("GET", f"/api/plate/NY/{plate.lower()}").json()["vin"], vin)
        # A return visit must retain the previous visit's mileage and findings.
        payload["mileage"] = str(int(payload["mileage"]) + 1000)
        self.request("POST", "/api/intake", json=payload)
        self.assertEqual(len(self.request("GET", "/api/history", params={"vin": vin}).json()["visits"]), 2)
        self.request("GET", "/api/history", params={"plate": "UNKNOWN"}, expected=404)
        self.request("GET", "/api/history", expected=400)
        self.request("GET", "/api/orders/999999", expected=404)
        self.request("GET", "/api/vin/SHORT", expected=400)
        with patch.object(main, "urlopen", return_value=BytesIO(b'{"Results":[{"ModelYear":"2020","Make":"TEST","Model":"VAN"}]}')):
            self.assertEqual(self.request("GET", f"/api/vin/{vin}").json()["year"], "2020")
        with patch.object(main, "urlopen", side_effect=TimeoutError):
            self.request("GET", f"/api/vin/{vin}", expected=502)


for number in range(len(CASES)):
    setattr(WorkflowTest, f"test_case_{number + 1:02}", lambda self, index=number: self.run_case(index))

if __name__ == "__main__":
    unittest.main(verbosity=2)
