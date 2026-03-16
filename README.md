# Hymn Number Scanner

This Python script uses Tesseract OCR and Poppler to scan a PDF of sheet music and find which pages a specific hymn number appears on. It searches specifically in the top-left and top-right corners of the page to save processing time.

## Prerequisites

1.  **Python 3.x**
2.  **Tesseract OCR**: This must be installed on your system.
    *   **Windows**: Download and install from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki). 
    *   *Note: `scanner.py` expects Tesseract to be installed at `C:\Program Files\Tesseract-OCR\tesseract.exe` by default.*
3.  **Poppler for Windows**: Needed by `pdf2image` to convert PDF pages into images.

## Installation

1.  Set up a virtual environment (recommended):
    ```bash
    python -m venv .venv
    .venv\Scripts\activate
    ```
2.  Install the required Python packages:
    ```bash
    pip install opencv-python pytesseract numpy pdf2image
    ```
3.  Download the Poppler for Windows binaries using the included script. This will download and extract Poppler into a local `poppler/` directory so you don't have to add it to your system PATH:
    ```bash
    python download_poppler.py
    ```

## Usage

1. Open `scanner.py`.
2. Near the bottom of the script, modify the `my_pdf` variable to point to the absolute path of your PDF document.
    ```python
    my_pdf = r"C:\path\to\your\document.pdf"
    ```
3. Modify the `number_to_find` variable to the target hymn number you want to search for.
4. Run the script:
   ```bash
   python scanner.py
   ```

The script will convert the PDF pages into images, run text recognition (OCR) on the top 15% of the corners, and print out any pages where your target number was found.
