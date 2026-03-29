import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import "./theme.css";
import {
  Music2,
  FileText,
  ImageIcon,
  Calendar,
  Download,
  Copy,
  Printer,
  Loader2,
} from "lucide-react";
import { FileDropzone } from "./components/FileDropzone";
import { MultiSelectDropdown } from "./components/MultiSelectDropdown";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";

import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";

// Color scheme
const colors = {
  BG: "#080603",
  SURFACE: "#120e06",
  ACCENT: "#bc9106",
  GOLD: "#cfa726",
  SECONDARY: "#735b0c",
  TEXT: "#f8f6ed",
  SUBTEXT: "#a6a292",
  SUCCESS: "#4caf50",
};

interface ScheduleData {
  month: string;
  dates: {
    date: string;
    day: string;
    hymns: string[];
  }[];
  offeringHymn: string;
  recessionalHymn: string;
}

export default function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfId, setPdfId] = useState<string>("");
  const [pdfFilename, setPdfFilename] = useState<string>("");
  const [lineupImage, setLineupImage] = useState<File | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState<string>("");
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [scanResults, setScanResults] = useState<string>("");
  const [scanResultsData, setScanResultsData] = useState<any>(null);
  const [scanResultsOrder, setScanResultsOrder] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const API_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:8000"
      : `${window.location.protocol}//${window.location.hostname}:8654`;

  useEffect(() => {
    const saved = localStorage.getItem("hymn_scanner_session");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.pdfId) setPdfId(data.pdfId);
        if (data.pdfFilename) setPdfFilename(data.pdfFilename);
        if (data.scheduleData) setScheduleData(data.scheduleData);
        if (data.selectedDates) setSelectedDates(data.selectedDates);
        if (data.manualInput) setManualInput(data.manualInput);
        if (data.scanResults) setScanResults(data.scanResults);
        if (data.scanResultsData) setScanResultsData(data.scanResultsData);
        if (data.scanResultsOrder) setScanResultsOrder(data.scanResultsOrder);
      } catch (e) {
        console.error("Failed to parse session", e);
      }
    }
  }, []);

  useEffect(() => {
    const sessionData = {
      pdfId,
      pdfFilename,
      scheduleData,
      selectedDates,
      manualInput,
      scanResults,
      scanResultsData,
      scanResultsOrder,
    };
    localStorage.setItem("hymn_scanner_session", JSON.stringify(sessionData));
  }, [
    pdfId,
    pdfFilename,
    scheduleData,
    selectedDates,
    manualInput,
    scanResults,
    scanResultsData,
    scanResultsOrder,
  ]);

  useEffect(() => {
    if (pdfFile) {
      setPdfId("");
      setPdfFilename(pdfFile.name);
    }
  }, [pdfFile]);

  const handleLoadLineup = async () => {
    if (!lineupImage) {
      setScanResults("❌ Parse error: No lineup image selected");
      return;
    }

    setIsLoading(true);
    setScanResults(
      "Uploading and parsing lineup image...\nWait a few seconds for Gemini AI processing...",
    );

    try {
      const formData = new FormData();
      formData.append("file", lineupImage);

      const res = await fetch(`${API_BASE_URL}/api/parse_lineup`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to parse lineup");
      }

      const { schedule_data } = await res.json();

      // Transform backend format
      const transformedDates = (schedule_data.dates || []).map(
        (dateTuple: any) => ({
          date: dateTuple[0].split("-")[0].trim(),
          day: dateTuple[0].includes("-")
            ? dateTuple[0].split("-")[1].trim()
            : "",
          hymns: dateTuple[1].map(String),
        }),
      );

      const newSchedule: ScheduleData = {
        month: "Loaded Schedule",
        dates: transformedDates,
        offeringHymn: schedule_data.offering || "",
        recessionalHymn: schedule_data.recessional || "",
      };

      setScheduleData(newSchedule);
      setScanResults(
        "✓ Successfully parsed lineup image\nFound schedule data:\n" +
          JSON.stringify(schedule_data, null, 2),
      );
    } catch (err: any) {
      console.error(err);
      setScanResults(`❌ Parse error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanPages = async () => {
    if (!pdfFile && !pdfId) {
      setScanResults(
        "❌ Error: No PDF file selected or available from session",
      );
      return;
    }

    if (selectedDates.length === 0 && !manualInput) {
      setScanResults("❌ Error: Please select a date or enter manual input");
      return;
    }

    setIsScanning(true);
    let currentPdfId = pdfId;

    try {
      if (!currentPdfId && pdfFile) {
        setScanResults(`Uploading PDF: ${pdfFile.name}...\n`);
        const formData = new FormData();
        formData.append("file", pdfFile);

        const uploadRes = await fetch(`${API_BASE_URL}/api/upload_pdf`, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload PDF");

        const uploadData = await uploadRes.json();
        currentPdfId = uploadData.file_id;
        setPdfId(currentPdfId);
        setScanResults((prev) => prev + "✓ PDF uploaded successfully\n");
      }

      setScanResults((prev) => prev + "Scanning pages...\n");

      const backendScheduleData = scheduleData
        ? {
            dates: scheduleData.dates.map((d) => [d.date, d.hymns]),
            offering: scheduleData.offeringHymn,
            recessional: scheduleData.recessionalHymn,
          }
        : null;

      const dateTokens = selectedDates.map((sd) => sd.split("-")[0].trim());
      const queryTokens = [...dateTokens];
      if (manualInput) {
        queryTokens.push(
          ...manualInput
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }

      const scanRes = await fetch(`${API_BASE_URL}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdf_id: currentPdfId,
          user_input: queryTokens.join(","),
          schedule_data: backendScheduleData,
        }),
      });

      if (!scanRes.ok) throw new Error("Failed to start scan");
      if (!scanRes.body) throw new Error("ReadableStream not supported");

      const reader = scanRes.body.getReader();
      const decoder = new TextDecoder();
      let doneReading = false;

      while (!doneReading) {
        const { value, done } = await reader.read();
        doneReading = done;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");
          for (const line of lines) {
            if (line.trim().startsWith("data: ")) {
              try {
                const data = JSON.parse(line.trim().slice(6));
                if (data.type === "log") {
                  setScanResults((prev) => prev + data.data + "\n");
                } else if (data.type === "done") {
                  setScanResultsData(data.results);
                  if (data.order) setScanResultsOrder(data.order);
                  setScanResults(
                    (prev) =>
                      prev +
                      `\n✓ Scan complete!\n\nFormatted targets:\n${data.formatted}`,
                  );
                } else if (data.type === "error") {
                  setScanResults(
                    (prev) => prev + `\n❌ Scan error: ${data.error}`,
                  );
                }
              } catch (ex) {
                // partial chunk parsing error
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setScanResults((prev) => prev + `\n❌ Scan error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopy = () => {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(scanResults)
        .then(() => {
          toast.success("Copied to clipboard!");
        })
        .catch(() => {
          // Fallback if Clipboard API fails
          fallbackCopy();
        });
    } else {
      // Use fallback for browsers that don't support Clipboard API
      fallbackCopy();
    }
  };

  const fallbackCopy = () => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = scanResults;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand("copy");
      textArea.remove();

      if (successful) {
        toast.success("Copied to clipboard!");
      } else {
        toast.error("Failed to copy to clipboard");
      }
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handlePrint = async () => {
    if (!pdfId || !scanResultsData) {
      toast.error("No scan results available to print");
      return;
    }

    setIsExporting(true);
    toast.success("Preparing PDF for printing...", { id: "print-toast" });

    try {
      const res = await fetch(`${API_BASE_URL}/api/export_pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdf_id: pdfId,
          scan_results: scanResultsData,
          order: scanResultsOrder,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate PDF for printing");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );

      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        toast.success("PDF opened for printing!", { id: "print-toast" });
      } else {
        toast.error("Popup blocked! Please allow popups to open the PDF.", {
          id: "print-toast",
        });
      }

      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      console.error(err);
      toast.error("Error printing PDF", {
        description: err.message,
        id: "print-toast",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSavePDF = async () => {
    if (!pdfId || !scanResultsData) {
      toast.error("No scan results available to save");
      return;
    }

    setIsExporting(true);
    toast.success("Generating PDF... please wait");

    try {
      const res = await fetch(`${API_BASE_URL}/api/export_pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdf_id: pdfId,
          scan_results: scanResultsData,
          order: scanResultsOrder,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate PDF");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `hymns_extracted.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("PDF saved successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="min-h-screen p-3 sm:p-6"
      style={{ backgroundColor: colors.BG }}
    >
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="text-center py-4 sm:py-6">
          <div className="inline-flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <Music2
              className="w-8 h-8 sm:w-10 sm:h-10"
              style={{ color: colors.GOLD }}
            />
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold"
              style={{ color: colors.TEXT }}
            >
              Hymn Page Scanner
            </h1>
          </div>
          <p
            className="text-sm sm:text-base lg:text-lg px-4"
            style={{ color: colors.SUBTEXT }}
          >
            Upload your hymn book PDF and lineup image to find the perfect hymns
            for your service
          </p>
        </div>

        {/* File Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* PDF Upload */}
          <Card
            className="border"
            style={{
              backgroundColor: colors.SURFACE,
              borderColor: colors.SECONDARY,
            }}
          >
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle
                className="flex items-center gap-2 text-lg sm:text-xl"
                style={{ color: colors.TEXT }}
              >
                <FileText
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  style={{ color: colors.GOLD }}
                />
                Hymn PDF
              </CardTitle>
              <CardDescription
                className="text-sm"
                style={{ color: colors.SUBTEXT }}
              >
                Upload your hymn book PDF file{" "}
                {pdfFilename && (
                  <span className="text-accent">(Previous: {pdfFilename})</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileDropzone
                accept={{ "application/pdf": [".pdf"] }}
                onFileSelect={setPdfFile}
                icon={<FileText className="w-10 h-10 sm:w-12 sm:h-12" />}
                label="Drop PDF here or click to browse"
                file={pdfFile}
              />
            </CardContent>
          </Card>

          {/* Image Upload */}
          <Card
            className="border"
            style={{
              backgroundColor: colors.SURFACE,
              borderColor: colors.SECONDARY,
            }}
          >
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle
                className="flex items-center gap-2 text-lg sm:text-xl"
                style={{ color: colors.TEXT }}
              >
                <ImageIcon
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  style={{ color: colors.GOLD }}
                />
                Lineup Image
              </CardTitle>
              <CardDescription
                className="text-sm"
                style={{ color: colors.SUBTEXT }}
              >
                Upload the schedule/lineup image
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileDropzone
                accept={{ "image/*": [".png", ".jpg", ".jpeg"] }}
                onFileSelect={setLineupImage}
                icon={<ImageIcon className="w-10 h-10 sm:w-12 sm:h-12" />}
                label="Drop image here or click to browse"
                file={lineupImage}
              />
              <Button
                onClick={handleLoadLineup}
                disabled={!lineupImage || isLoading}
                className="w-full mt-4 text-white border-0 h-11 sm:h-auto"
                style={{ backgroundColor: colors.ACCENT }}
              >
                {isLoading ? "Parsing..." : "Load/Parse Lineup"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Parsed Schedule Table */}
        {scheduleData && (
          <Card
            className="border"
            style={{
              backgroundColor: colors.SURFACE,
              borderColor: colors.SECONDARY,
            }}
          >
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle
                className="flex items-center gap-2 text-lg sm:text-xl"
                style={{ color: colors.TEXT }}
              >
                <Calendar
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  style={{ color: colors.GOLD }}
                />
                Parsed Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <table className="w-full border-collapse min-w-[640px]">
                    <thead>
                      <tr>
                        <th
                          colSpan={scheduleData.dates.length}
                          className="text-center py-2 sm:py-3 text-base sm:text-xl font-bold border"
                          style={{
                            backgroundColor: colors.SURFACE,
                            color: colors.TEXT,
                            borderColor: colors.SECONDARY,
                          }}
                        >
                          {scheduleData.month}
                        </th>
                      </tr>
                      <tr>
                        {scheduleData.dates.map((dateInfo, idx) => (
                          <th
                            key={idx}
                            className="px-2 sm:px-4 py-2 sm:py-3 text-center border font-semibold text-sm sm:text-base"
                            style={{
                              backgroundColor: colors.SURFACE,
                              color: colors.TEXT,
                              borderColor: colors.SECONDARY,
                            }}
                          >
                            {dateInfo.date} - {dateInfo.day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Hymn rows */}
                      {Array.from({ length: 6 }).map((_, rowIdx) => (
                        <tr key={rowIdx}>
                          {scheduleData.dates.map((dateInfo, colIdx) => (
                            <td
                              key={colIdx}
                              className="px-2 sm:px-4 py-1.5 sm:py-2 text-center border text-sm sm:text-base"
                              style={{
                                backgroundColor: colors.BG,
                                color: colors.TEXT,
                                borderColor: colors.SECONDARY,
                              }}
                            >
                              {dateInfo.hymns[rowIdx] || ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {/* Offering Hymn Row */}
                      <tr>
                        <td
                          colSpan={scheduleData.dates.length}
                          className="px-2 sm:px-4 py-2 text-center border font-semibold text-sm sm:text-base"
                          style={{
                            backgroundColor: colors.BG,
                            color: colors.TEXT,
                            borderColor: colors.SECONDARY,
                          }}
                        >
                          <span style={{ color: colors.GOLD }}>
                            {scheduleData.offeringHymn}
                          </span>{" "}
                          - Hymn for Offering
                        </td>
                      </tr>
                      {/* Recessional Hymn Row */}
                      <tr>
                        <td
                          colSpan={scheduleData.dates.length}
                          className="px-2 sm:px-4 py-2 text-center border font-semibold text-sm sm:text-base"
                          style={{
                            backgroundColor: colors.BG,
                            color: colors.TEXT,
                            borderColor: colors.SECONDARY,
                          }}
                        >
                          <span style={{ color: colors.GOLD }}>
                            {scheduleData.recessionalHymn}
                          </span>{" "}
                          - Recessional Hymn
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scan Configuration */}
        <Card
          className="border"
          style={{
            backgroundColor: colors.SURFACE,
            borderColor: colors.SECONDARY,
          }}
        >
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle
              className="text-lg sm:text-xl"
              style={{ color: colors.TEXT }}
            >
              Scan Configuration
            </CardTitle>
            <CardDescription
              className="text-sm"
              style={{ color: colors.SUBTEXT }}
            >
              Select columns to scan from dates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label
                className="mb-3 block text-sm sm:text-base"
                style={{ color: colors.TEXT }}
              >
                Selected Dates
              </Label>
              {scheduleData && (
                <>
                  {/* Mobile Dropdown */}
                  <div className="block lg:hidden">
                    <MultiSelectDropdown
                      options={scheduleData.dates.map((dateInfo) => ({
                        value: `${dateInfo.date}-${dateInfo.day}`,
                        label: `April ${dateInfo.date} - ${dateInfo.day}`,
                      }))}
                      selectedValues={selectedDates}
                      onChange={setSelectedDates}
                      placeholder="Select dates"
                      colors={colors}
                    />
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto -mx-2 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <table className="w-full border-collapse min-w-[640px]">
                        <thead>
                          <tr>
                            <th
                              colSpan={scheduleData.dates.length}
                              className="text-center py-2 text-base sm:text-lg font-bold border"
                              style={{
                                backgroundColor: colors.BG,
                                color: colors.TEXT,
                                borderColor: colors.SECONDARY,
                              }}
                            >
                              {scheduleData.month}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {scheduleData.dates.map((dateInfo, idx) => (
                              <td
                                key={idx}
                                className="px-2 sm:px-4 py-2 sm:py-3 text-center border cursor-pointer transition-colors active:opacity-70 text-sm sm:text-base"
                                style={{
                                  backgroundColor: selectedDates.includes(
                                    `${dateInfo.date}-${dateInfo.day}`,
                                  )
                                    ? colors.ACCENT
                                    : colors.BG,
                                  color: selectedDates.includes(
                                    `${dateInfo.date}-${dateInfo.day}`,
                                  )
                                    ? colors.BG
                                    : colors.TEXT,
                                  borderColor: colors.SECONDARY,
                                }}
                                onClick={() => {
                                  if (
                                    selectedDates.includes(
                                      `${dateInfo.date}-${dateInfo.day}`,
                                    )
                                  ) {
                                    setSelectedDates(
                                      selectedDates.filter(
                                        (date) =>
                                          date !==
                                          `${dateInfo.date}-${dateInfo.day}`,
                                      ),
                                    );
                                  } else {
                                    setSelectedDates([
                                      ...selectedDates,
                                      `${dateInfo.date}-${dateInfo.day}`,
                                    ]);
                                  }
                                }}
                              >
                                <div className="font-semibold">
                                  {dateInfo.date}
                                </div>
                                <div
                                  className="text-xs sm:text-sm"
                                  style={{
                                    color: selectedDates.includes(
                                      `${dateInfo.date}-${dateInfo.day}`,
                                    )
                                      ? colors.BG
                                      : colors.SUBTEXT,
                                  }}
                                >
                                  {dateInfo.day}
                                </div>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
              {!scheduleData && (
                <div
                  className="text-center py-6 sm:py-8 border rounded-lg text-sm sm:text-base"
                  style={{
                    backgroundColor: colors.BG,
                    borderColor: colors.SECONDARY,
                    color: colors.SUBTEXT,
                  }}
                >
                  No schedule loaded. Please upload and parse a lineup image
                  first.
                </div>
              )}
            </div>

            <div>
              <Label
                htmlFor="manual-input"
                className="mb-2 text-sm sm:text-base"
                style={{ color: colors.TEXT }}
              >
                Manual Input
              </Label>
              <Input
                id="manual-input"
                placeholder="e.g. 52, CH14, 1A"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="border h-11 text-base placeholder:text-[#a88c3a]/50 focus-visible:ring-1 focus-visible:ring-[#d4af37]"
                style={{
                  backgroundColor: colors.BG,
                  borderColor: colors.ACCENT,
                  color: colors.TEXT,
                }}
              />
            </div>

            <Button
              onClick={handleScanPages}
              disabled={(!pdfFile && !pdfId) || isScanning}
              className="w-full text-base sm:text-lg py-6 sm:py-7 text-white border-0 min-h-[44px]"
              style={{ backgroundColor: colors.ACCENT }}
            >
              {isScanning ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Scanning...
                </span>
              ) : (
                "SCAN PAGES"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {scanResults && (
          <Card
            className="border"
            style={{
              backgroundColor: colors.SURFACE,
              borderColor: colors.SECONDARY,
            }}
          >
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle
                    className="text-lg sm:text-xl"
                    style={{ color: colors.TEXT }}
                  >
                    Scan Results
                  </CardTitle>
                  {isScanning && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold animate-pulse border"
                      style={{
                        backgroundColor: colors.SECONDARY,
                        color: colors.TEXT,
                        borderColor: colors.ACCENT,
                      }}
                    >
                      Scanning
                    </span>
                  )}
                  {!isScanning && scanResults.includes("❌") && (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold border"
                      style={{
                        backgroundColor: "#2a1111",
                        color: "#ef4444",
                        borderColor: "#7f1d1d",
                      }}
                    >
                      Error
                    </span>
                  )}
                  {!isScanning &&
                    scanResultsData &&
                    !scanResults.includes("❌") && (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-bold border"
                        style={{
                          backgroundColor: "#162b16",
                          color: colors.SUCCESS,
                          borderColor: "#2f5a2f",
                        }}
                      >
                        Complete
                      </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleCopy}
                    variant="outline"
                    size="sm"
                    className="border flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
                    style={{
                      borderColor: colors.SECONDARY,
                      color: colors.TEXT,
                      backgroundColor: "transparent",
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    onClick={handlePrint}
                    variant="outline"
                    size="sm"
                    className="border flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
                    style={{
                      borderColor: colors.SECONDARY,
                      color: colors.TEXT,
                      backgroundColor: "transparent",
                    }}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button
                    onClick={handleSavePDF}
                    disabled={!pdfId || !scanResultsData || isExporting}
                    variant="outline"
                    size="sm"
                    className="border flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
                    style={{
                      borderColor: colors.SECONDARY,
                      color: colors.TEXT,
                      backgroundColor: "transparent",
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Save PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-lg p-4 sm:p-6 font-mono text-xs sm:text-sm h-64 overflow-auto"
                style={{ backgroundColor: colors.BG }}
              >
                <pre
                  className="whitespace-pre-wrap"
                  style={{ color: colors.SUCCESS }}
                >
                  {scanResults}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Toaster />
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
