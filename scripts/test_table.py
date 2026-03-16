import cv2
import pytesseract

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
img_path = r"C:\Users\gopio\.gemini\antigravity\brain\85029f1b-e9dc-469c-83c0-47ec9650b647\media__1773635167446.png"

img = cv2.imread(img_path)
data = pytesseract.image_to_string(img, config='--psm 6')
print("--- PSM 6 Output ---")
print(data)

data4 = pytesseract.image_to_string(img, config='--psm 4')
print("\n--- PSM 4 Output ---")
print(data4)
