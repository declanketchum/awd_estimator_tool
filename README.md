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

The app reads from a published Google Sheets CSV URL in `CSV_SOURCE_URL` inside `src/app.js`.

Current source:

`https://docs.google.com/spreadsheets/d/e/2PACX-1vRMpK2oJSiJb4_JUHEXu1ThT4U33ByWK46jZNR8isA5KSLDY3BkM_p1UTf_LF6BKBfQbHrTVPNCg31q/pub?output=csv`

## CSV format expected

The parser expects a header row with these columns (case-insensitive matching):

- `Type` (or `Types`) -> used to create one panel per unique type
- `Item Description`
- `Link`
- `Item Size`
- `Price per unit`
- `Est.Hrs`
- Van compatibility columns: `Promaster`, `Sprinter`, `Transit`, `Other`

Compatibility columns use `x` (or `yes`, `true`, `1`) to mark that an item works with a van type.

Behavior:

- Panels are grouped by unique `Type` values.
- Panel dropdown options include only items from that panel's `Type`.
- Dropdown options are additionally filtered by selected van type.
