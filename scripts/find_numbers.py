import pytesseract
import cv2

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Load the image
img = cv2.imread(r'd:\Python_ML\page_15.png')

print("Running OCR with bounding boxes on page 15...")
data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)

print("Found numeric text at:")
for i in range(len(data['text'])):
    text = data['text'][i].strip()
    if text.isdigit() and len(text) <= 3: # Hymn numbers are usually 1-3 digits
        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
        conf = data['conf'][i]
        if float(conf) > 50: # Only confident reads
            print(f"Text: '{text}', Box: (x={x}, y={y}, w={w}, h={h}), Conf: {conf}")

