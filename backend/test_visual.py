import json
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from backend import test_shop_v2
from backend.app import main, access, visual


class VisualTest(unittest.TestCase):
    setUp = test_shop_v2.ShopV2Test.setUp
    request = test_shop_v2.ShopV2Test.request
    current = test_shop_v2.ShopV2Test.current
    change = test_shop_v2.ShopV2Test.change

    def selection(self, part=1, action='Replace'):
        return json.dumps({'part_id':part,'location':'Left front','quantity':2,'action':action})

    def test_catalog_assets(self):
        root=Path(__file__).resolve().parents[1]
        frontend=json.loads((root/'src/parts-catalog.json').read_text())
        self.assertEqual(len(frontend),100)
        self.assertEqual(frontend,list(visual.CATALOG.values()))
        self.assertEqual(len({p['name'] for p in frontend}),100)
        for p in frontend:
            with Image.open(root/'public/parts'/p['file']) as image:
                image.verify()

    def test_ten_visual_cases_retry_history_and_approval(self):
        for i in range(10):
            data={'visual_selection':self.selection(i*10+1),'request_key':f'visual-case-{i:08}'}
            r=self.client.post(self.path+'/findings',data=data)
            self.assertEqual(r.status_code,200,r.text)
            self.assertEqual(self.client.post(self.path+'/findings',data=data).status_code,200)
        order=self.current()
        self.assertEqual(len(order['inspections']),10)
        self.assertTrue(all(f['visual_selection'] for f in order['inspections']))
        self.assertFalse(order['estimate_items'])
        self.assertEqual(self.client.patch(self.path+'/status',json={'status':'in_progress'}).status_code,409)
        self.change('/lines',{'description':'Replace left front caliper','kind':'part','qty':2,'unit_price':80,'part_id':1,'part_location':'Left front'})
        line=self.order['estimate_items'][0]
        self.assertEqual(line['part_id'],1)
        self.change('/decisions',{'item_ids':[line['id']],'decision':'approved','customer_name':'QA','method':'in_person','note':'Customer agreed to selected work.'})
        self.change('/status',{'status':'in_progress'},'PATCH')
        self.change('/lines/'+str(line['id']),{'description':'Revised quantity','kind':'part','qty':3,'unit_price':80,'part_id':1,'part_location':'Left front'},'PUT')
        self.assertEqual(self.order['estimate_items'][0]['decision'],'pending')
        history=self.client.get('/api/history',params={'plate':'QA2026'}).json()
        self.assertEqual(len(history['visits'][0]['inspections']),10)
        self.assertEqual(self.client.post(self.path+'/findings',data={'visual_selection':self.selection(2),'request_key':'visual-case-00000000'}).status_code,409)

    def test_validation_and_signed_video(self):
        for selection in [self.selection(101),self.selection(1,'Approve'),'{bad',json.dumps({'part_id':1,'quantity':0})]:
            self.assertEqual(self.client.post(self.path+'/findings',data={'visual_selection':selection,'request_key':'visual-invalid-001'}).status_code,422)
        invalid=self.client.post(self.path+'/findings',data={'request_key':'visual-video-bad1'},files={'videos':('bad.mp4',b'not a movie','video/mp4')})
        self.assertEqual(invalid.status_code,422)
        self.assertFalse(list(main.UPLOAD_DIR.iterdir()))
        # Container header fixture validates accepted format; browser QA uses actual image files.
        data=b'\x00\x00\x00\x20ftypisom'+b'\x00'*24
        r=self.client.post(self.path+'/findings',data={'request_key':'visual-video-good'},files={'videos':('message.mp4',data,'video/mp4')})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(r.json()['media'][0]['kind'],'asl_video')
        self.assertIn('interpretation required',r.json()['inspections'][0]['notes'])

    def test_office_instructions_role_retry_and_attachments(self):
        buffer=BytesIO();Image.new('RGB',(10,10),'red').save(buffer,format='PNG')
        data={'selection':self.selection(52,'Inspect further'),'request_key':'office-picture-0001'}
        files={'photos':('concern.png',buffer.getvalue(),'image/png')}
        r=self.client.post(self.path+'/visual-instructions',data=data,files=files)
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.client.post(self.path+'/visual-instructions',data=data,files=files).status_code,200)
        self.assertEqual(len(self.current()['visual_instructions']),1)
        self.assertEqual(len(list(main.UPLOAD_DIR.iterdir())),1)
        self.assertEqual(self.current()['media'][0]['kind'],'instruction_photo')
        bad={**data,'selection':self.selection(52,'Replace'),'request_key':'office-repair-0001'}
        self.assertEqual(self.client.post(self.path+'/visual-instructions',data=bad).status_code,422)
        self.assertEqual(self.client.post(self.path+'/visual-instructions',data=data,files={'videos':('asl.mp4',b'header','video/mp4')}).status_code,422)
        self.client.cookies.set('mvac_session','test')
        with patch.object(access,'PRODUCTION',True), patch.object(access,'urlopen',side_effect=lambda *a,**k:BytesIO(b'{"id":42,"name":"QA Mechanic","role":"SHOP_MECHANIC"}')):
            r=self.client.post(self.path+'/visual-instructions',headers={'Origin':access.SHOP_ORIGIN,'X-Shop-Request':'1'},data=data)
            self.assertEqual(r.status_code,403)

    def test_closed_instruction_and_finding_rejected(self):
        with main.db() as conn:
            conn.execute("UPDATE repair_orders SET work_state='complete' WHERE id=?",(self.order['id'],))
        self.assertEqual(self.client.post(self.path+'/findings',data={'visual_selection':self.selection(),'request_key':'closed-visual-0001'}).status_code,409)
        self.assertEqual(self.client.post(self.path+'/visual-instructions',data={'selection':self.selection(1,'Inspect further'),'request_key':'closed-office-0001'}).status_code,409)
