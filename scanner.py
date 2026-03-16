import cv2
import pytesseract
import numpy as np
import re
from pdf2image import convert_from_path

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def find_hymn_number_in_corners(pdf_path, target_number):
    found_on_pages = []
    
    print("Converting PDF to images...")
    # Convert PDF to images. 300 DPI is good for reading numbers.
    # We specify the poppler path so it can find the required executable on Windows.
    pages = convert_from_path(pdf_path, 300, poppler_path=r"d:\Python_ML\poppler\poppler-25.12.0\Library\bin")
    
    for page_index, page_img in enumerate(pages):
        # Convert the PIL image to an OpenCV format (numpy array)
        img = cv2.cvtColor(np.array(page_img), cv2.COLOR_RGB2BGR)
        
        # Get the dimensions of the page
        height, width, _ = img.shape
        
        # --- Define our Regions of Interest (ROI) ---
        # Let's crop the top 15% of the page, and the left/right 25%
        top_crop = int(height * 0.15)
        left_crop = int(width * 0.25)
        right_crop = int(width * 0.75)
        
        # Crop Top-Left
        top_left_corner = img[0:top_crop, 0:left_crop]
        # Crop Top-Right
        top_right_corner = img[0:top_crop, right_crop:width]
        
        # Run OCR on both corners
        # --psm 6 tells Tesseract to assume a single uniform block of text
        config = '--psm 6'
        text_left = pytesseract.image_to_string(top_left_corner, config=config)
        text_right = pytesseract.image_to_string(top_right_corner, config=config)
        
        # Combine the text from both corners
        corner_text = text_left + " " + text_right
        
        # Clean up the text: extract only the digits using regex
        numbers_found = re.findall(r'\d+', corner_text)
        
        print(f"Scanning page {page_index + 1}... Found numbers in corners: {numbers_found}")
        
        # Check if our target number is in the list of found numbers
        if str(target_number) in numbers_found:
            found_on_pages.append(page_index + 1)
            
    return found_on_pages

# --- How to use it ---
# Replace with the path to your PDF
my_pdf = r"C:\Users\gopio\OneDrive\Desktop\TAG AWIT 2025.pdf" 
number_to_find = 12

print(f"Searching for #{number_to_find}...")
result = find_hymn_number_in_corners(my_pdf, number_to_find)

if result:
    print(f"\nSuccess! Number {number_to_find} found on PDF page(s): {result}")
else:
    print(f"\nCould not find number {number_to_find} in the corners.")