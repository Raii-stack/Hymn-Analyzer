import './style.css'

const API_BASE = 'http://localhost:8000/api'

// Elements
const btnBrowsePdf = document.getElementById('btnBrowsePdf') as HTMLButtonElement
const pdfFileInput = document.getElementById('pdfFileInput') as HTMLInputElement
const pdfFileName = document.getElementById('pdfFileName') as HTMLInputElement

const btnBrowseLineup = document.getElementById('btnBrowseLineup') as HTMLButtonElement
const lineupFileInput = document.getElementById('lineupFileInput') as HTMLInputElement
const lineupFileName = document.getElementById('lineupFileName') as HTMLInputElement

const btnParse = document.getElementById('btnParse') as HTMLButtonElement
const parseStatus = document.getElementById('parseStatus') as HTMLSpanElement

const scheduleHead = document.getElementById('scheduleHead') as HTMLTableSectionElement
const scheduleBody = document.getElementById('scheduleBody') as HTMLTableSectionElement

const selectedDatesInput = document.getElementById('selectedDates') as HTMLInputElement
const manualInput = document.getElementById('manualInput') as HTMLInputElement
const btnScan = document.getElementById('btnScan') as HTMLButtonElement
const scanStatus = document.getElementById('scanStatus') as HTMLDivElement
const resultText = document.getElementById('resultText') as HTMLDivElement

const logContainer = document.getElementById('logContainer') as HTMLDivElement
const btnClearLog = document.getElementById('btnClearLog') as HTMLButtonElement

const btnCopy = document.getElementById('btnCopy') as HTMLButtonElement
const btnPrint = document.getElementById('btnPrint') as HTMLButtonElement
const btnSave = document.getElementById('btnSave') as HTMLButtonElement

// State
let currentPdfId: string | null = null
let currentLineupFile: File | null = null
let currentScheduleData: Record<string, string[]> | null = null
let selectedDates: Set<string> = new Set()
let lastScanResults: any = null
let lastFormattedResult: string = ""

// Handlers
btnBrowsePdf.addEventListener('click', () => pdfFileInput.click())
pdfFileInput.addEventListener('change', async () => {
    if (pdfFileInput.files && pdfFileInput.files.length > 0) {
        const file = pdfFileInput.files[0]
        pdfFileName.value = file.name
        
        // Upload immediately
        try {
            log(`Uploading PDF: ${file.name}...`)
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch(`${API_BASE}/upload_pdf`, { method: 'POST', body: formData })
            if (!res.ok) throw new Error(await res.text())
            const data = await res.json()
            currentPdfId = data.file_id
            log(`✓ PDF uploaded successfully.`, 'text-success')
        } catch (e: any) {
            log(`Error uploading PDF: ${e.message}`, 'text-red-500')
        }
    }
})

btnBrowseLineup.addEventListener('click', () => lineupFileInput.click())
lineupFileInput.addEventListener('change', () => {
    if (lineupFileInput.files && lineupFileInput.files.length > 0) {
        const file = lineupFileInput.files[0]
        lineupFileName.value = file.name
        currentLineupFile = file
    }
})

btnParse.addEventListener('click', async () => {
    if (!currentLineupFile) {
        alert("Please select a lineup image first.")
        return
    }

    parseStatus.textContent = "Parsing image..."
    parseStatus.className = "text-[8pt] italic text-accent ml-3"
    btnParse.disabled = true
    log("\nParsing lineup image...", "text-accent font-bold")

    try {
        const formData = new FormData()
        formData.append('file', currentLineupFile)
        
        const res = await fetch(`${API_BASE}/parse_lineup`, {
            method: 'POST',
            body: formData
        })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        
        currentScheduleData = data.schedule_data
        renderScheduleTable()
        parseStatus.textContent = "Parse successful ✓"
        parseStatus.className = "text-[8pt] italic text-success ml-3"
        log("✓ Lineup parsed successfully.", "text-success")
        btnScan.disabled = false
    } catch (e: any) {
        parseStatus.textContent = "Parse failed ✗"
        parseStatus.className = "text-[8pt] italic text-red-500 ml-3"
        log(`✗ Parse error: ${e.message}`, "text-red-500")
        alert(`Parse error: ${e.message}`)
    } finally {
        btnParse.disabled = false
    }
})

function renderScheduleTable() {
    if (!currentScheduleData) return

    const dates = Object.keys(currentScheduleData)
    // Build table head
    scheduleHead.innerHTML = ''
    const trHead = document.createElement('tr')
    dates.forEach(date => {
        const th = document.createElement('th')
        th.textContent = date
        th.className = "px-4 py-2 border-b border-secondary border-r cursor-pointer hover:bg-secondary select-none"
        th.onclick = () => toggleDateSelection(date, th)
        trHead.appendChild(th)
    })
    scheduleHead.appendChild(trHead)

    // Build table body (max rows)
    scheduleBody.innerHTML = ''
    const maxRows = Math.max(...dates.map(d => currentScheduleData![d].length))
    
    for (let i = 0; i < maxRows; i++) {
        const tr = document.createElement('tr')
        tr.className = "hover:bg-app-bg"
        dates.forEach(date => {
            const td = document.createElement('td')
            td.textContent = currentScheduleData![date][i] || ""
            td.className = "px-4 py-1 border-r border-secondary border-b border-log-bg"
            tr.appendChild(td)
        })
        scheduleBody.appendChild(tr)
    }

    selectedDates.clear()
    updateSelectedDates()
}

function toggleDateSelection(date: string, th: HTMLTableCellElement) {
    if (selectedDates.has(date)) {
        selectedDates.delete(date)
        th.classList.remove("bg-accent", "text-app-bg")
    } else {
        selectedDates.add(date)
        th.classList.add("bg-accent", "text-app-bg")
    }
    updateSelectedDates()
}

function updateSelectedDates() {
    selectedDatesInput.value = Array.from(selectedDates).join(",")
}

btnScan.addEventListener('click', async () => {
    if (!currentPdfId) {
        alert("Please upload a PDF first.")
        return
    }

    const userInput = [selectedDatesInput.value, manualInput.value].filter(Boolean).join(",")
    if (!userInput) {
        alert("Please select at least one date or enter manual input.")
        return
    }

    btnScan.disabled = true
    scanStatus.textContent = "Scanning..."
    resultText.textContent = "—"
    btnCopy.disabled = true
    btnPrint.disabled = true
    btnSave.disabled = true

    log(`\n───────────────────────────────────────────────────────`, "text-accent font-bold")
    log(`  PDF:   ${pdfFileName.value}`, "text-accent font-bold")
    log(`  Input: ${userInput}`, "text-accent font-bold")
    log(`───────────────────────────────────────────────────────`, "text-accent font-bold")

    try {
        const res = await fetch(`${API_BASE}/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pdf_id: currentPdfId,
                user_input: userInput,
                schedule_data: currentScheduleData || {}
            })
        })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()

        data.logs.forEach((msg: string) => {
            if (msg.includes("SUCCESS") || msg.includes("RESULTS")) {
                log(msg, "text-success")
            } else if (msg.includes("[CACHE]") || msg.includes("[SCHEDULE]") || msg.includes("[SCAN]")) {
                log(msg, "text-accent")
            } else {
                log(msg)
            }
        })

        lastScanResults = data.results
        lastFormattedResult = data.formatted
        
        log(`\n=== FINAL RESULTS ===`, "text-gold font-bold")
        log(`  ${data.formatted}`, "text-success")
        
        resultText.textContent = data.formatted
        scanStatus.textContent = "Done ✓"

        btnCopy.disabled = false
        btnPrint.disabled = false
        btnSave.disabled = false
    } catch (e: any) {
        scanStatus.textContent = "Error ✗"
        log(`\n⚠️ Error: ${e.message}`, "text-red-500")
        alert(`Scan error: ${e.message}`)
    } finally {
        btnScan.disabled = false
    }
})

// Log Panel
function log(msg: string, className: string = "text-text") {
    const p = document.createElement("div")
    p.textContent = msg
    p.className = `whitespace-pre-wrap ${className}`
    logContainer.appendChild(p)
    logContainer.scrollTop = logContainer.scrollHeight
}

btnClearLog.addEventListener('click', () => {
    logContainer.innerHTML = ''
})

btnCopy.addEventListener('click', () => {
    if (lastFormattedResult) {
        navigator.clipboard.writeText(lastFormattedResult)
        scanStatus.textContent = "Copied ✓"
    }
})

async function triggerPdfDownload(blob: Blob, defaultFilename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

btnSave.addEventListener('click', async () => {
    if (!lastScanResults || !currentPdfId) return
    btnSave.disabled = true
    try {
        const res = await fetch(`${API_BASE}/export_pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pdf_id: currentPdfId,
                scan_results: lastScanResults
            })
        })
        if (!res.ok) throw new Error(await res.text())
        const blob = await res.blob()
        const match = res.headers.get("content-disposition")?.match(/filename="(.+)"/)
        const filename = match ? match[1] : `hymns_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`
        
        await triggerPdfDownload(blob, filename)
        scanStatus.textContent = "Saved ✓"
        log(`\nSaved PDF to downloads folder.`, "text-success")
    } catch (e: any) {
        alert("Export error: " + e.message)
    } finally {
        btnSave.disabled = false
    }
})

btnPrint.addEventListener('click', async () => {
    if (!lastScanResults || !currentPdfId) return
    btnPrint.disabled = true
    try {
        const res = await fetch(`${API_BASE}/export_pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pdf_id: currentPdfId,
                scan_results: lastScanResults
            })
        })
        if (!res.ok) throw new Error(await res.text())
        const blob = await res.blob()
        const fileUrl = URL.createObjectURL(blob)
        
        // Open in new tab or iframe to print
        const win = window.open(fileUrl, "_blank")
        if (win) {
            win.onload = () => {
                win.print()
            }
        }
        scanStatus.textContent = "Printed ✓"
    } catch (e: any) {
        alert("Print error: " + e.message)
    } finally {
        btnPrint.disabled = false
    }
})
