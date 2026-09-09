import base64
import io
import json
import unittest
from unittest.mock import patch
from PIL import Image, ImageDraw
from backend import test_shop_v2
from backend.app import main, checkin, access, backups


class CheckInTest(unittest.TestCase):
    setUp = test_shop_v2.ShopV2Test.setUp
    request = test_shop_v2.ShopV2Test.request

    def png(self, ink=True):
        image=Image.new('RGB',(600,160),'white')
        if ink: ImageDraw.Draw(image).line([(30,90),(90,30),(150,110),(250,40),(400,100)],fill='black',width=4)
        output=io.BytesIO();image.save(output,format='PNG');return output.getvalue()

    def data(self):
        return dict(customer_name='Fictional Customer',phone='2025550100',plate='CHECKINQA',vin='TESTVIN0000000042',
                    concern='Brake noise & coolant loss',requested_services=['Diagnostic'],diagnostic_fee=130,
                    authorization_name='Fictional Customer',terms_version=checkin.VERSION,accepted=True)

    def submit(self,key='checkin-request-0001',data=None,signature=None,files=None,metadata=None):
        return self.client.post('/api/check-in',data={'payload':json.dumps(data or self.data()),'signature':signature or 'data:image/png;base64,'+base64.b64encode(self.png()).decode(),
            'metadata':json.dumps(metadata if metadata is not None else [dict(kind='arrival',area='front',caption='Existing scratch'),dict(kind='concern',area='other',caption='Coolant leak')]),'request_key':key},
            files=files or [('photos',('arrival.png',self.png(),'image/png')),('photos',('concern.png',self.png(),'image/png'))])

    def test_ten_signed_records_and_safe_retries(self):
        for index in range(10):
            with self.subTest(index=index):
                key=f'checkin-fixture-{index:04}'
                response=self.submit(key)
                self.assertEqual(response.status_code,200,response.text)
                order_id=response.json()['id']
                self.assertEqual(self.submit(key).json()['id'],order_id)
                order=self.client.get(f'/api/orders/{order_id}').json()
                self.assertEqual(len(order['media']),4)
                self.assertEqual({m['kind'] for m in order['media']},{'arrival','concern','signature','authorization'})
                snapshot=json.loads(order['authorization']['snapshot'])
                self.assertEqual(snapshot['terms'],checkin.TERMS)
                self.assertEqual(snapshot['diagnostic_fee'],130)
                path=order['authorization']['pdf_path'].split('/')[-1]
                pdf=self.client.get('/api/files/'+path+'?download=true')
                self.assertTrue(pdf.content.startswith(b'%PDF'))
                self.assertIn('attachment',pdf.headers['content-disposition'])
                with main.db() as conn:
                    conn.execute('UPDATE repair_orders SET concern=? WHERE id=?',('Later change',order_id))
                self.assertEqual(self.client.get('/api/files/'+path).content,pdf.content)
                self.assertEqual(json.loads(self.client.get(f'/api/orders/{order_id}').json()['authorization']['snapshot'])['concern'],'Brake noise & coolant loss')
        self.assertEqual(len(list(main.UPLOAD_DIR.iterdir())),40)
        history=self.client.get('/api/history?plate=CHECKINQA').json()
        self.assertTrue(all(v['authorization'] for v in history['visits']))
        self.assertTrue(backups.verify(backups.create_backup()))

    def test_incomplete_or_modified_authorization_rejected(self):
        for change in ({'accepted':False},{'terms_version':'obsolete'},{'diagnostic_fee':-1},{'authorization_name':' '}):
            response=self.submit(data={**self.data(),**change})
            self.assertEqual(response.status_code,422,response.text)
        blank='data:image/png;base64,'+base64.b64encode(self.png(False)).decode()
        self.assertEqual(self.submit(signature=blank).status_code,422)
        self.assertEqual(self.submit().status_code,200)
        self.assertEqual(self.submit(data={**self.data(),'concern':'Different concern'}).status_code,409)

    def test_photo_or_pdf_failure_leaves_no_partial_visit(self):
        response=self.submit(files=[('photos',('good.png',self.png(),'image/png')),('photos',('bad.png',b'broken','image/png'))])
        self.assertEqual(response.status_code,422)
        self.assertFalse(list(main.UPLOAD_DIR.iterdir()))
        with patch.object(checkin,'make_pdf',side_effect=OSError('disk test')):
            with self.assertRaises(OSError): self.submit()
        with main.db() as conn:
            self.assertEqual(conn.execute('SELECT COUNT(*) FROM shop_authorizations').fetchone()[0],0)
        self.assertFalse(list(main.UPLOAD_DIR.iterdir()))

    def test_mechanic_cannot_record_signature(self):
        self.client.cookies.set('mvac_session','fictional')
        self.client.headers.update({'Origin':access.SHOP_ORIGIN,'X-Shop-Request':'1'})
        with patch.object(access,'PRODUCTION',True),patch.object(access,'urlopen',side_effect=lambda *a,**k:io.BytesIO(b'{"id":2,"role":"SHOP_MECHANIC"}')):
            self.assertEqual(self.submit().status_code,403)
        with patch.object(access,'PRODUCTION',True),patch.object(access,'urlopen',side_effect=lambda *a,**k:io.BytesIO(b'{"id":3,"name":"QA Office","role":"SHOP_OFFICE"}')):
            response=self.submit()
            self.assertEqual(response.status_code,200,response.text)
            snapshot=self.client.get(f"/api/orders/{response.json()['id']}").json()['authorization']['snapshot']
            self.assertEqual(json.loads(snapshot)['staff_name'],'QA Office')
