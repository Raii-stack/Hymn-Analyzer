import fitz
import pytesseract
import cv2
import numpy as np

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
pdf_path = r"C:\Users\gopio\OneDrive\Desktop\TAG AWIT 2025.pdf"

doc = fitz.open(pdf_path)
page = doc[25] # Page 26 (0-indexed)
rect = page.rect
width, height = rect.width, rect.height

top_left_rect = fitz.Rect(0, 0, width * 0.25, height * 0.15)
zoom = 300 / 72.0  
mat = fitz.Matrix(zoom, zoom)

pix_left = page.get_pixmap(matrix=mat, clip=top_left_rect)
img_left = np.frombuffer(pix_left.samples, dtype=np.uint8).reshape(pix_left.h, pix_left.w, pix_left.n)
if pix_left.n == 3:
    img_left = cv2.cvtColor(img_left, cv2.COLOR_RGB2GRAY)

cv2.imwrite(r'd:\Python_ML\page26_topleft.png', img_left)

print("Testing different PSM modes on Page 26 Top-Left...")

for psm in [3, 4, 6, 11, 12]:
    config = f'--psm {psm}'
    text = pytesseract.image_to_string(img_left, config=config)
    print(f"\n--- PSM {psm} ---")
    print(repr(text))
