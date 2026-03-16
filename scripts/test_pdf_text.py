import fitz  # PyMuPDF
import sys

pdf_path = r"C:\Users\gopio\OneDrive\Desktop\TAG AWIT 2025.pdf"

try:
    doc = fitz.open(pdf_path)
    print(f"Opened PDF with {len(doc)} pages.")
    
    # Check the first few pages for text
    text_found = False
    for i in range(min(5, len(doc))):
        page = doc[i]
        text = page.get_text()
        if text.strip():
            text_found = True
            print(f"--- Page {i+1} Text Snippet ---")
            print(text.strip()[:200]) # Print first 200 chars
            
    if text_found:
        print("\nSUCCESS: The PDF contains embedded text! We can use fast extraction.")
    else:
        print("\nFAILURE: No text found in the first 5 pages. It's likely a scanned image PDF. We must use OCR.")
        
except Exception as e:
    print(f"Error reading PDF: {e}")
