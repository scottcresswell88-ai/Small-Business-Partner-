# Small Business Partner

A personal assistant app for small business owners. It runs in the browser (desktop or phone) and keeps your data on your device.

## Features

### 🧮 Tax & GST calculator
- Shows what percentage of every dollar you receive to put aside for **GST** and **income tax**.
- Australia (10% GST) and New Zealand (15% GST), for sole traders and companies.
- Enter figures per year, quarter, month or week. Tax is projected over a full year so the right brackets apply.
- Counts GST credits on expenses, the Medicare levy (AU) or ACC levy (NZ), and other income such as wages that push you into a higher bracket.
- **"Got paid? Split it now"**: enter a payment to see exactly how much goes to GST, how much to tax, and how much is yours.
- Warns you when your turnover passes the GST registration threshold.

Rates live in `src/lib/tax.ts`. Update them each financial year.

### 🧾 Receipts & expenses
- **Scan** a receipt with your phone camera, upload photos or **PDF receipts**, or **paste the text of an emailed receipt**.
- Digital PDFs are read straight from their text, which is very accurate. Photos and scanned PDFs go through text recognition (Tesseract) **in the browser**. Either way the app suggests the supplier, date, total and GST for you to check. Nothing leaves your device.
- GST is worked out from the total automatically (10% AU / 15% NZ), or you can choose another amount or GST-free.
- Tag each receipt to a client or job and a category, and mark it billable or not.
- Filter by client and date range to get an **expense invoice** for rebilling:
  - **GST registered:** the expense is rebilled at its GST-exclusive cost, plus any markup, with GST added. With no markup the client pays exactly what the receipt shows.
  - **Not registered:** the full amount you paid is rebilled, with no GST.
- **Save as PDF**, **export to CSV** (for Xero, MYOB or a spreadsheet), and **mark expenses as invoiced** so you never bill them twice.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # production build in dist/
```

### Live site

Every push to `main` runs the tests and publishes the app to GitHub Pages:
**https://scottcresswell88-ai.github.io/Small-Business-Partner-/**

On your phone, open the link and choose **Add to Home Screen** (Safari: Share menu; Chrome: ⋮ menu) to use it like an app.

One-time setup: the repository must be public (or on a paid GitHub plan), and **Settings → Pages → Source** must be set to **GitHub Actions**.

## Project structure

```
src/
  App.tsx                 # navigation – add new features to the FEATURES list
  features/
    tax/                  # Tax & GST calculator screen
    receipts/             # Receipt scanning, editing, expense statement
  lib/
    tax.ts                # tax brackets, GST rules and the estimate engine
    receiptParser.ts      # pulls supplier/date/total/GST out of OCR text
    expenses.ts           # rebilling totals and CSV export
    ocr.ts                # self-hosted Tesseract worker + image downscaling
    pdf.ts                # PDF receipt text extraction and page rendering (pdf.js)
    storage.ts            # IndexedDB (receipts) and localStorage (settings)
scripts/copy-ocr-assets.mjs  # copies OCR engine + language data into public/ocr
```

## Data and privacy

Receipts are stored in the browser's IndexedDB, and settings in localStorage. Nothing is sent to a server. Clearing your browser data deletes them, so export CSVs regularly. Cloud backup and sync are planned.

## Disclaimer

Tax figures are estimates using standard resident rates. They don't account for tax offsets, HELP or student loan repayments, super, provisional tax timing or your individual circumstances. Check with your accountant.
