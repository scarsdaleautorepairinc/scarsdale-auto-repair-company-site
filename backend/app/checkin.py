"""Signed intake snapshots and categorized arrival photos, isolated from Fleet."""
import base64
import hashlib
import io
import json
from decimal import Decimal
from pathlib import Path
from uuid import uuid4
from xml.sax.saxutils import escape
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from PIL import Image, ImageChops, UnidentifiedImageError
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as PDFImage, KeepTogether
from backend.app import workflow

router = APIRouter()
VERSION = 'inspection-v1'
TERMS = ('I authorize inspection and diagnosis of the vehicle concerns and requested areas listed in this record. '
         'I acknowledge the diagnostic fee shown in this record. Repairs and any additional charges require my separate approval. '
         'My signature applies to this check-in record, not to future changes or additional repairs.')
AREAS = {'front', 'rear', 'left', 'right', 'dashboard', 'existing_damage', 'other'}


@router.get('/api/intake-terms')
def terms():
    return {'version': VERSION, 'text': TERMS}


def normalized_image(data, signature=False):
    try:
        with Image.open(io.BytesIO(data)) as image:
            limit = 2000000 if signature else 40000000
            if image.width * image.height > limit or image.width < 2 or image.height < 2:
                raise ValueError('Image dimensions are not supported')
            image.load()
            if signature:
                background = Image.new('RGB', image.size, 'white')
                if image.mode == 'RGBA':
                    background.paste(image, mask=image.getchannel('A'))
                else:
                    background.paste(image.convert('RGB'))
                difference = ImageChops.difference(background, Image.new('RGB', image.size, 'white')).convert('L')
                if sum(difference.histogram()[32:]) < 30:
                    raise ValueError('Please provide a signature')
                output = io.BytesIO()
                background.save(output, format='PNG')
                return output.getvalue()
            if image.format not in ('JPEG', 'PNG', 'WEBP', 'GIF'):
                raise ValueError('Use JPG, PNG, WebP or GIF photos')
    except (OSError, ValueError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise HTTPException(422, str(exc)) from exc
    return data


def make_pdf(path, snapshot, signature_path, order_id):
    styles = getSampleStyleSheet()
    def p(text, style='BodyText'):
        return Paragraph(escape(str(text)).replace('\n', '<br/>'), styles[style])
    story = [p('Vehicle Check-In Authorization', 'Title'), p(f'Visit #{order_id}'), Spacer(1, 12)]
    for label, value in [('Customer', snapshot['customer_name']), ('Phone', snapshot['phone']),
                         ('Email', snapshot.get('email') or 'Not provided'), ('Address', snapshot.get('address') or 'Not provided'),
                         ('Vehicle', ' '.join(str(snapshot.get(k) or '') for k in ('year','make','model'))),
                         ('Plate / VIN', f"{snapshot.get('plate') or '-'} / {snapshot.get('vin') or '-'}"),
                         ('Plate state', snapshot.get('plate_state') or 'Not provided'),
                         ('Mileage', snapshot.get('mileage') or 'Not recorded'),
                         ('Customer concern', snapshot['concern']), ('Requested areas / services', ', '.join(snapshot['requested_services'])),
                         ('Diagnostic fee', f"${Decimal(str(snapshot['diagnostic_fee'])):.2f}")]:
        story.extend([p(label, 'Heading3'), p(value or 'Not provided')])
    story.extend([Spacer(1,12), p('Authorization', 'Heading2'), p(snapshot['terms'])])
    story.append(KeepTogether([p('Signed by: '+snapshot['authorization_name'], 'Heading3'),
                              PDFImage(str(signature_path), width=360, height=90, kind='proportional'),
                              p('Recorded at: '+snapshot['signed_at']), p('Recorded by: '+snapshot['staff_name']),
                              p('Authorization version: '+snapshot['terms_version'])]))
    if snapshot['photos']:
        story.extend([p('Check-In Photo Record', 'Heading2')])
        for index, photo in enumerate(snapshot['photos'], 1):
            story.append(p(f"{index}. {photo['kind']} / {photo['area']}: {photo['name']} - {photo['caption']}"))
    def footer(canvas, document):
        canvas.setFont('Helvetica', 9)
        canvas.drawString(42, 24, f'Visit #{order_id} | Saved authorization record | Page {document.page}')
    SimpleDocTemplate(str(path), leftMargin=42, rightMargin=42, topMargin=40, bottomMargin=44).build(story, onFirstPage=footer, onLaterPages=footer)


@router.post('/api/check-in')
def create_checkin(request: Request, payload: str = Form(..., max_length=50000),
                   signature: str = Form(..., max_length=1000000),
                   metadata: str = Form('[]', max_length=20000),
                   request_key: str = Form(..., min_length=16, max_length=100),
                   photos: list[UploadFile] = File(default=[])):
    workflow.office(request)
    main = workflow.service()
    try:
        raw = json.loads(payload)
        details = json.loads(metadata)
        fields = main.IntakePayload.model_validate(raw)
        if not isinstance(raw.get('plate_state',''),str) or len(raw.get('plate_state','')) > 30:
            raise ValueError('Enter a valid plate state.')
        if raw.get('terms_version') != VERSION or raw.get('accepted') is not True:
            raise ValueError('Review and accept the current authorization before signing.')
        for field in ('customer_name', 'phone', 'concern', 'authorization_name'):
            if not getattr(fields, field).strip():
                raise ValueError('Customer, phone, concern, and signer name are required.')
        fee = Decimal(str(fields.diagnostic_fee))
        if not fee.is_finite() or fee < 0 or fee > 100000 or fee.as_tuple().exponent < -2:
            raise ValueError('Enter a valid diagnostic fee.')
        if not isinstance(details, list) or len(details) != len(photos) or len(photos) > 10:
            raise ValueError('Provide photo details for up to 10 photos.')
        for detail in details:
            if detail.get('kind') not in ('arrival', 'concern') or detail.get('area') not in AREAS or len(detail.get('caption','')) > 500:
                raise ValueError('Choose a valid photo category, area, and caption.')
        if not signature.startswith('data:image/png;base64,'):
            raise ValueError('A customer signature is required.')
        signed_image = normalized_image(base64.b64decode(signature.split(',',1)[1], validate=True), True)
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(422, str(exc)) from exc
    user = workflow.actor(request)
    fingerprint = hashlib.sha256(json.dumps([raw, details, signature], sort_keys=True).encode())
    prepared, saved = [], False
    photo_records = []
    total = 0
    try:
        for photo, detail in zip(photos, details):
            data = photo.file.read(20*1024*1024+1)
            total += len(data)
            if len(data)>20*1024*1024 or total>24*1024*1024:
                raise HTTPException(413, 'Photos must be 20 MB each or smaller, 24 MB total.')
            normalized_image(data)
            with Image.open(io.BytesIO(data)) as decoded:
                suffix = {'JPEG':'.jpg','PNG':'.png','WEBP':'.webp','GIF':'.gif'}[decoded.format]
            name = 'checkin-'+uuid4().hex+suffix
            path = main.UPLOAD_DIR/name
            prepared.append(path)
            path.write_bytes(data)
            fingerprint.update(json.dumps([photo.filename, hashlib.sha256(data).hexdigest()]).encode())
            photo_records.append({**detail,'name':photo.filename or name,'path':'uploads/'+name})
        digest = fingerprint.hexdigest()
        with main.db() as conn:
            conn.execute('BEGIN IMMEDIATE')
            prior = conn.execute('SELECT * FROM shop_authorizations WHERE request_key=?',(request_key,)).fetchone()
            if prior:
                if prior['actor'] != user['id'] or prior['fingerprint'] != digest:
                    raise HTTPException(409, 'This request key belongs to a different check-in.')
                order = main.fetch_order(conn, prior['order_id'])
                return {'id':order['id'], 'access_code':order['access_code']}
            stamp, code = main.now_iso(), uuid4().hex[:8].upper()
            customer_id = conn.execute('INSERT INTO customers (name,phone,email,address,created_at) VALUES (?,?,?,?,?)',
                                       (fields.customer_name,fields.phone,fields.email,fields.address,stamp)).lastrowid
            vehicle_id = conn.execute('INSERT INTO vehicles (customer_id,plate,vin,year,make,model,mileage,created_at) VALUES (?,?,?,?,?,?,?,?)',
                                      (customer_id,fields.plate,fields.vin,fields.year,fields.make,fields.model,fields.mileage,stamp)).lastrowid
            order_id = conn.execute('INSERT INTO repair_orders (customer_id,vehicle_id,access_code,status,concern,requested_services,diagnostic_fee,authorization_name,authorized_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                                    (customer_id,vehicle_id,code,'authorized',fields.concern,','.join(fields.requested_services),float(fee),fields.authorization_name,stamp,stamp,stamp)).lastrowid
            snapshot = {**fields.model_dump(), 'plate_state':raw.get('plate_state',''), 'terms':TERMS, 'terms_version':VERSION, 'signed_at':stamp, 'staff_name':user.get('name',''), 'photos':photo_records}
            sign_path = main.UPLOAD_DIR/f'{order_id}-signature-{uuid4().hex}.png'
            pdf_path = main.UPLOAD_DIR/f'{order_id}-authorization-{uuid4().hex}.pdf'
            prepared.extend([sign_path,pdf_path])
            sign_path.write_bytes(signed_image)
            make_pdf(pdf_path,snapshot,sign_path,order_id)
            conn.execute('INSERT INTO shop_authorizations VALUES (?,?,?,?,?,?,?,?)',
                         (order_id,request_key,user['id'],json.dumps(snapshot),'uploads/'+sign_path.name,'uploads/'+pdf_path.name,stamp,digest))
            for record in photo_records + [dict(kind='signature',name='Customer signature.png',path='uploads/'+sign_path.name),dict(kind='authorization',name=f'Authorization-{order_id}.pdf',path='uploads/'+pdf_path.name)]:
                conn.execute('INSERT INTO media (repair_order_id,kind,original_name,stored_path,uploaded_at,caption,area) VALUES (?,?,?,?,?,?,?)',
                             (order_id,record['kind'],record['name'],record['path'],stamp,record.get('caption',''),record.get('area','')))
            workflow.record(conn,order_id,'Signed check-in recorded',{'terms_version':VERSION,'photo_count':len(photo_records),'authorized_by':fields.authorization_name},request)
        saved = True
        return {'id':order_id,'access_code':code}
    finally:
        if not saved:
            for path in prepared:
                path.unlink(missing_ok=True)
