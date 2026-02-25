# Van Build Budget Estimator

Static estimator site designed for GitHub Pages. Users can pick compatible products by section, calculate labor/material/tax totals, and print the final estimate to PDF.

## Run locally

```bash
npm install
npm run dev
```

Dev server command: `npm run dev` (or `npm start`)

## Build for GitHub Pages

```bash
npm run build
```

Then publish the `dist/` folder with your preferred GitHub Pages flow.

## Data source setup

The app first tries to read the Excel file directly from `EXCEL_EMBED_URL` in `src/app.js`.

If that fails (common with Office embed links because of CORS/auth/session requirements), it automatically falls back to `data/catalog.json`.

### Why your current embed URL usually fails in browser apps

`https://1drv.ms/x/...` embed links are made for iframe rendering, not reliable JSON/Excel API access from browser JavaScript.

### Recommended production approach

1. Keep Excel as your editing source of truth.
2. Export workbook tables into `data/catalog.json` as part of your update process.
3. Commit the updated JSON to GitHub Pages.

This is the most reliable option for a fully static website.

### Optional direct Excel loading approach

If you want direct loading from OneDrive:

1. Make the workbook publicly viewable.
2. Use a direct file-download `.xlsx` URL (not embed URL).
3. Put that direct URL in `EXCEL_EMBED_URL` in `src/app.js`.

If CORS or permissions still block this, use the JSON export approach above.

## Data format expected in JSON

`data/catalog.json` uses this shape:

```json
{
  "defaultLaborRate": 115,
  "taxRate": 8.25,
  "sections": [
    {
      "name": "Floors",
      "items": [
        {
          "product": "Marine Grade Plywood + LVT",
          "materialCost": 1280,
          "laborHours": 14,
          "compatible": ["promaster", "sprinter", "transit"]
        }
      ]
    }
  ]
}
```

## Spreadsheet parsing behavior

When direct Excel load is available, each worksheet is treated as one estimate section. The parser looks for column names containing:

- Product: `product`, `item`, or `name`
- Material cost: `material cost`, `material`, `parts cost`, `price`
- Labor hours: `labor hours`, `hours`, `install hours`, `labor time`

Any other non-metadata column is treated as a compatibility column (`x`, `yes`, `1`, `true` = compatible).
