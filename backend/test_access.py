from io import BytesIO
import unittest
from unittest.mock import patch
from backend.app import access, main
from backend import test_workflow


class ProductionAccessTest(unittest.TestCase):
    def setUp(self):
        test_workflow.WorkflowTest.setUp(self)
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
        with main.db() as conn:
            conn.execute("INSERT INTO shop_members VALUES ('2', 'SHOP_MECHANIC', '1', '2026-09-08')")
        with patch.object(access, "urlopen", side_effect=lambda *a, **k: BytesIO(b'{"id":2,"role":"SHOP_MECHANIC"}')):
            self.assertEqual(self.client.get('/api/reports/income').status_code, 403)
            self.assertEqual(self.client.get("/api/orders/999999").status_code, 404)
            self.assertEqual(self.client.post("/api/orders/999999/paid").status_code, 403)
            self.assertEqual(self.client.post("/api/orders/999999/paid", headers={"Origin": access.SHOP_ORIGIN, "X-Shop-Request": "1"}).status_code, 403)
        with patch.object(access, "urlopen", side_effect=lambda *a, **k: BytesIO(b'{"id":1,"role":"ADMIN"}')):
            self.assertEqual(self.client.get('/api/reports/income').status_code, 200)
            self.assertEqual(self.client.post("/api/orders/999999/paid", headers={"Origin": "https://untrusted.example", "X-Shop-Request": "1"}).status_code, 403)
            self.assertEqual(self.client.post("/api/orders/999999/paid", headers={"Origin": access.SHOP_ORIGIN, "X-Shop-Request": "1"}).status_code, 404)

    def test_fleet_roles_are_authoritative_and_legacy_assignments_cannot_grant_access(self):
        self.client.cookies.set('mvac_session', 'fictional')
        headers = {'Origin': access.SHOP_ORIGIN, 'X-Shop-Request': '1'}
        identity = {'id': 2, 'role': 'TECHNICIAN'}
        with main.db() as conn:
            conn.execute("INSERT INTO shop_members VALUES ('2', 'SHOP_OFFICE', '1', '2026-09-08')")
        import json
        with patch.object(access, 'urlopen', side_effect=lambda *a, **k: BytesIO(json.dumps(identity).encode())):
            self.assertEqual(self.client.get('/api/session').json()['role'], None)
            self.assertEqual(self.client.get('/api/orders').status_code, 403)
            identity.update(role='SHOP_MECHANIC')
            self.assertEqual(self.client.get('/api/session').json()['role'], 'SHOP_MECHANIC')
            self.assertEqual(self.client.get('/api/orders').status_code, 200)
            for path in ('/api/intake', '/api/orders/1/approve', '/api/orders/1/paid', '/api/orders/1/estimate-items'):
                self.assertEqual(self.client.post(path, headers=headers, json={}).status_code, 403)
            self.assertEqual(self.client.put('/api/shop-members/2', headers=headers, json={'role': 'SHOP_OFFICE'}).status_code, 404)
            self.assertEqual(self.client.post('/api/orders/1/upload', headers=headers, data={'kind': 'invoice'}, files={'file': ('invoice.pdf', b'test')}).status_code, 403)
            self.assertEqual(self.client.patch('/api/orders/1/status', headers=headers, json={'status': 'paid'}).status_code, 422)
            self.assertEqual(self.client.post('/api/orders/1/inspection', headers=headers, json={'status': 'approved'}).status_code, 422)
            identity.update(role='SHOP_OFFICE')
            self.assertEqual(self.client.get('/api/reports/income').status_code, 200)
            self.assertEqual(self.client.get('/api/shop-members').status_code, 404)
            self.assertEqual(self.client.post('/api/orders/9999/paid', headers=headers).status_code, 404)
            identity.update(role='TECHNICIAN')
            self.assertEqual(self.client.get('/api/orders').status_code, 403)
