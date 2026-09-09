"""Verified local recovery archives. Offsite storage remains an operator responsibility."""
import hashlib
from contextlib import closing
import json
import logging
from pathlib import Path
import sqlite3
import shutil
import tempfile
import threading
import zipfile
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

router = APIRouter()
stop = threading.Event()
lock = threading.Lock()


def service():
    from backend.app import main
    return main


def folder():
    path = service().DATA_DIR / 'backups'
    path.mkdir(parents=True, exist_ok=True)
    return path


def verify(path):
    with zipfile.ZipFile(path) as archive:
        manifest = json.loads(archive.read('manifest.json'))
        for name, digest in manifest.items():
            if hashlib.sha256(archive.read(name)).hexdigest() != digest:
                raise ValueError('Backup checksum mismatch')
        with tempfile.TemporaryDirectory(dir=path.parent) as directory:
            database = Path(directory) / 'restore-check.sqlite3'
            database.write_bytes(archive.read('shop.sqlite3'))
            with closing(sqlite3.connect(database)) as conn:
                if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('Backup database integrity check failed')
                for (stored,) in conn.execute('SELECT stored_path FROM media'):
                    if stored not in manifest:
                        raise ValueError('Backup attachment missing')
    return True


def create_backup():
    main = service()
    with lock, tempfile.TemporaryDirectory(dir=folder()) as directory:
        snapshot = Path(directory) / 'shop.sqlite3'
        output = folder() / f"shop-{main.now_iso().replace(':','')}-{uuid4().hex[:8]}.zip"
        partial = output.with_suffix('.partial')
        # Block shop writes while copying the DB and its immutable uploaded files.
        with main.db() as writer:
            writer.execute('BEGIN IMMEDIATE')
            with closing(sqlite3.connect(main.DB_PATH)) as source, closing(sqlite3.connect(snapshot)) as target:
                source.backup(target)
            files = [('shop.sqlite3', snapshot)]
            for row in writer.execute('SELECT stored_path FROM media'):
                stored = row['stored_path']
                path = (main.DATA_DIR / stored).resolve()
                if not path.is_relative_to(main.UPLOAD_DIR.resolve()) or not path.is_file():
                    raise ValueError('An uploaded file is missing or outside upload storage')
                files.append((stored, path))
            required = sum(path.stat().st_size for _, path in files) * 2 + 1024 ** 3
            if shutil.disk_usage(folder()).free < required:
                raise ValueError('Insufficient disk space to create and verify an archive safely')
            manifest = {}
            with zipfile.ZipFile(partial, 'w', zipfile.ZIP_DEFLATED) as archive:
                for name, path in dict(files).items():
                    archive.write(path, name)
                    manifest[name] = hashlib.sha256(path.read_bytes()).hexdigest()
                archive.writestr('manifest.json', json.dumps(manifest))
        try:
            verify(partial)
            partial.replace(output)
        finally:
            partial.unlink(missing_ok=True)
        return output


def admin(request):
    if request.state.shop['role'] != 'SHOP_ADMIN':
        raise HTTPException(403, 'Administrator access is required for backups.')


@router.get('/api/backups')
def list_backups(request: Request):
    admin(request)
    return [{'name': p.name, 'size': p.stat().st_size} for p in sorted(folder().glob('shop-*.zip'), reverse=True)]


@router.post('/api/backups')
def backup_now(request: Request):
    admin(request)
    try:
        return {'name': create_backup().name}
    except (OSError, ValueError, sqlite3.Error) as exc:
        logging.exception('Shop backup failed')
        raise HTTPException(503, 'Backup failed. Check storage and attachment integrity before retrying.') from exc


@router.get('/api/backups/{name}')
def download_backup(name: str, request: Request):
    admin(request)
    if Path(name).name != name or not name.startswith('shop-') or not name.endswith('.zip'):
        raise HTTPException(404, 'Backup not found')
    path = folder() / name
    if not path.is_file():
        raise HTTPException(404, 'Backup not found')
    return FileResponse(path, filename=name, content_disposition_type='attachment')


def start():
    stop.clear()
    def run():
        while not stop.is_set():
            try:
                archives = list(folder().glob('shop-*.zip'))
                import time
                if not archives or time.time() - max(p.stat().st_mtime for p in archives) > 86400:
                    create_backup()
            except Exception:
                logging.exception('Scheduled shop backup failed; will retry in one hour')
            stop.wait(3600)
    threading.Thread(target=run, name='shop-backup', daemon=True).start()
