# Hymn Scanner

Hymn Scanner is a Python-based utility with a modern dark-mode graphical user interface (GUI) designed to accelerate and automate the process of finding which pages specific hymn numbers appear on within a large sheet-music PDF. It leverages OCR to quickly index the PDF and uses the Google Gemini 2.5 Vision API to automatically extract lists of hymns directly from images of schedules.

## Key Features

- **Smart PDF Indexing**: Uses Tesseract OCR and PyMuPDF (`fitz`) to extract page images and scan specifically the top-left and top-right 15% corners of the PDF pages for hymn numbers. This drastically reduces processing time. Results are cached into a local index file so future queries are instantaneous.
- **AI Schedule Parsing**: Upload an image or screenshot of your song schedule lineup. The application utilizes the `gemini-2.5-flash` model to intelligently extract the dates and the correct hymn numbers from the picture.
- **Modern GUI**: A sleek dark-themed (`tkinter`) window to manage PDF selection, index searching, manual hymn entries, and schedule API configurations.
- **Save State & Export**: Automatically formats and copies results directly to your clipboard. Your last session and PDF indexes are safely stored in your local AppData folder (`%APPDATA%\HymnScanner`).
- **Standalone Build**: Includes build configurations (PyInstaller) to bundle into a single `.exe` file for sharing with non-developers.

## Prerequisites

Before running or building the script, make sure you have the following installed:

1. **Python 3.10+** (if running from source)
2. **Tesseract OCR**: Required for scanning the PDF.
   - **Windows**: Download the installer from [UB-Mannheim Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki).
   - _Note: `scanner.py` defaults to expecting Tesseract installed at `C:\Program Files\Tesseract-OCR\tesseract.exe`. Ensure it is installed there or update the path manually._
3. **Google Gemini API Key**: Needed to use the intelligent schedule image parsing feature. You can get a free API key from [Google AI Studio](https://aistudio.google.com/).

## Installation & Setup

1. **Clone the Repository**

   ```bash
   git clone <repository_url>
   cd <repository_folder>
   ```

2. **Set up a Virtual Environment (Recommended)**

   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. **Install Required Packages**
   Install the necessary libraries via `pip`. (Note: The older Poppler integration was replaced by PyMuPDF, which is native and significantly faster).

   ```bash
   pip install PyMuPDF opencv-python pytesseract numpy google-genai python-dotenv
   ```

4. **Environment Settings**
   Launch the app once to initialize the automatic application directory (`%APPDATA%\HymnScanner`). The GUI will prompt you for your API key, or you can supply your API key manually into the `.env` file that is generated in that directory.

## Usage

### Running the App

You can launch the GUI directly via your terminal:

```bash
python scanner_gui.py
```

### Application Features

1. **Select PDF Index**: Choose your sheet music PDF. Tesseract will scan previously unindexed pages sequentially and save them to `%APPDATA%\HymnScanner\pdf_index.json`.
2. **Lineup Source**: Select an image file representing your song selection schedule. You must have your Gemini API key saved in the app settings for this feature to connect to Google's API.
3. **Manual Entry**: If you prefer not to use the AI, input your hymn numbers manually as a comma-separated list.
4. **Run Scan**: The application outputs a consolidated list mapping dates to absolute PDF page numbers that you can use to assemble performance binders or display software.

## Building the Executable

You can pack the entire application into a single executable file using PyInstaller.

1. **Install PyInstaller:**
   ```bash
   pip install pyinstaller
   ```
2. **Run PyInstaller:**
   Use the terminal to build a windowed, standalone `.exe` using the script:
   ```bash
   pyinstaller --noconfirm --onefile --windowed --name "HymnScanner" scanner_gui.py
   ```
3. **Distribution**: Find the resulting Windows Executable in the `dist/` directory. No underlying python setup will be needed on target machines, though they will still need to have Tesseract OCR installed!
