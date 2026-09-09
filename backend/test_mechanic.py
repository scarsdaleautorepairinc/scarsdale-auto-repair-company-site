import unittest
from io import BytesIO
from unittest.mock import patch
from backend import test_shop_v2
from backend.app import main, access


class MechanicTest(unittest.TestCase):
    setUp = test_shop_v2.ShopV2Test.setUp
    request = test_shop_v2.ShopV2Test.request
    current = test_shop_v2.ShopV2Test.current
    change = test_shop_v2.ShopV2Test.change

    def send(self, key='mechanic-finding-0001', notes='Reservoir leaking', files=None):
        return self.client.post(self.path+'/findings', data={'notes': notes, 'required_parts': 'Reservoir\nCoolant', 'request_key': key},
                                files=files or [('photos', ('part.jpg', b'photo bytes', 'image/jpeg'))])

    def test_atomic_retry_and_office_review(self):
        for index in range(10):
            key = f'mechanic-finding-{index:04}'
            photos = [('photos', (f'part-{i}.jpg', b'photo bytes', 'image/jpeg')) for i in range(2)]
            response = self.send(key, f'Fictional concern {index}', photos)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(self.send(key, f'Fictional concern {index}', photos).status_code, 200)
        order = self.current()
        self.assertEqual(len(order['inspections']), 10)
        self.assertEqual(len(order['media']), 20)
        self.assertEqual(len(list(main.UPLOAD_DIR.iterdir())), 20)
        self.assertTrue(all(not f['office_reviewed'] for f in order['inspections']))
        self.change('/acknowledge')
        self.assertTrue(all(f['office_reviewed'] for f in self.order['inspections']))
        self.assertEqual(self.send('mechanic-finding-0000', 'Changed text').status_code, 409)
        self.assertEqual(self.send('mechanic-new-finding').status_code, 200)
        self.assertFalse(self.current()['inspections'][0]['office_reviewed'])

    def test_bad_attachment_rolls_back_everything(self):
        response = self.send(files=[('photos', ('good.jpg', b'photo', 'image/jpeg')), ('photos', ('bad.svg', b'<svg/>', 'image/svg+xml'))])
        self.assertEqual(response.status_code, 422)
        self.assertFalse(self.current()['inspections'])
        self.assertFalse(list(main.UPLOAD_DIR.iterdir()))
        response = self.send(notes='   ')
        self.assertEqual(response.status_code, 422)

    def test_production_mechanic_identity_and_csrf(self):
        self.client.cookies.set('mvac_session','fictional')
        with patch.object(access,'PRODUCTION',True), patch.object(access,'urlopen',side_effect=lambda *a,**k:BytesIO(b'{"id":42,"name":"QA Mechanic","role":"SHOP_MECHANIC"}')):
            self.assertEqual(self.send().status_code,403)
            response=self.client.post(self.path+'/findings',headers={'Origin':access.SHOP_ORIGIN,'X-Shop-Request':'1'}, data={'notes':'Brake noise','request_key':'mechanic-identity-01'})
            self.assertEqual(response.status_code,200,response.text)
            self.assertEqual(response.json()['inspections'][0]['technician'],'QA Mechanic')
        with main.db() as conn:
            conn.execute("UPDATE repair_orders SET work_state='complete' WHERE id=?",(self.order['id'],))
        self.assertEqual(self.send().status_code,409)
        self.assertFalse(list(main.UPLOAD_DIR.iterdir()))
