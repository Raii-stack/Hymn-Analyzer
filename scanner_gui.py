import tkinter as tk
from tkinter import ttk, filedialog, scrolledtext, messagebox
import threading
import os
import fitz
import tempfile
import webbrowser
import datetime
import json
from ctypes import windll

# Import the refactored scanner logic
from scanner import run_scan, format_results, parse_schedule_image, extract_hymn_pages

APP_DIR = os.path.join(os.getenv('APPDATA', os.path.expanduser('~')), 'HymnScanner')
os.makedirs(APP_DIR, exist_ok=True)
SESSION_FILE = os.path.join(APP_DIR, "last_session.json")
INDEX_FILE = os.path.join(APP_DIR, "pdf_index.json")

# ─────────────────────────── Colour Palette ───────────────────────────
BG       = "#080603"
SURFACE  = "#120e06"
ACCENT   = "#bc9106"
GOLD     = "#cfa726"
SECONDARY= "#735b0c"
TEXT     = "#f8f6ed"
SUBTEXT  = "#a6a292"
SUCCESS  = "#4caf50"
LOG_BG   = "#040302"
FONT     = ("Segoe UI", 10)
FONT_B   = ("Segoe UI", 10, "bold")
MONO     = ("Consolas", 9)

def make_card(parent, **kwargs):
    return tk.Frame(parent, bg=SURFACE, highlightbackground=SECONDARY, highlightthickness=1, **kwargs)


class HymnScannerApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Hymn Page Scanner")
        self.configure(bg=BG)
        self.resizable(True, True)
        self.minsize(700, 600)

        self.pdf_var        = tk.StringVar(value="")
        self.lineup_var     = tk.StringVar(value="")
        self.manual_var     = tk.StringVar(value="")
        self._parsed_schedule = None
        self._last_result     = ""   # last page list string, for copy/save
        
        self.schedule_data = {}

        # ── Scrollable Root Frame ──
        container = tk.Frame(self, bg=BG)
        container.pack(fill="both", expand=True)

        self.canvas = tk.Canvas(container, bg=BG, highlightthickness=0)
        
        scrollbar = ttk.Scrollbar(container, orient="vertical", command=self.canvas.yview)
        
        self.scrollable_frame = tk.Frame(self.canvas, bg=BG)

        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        self.scrollable_window = self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        
        # Make the layout responsive horizontally
        self.canvas.bind(
            "<Configure>",
            lambda e: self.canvas.itemconfig(self.scrollable_window, width=e.width)
        )
        
        self.canvas.configure(yscrollcommand=scrollbar.set)
        
        # Mouse wheel bindings
        self.canvas.bind_all("<MouseWheel>", self._on_mousewheel)

        self.canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        self.style = ttk.Style()
        self.style.theme_use("clam")

        self._build_ui()
        self._load_session()
        
    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1*(event.delta/120)), "units")

    def _load_session(self):
        if not os.path.exists(SESSION_FILE): return
        try:
            with open(SESSION_FILE, "r") as f:
                data = json.load(f)
            self.pdf_var.set(data.get("pdf_path", ""))
            self.lineup_var.set(data.get("lineup_path", ""))
            
            # Repopulate the schedule table natively
            schedule_ref = data.get("schedule_data", {})
            if schedule_ref:
                columns_data = [(str(k), [str(v) for v in vals]) for k, vals in schedule_ref.items()]
                self._on_parse_success(columns_data)
        except Exception as e:
            self._log(f"Session load error: {e}", "error")

    def _save_session(self):
        try:
            with open(SESSION_FILE, "w") as f:
                json.dump({
                    "pdf_path": self.pdf_var.get(),
                    "lineup_path": self.lineup_var.get(),
                    "schedule_data": self.schedule_data
                }, f)
        except Exception as e:
            self._log(f"Session save error: {e}", "error")

    # ──────────────────────────── UI builder ──────────────────────────
    def _build_ui(self):
        # Header
        hdr = tk.Frame(self.scrollable_frame, bg=BG)
        hdr.pack(fill="x", padx=20, pady=(18, 6))
        tk.Label(hdr, text="🎵  Hymn Page Scanner",
                 bg=BG, fg=GOLD, font=("Segoe UI", 18, "bold")).pack(side="left")

        # ── File pickers card ────────────────────────────────────────
        card = make_card(self.scrollable_frame)
        card.pack(fill="x", padx=20, pady=6)
        card.columnconfigure(1, weight=1)

        self._file_row(card, "Hymn PDF:",     self.pdf_var,       self._browse_pdf,   row=0)
        self._file_row(card, "Lineup (Img/JSON):", self.lineup_var, self._browse_lineup, row=1)

        # Parse button
        self.parse_btn = tk.Button(
            card, text="  Load/Parse Lineup",
            bg=SECONDARY, fg=TEXT, activebackground=ACCENT,
            font=FONT_B, relief="solid", bd=1, padx=14, pady=6,
            cursor="hand2", command=self._parse_lineup
        )
        self.parse_btn.grid(row=2, column=1, padx=6, pady=(0, 8), sticky="w")

        self.parse_status = tk.Label(card, text="", bg=SURFACE, fg=SUBTEXT,
                                     font=("Segoe UI", 8, "italic"))
        self.parse_status.grid(row=2, column=2, padx=(0, 12), sticky="w")

        # ── Parsed schedule preview ──────────────────────────────────
        self.preview_frame = make_card(self.scrollable_frame)
        self.preview_frame.pack(fill="x", padx=20, pady=(0, 4))

        self.preview_lbl = tk.Label(
            self.preview_frame,
            text="No lineup loaded — select an image or JSON file first.",
            bg=SURFACE, fg=SUBTEXT,
            font=("Segoe UI", 8, "italic"),
            justify="left", anchor="w", wraplength=640
        )
        self.preview_lbl.pack(fill="x", padx=12, pady=8)

        # ── Dates Table (Treeview) ──────────────────────────────────
        inp_card = make_card(self.scrollable_frame)
        inp_card.pack(fill="x", padx=20, pady=6)

        tk.Label(inp_card, text="Select Dates to Scan:", bg=SURFACE, fg=TEXT,
                 font=FONT_B).pack(anchor="w", padx=12, pady=(10, 4))
        
        self.style.configure("Treeview", background=LOG_BG, foreground=TEXT, fieldbackground=LOG_BG, borderwidth=1, bordercolor=SECONDARY, font=FONT)
        self.style.configure("Treeview.Heading", background=SECONDARY, foreground=TEXT, font=FONT_B, relief="solid")
        self.style.map("Treeview", background=[('selected', SECONDARY)])

        self.tree = ttk.Treeview(inp_card, columns=("Date", "Total", "Hymns"), show="headings", height=8, selectmode="extended")
        self.tree.heading("Date", text="Date")
        self.tree.heading("Total", text="Total Hymns")
        self.tree.heading("Hymns", text="Hymn Numbers (Preview)")

        self.tree.column("Date", width=80, anchor="center", stretch=False)
        self.tree.column("Total", width=100, anchor="center", stretch=False)
        self.tree.column("Hymns", stretch=True, anchor="w")

        tree_scroll = ttk.Scrollbar(inp_card, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=tree_scroll.set)

        # Add an inner frame for just the Treeview and its scrollbar
        tree_frame = tk.Frame(inp_card, bg=SURFACE)
        tree_frame.pack(fill="x", expand=True, padx=12, pady=(0, 6))

        self.tree.pack(side="left", fill="x", expand=True)
        tree_scroll.pack(side="right", fill="y")
        
        self.tree.bind("<Button-1>", self._toggle_tree_selection)

        # Manual Input
        man_frame = tk.Frame(inp_card, bg=SURFACE)
        man_frame.pack(fill="x", padx=12, pady=(0, 10))
        
        tk.Label(man_frame, text="Or Manual Hymns:", bg=SURFACE, fg=SUBTEXT, font=FONT_B).pack(anchor="w")
        
        entry_frame = tk.Frame(man_frame, bg=SURFACE)
        entry_frame.pack(fill="x", anchor="w", pady=(4, 2))
        
        self.manual_entry = tk.Entry(entry_frame, textvariable=self.manual_var, bg=LOG_BG, fg=TEXT, insertbackground=TEXT, relief="solid", bd=1, highlightbackground=SECONDARY, highlightthickness=1, font=MONO)
        self.manual_entry.pack(side="left", fill="x", expand=True)
        self.manual_entry.bind("<FocusOut>", lambda e: self._save_session())
        
        # Example Sub-text
        tk.Label(man_frame, text="Example: 20 (single) or 20, 25, 52 (multiple)", bg=SURFACE, fg="#6c6758", font=("Segoe UI", 8, "italic")).pack(anchor="w")

        # ── Buttons ──────────────────────────────────────────────────
        btn_frame = tk.Frame(self.scrollable_frame, bg=BG)
        btn_frame.pack(fill="x", padx=20, pady=6)

        self.scan_btn = tk.Button(btn_frame, text="▶  Scan Selected",
                                  bg=SECONDARY, fg=TEXT, activebackground=ACCENT,
                                  font=("Segoe UI", 11, "bold"), relief="solid", bd=1,
                                  padx=20, pady=8, cursor="hand2",
                                  command=self._start_scan)
        self.scan_btn.pack(side="left")

        self.clear_btn = tk.Button(btn_frame, text="⟳  Clear Log",
                                   bg=SURFACE, fg=TEXT, activebackground=SECONDARY,
                                   font=FONT, relief="solid", bd=1, padx=14, pady=8,
                                   cursor="hand2", command=self._clear_log)
        self.clear_btn.pack(side="left", padx=(10, 0))

        self.status_lbl = tk.Label(btn_frame, text="", bg=BG, fg=SUBTEXT, font=FONT)
        self.status_lbl.pack(side="right")

        # Progress bar
        self.progress = ttk.Progressbar(self.scrollable_frame, mode="indeterminate")
        self.progress.pack(fill="x", padx=20, pady=(0, 4))
        self.style.configure("TProgressbar", troughcolor=SURFACE, background=GOLD, thickness=4)

        # ── Log ──────────────────────────────────────────────────────
        tk.Label(self.scrollable_frame, text="Scan Log", bg=BG, fg=SUBTEXT, font=FONT
                 ).pack(anchor="w", padx=22)

        self.log = scrolledtext.ScrolledText(
            self.scrollable_frame, bg=LOG_BG, fg=TEXT, insertbackground=TEXT,
            font=MONO, relief="solid", bd=1, state="disabled", wrap="word", height=10
        )
        self.log.pack(fill="both", expand=True, padx=20, pady=(2, 6))
        self.log.tag_config("success", foreground=SUCCESS)
        self.log.tag_config("header",  foreground=GOLD,    font=("Consolas", 9, "bold"))
        self.log.tag_config("result",  foreground="#2d7dd2", font=("Consolas", 9, "bold"))
        self.log.tag_config("error",   foreground="#d73a49")

        # ── Setup log below ───────────────────────────────────────────────
        res_card = make_card(self.scrollable_frame)
        res_card.pack(fill="x", padx=20, pady=(0, 16))

        tk.Label(res_card, text="Result:", bg=SURFACE, fg=SUBTEXT, font=FONT_B
                 ).pack(side="left", padx=(12, 6), pady=8)

        self.result_lbl = tk.Label(res_card, text="—", bg=SURFACE, fg=SUCCESS,
                                   font=("Segoe UI", 10, "bold"), wraplength=380,
                                   justify="left")
        self.result_lbl.pack(side="left", pady=8, fill="x", expand=True)

        tk.Button(res_card, text="📋 Copy",
                  bg=SURFACE, fg=TEXT, activebackground=SECONDARY,
                  font=FONT, relief="solid", bd=1, padx=10, pady=6,
                  cursor="hand2", command=self._copy_result
                  ).pack(side="right", padx=(4, 12), pady=8)

        tk.Button(res_card, text="📄 Save PDF",
                  bg=SURFACE, fg=TEXT, activebackground=SECONDARY,
                  font=FONT, relief="solid", bd=1, padx=10, pady=6,
                  cursor="hand2", command=self._save_pdf
                  ).pack(side="right", padx=(4, 0), pady=8)

        tk.Button(res_card, text="🖨 Print",
                  bg=SURFACE, fg=TEXT, activebackground=SECONDARY,
                  font=FONT, relief="solid", bd=1, padx=10, pady=6,
                  cursor="hand2", command=self._print_result
                  ).pack(side="right", padx=(0, 4), pady=8)

    def _file_row(self, parent, label, var, cmd, row):
        tk.Label(parent, text=label, bg=SURFACE, fg=SUBTEXT, font=FONT,
                 width=14, anchor="w").grid(row=row, column=0, padx=(12, 4), pady=8, sticky="w")

        tk.Entry(parent, textvariable=var, bg=LOG_BG, fg=TEXT,
                 insertbackground=TEXT, relief="solid", bd=1, highlightbackground=SECONDARY, highlightthickness=1, font=MONO
                 ).grid(row=row, column=1, padx=4, pady=8, sticky="ew")

        tk.Button(parent, text="Browse…", bg=SURFACE, fg=TEXT,
                  activebackground=SECONDARY, relief="solid", bd=1,
                  font=FONT, padx=10, cursor="hand2", command=cmd
                  ).grid(row=row, column=2, padx=(4, 12), pady=8)

    def _toggle_tree_selection(self, event):
        item = self.tree.identify_row(event.y)
        if item:
            if item in self.tree.selection():
                self.tree.selection_remove(item)
            else:
                self.tree.selection_add(item)
            return "break"

    # ─────────────────────────── File dialogs ─────────────────────────
    def _browse_pdf(self):
        path = filedialog.askopenfilename(
            title="Select Hymn PDF",
            filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")]
        )
        if path:
            self.pdf_var.set(path)
            self._save_session()

    def _browse_lineup(self):
        path = filedialog.askopenfilename(
            title="Select Lineup Image or JSON",
            filetypes=[
                ("Supported files", "*.png *.jpg *.jpeg *.bmp *.tiff *.webp *.json"),
                ("Image files", "*.png *.jpg *.jpeg *.bmp *.tiff *.webp"),
                ("JSON files", "*.json"),
                ("All files", "*.*")
            ]
        )
        if path:
            self.lineup_var.set(path)
            self.parse_status.config(text="Lineup selected — click Parse.")
            self._parsed_schedule = None
            self._save_session()
            self.preview_lbl.config(
                text="Lineup selected. Click 'Load/Parse Lineup' to extract the schedule.",
                fg=SUBTEXT
            )

    # ─────────────────────────── OCR parse ───────────────────────────
    def _parse_lineup(self):
        img_path = self.lineup_var.get().strip()
        if not img_path or not os.path.exists(img_path):
            messagebox.showerror("Error", "Please select a valid Line-up Image or JSON file.")
            return

        self.parse_status.config(text="Parsing lineup...", fg=SUBTEXT)
        self.parse_btn.config(state="disabled")
        self.preview_lbl.config(text="Extracting dates...", fg=SUBTEXT)
        
        # Clear existing tree data
        for row in self.tree.get_children():
            self.tree.delete(row)

        if img_path.lower().endswith(".json"):
            # Direct JSON parsing
            try:
                import json
                with open(img_path, 'r') as f:
                    data = json.load(f)
                columns_data = [(str(k), [str(v) for v in vals]) for k, vals in data.items()]
                self._log("\nLoaded lineup from structured JSON.")
                self.after(0, self._on_parse_success, columns_data)
            except Exception as e:
                self.after(0, self._on_parse_error, f"JSON Error: {str(e)}")
            return

        def worker():
            try:
                # Returns list of (date_guess, hymns_list)
                columns_data = parse_schedule_image(img_path, self._log) # Changed _log_msg to _log
                self.after(0, self._on_parse_success, columns_data)
            except Exception as e:
                self.after(0, self._on_parse_error, str(e))

        threading.Thread(target=worker, daemon=True).start()

    def _on_parse_success(self, parsed_data):
        self.parse_btn.config(state="normal")
        
        # Handle new dict format or legacy list format
        if isinstance(parsed_data, dict) and "dates" in parsed_data:
            columns_data = parsed_data["dates"]
            self.schedule_data = parsed_data # Save the full dict so run_scan can normalize it
        else:
            columns_data = parsed_data
            self.schedule_data = columns_data

        self.parse_status.config(text=f"✓ Found {len(columns_data)} columns", fg=SUCCESS)
        self.preview_lbl.config(text="Dates extracted! Select rows in the table to scan.", fg=SUCCESS)
        
        for row in self.tree.get_children():
            self.tree.delete(row)
            
        for date_guess, hymns in columns_data:
            preview = ", ".join(hymns)
            # Add to treeview
            self.tree.insert("", "end", iid=date_guess, values=(date_guess, len(hymns), preview))

        # Build schedule data dynamically on scan
        self._log("\nLine-up parsing complete. Select dates from the table.")
        
        self._save_session()

    def _on_parse_error(self, err_msg):
        self.parse_btn.config(state="normal")
        self.parse_status.config(text="⚠ Parse failed", fg="#ff6b6b")
        self.preview_lbl.config(text=err_msg, fg="#ff6b6b")
        self._log(f"ERROR: {err_msg}")

    # ─────────────────────────── Logging ─────────────────────────────
    def _log(self, msg, tag=None):
        def _append():
            self.log.config(state="normal")
            if tag:
                self.log.insert("end", msg + "\n", tag)
            else:
                self.log.insert("end", msg + "\n")
            self.log.see("end")
            self.log.config(state="disabled")
        self.after(0, _append)

    def _clear_log(self):
        self.log.config(state="normal")
        self.log.delete("1.0", "end")
        self.log.config(state="disabled")
        self.result_lbl.config(text="—")

    # ─────────────────────────── Scan ────────────────────────────────
    def _start_scan(self):
        pdf_path = self.pdf_var.get().strip()

        if not pdf_path or not os.path.exists(pdf_path):
            messagebox.showerror("Error", "Please select a valid Hymn PDF.")
            return

        selected_items = self.tree.selection()
        dates_raw = ",".join(selected_items)
        manual_raw = self.manual_var.get().strip()
        
        combo = []
        if dates_raw: combo.append(dates_raw)
        if manual_raw: combo.append(manual_raw)
        
        user_in = ",".join(combo)
        
        if not user_in:
            messagebox.showerror("Error", "Please select at least one date or manually input hymns.")
            return

        self.scan_btn.config(state="disabled")
        self.progress.start(12)
        self.status_lbl.config(text="Scanning…")
        self.result_lbl.config(text="—")

        threading.Thread(
            target=self._scan_worker,
            args=(pdf_path, user_in),
            daemon=True
        ).start()

    def _scan_worker(self, pdf, user_in):
        self._log(f"{'─'*55}", "header")
        self._log(f"  PDF:   {os.path.basename(pdf)}", "header")
        self._log(f"  Input: {user_in}", "header")
        self._log(f"{'─'*55}", "header")

        try:
            results = run_scan(
                pdf_path=pdf,
                schedule_file="",          # unused — we pass schedule_data
                user_input=user_in,
                index_file=INDEX_FILE,
                log_callback=self._smart_log,
                schedule_data=self.schedule_data
            )
            # Save raw dict for extraction later
            self._last_results_dict = results
            
            lines = format_results(results)
            page_list = ", ".join(lines)

            self._log("\n=== FINAL RESULTS ===", "result")
            self._log(f"  {page_list}", "success")
            self._last_result = page_list
            self.after(0, lambda: self.result_lbl.config(text=page_list))

        except Exception as e:
            self._log(f"\n⚠  Error: {e}", "error")

        self.after(0, self._scan_done)

    def _smart_log(self, msg):
        if "SUCCESS" in msg or "RESULTS" in msg:
            self._log(msg, "success")
        elif any(k in msg for k in ("[CACHE]", "[SCHEDULE]", "[SCAN]")):
            self._log(msg, "header")
        else:
            self._log(msg)

    def _scan_done(self):
        self.progress.stop()
        self.scan_btn.config(state="normal")
        self.status_lbl.config(text="Done ✓")

    # ──────────────────────── Copy / Save ────────────────────────────
    def _copy_result(self):
        if not self._last_result:
            return
        self.clipboard_clear()
        self.clipboard_append(self._last_result)
        self.status_lbl.config(text="Copied ✓")

    # ─── helpers ─────────────────────────────────────────────────────
    def _print_result(self):
        if not hasattr(self, '_last_results_dict') or not self._last_results_dict:
            messagebox.showinfo("Nothing to print", "Run a scan first.")
            return
        try:
            # Generate a temporary PDF and open it with webbrowser for printing
            fd, tmp_path = tempfile.mkstemp(suffix='.pdf')
            os.close(fd)
            extract_hymn_pages(self.pdf_var.get(), self._last_results_dict, tmp_path)
            
            # Use webbrowser to open the PDF. Chrome/Edge will display a nice Print dialog.
            webbrowser.open_new(f"file:///{tmp_path.replace(chr(92), '/')}")
            self.status_lbl.config(text="Opened for printing ✓")
        except Exception as e:
            messagebox.showerror("Print error", str(e))

    def _save_pdf(self):
        if not hasattr(self, '_last_results_dict') or not self._last_results_dict:
            messagebox.showinfo("Nothing to save", "Run a scan first.")
            return
        default = f"hymns_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        path = filedialog.asksaveasfilename(
            title="Save as PDF",
            defaultextension=".pdf",
            initialfile=default,
            filetypes=[("PDF file", "*.pdf"), ("All files", "*.*")]
        )
        if not path:
            return
        try:
            extract_hymn_pages(self.pdf_var.get(), self._last_results_dict, path)
            self.status_lbl.config(text=f"Saved → {os.path.basename(path)}")
            self._log(f"\nSaved PDF to:\n  {path}", "success")
        except Exception as e:
            messagebox.showerror("Save error", str(e))
            # Also open it to preview
            os.startfile(path) if hasattr(os, 'startfile') else webbrowser.open_new(f"file:///{path.replace(chr(92), '/')}")
        except ImportError:
            messagebox.showerror("reportlab missing",
                                 "Install reportlab:\n  pip install reportlab")
        except Exception as e:
            messagebox.showerror("PDF error", str(e))


if __name__ == "__main__":
    app = HymnScannerApp()
    app.mainloop()
