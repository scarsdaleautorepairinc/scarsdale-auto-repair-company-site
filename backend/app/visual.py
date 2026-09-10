"""Visual communication data; no diagnosis or sign-language translation is inferred."""
import hashlib
import json
from pathlib import Path
from typing import Literal
from uuid import uuid4
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from backend.app import workflow

router = APIRouter()
CATALOG = {p['id']: p for p in json.loads(Path(__file__).with_name('parts-catalog.json').read_text())}
Location = Literal['Not location specific', 'Left front', 'Right front', 'Left rear', 'Right rear', 'Front', 'Rear']


class Selection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    part_id: int | None = Field(default=None, ge=1, le=100)
    location: Location = 'Not location specific'
    quantity: int = Field(default=1, ge=1, le=100)
    action: Literal['Replace', 'Inspect further', 'No issue found', 'Need help'] = 'Inspect further'


def parse_selection(value):
    try:
        return Selection.model_validate_json(value)
    except ValueError as exc:
        raise HTTPException(422, 'Choose a valid part, location, quantity, and action.') from exc


def describe(selection):
    name = CATALOG[selection.part_id]['name'] if selection.part_id else 'Part not listed'
    return f'{name} | {selection.location} | Qty {selection.quantity} | {selection.action}'


def video_suffix(data):
    if len(data) > 16 and data[4:8] == b'ftyp':
        return '.mp4'
    if len(data) > 16 and data[:4] == b'\x1aE\xdf\xa3' and b'webm' in data[:4096]:
        return '.webm'
    raise HTTPException(422, 'Use an MP4 or WebM video.')


@router.post('/api/orders/{order_id}/visual-instructions')
def instruction(order_id: int, request: Request, selection: str = Form(..., max_length=2000),
                notes: str = Form('', max_length=5000), request_key: str = Form(..., min_length=16, max_length=100),
                asl_reviewed: bool = Form(False), photos: list[UploadFile] = File(default=[]),
                videos: list[UploadFile] = File(default=[])):
    workflow.office(request)
    chosen = parse_selection(selection)
    if chosen.action != 'Inspect further':
        raise HTTPException(422, 'Inspection instructions do not authorize repairs.')
    if len(photos)>5 or len(videos)>1 or (videos and not asl_reviewed):
        raise HTTPException(422, 'Use up to five photos and one reviewed ASL instruction video.')
    from backend.app.checkin import normalized_image
    from PIL import Image
    import io
    main = workflow.service()
    digest = hashlib.sha256(json.dumps([chosen.model_dump(), notes, asl_reviewed], sort_keys=True).encode())
    prepared, committed, total = [], False, 0
    user = workflow.actor(request)
    try:
        for upload, kind in [(p,'instruction_photo') for p in photos]+[(v,'asl_instruction') for v in videos]:
            data = upload.file.read(24*1024*1024+1)
            total += len(data)
            if total>24*1024*1024:
                raise HTTPException(413, 'Limit the submission to 24 MB.')
            if kind == 'asl_instruction':
                suffix = video_suffix(data)
            else:
                normalized_image(data)
                with Image.open(io.BytesIO(data)) as image:
                    suffix = {'JPEG':'.jpg','PNG':'.png','WEBP':'.webp','GIF':'.gif'}[image.format]
            path = main.UPLOAD_DIR/f'{order_id}-instruction-{uuid4().hex}{suffix}'
            prepared.append((path,upload.filename or path.name,kind))
            path.write_bytes(data)
            digest.update((upload.filename or '').encode()+data)
        with main.db() as conn:
            conn.execute('BEGIN IMMEDIATE')
            order = main.fetch_order(conn,order_id)
            prior = conn.execute('SELECT * FROM shop_visual_instructions WHERE request_key=?',(request_key,)).fetchone()
            if prior:
                if prior['order_id']!=order_id or prior['actor']!=user['id'] or prior['fingerprint']!=digest.hexdigest():
                    raise HTTPException(409,'This request key belongs to different instructions.')
                return order
            if order['work_state']=='complete' or order.get('paid_at'):
                raise HTTPException(409,'This visit is closed.')
            stamp=main.now_iso()
            identifier=conn.execute('INSERT INTO shop_visual_instructions (order_id,selection,notes,actor,actor_name,created_at,request_key,fingerprint,asl_reviewed) VALUES (?,?,?,?,?,?,?,?,?)',
                (order_id,chosen.model_dump_json(),notes,user['id'],user.get('name',''),stamp,request_key,digest.hexdigest(),int(asl_reviewed))).lastrowid
            for path,name,kind in prepared:
                conn.execute('INSERT INTO media (repair_order_id,kind,original_name,stored_path,uploaded_at,instruction_id) VALUES (?,?,?,?,?,?)', (order_id,kind,name,'uploads/'+path.name,stamp,identifier))
            workflow.record(conn,order_id,'Visual inspection assigned',{'instruction_id':identifier,'selection':chosen.model_dump(),'asl_reviewed':asl_reviewed},request)
            result=main.fetch_order(conn,order_id)
        committed=True
        return result
    finally:
        if not committed:
            for path,_,_ in prepared:
                path.unlink(missing_ok=True)
