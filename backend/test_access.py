from io import BytesIO
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app import access, main


class ProductionAccessTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)
        override = patch.object(access, "PRODUCTION", True)
        override.start()
        self.addCleanup(override.stop)

    def test_public_health_but_no_customer_or_file_access_without_login(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        for path in ("/api/orders", "/api/history?plate=TEST", "/api/files/test.pdf", "/api/customer/orders/TEST"):
            self.assertEqual(self.client.get(path).status_code, 401)
        self.assertEqual(self.client.delete("/api/dev/clear-data").status_code, 404)

    def test_external_user_and_auth_outage_fail_closed(self):
        self.client.cookies.set("mvac_session", "fictional")
        with patch.object(access, "urlopen", return_value=BytesIO(b'{"role":"DSP"}')):
            self.assertEqual(self.client.get("/api/orders").status_code, 403)
        with patch.object(access, "urlopen", side_effect=TimeoutError):
            self.assertEqual(self.client.get("/api/orders").status_code, 503)

    def test_staff_csrf_and_office_permissions(self):
        self.client.cookies.set("mvac_session", "fictional")
        with patch.object(access, "urlopen", side_effect=lambda *a, **k: BytesIO(b'{"role":"TECHNICIAN"}')):
            self.assertEqual(self.client.get("/api/orders/999999").status_code, 404)
            self.assertEqual(self.client.post("/api/orders/999999/paid").status_code, 403)
            self.assertEqual(self.client.post("/api/orders/999999/paid", headers={"Origin": access.SHOP_ORIGIN, "X-Shop-Request": "1"}).status_code, 403)
        with patch.object(access, "urlopen", side_effect=lambda *a, **k: BytesIO(b'{"role":"ADMIN"}')):
            self.assertEqual(self.client.post("/api/orders/999999/paid", headers={"Origin": "https://untrusted.example", "X-Shop-Request": "1"}).status_code, 403)
            self.assertEqual(self.client.post("/api/orders/999999/paid", headers={"Origin": access.SHOP_ORIGIN, "X-Shop-Request": "1"}).status_code, 404)
