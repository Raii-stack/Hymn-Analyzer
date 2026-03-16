import fitz
import pytesseract
import cv2
import numpy as np

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
pdf_path = r"C:\Users\gopio\OneDrive\Desktop\TAG AWIT 2025.pdf"

doc = fitz.open(pdf_path)

# Test pages that had false positives
test_pages = [16, 25, 46, 63] # 0-indexed for [17, 26, 47, 64]

zoom = 300 / 72.0  
mat = fitz.Matrix(zoom, zoom)
config = '--psm 11'

print("Testing tighter ROI (Top 8%, Outer 15%)...")
for p in test_pages:
    page = doc[p]
    rect = page.rect
    width, height = rect.width, rect.height
    
    # Try Top 8%, Left/Right 15%
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
    
    print(f"Page {p+1}: Left='{text_left.strip()}', Right='{text_right.strip()}'")
