import fitz

pdf_path = r"C:\Users\gopio\OneDrive\Desktop\TAG AWIT 2025.pdf"
doc = fitz.open(pdf_path)

for i in range(5):
    text = doc[i].get_text("text")
    if "LINE-UP" in text or "March" in text or "329" in text:
        print(f"--- PAGE {i} ---")
        print(text)
