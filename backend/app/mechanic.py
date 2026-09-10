"""Atomically publish a technician finding and its photos, with retry protection."""
import hashlib
import json
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from backend.app import workflow, visual

router = APIRouter()


@router.post('/api/orders/{order_id}/findings')
def submit_finding(order_id: int, request: Request,
                   notes: str = Form('', max_length=10000),
                   required_parts: str = Form('', max_length=5000),
                   labor_notes: str = Form('', max_length=5000),
                   request_key: str = Form(..., min_length=16, max_length=100),
                   photos: list[UploadFile] = File(default=[]),
                   visual_selection: str = Form('', max_length=2000),
                   videos: list[UploadFile] = File(default=[])):
    main = workflow.service()
    selection = visual.parse_selection(visual_selection) if visual_selection else None
    if selection:
        notes = visual.describe(selection) + ('\n'+notes.strip() if notes.strip() else '')
        required_parts = visual.CATALOG[selection.part_id]['name'] if selection.part_id else 'Part not listed'
        labor_notes = selection.action
    if not notes.strip() and not videos:
        raise HTTPException(422, 'Describe the concern before sending.')
    if len(photos) > 10 or len(videos) > 1:
        raise HTTPException(422, 'Attach up to 10 photos per finding.')
    prepared, committed = [], False
    digest = hashlib.sha256(json.dumps([notes, required_parts, labor_notes]).encode())
    if selection:
        digest.update(selection.model_dump_json().encode())
    total = 0
    try:
        for photo in photos + videos:
            is_video = photo in videos
            suffix = Path(photo.filename or '').suffix.lower()
            if suffix not in (('.mp4', '.webm') if is_video else ('.jpg', '.jpeg', '.png', '.webp', '.gif')):
                raise HTTPException(422, 'Use JPG, PNG, WebP, or GIF photos.')
            name = f'{order_id}-photo-{uuid4().hex}{suffix}'
            path = main.UPLOAD_DIR / name
            prepared.append((path, photo.filename, 'asl_video' if is_video else 'photo'))
            digest.update((photo.filename or '').encode())
            size = 0
            with path.open('wb') as output:
                while chunk := photo.file.read(1024 * 1024):
                    size += len(chunk)
                    total += len(chunk)
                    if size > 20 * 1024 * 1024 or total > 24 * 1024 * 1024:
                        raise HTTPException(413, 'Limit each photo to 20 MB and the submission to 24 MB.')
                    digest.update(chunk)
                    output.write(chunk)
            if not size:
                raise HTTPException(422, 'An attached photo is empty.')
            if is_video:
                with path.open('rb') as stored:
                    detected = visual.video_suffix(stored.read(4096))
                if detected != suffix:
                    raise HTTPException(422, 'Video format does not match its extension.')
        signature = digest.hexdigest()
        user = workflow.actor(request)
        with main.db() as conn:
            conn.execute('BEGIN IMMEDIATE')
            order = main.fetch_order(conn, order_id)
            prior = conn.execute('SELECT * FROM shop_finding_submissions WHERE request_key=?', (request_key,)).fetchone()
            if prior:
                if prior['order_id'] != order_id or prior['actor'] != user['id'] or prior['signature'] != signature:
                    raise HTTPException(409, 'This submission key belongs to a different finding.')
                return order
            if order['work_state'] == 'complete' or order.get('paid_at'):
                raise HTTPException(409, 'This visit is closed for findings. Create a new visit for additional work.')
            stamp = main.now_iso()
            finding = conn.execute('INSERT INTO inspections (repair_order_id,technician,notes,required_parts,labor_notes,created_at) VALUES (?,?,?,?,?,?)',
                                   (order_id, user.get('name', ''), notes.strip() or 'ASL message attached; interpretation required.', required_parts.strip(), labor_notes.strip(), stamp)).lastrowid
            if selection:
                conn.execute('UPDATE inspections SET visual_selection=? WHERE id=?',(selection.model_dump_json(),finding))
            workflow.record(conn, order_id, 'Finding added', {'finding_id': finding}, request)
            for path, original, kind in prepared:
                conn.execute('INSERT INTO media (repair_order_id,kind,original_name,stored_path,uploaded_at,inspection_id) VALUES (?,?,?,?,?,?)',
                             (order_id, kind, original, 'uploads/'+path.name, stamp, finding))
                workflow.record(conn, order_id, 'Photo uploaded', {'finding_id': finding, 'name': original}, request)
            state = 'inspection_complete' if order['work_state'] in ('authorized', 'needs_review') else order['work_state']
            conn.execute('UPDATE repair_orders SET work_state=? WHERE id=?', (state, order_id))
            conn.execute('INSERT INTO shop_finding_submissions VALUES (?,?,?,?)', (request_key, order_id, user['id'], signature))
            result = main.fetch_order(conn, order_id)
        committed = True
        return result
    finally:
        if not committed:
            for path, _, _ in prepared:
                path.unlink(missing_ok=True)
