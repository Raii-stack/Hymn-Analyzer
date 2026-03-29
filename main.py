from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
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

# Use the mapped volume path primarily, fallback to local appdata_index for desktop dev
DATA_DIR = Path("/root/HymnScanner") if Path("/root/HymnScanner").exists() else Path("appdata_index")
DATA_DIR.mkdir(exist_ok=True, parents=True)

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

@app.post("/api/parse_lineup")
async def parse_lineup(file: UploadFile = File(...)):
    import os
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        ext = ".jpg"  # Default to jpg for Gemini compatibility
        
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
        raise HTTPException(status_code=404, detail="PDF not found")
    
    pdf_path = pdf_store[req.pdf_id]
    
    # We need a log callback that can collect logs, or we can just run it
    logs = []
    def log_callback(msg):
        logs.append(msg)
        
    try:
        results = run_scan(
            pdf_path=pdf_path,
            schedule_file="",
            user_input=req.user_input,
            index_file=str(DATA_DIR / "pdf_index.json"),
            log_callback=log_callback,
            schedule_data=req.schedule_data
        )
        lines = format_results(results)
        page_list = ", ".join(lines)
        return {
            "results": results,
            "formatted": page_list,
            "logs": logs,
            "order": list(results.keys())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/export_pdf")
async def export_pdf(req: ExportRequest):
    if req.pdf_id not in pdf_store:
        raise HTTPException(status_code=404, detail="PDF not found")
        
    pdf_path = pdf_store[req.pdf_id]
    out_id = str(uuid.uuid4())
    out_path = TEMP_DIR / f"hymns_{out_id}.pdf"
    
    try:
        # Reconstruct exactly in the order given by the user
        ordered_results = {k: req.scan_results[k] for k in req.order if k in req.scan_results} if req.order else req.scan_results
        
        extract_hymn_pages(pdf_path, ordered_results, str(out_path))
        return FileResponse(
            path=out_path, 
            filename=f"hymns_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf",
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

SESSION_FILE = DATA_DIR / "session.json"

@app.get("/api/session")
async def get_session():
    if SESSION_FILE.exists():
        try:
            with open(SESSION_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

@app.post("/api/session")
async def save_session(request: Request):
    try:
        data = await request.json()
        with open(SESSION_FILE, "w") as f:
            json.dump(data, f)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

