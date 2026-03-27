import { useState } from 'react';
import { Music2, FileText, ImageIcon, Calendar, Download, Copy, Printer, Loader2, Check } from 'lucide-react';
import { FileDropzone } from './components/FileDropzone';
import { MultiSelectDropdown } from './components/MultiSelectDropdown';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';

// Color scheme
const colors = {
  BG: '#080603',
  SURFACE: '#120e06',
  ACCENT: '#bc9106',
  GOLD: '#cfa726',
  SECONDARY: '#735b0c',
  TEXT: '#f8f6ed',
  SUBTEXT: '#a6a292',
  SUCCESS: '#4caf50'
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
  const [lineupImage, setLineupImage] = useState<File | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState<string>('');
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [scanResults, setScanResults] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleLoadLineup = async () => {
    if (!lineupImage) {
      setScanResults('❌ Parse error: No lineup image selected');
      return;
    }
    
    setIsLoading(true);
    setScanResults('Parsing lineup image...\n');
    
    // Simulate parsing
    setTimeout(() => {
      const mockSchedule: ScheduleData = {
        month: 'April 2 - 30, 2026',
        dates: [
          { date: '02', day: 'TH', hymns: ['315', '212', '158', '197', '51', '180'] },
          { date: '05', day: 'S', hymns: ['283', '148', '174', '11', '64', '273'] },
          { date: '09', day: 'TH', hymns: ['317', '77', '40', '238', '181', '55'] },
          { date: '12', day: 'S', hymns: ['318', '150', '139', '541', '189', '149'] },
          { date: '16', day: 'TH', hymns: ['322', '49', '120', '100', '200', '218'] },
          { date: '19', day: 'S', hymns: ['302', '279', '248', '108', '240', '224'] },
          { date: '23', day: 'TH', hymns: ['328', '132', '146', '260', '8', '130'] },
          { date: '26', day: 'S', hymns: ['321', '498', '404', '514', '235', '460'] },
          { date: '30', day: 'TH', hymns: ['324', '263', '249', '48', '208', '257'] },
        ],
        offeringHymn: '348',
        recessionalHymn: '289'
      };
      setScheduleData(mockSchedule);
      setScanResults('✓ Successfully parsed lineup image\nFound schedule data');
      setIsLoading(false);
    }, 1500);
  };

  const handleScanPages = async () => {
    if (!pdfFile) {
      setScanResults('❌ Error: No PDF file selected');
      return;
    }

    if (selectedDates.length === 0 && !manualInput) {
      setScanResults('❌ Error: Please select a date or enter manual input');
      return;
    }

    setIsScanning(true);
    setScanResults(`Uploading PDF: ${pdfFile.name}...\n`);

    // Simulate scanning
    setTimeout(() => {
      setScanResults(prev => prev + '✓ PDF uploaded successfully\n\nScanning pages...\n');
      
      setTimeout(() => {
        setScanResults(prev => prev + '✓ Scan complete!\n\nFound hymns:\n• TAG AWIT #52 - "Pagdayeg sa Diyos"\n• TAG AWIT #104 - "Papuri sa Langit"\n• TAG AWIT #156 - "Salamat sa Panginoon"');
        setIsScanning(false);
      }, 2000);
    }, 1000);
  };

  const handleCopy = () => {
    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(scanResults)
        .then(() => {
          toast.success('Copied to clipboard!');
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
      const textArea = document.createElement('textarea');
      textArea.value = scanResults;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      textArea.remove();
      
      if (successful) {
        toast.success('Copied to clipboard!');
      } else {
        toast.error('Failed to copy to clipboard');
      }
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSavePDF = () => {
    console.log('Saving as PDF...');
  };

  return (
    <div className="min-h-screen p-3 sm:p-6" style={{ backgroundColor: colors.BG }}>
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="text-center py-4 sm:py-6">
          <div className="inline-flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <Music2 className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: colors.GOLD }} />
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold" style={{ color: colors.TEXT }}>
              Hymn Page Scanner
            </h1>
          </div>
          <p className="text-sm sm:text-base lg:text-lg px-4" style={{ color: colors.SUBTEXT }}>
            Upload your hymn book PDF and lineup image to find the perfect hymns for your service
          </p>
        </div>

        {/* File Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* PDF Upload */}
          <Card className="border" style={{ backgroundColor: colors.SURFACE, borderColor: colors.SECONDARY }}>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl" style={{ color: colors.TEXT }}>
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.GOLD }} />
                Hymn PDF
              </CardTitle>
              <CardDescription className="text-sm" style={{ color: colors.SUBTEXT }}>
                Upload your hymn book PDF file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileDropzone
                accept={{ 'application/pdf': ['.pdf'] }}
                onFileSelect={setPdfFile}
                icon={<FileText className="w-10 h-10 sm:w-12 sm:h-12" />}
                label="Drop PDF here or click to browse"
                file={pdfFile}
              />
            </CardContent>
          </Card>

          {/* Image Upload */}
          <Card className="border" style={{ backgroundColor: colors.SURFACE, borderColor: colors.SECONDARY }}>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl" style={{ color: colors.TEXT }}>
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.GOLD }} />
                Lineup Image
              </CardTitle>
              <CardDescription className="text-sm" style={{ color: colors.SUBTEXT }}>
                Upload the schedule/lineup image
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileDropzone
                accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
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
                {isLoading ? 'Parsing...' : 'Load/Parse Lineup'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Parsed Schedule Table */}
        {scheduleData && (
          <Card className="border" style={{ backgroundColor: colors.SURFACE, borderColor: colors.SECONDARY }}>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl" style={{ color: colors.TEXT }}>
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.GOLD }} />
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
                            borderColor: colors.SECONDARY 
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
                              borderColor: colors.SECONDARY 
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
                                borderColor: colors.SECONDARY 
                              }}
                            >
                              {dateInfo.hymns[rowIdx] || ''}
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
                            borderColor: colors.SECONDARY 
                          }}
                        >
                          <span style={{ color: colors.GOLD }}>{scheduleData.offeringHymn}</span> - Hymn for Offering
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
                            borderColor: colors.SECONDARY 
                          }}
                        >
                          <span style={{ color: colors.GOLD }}>{scheduleData.recessionalHymn}</span> - Recessional Hymn
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
        <Card className="border" style={{ backgroundColor: colors.SURFACE, borderColor: colors.SECONDARY }}>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-lg sm:text-xl" style={{ color: colors.TEXT }}>Scan Configuration</CardTitle>
            <CardDescription className="text-sm" style={{ color: colors.SUBTEXT }}>
              Select columns to scan from dates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-3 block text-sm sm:text-base" style={{ color: colors.TEXT }}>Selected Dates</Label>
              {scheduleData && (
                <>
                  {/* Mobile Dropdown */}
                  <div className="block lg:hidden">
                    <MultiSelectDropdown
                      options={scheduleData.dates.map((dateInfo) => ({
                        value: `${dateInfo.date}-${dateInfo.day}`,
                        label: `April ${dateInfo.date} - ${dateInfo.day}`
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
                                borderColor: colors.SECONDARY 
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
                                  backgroundColor: selectedDates.includes(`${dateInfo.date}-${dateInfo.day}`) ? colors.ACCENT : colors.BG, 
                                  color: selectedDates.includes(`${dateInfo.date}-${dateInfo.day}`) ? colors.BG : colors.TEXT,
                                  borderColor: colors.SECONDARY 
                                }}
                                onClick={() => {
                                  if (selectedDates.includes(`${dateInfo.date}-${dateInfo.day}`)) {
                                    setSelectedDates(selectedDates.filter(date => date !== `${dateInfo.date}-${dateInfo.day}`));
                                  } else {
                                    setSelectedDates([...selectedDates, `${dateInfo.date}-${dateInfo.day}`]);
                                  }
                                }}
                              >
                                <div className="font-semibold">{dateInfo.date}</div>
                                <div className="text-xs sm:text-sm" style={{ 
                                  color: selectedDates.includes(`${dateInfo.date}-${dateInfo.day}`) ? colors.BG : colors.SUBTEXT 
                                }}>
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
                    color: colors.SUBTEXT 
                  }}
                >
                  No schedule loaded. Please upload and parse a lineup image first.
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="manual-input" className="mb-2 text-sm sm:text-base" style={{ color: colors.TEXT }}>Manual Input</Label>
              <Input
                id="manual-input"
                placeholder="e.g. 52, CH14, 1A"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="border h-11 text-base"
                style={{ 
                  backgroundColor: colors.BG, 
                  borderColor: colors.SECONDARY,
                  color: colors.TEXT 
                }}
              />
            </div>

            <Button 
              onClick={handleScanPages}
              disabled={!pdfFile || isScanning}
              className="w-full text-base sm:text-lg py-6 sm:py-7 text-white border-0 min-h-[44px]"
              style={{ backgroundColor: colors.ACCENT }}
            >
              {isScanning ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Scanning...
                </span>
              ) : (
                'SCAN PAGES'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {scanResults && (
          <Card className="border" style={{ backgroundColor: colors.SURFACE, borderColor: colors.SECONDARY }}>
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg sm:text-xl" style={{ color: colors.TEXT }}>Scan Results</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={handleCopy} 
                    variant="outline" 
                    size="sm" 
                    className="border flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
                    style={{ 
                      borderColor: colors.SECONDARY,
                      color: colors.TEXT,
                      backgroundColor: 'transparent' 
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
                      backgroundColor: 'transparent' 
                    }}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button 
                    onClick={handleSavePDF} 
                    variant="outline" 
                    size="sm"
                    className="border flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
                    style={{ 
                      borderColor: colors.SECONDARY,
                      color: colors.TEXT,
                      backgroundColor: 'transparent' 
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Save PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg p-4 sm:p-6 font-mono text-xs sm:text-sm overflow-x-auto" style={{ backgroundColor: colors.BG }}>
                <pre className="whitespace-pre-wrap" style={{ color: colors.SUCCESS }}>{scanResults}</pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Toaster />
    </div>
  );
}