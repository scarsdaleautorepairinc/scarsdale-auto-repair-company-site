"""Modern workflow fixtures run entirely in disposable database/upload storage."""
import json
from io import BytesIO
from pathlib import Path
import sqlite3
import unittest
from unittest.mock import patch
import zipfile

from backend.app import main, backups, access
from backend import test_workflow
from backend.test_workflow import CASES


class ShopV2Test(unittest.TestCase):
    request = test_workflow.WorkflowTest.request

    def setUp(self):
        test_workflow.WorkflowTest.setUp(self)
        root = Path(self.temp.name)
        (root / 'uploads').mkdir()
        for override in (patch.object(main, 'DATA_DIR', root), patch.object(main, 'UPLOAD_DIR', root / 'uploads')):
            override.start()
            self.addCleanup(override.stop)
        self.order = self.request('POST', '/api/intake', json={
            'customer_name': 'Fictional V2 Customer', 'phone': '2025550100',
            'plate': 'QA2026', 'vin': 'TESTVIN0000000001', 'mileage': '42000',
            'concern': 'Fictional inspection', 'authorization_name': 'Test Customer',
            'requested_services': ['Diagnostic'], 'diagnostic_fee': 0,
        }).json()
        self.path = f"/api/orders/{self.order['id']}"

    def current(self):
        self.order = self.request('GET', self.path).json()
        return self.order

    def change(self, suffix, data=None, method='POST', expected=200):
        response = self.request(method, self.path + suffix, expected=expected,
                                json={'revision': self.current()['revision'], **(data or {})})
        self.current()
        return response

    def line(self, description='Reservoir', kind='part', qty=1, price=100):
        self.change('/lines', {'description': description, 'kind': kind, 'qty': qty, 'unit_price': price})
        return self.order['estimate_items'][-1]['id']

    def approve(self, ids=None, decision='approved'):
        self.change('/decisions', {'item_ids': ids or [i['id'] for i in self.order['estimate_items']],
                                  'decision': decision, 'customer_name': 'Test Customer',
                                  'method': 'phone', 'note': 'Customer reviewed selected items and total.'})

    def invoice(self, amount):
        self.request('POST', self.path+'/upload', data={'kind': 'invoice'},
                     files={'file': ('invoice.pdf', b'%PDF-1.4\nFictional invoice\n%%EOF', 'application/pdf')})
        self.change('/invoice-total', {'amount': amount, 'note': 'Checked total against uploaded document.'}, 'PUT')

    def run_modern_case(self, index):
        _, first, second = CASES[index]
        self.request('GET', '/api/session')
        self.change('/assignment', {'assigned_to': 'local', 'promised_at': '2026-09-10T17:00:00-04:00'}, 'PUT')
        for part in (first, second):
            self.change('/inspection', {'notes': part+' requires attention', 'required_parts': part,
                                       'labor_notes': 'Replace and verify', 'urgency': 'urgent'})
            finding = self.order['inspections'][0]
            self.request('POST', self.path+'/upload', data={'kind': 'photo', 'inspection_id': finding['id']},
                         files={'file': ('finding.jpg', b'fictional image bytes', 'image/jpeg')})
        self.current()
        self.assertEqual(len(self.order['inspections']), 2)
        self.assertEqual(self.order['unread_updates'], 4)
        stale = self.order['revision']
        self.line(first, price=49.99, qty=2)
        self.request('POST', self.path+'/acknowledge', json={'revision': stale}, expected=409)
        self.change('/acknowledge')
        self.assertEqual(self.order['unread_updates'], 0)
        self.line(second, price=70)
        self.line('Installation labor', kind='labor', qty=1.5, price=120)
        self.assertEqual(self.order['proposed_cents'], 34998)
        self.change('/status', {'status': 'in_progress'}, 'PATCH', expected=409)
        self.approve()
        self.change('/status', {'status': 'waiting_parts'}, 'PATCH')
        self.change('/status', {'status': 'in_progress'}, 'PATCH')
        self.change('/status', {'status': 'complete'}, 'PATCH')
        self.invoice(349.98)
        revision = self.current()['revision']
        payment = {'revision': revision, 'amount': 100, 'method': 'cash', 'request_key': f'case-{index:02}-payment-0001'}
        with patch.object(main, 'now_iso', return_value='2026-09-08T14:00:00Z'):
            self.request('POST', self.path+'/payments', json=payment)
        self.request('POST', self.path+'/payments', json=payment)
        self.current()
        self.assertEqual(len(self.order['payments']), 1)
        self.assertEqual(self.order['payment_state'], 'partial')
        self.assertEqual(self.order['balance_cents'], 24998)
        self.change('/lines', {'description': 'Forbidden', 'kind': 'part', 'qty': 1, 'unit_price': 1}, expected=409)
        self.change('/payments', {'amount': 250, 'method': 'cash', 'request_key': f'case-{index:02}-overpay-0001'}, expected=409)
        with patch.object(main, 'now_iso', return_value='2026-09-09T14:00:00Z'):
            self.change('/payments', {'amount': 249.98, 'method': 'card', 'reference': 'Receipt QA', 'request_key': f'case-{index:02}-payment-0002'})
        self.assertEqual(self.order['payment_state'], 'paid')
        self.assertEqual(self.order['work_state'], 'complete')
        self.assertEqual(self.order['balance_cents'], 0)
        self.change('/status', {'status': 'in_progress'}, 'PATCH', expected=409)
        self.change('/inspection', {'notes': 'Closed visit'}, expected=409)
        self.request('POST', self.path+'/upload', data={'kind': 'invoice'}, files={'file': ('other.pdf', b'test')}, expected=409)
        for day, income in [('2026-09-08', 10000), ('2026-09-09', 24998)]:
            report = self.request('GET', '/api/reports/income', params={'period': 'day', 'on': day}).json()
            self.assertEqual(report['totals']['income_cents'], income)
            self.assertEqual(report['totals']['paid_tickets'], 1)
        report = self.request('GET', '/api/reports/income', params={'period': 'month', 'on': '2026-09-01'}).json()
        self.assertEqual(report['totals']['income_cents'], 34998)
        self.assertEqual(report['totals']['paid_tickets'], 1)
        for query in ({'plate': 'qa2026'}, {'vin': 'TESTVIN0000000001'}):
            history = self.request('GET', '/api/history', params=query).json()['visits'][0]
            self.assertEqual(history['invoice_total'], 349.98)
            self.assertEqual(len(history['work_done']), 3)
            for media in history['media']:
                response = self.request('GET', '/api/files/'+Path(media['stored_path']).name+'?download=true')
                self.assertIn('attachment', response.headers['content-disposition'])
        self.assertTrue(self.order['approvals'])
        self.assertGreater(len(self.order['activity']), 10)

    def test_revisions_invalidate_invoice_and_approval(self):
        item = self.line()
        self.approve()
        snapshot = self.order['approvals'][0]['snapshot']
        self.invoice(100)
        stale = self.order['revision']
        self.change(f'/lines/{item}', {'description': 'Revised reservoir', 'kind': 'part', 'qty': 1, 'unit_price': 110}, 'PUT')
        self.assertIsNone(self.order['invoice_total_cents'])
        self.assertEqual(self.order['pending_items'], 1)
        self.assertEqual(self.order['approvals'][0]['snapshot'], snapshot)
        self.request('DELETE', self.path+f'/lines/{item}', json={'revision': stale}, expected=409)
        self.change('/decisions', {'item_ids': [999999], 'decision': 'approved', 'customer_name': 'QA', 'method': 'phone', 'note': 'QA'}, expected=400)
        self.change(f'/lines/{item}', {}, 'DELETE')
        self.assertFalse(self.order['estimate_items'])

    def test_no_charge_and_declined_work(self):
        self.line()
        self.approve(decision='declined')
        self.change('/status', {'status': 'in_progress'}, 'PATCH', expected=409)
        self.change('/status', {'status': 'complete'}, 'PATCH')
        self.invoice(0)
        self.change('/close-no-charge')
        self.assertEqual(self.order['payment_state'], 'paid')
        self.assertEqual(self.order['received_cents'], 0)
        self.change('/lines', {'description': 'Late fee', 'kind': 'fee', 'qty': 1, 'unit_price': 1}, expected=409)

    def test_backup_restore_and_missing_file(self):
        self.line()
        self.approve()
        self.invoice(100)
        archive = backups.create_backup()
        self.assertTrue(backups.verify(archive))
        restore = Path(self.temp.name) / 'restored'
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(restore)
        conn = sqlite3.connect(restore/'shop.sqlite3')
        try:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM shop_approvals').fetchone()[0], 1)
            for (name,) in conn.execute('SELECT stored_path FROM media'):
                self.assertEqual((restore/name).read_bytes(), (main.DATA_DIR/name).read_bytes())
        finally:
            conn.close()
        media = self.order['media'][0]['stored_path']
        (main.DATA_DIR/media).unlink()
        with self.assertRaises(ValueError):
            backups.create_backup()

    def test_new_routes_require_real_roles_and_csrf(self):
        self.line()
        headers = {'Origin': access.SHOP_ORIGIN, 'X-Shop-Request': '1'}
        identity = {'id': 22, 'name': 'QA Mechanic', 'role': 'SHOP_MECHANIC'}
        self.client.cookies.set('mvac_session', 'fictional')
        with patch.object(access, 'PRODUCTION', True), patch.object(access, 'urlopen', side_effect=lambda *a, **k: BytesIO(json.dumps(identity).encode())):
            for endpoint, method, payload in [
                ('/lines', 'POST', {'description': 'Bad', 'kind': 'part', 'qty': 1, 'unit_price': 1}),
                ('/assignment', 'PUT', {}), ('/acknowledge', 'POST', {}),
                ('/invoice-total', 'PUT', {'amount': 1, 'note': 'QA'}),
                ('/payments', 'POST', {'amount': 1, 'method': 'cash', 'request_key': 'permission-test-key'}),
                ('/close-no-charge', 'POST', {}),
            ]:
                response = self.client.request(method, self.path+endpoint, headers=headers, json={'revision': self.order['revision'], **payload})
                self.assertEqual(response.status_code, 403, response.text)
            self.assertEqual(self.client.get('/api/backups').status_code, 403)
            identity['role'] = 'SHOP_OFFICE'
            self.assertEqual(self.client.get('/api/backups').status_code, 403)
            self.assertEqual(self.client.post(self.path+'/acknowledge', json={'revision': self.order['revision']}).status_code, 403)
            identity['role'] = 'ADMIN'
            self.assertEqual(self.client.get('/api/backups').status_code, 200)

    def test_concurrent_duplicate_payment_is_one_receipt(self):
        from concurrent.futures import ThreadPoolExecutor
        self.line()
        self.approve()
        self.change('/status', {'status': 'complete'}, 'PATCH')
        self.invoice(100)
        payload = {'revision': self.order['revision'], 'amount': 100, 'method': 'cash', 'request_key': 'concurrent-receipt-0001'}
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: self.client.post(self.path+'/payments', json=payload), range(2)))
        self.assertEqual([r.status_code for r in responses], [200, 200])
        self.assertEqual(len(self.current()['payments']), 1)
        self.assertEqual(self.order['received_cents'], 10000)


for number in range(10):
    setattr(ShopV2Test, f'test_modern_case_{number+1:02}', lambda self, index=number: self.run_modern_case(index))
