import fitz  # PyMuPDF
import cv2
import numpy as np
import pytesseract

# Define the path to your Tesseract executable and your PDF
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
import re
import time
import json
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

PDF_PATH = r"C:\Users\gopio\OneDrive\Desktop\TAG AWIT 2025.pdf"
INDEX_FILE = "pdf_index.json"
SCHEDULE_FILE = "march_schedules.json"

# Days that appear as row keys in the lineup table (Sundays & Wednesdays)
# Numbers ≤ 31 that are plausible date keys
DATE_RANGE = set(range(1, 32))

def load_index(index_file=INDEX_FILE):
    if os.path.exists(index_file):
        with open(index_file, 'r') as f:
            return json.load(f)
    return {
        "last_scanned_page": 0,
        "hymn_locations": {}
    }


def save_index(index_data, index_file=INDEX_FILE):
    with open(index_file, 'w') as f:
        json.dump(index_data, f, indent=4)


def load_schedules(schedule_file=SCHEDULE_FILE):
    if os.path.exists(schedule_file):
        with open(schedule_file, 'r') as f:
            return json.load(f)
    return {}
def parse_schedule_image(image_path: str, log_callback=None) -> list[tuple[str, list[str]]]:
    """
    Parses a lineup image using the Gemini Vision API.
    Returns a list of tuples: [("1", ["12", "116"...]), ("5", [...])].
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        raise ValueError("GEMINI_API_KEY environment variable not set. Please check your .env file.")

    client = genai.Client(api_key=api_key)

    if log_callback: log_callback("Uploading image to Gemini API...")
    
    try:
        sample_file = client.files.upload(file=image_path, config={'display_name': 'Schedule Image'})
        
        prompt = '''
        Analyze the image and extract the song schedule lineup.
        Output MUST be strictly valid JSON format.
        Do NOT wrap the output in markdown block like ```json.
        The JSON structure should be a list of lists.
        Each inner list represents a column (or date).
        The first element of the inner list should be the date (a string representing the day number, e.g., "19").
        The second element should be a list of hymn numbers (strings) scheduled for that date.
        Only include strings containing digits 1-600 in the hymn numbers. Ignore other text.
        Example output:
        [
            ["19", ["12", "116", "233"]],
            ["26", ["301", "44", "225"]]
        ]
        '''
        
        if log_callback: log_callback("Waiting for Gemini Vision response...")
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[sample_file, prompt]
        )
        
        # Cleanup file from google storage
        client.files.delete(name=sample_file.name)
        
        # Clean up possible markdown wrappers
        text = response.text.strip()
        if text.startswith('```json'):
            text = text[7:]
        if text.endswith('```'):
            text = text[:-3]
        text = text.strip()
        
        data = json.loads(text)
        
        # Transform into expected list of tuples
        columns_data = []
        for item in data:
            if len(item) == 2:
                date_str = str(item[0])
                hymns = [str(int(h)) for h in item[1] if str(h).isdigit() and 1 <= int(h) <= 600]
                columns_data.append((date_str, hymns))
                if log_callback: log_callback(f"  Recognized Date: {date_str} => {len(hymns)} hymns")
                
        return columns_data
        
    except Exception as e:
        raise RuntimeError(f"Error calling Gemini API: {e}")


def run_scan(pdf_path, schedule_file, user_input,
             log_callback=print, index_file=INDEX_FILE,
             schedule_data=None):
    """
    Core scan function. Accepts a log_callback so both GUI and CLI can use it.
    schedule_data: optional pre-parsed dict (e.g. from parse_schedule_image).
                   If provided, schedule_file is ignored.
    Returns a results dict mapping hymn number -> list of PDF page numbers.
    """
    march_schedules = schedule_data if schedule_data is not None else load_schedules(schedule_file)

    # Split input and check each token against the schedule keys
    tokens = [t.strip() for t in user_input.split(',') if t.strip()]
    date_tokens  = [t for t in tokens if t in march_schedules]
    hymn_tokens  = [t for t in tokens if t not in march_schedules]

    targets = []
    if date_tokens:
        for date in date_tokens:
            log_callback(f"\n[SCHEDULE] Loaded March {date} Worldwide Lineup!")
            targets += march_schedules[date]
            
    if hymn_tokens:
        log_callback(f"\n[MANUAL] Added explicit hymns: {', '.join(hymn_tokens)}")
        targets += hymn_tokens

    if targets:
        # Remove duplicates while preserving order
        seen = set()
        targets = [x for x in targets if not (x in seen or seen.add(x))]
        log_callback(f"Hymns to scan: {', '.join(targets)}")

    if not targets:
        log_callback("No numbers provided.")
        return {}

    results = {target: [] for target in targets}
    targets_remaining = set(targets)

    index_data = load_index(index_file)
    hymn_locations = index_data["hymn_locations"]
    last_scanned_page = index_data["last_scanned_page"]

    log_callback(f"\n[CACHE] Checking index (last scanned up to page {last_scanned_page})...")
    for target in targets:
        if target in hymn_locations:
            pages = hymn_locations[target]
            results[target].extend(pages)
            targets_remaining.remove(target)
            log_callback(f"  -> Found #{target} in cache on page(s): {pages}")

    if not targets_remaining:
        log_callback("\nAll requested hymns were already in the cache! Scan complete.")
        return results

    log_callback(f"\n[SCAN] Missing hymns: {targets_remaining}. Resuming from page {last_scanned_page + 1}...")

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        log_callback(f"Error opening PDF: {e}")
        return results

    total_pages = len(doc)
    zoom = 300 / 72.0
    mat = fitz.Matrix(zoom, zoom)
    config = '--psm 11'

    start_page = min(last_scanned_page, total_pages)

    for page_index in range(start_page, total_pages):
        start_time = time.time()
        page = doc[page_index]
        rect = page.rect
        width, height = rect.width, rect.height

        top_left_rect = fitz.Rect(0, 0, width * 0.15, height * 0.08)
        top_right_rect = fitz.Rect(width * 0.85, 0, width, height * 0.08)

        pix_left = page.get_pixmap(matrix=mat, clip=top_left_rect)
        pix_right = page.get_pixmap(matrix=mat, clip=top_right_rect)

        img_left = np.frombuffer(pix_left.samples, dtype=np.uint8).reshape(pix_left.h, pix_left.w, pix_left.n)
        img_right = np.frombuffer(pix_right.samples, dtype=np.uint8).reshape(pix_right.h, pix_right.w, pix_right.n)

        if pix_left.n == 3:
            img_left = cv2.cvtColor(img_left, cv2.COLOR_RGB2GRAY)
            img_right = cv2.cvtColor(img_right, cv2.COLOR_RGB2GRAY)

        text_left = pytesseract.image_to_string(img_left, config=config)
        text_right = pytesseract.image_to_string(img_right, config=config)

        corner_text = text_left + " " + text_right
        numbers_found = re.findall(r'\d+', corner_text)

        elapsed = time.time() - start_time
        page_num = page_index + 1
        log_callback(f"Scanning page {page_num}/{total_pages} ({elapsed:.2f}s)... Found: {numbers_found}")

        for num in numbers_found:
            if num not in hymn_locations:
                hymn_locations[num] = []
            if page_num not in hymn_locations[num]:
                hymn_locations[num].append(page_num)
                hymn_locations[num].sort()

        for target in list(targets_remaining):
            if target in numbers_found:
                results[target].append(page_num)
                log_callback(f"  *** SUCCESS: Target #{target} found on page {page_num}! ***")

        index_data["last_scanned_page"] = page_num

        if page_num % 5 == 0 or any(t in numbers_found for t in targets_remaining):
            save_index(index_data, index_file)

        if numbers_found:
            max_found_on_page = max([int(n) for n in numbers_found if n.isdigit()])
            still_need_to_scan = False
            for target in list(targets_remaining):
                if int(target) >= max_found_on_page - 1:
                    still_need_to_scan = True
                elif target in hymn_locations:
                    log_callback(f"  -> Concluded #{target}. Found on pages: {hymn_locations[target]}")
                    targets_remaining.remove(target)

            if not still_need_to_scan and not targets_remaining:
                log_callback("\nScanned past all requested hymns. Stopping.")
                break

    save_index(index_data, index_file)
    return results


def format_results(results):
    """Turn a results dict into a comma-separated page string like: 87, 222, 295-296"""
    final_pages = []
    for target, pages in results.items():
        if pages:
            pages.sort()
            hymn_sequence = [pages[0]]
            for p in pages[1:]:
                if p == hymn_sequence[-1] + 1:
                    hymn_sequence.append(p)
                else:
                    break  # gap = false positive later in the book
            if len(hymn_sequence) == 1:
                final_pages.append(str(hymn_sequence[0]))
            else:
                final_pages.append(f"{hymn_sequence[0]}-{hymn_sequence[-1]}")
        else:
            final_pages.append("?")
    return final_pages

def extract_hymn_pages(source_pdf_path, results_dict, output_pdf_path):
    """
    Given a results mapping of {hymn_number: [page1, page2...]},
    extract the exact corresponding pages from source_pdf_path and save to output_pdf_path.
    """
    try:
        doc = fitz.open(source_pdf_path)
    except Exception as e:
        raise RuntimeError(f"Could not open source PDF for extraction: {e}")
        
    out_doc = fitz.open()  # New empty PDF
    # Collect all pages we need to extract in order loosely bound by hymn order 
    page_numbers = []
    
    for pages in results_dict.values():
        if pages:
            page_numbers.extend(pages)
            
    # PyMuPDF is 0-indexed, so we subtract 1 from everything
    for p in page_numbers:
        # Avoid out-of-bounds just in case
        if 1 <= p <= len(doc):
            out_doc.insert_pdf(doc, from_page=p-1, to_page=p-1)
            
    if len(out_doc) > 0:
        out_doc.save(output_pdf_path)
    else:
        out_doc.close()
        doc.close()
        raise ValueError("No valid pages were found to extract.")
        
    out_doc.close()
    doc.close()

if __name__ == "__main__":
    user_input = input("Enter hymn numbers (e.g., 25, 28) OR a March Date (e.g., '19'): ").strip()
    results = run_scan(PDF_PATH, SCHEDULE_FILE, user_input)
    if results:
        print("\n=== FINAL RESULTS ===")
        print("\n".join(format_results(results)))
