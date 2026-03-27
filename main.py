from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import tempfile
import uuid
import datetime
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from scanner import parse_schedule_image, run_scan, format_results, extract_hymn_pages

app = FastAPI(title="Hymn Scanner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = Path(tempfile.gettempdir()) / "hymn_scanner_dev"
TEMP_DIR.mkdir(exist_ok=True, parents=True)

# Store uploaded pdfs mapping: file_id -> file_path
pdf_store: Dict[str, str] = {}

class ScanRequest(BaseModel):
    pdf_id: str
    user_input: str
    schedule_data: Any

class ExportRequest(BaseModel):
    pdf_id: str
    scan_results: Dict[str, Any]
    order: Optional[List[str]] = None

@app.post("/api/upload_pdf")
async def upload_pdf(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    file_path = TEMP_DIR / f"{file_id}_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(await file.read())
    pdf_store[file_id] = str(file_path)
    return {"file_id": file_id, "filename": file.filename}

from fastapi import Request
from collections import defaultdict
import time

parse_rate_limits = defaultdict(list)

def check_parse_rate_limit(ip: str):
    now = time.time()
    two_hours_ago = now - (2 * 60 * 60)
    
    # clean old entries
    parse_rate_limits[ip] = [ts for ts in parse_rate_limits[ip] if ts > two_hours_ago]
    
    if len(parse_rate_limits[ip]) >= 3:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Maximum 3 parses per 2 hours per IP.")
    
    parse_rate_limits[ip].append(now)

@app.post("/api/parse_lineup")
async def parse_lineup(request: Request, file: UploadFile = File(...)):
    client_ip = request.client.host if request.client else "unknown"
    check_parse_rate_limit(client_ip)
    
    import os
    ext = os.path.splitext(file.filename)[1]
    if not ext:
        ext = ".jpg"
    temp_img = TEMP_DIR / f"lineup_{uuid.uuid4()}{ext}"
    with open(temp_img, "wb") as f:
        f.write(await file.read())
    
    try:
        results = parse_schedule_image(str(temp_img))
        # results is now {"dates": [(date, [hymns])], "offering": "348", "recessional": "289"}
        # return as is for JSON, but transform the dates array to a dict if easier, 
        # actually let's keep it as an array to preserve order in the frontend!
        return {"schedule_data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_img.exists():
            temp_img.unlink()

@app.post("/api/scan")
async def scan_pdf(req: ScanRequest):
    if req.pdf_id not in pdf_store:
        found_path = ""
        for f in TEMP_DIR.iterdir():
            if f.name.startswith(f"{req.pdf_id}_") and f.suffix.lower() == ".pdf":
                found_path = str(f)
                break
        if found_path:
            pdf_store[req.pdf_id] = found_path
        else:
            raise HTTPException(status_code=404, detail="PDF not found. Please re-upload your PDF.")
    
    pdf_path = pdf_store[req.pdf_id]
    
    import queue
    import threading
    q = queue.Queue()
    
    def log_callback(msg):
        q.put({"type": "log", "data": msg})
        
    def worker():
        try:
            results = run_scan(
                pdf_path=pdf_path,
                schedule_file="",
                user_input=req.user_input,
                index_file=str(TEMP_DIR / "pdf_index.json"),
                log_callback=log_callback,
                schedule_data=req.schedule_data
            )
            lines = format_results(results)
            page_list = ", ".join(lines)
            q.put({"type": "done", "results": results, "formatted": page_list, "order": list(results.keys())})
        except Exception as e:
            q.put({"type": "error", "error": str(e)})

    threading.Thread(target=worker, daemon=True).start()

    def event_stream():
        while True:
            msg = q.get()
            import json
            yield f"data: {json.dumps(msg)}\n\n"
            if msg["type"] in ["done", "error"]:
                break

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.post("/api/export_pdf")
async def export_pdf(req: ExportRequest):
    if req.pdf_id not in pdf_store:
        found_path = ""
        for f in TEMP_DIR.iterdir():
            if f.name.startswith(f"{req.pdf_id}_") and f.suffix.lower() == ".pdf":
                found_path = str(f)
                break
        if found_path:
            pdf_store[req.pdf_id] = found_path
        else:
            raise HTTPException(status_code=404, detail="PDF not found. Please re-upload your PDF.")
        
    pdf_path = pdf_store[req.pdf_id]
    out_id = str(uuid.uuid4())
    out_path = TEMP_DIR / f"hymns_{out_id}.pdf"
    
    try:
        ordered_results = {k: req.scan_results[k] for k in (req.order or []) if k in req.scan_results} if req.order else req.scan_results
        extract_hymn_pages(pdf_path, ordered_results, str(out_path))
        return FileResponse(
            path=out_path, 
            filename=f"hymns_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf",
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

SESSION_FILE = Path("appdata_index/session.json")

@app.get("/api/session")
async def get_session():
    if SESSION_FILE.exists():
        try:
            with open(SESSION_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            return {}
    return {}

@app.post("/api/session")
async def save_session(request: Request):
    try:
        data = await request.json()
        SESSION_FILE.parent.mkdir(exist_ok=True, parents=True)
        with open(SESSION_FILE, "w") as f:
            json.dump(data, f)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
