import fitz
import re

pdf_path = r"C:\Users\gopio\OneDrive\Desktop\TAG AWIT 2025.pdf"

print("Testing PyMuPDF corner extraction...")
doc = fitz.open(pdf_path)

found_numbers = []
for i in range(min(20, len(doc))):
    page = doc[i]
    rect = page.rect
    width, height = rect.width, rect.height
    
    # Top 15% and Left/Right 25%
    top_left_rect = fitz.Rect(0, 0, width * 0.25, height * 0.15)
    top_right_rect = fitz.Rect(width * 0.75, 0, width, height * 0.15)
    
    text_left = page.get_text("text", clip=top_left_rect)
    text_right = page.get_text("text", clip=top_right_rect)
    
    corner_text = text_left + " " + text_right
    numbers = re.findall(r'\d+', corner_text)
    
    if numbers:
        print(f"Page {i+1}: Found numbers {numbers} (Raw text: {repr(corner_text.strip())})")
    else:
        print(f"Page {i+1}: No numbers found. (Raw text: {repr(corner_text.strip())})")
        
print("Done.")
