import fitz

pdf_path = r"C:\Users\gopio\OneDrive\Desktop\TAG AWIT 2025.pdf"

print("Extracting full page to see where numbers are...")
doc = fitz.open(pdf_path)

# Let's extract page 15, since we saw some numbers there, or maybe page 10
# We'll just extract a few pages as images to examine them.
for p_num in [10, 15, 20]:
    page = doc[p_num]
    zoom = 150 / 72.0  # 150 DPI
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    out_path = f"d:\\Python_ML\\page_{p_num}.png"
    pix.save(out_path)
    print(f"Saved {out_path}")
