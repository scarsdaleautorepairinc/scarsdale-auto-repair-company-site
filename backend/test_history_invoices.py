import unittest
from pathlib import Path
from urllib.parse import unquote
from backend import test_workflow


class HistoryInvoiceTest(unittest.TestCase):
    def setUp(self):
        test_workflow.WorkflowTest.setUp(self)

    def test_history_invoices_belong_to_each_visit_and_download_with_original_names(self):
        ids = []
        for i in range(2):
            response = self.client.post('/api/intake', json={
                'customer_name': 'Invoice Test', 'phone': 'test', 'concern': 'Test',
                'authorization_name': 'Test', 'plate': 'TEST001', 'vin': 'TESTVIN0000000001',
            })
            ids.append(response.json()['id'])
        for filename in ('Repair invoice.pdf', 'Repair invoice revised.pdf'):
            body = b'%PDF-1.4\n' + filename.encode()
            result = self.client.post(f'/api/orders/{ids[0]}/upload', data={'kind': 'invoice'}, files={'file': (filename, body, 'application/pdf')})
            self.assertEqual(result.status_code, 200)
        for search in ({'plate': 'TEST001'}, {'vin': 'TESTVIN0000000001'}):
            history = self.client.get('/api/history', params=search).json()
            original = next(visit for visit in history['visits'] if visit['id'] == ids[0])
            other = next(visit for visit in history['visits'] if visit['id'] == ids[1])
            invoices = [item for item in original['media'] if item['kind'] == 'invoice']
            self.assertEqual(len(invoices), 2)
            self.assertEqual(other['media'], [])
            for invoice in invoices:
                url = '/api/files/' + Path(invoice['stored_path']).name
                inline = self.client.get(url)
                downloaded = self.client.get(url + '?download=true')
                self.assertEqual(downloaded.status_code, 200)
                self.assertEqual(inline.content, downloaded.content)
                self.assertIn('attachment;', downloaded.headers['content-disposition'])
                self.assertIn(invoice['original_name'], unquote(downloaded.headers['content-disposition']))
                self.assertEqual(downloaded.headers['content-type'], 'application/pdf')
        self.assertEqual(self.client.get('/api/files/missing.pdf?download=true').status_code, 404)
