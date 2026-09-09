import io
from contextlib import contextmanager
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException, UploadFile, Request
from backend.app import main


class FindingHistoryTest(unittest.TestCase):
    def test_findings_and_photos_survive_subsequent_updates(self):
        original_db = main.db

        @contextmanager
        def test_db():
            connection = original_db()
            try:
                with connection:
                    yield connection
            finally:
                connection.close()

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(main, "DB_PATH", root / "test.sqlite3"), patch.object(main, "UPLOAD_DIR", root), patch.object(main, "db", test_db):
                main.init_db()
                # Exercise upgrading an existing media table without losing old photos.
                with main.db() as conn:
                    conn.execute("ALTER TABLE media DROP COLUMN inspection_id")
                    conn.execute("INSERT INTO media (repair_order_id, kind, original_name, stored_path, uploaded_at) VALUES (1, 'photo', 'old.jpg', 'uploads/old.jpg', '2026-09-05T00:00:00Z')")
                main.init_db()
                main.init_db()
                ticket = main.create_intake(main.IntakePayload(
                    customer_name="Test", phone="test", concern="Inspection", authorization_name="Test"
                ))["id"]
                findings = []
                request = Request({'type': 'http', 'state': {'shop': {'id': 'test', 'name': 'Test Tech', 'role': 'SHOP_MECHANIC'}}})
                for part in ("Coolant reservoir", "Left caliper"):
                    order = main.add_inspection(ticket, main.InspectionPayload(
                        technician="Test Tech", notes=f"Replace {part}", required_parts=part, labor_notes=f"Install {part}"
                    ))
                    finding_id = order["inspections"][0]["id"]
                    findings.append(finding_id)
                    main.upload_file(ticket, request, "photo", UploadFile(filename=f"{part}.jpg", file=io.BytesIO(b"test")), finding_id)
                saved = main.get_order(ticket)
                self.assertEqual([i["required_parts"] for i in saved["inspections"]], ["Left caliper", "Coolant reservoir"])
                self.assertEqual({m["inspection_id"] for m in saved["media"]}, {None, *findings})
                self.assertEqual(len(saved["media"]), 3)
                other = main.create_intake(main.IntakePayload(
                    customer_name="Other", phone="test", concern="Inspection", authorization_name="Other"
                ))["id"]
                with self.assertRaises(HTTPException):
                    main.upload_file(other, request, "photo", UploadFile(filename="wrong.jpg", file=io.BytesIO(b"test")), findings[0])
                self.assertEqual(len(main.get_order(other)["media"]), 0)


if __name__ == "__main__":
    unittest.main()
