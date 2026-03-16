import fitz
import pytesseract
import cv2
import numpy as np
import time

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
pdf_path = r"C:\Users\gopio\OneDrive\Desktop\TAG AWIT 2025.pdf"

print("Testing PyMuPDF fast corner rendering + OCR...")
start_time = time.time()
doc = fitz.open(pdf_path)

for i in range(min(5, len(doc))):
    page = doc[i]
    rect = page.rect
    width, height = rect.width, rect.height
    
    # Corners
    top_left_rect = fitz.Rect(0, 0, width * 0.25, height * 0.15)
    top_right_rect = fitz.Rect(width * 0.75, 0, width, height * 0.15)
    
    # Render ONLY the corners at 300 DPI
    zoom = 300 / 72.0  # 300 DPI (PDFs are natively 72 points per inch)
    mat = fitz.Matrix(zoom, zoom)
    
    pix_left = page.get_pixmap(matrix=mat, clip=top_left_rect)
    pix_right = page.get_pixmap(matrix=mat, clip=top_right_rect)
    
    # Convert to numpy/OpenCV
    img_left = np.frombuffer(pix_left.samples, dtype=np.uint8).reshape(pix_left.h, pix_left.w, pix_left.n)
    img_right = np.frombuffer(pix_right.samples, dtype=np.uint8).reshape(pix_right.h, pix_right.w, pix_right.n)
    
    # Grayscale
    if pix_left.n == 3:
        img_left = cv2.cvtColor(img_left, cv2.COLOR_RGB2GRAY)
        img_right = cv2.cvtColor(img_right, cv2.COLOR_RGB2GRAY)
        
    config = '--psm 6'
    text_left = pytesseract.image_to_string(img_left, config=config)
    text_right = pytesseract.image_to_string(img_right, config=config)
    
    print(f"Page {i+1}: Left='{text_left.strip()}', Right='{text_right.strip()}'")

print(f"Finished 5 pages in {time.time() - start_time:.2f} seconds.")
