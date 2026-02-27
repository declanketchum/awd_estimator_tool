# AGENTS.md

Guidance for autonomous coding agents working in `awd_estimator_tool`.

## Project Snapshot

- Stack: Vite + vanilla JavaScript + static HTML/CSS.
- Entry point: `index.html` loads `src/app.js` as an ES module.
- Runtime data source:
  - Google Drive published CSV URL in `CSV_SOURCE_URL`.
- Output: static site build in `dist/`.

## Rule Files Status

- Checked for Cursor rules in `.cursor/rules/` and `.cursorrules`.
- Checked for Copilot instructions in `.github/copilot-instructions.md`.
- Result: no Cursor/Copilot rule files currently exist in this repository.
- If these files are added later, treat them as highest-priority repo rules and merge them into this guide.

## Install / Run / Build Commands

Run commands from repository root: `/Users/declan/Documents/awd_estimator_tool`.

- Install dependencies:
  - `npm install`
- Dev server scripts (do not run in this environment):
  - `npm run dev`
  - `npm start` (alias)
- Build production bundle:
  - `npm run build`
- Preview production bundle locally:
  - `npm run preview`
- GitHub Pages CI build:
  - Workflow passes Vite `--base` dynamically (`/` for `*.github.io` repos, `/<repo>/` otherwise).

Environment note:

- Do not run localhost-starting npm scripts (`npm run dev`, `npm start`) in this repo.
- A development server is already managed externally in the background.

## Lint / Format / Test Commands

Current state (important):

- No lint script is defined in `package.json`.
- No formatter script is defined in `package.json`.
- No test framework or test script is currently configured.

What to do right now:

- Use `npm run build` as the required validation step.
- Do not start a local dev server from this agent session.

Single-test command guidance:

- There is no working single-test command yet because tests are not set up.
- If tests are introduced, add a script and document single-test usage immediately.
- Recommended future convention (Vitest example):
  - `npx vitest run path/to/file.test.js`
  - `npx vitest run path/to/file.test.js -t "test name"`

## Repository Layout

- `index.html`: app shell and control markup.
- `src/app.js`: all app behavior, state, rendering, and data loading.
- `styles.css`: complete visual system and responsive/print styles.
- `data/catalog.json`: legacy local catalog file (not used by current runtime flow).
- `README.md`: user-facing setup and data-source documentation.

## Code Style: JavaScript

Follow existing code conventions from `src/app.js`.

- Language level:
  - ES modules, modern browser APIs, no TypeScript.
  - Prefer `const`; use `let` only when reassignment is required.
- Semicolons:
  - Use semicolons consistently.
- Strings:
  - Prefer double quotes.
  - Template literals for interpolation and HTML markup strings.
- Formatting:
  - 2-space indentation.
  - Trailing commas in multiline object/array literals where already used.
  - Keep related helper functions grouped by responsibility.
- Function style:
  - Prefer small pure helpers for transformation (`asNumber`, `normalize`, etc.).
  - Use arrow functions for local helpers and callbacks.
  - Use descriptive function names in `camelCase`.
- Naming:
  - `camelCase` for variables/functions.
  - `UPPER_SNAKE_CASE` for module constants (for example, URL/path constants).
  - Use explicit names for domain concepts (`sectionTotals`, `selectedItemsForSection`).
- Imports:
  - No local imports currently in `src/app.js`; keep module boundaries simple.
  - If adding imports later, group third-party imports first, then local imports.
- Types (without TypeScript):
  - Enforce runtime shape with parsing/normalization helpers.
  - Convert external input to known primitives at boundaries.
  - Never trust CSV string values without coercion.

## Error Handling and Resilience

- Use `try/catch` around remote loading paths.
- Provide graceful fallback behavior instead of hard crashes.
- Throw explicit `Error` objects with actionable messages in data loaders.
- Check `response.ok` on all fetches before parsing body.
- Keep UI status messages user-readable (`dom.status.textContent`).
- Avoid swallowing errors silently; either surface status or throw.

## State and Rendering Conventions

- Keep mutable app state in a single `state` object.
- `selectedBySection` stores line-item selections as objects (`id`, `count`, `markup`), not plain id strings.
- `collapsedBySection` controls whether each panel is collapsed to header + section total.
- `viewMode` toggles Builder vs Client presentation (Client hides price-per-unit and markup columns).
- `estimate.notes` stores freeform notes entered in the top control panel.
- `estimate.clientName` and `estimate.vanInfo` store project-level customer/vehicle metadata.
- Re-render after state changes rather than mutating DOM in many places.
- Derive totals from state, not from previously rendered text.
- Keep section/item selection logic deterministic and id-based.
- Preserve normalization pipeline:
  - External data -> normalize -> internal state -> render.
- Avoid adding hidden side effects inside utility functions.

## DOM and Event Patterns

- Cache stable DOM references in a `dom` object near top of file.
- Use event delegation for dynamic section controls.
- Read input values at event boundaries, then update `state`.
- Reuse existing helper functions when adding UI behavior.
- Ensure print behavior continues to work (`window.print()` flow).

## Code Style: HTML/CSS

- Keep semantic structure (`header`, `section`, `article`, `table`).
- Preserve accessibility basics:
  - Labels bound to controls.
  - Button text clear and action-oriented.
- CSS conventions:
  - Use design tokens in `:root` for color/ink/surface values.
  - 2-space indentation and kebab-case class names.
  - Favor existing utility classes (`panel`, `no-print`, etc.).
- Responsive behavior:
  - Maintain breakpoints at ~980px and ~640px unless intentionally redesigned.
- Print support:
  - Keep `@media print` behavior aligned with on-screen estimate details for customer PDF output.

## Change Workflow for Agents

- Before editing, read relevant files fully; this repo is small.
- Prefer minimal, focused changes over large rewrites.
- Do not introduce new tooling (lint/test/framework) unless task requires it.
- Do not run localhost-starting scripts (`npm run dev`, `npm start`); rely on the externally managed dev server.
- Validate with `npm run build` after code changes.
- If UI behavior changes, manually verify key flows in the existing externally managed dev environment:
  - Load catalog from Google Drive CSV source.
  - Select van type and add/remove section items.
  - Verify totals and print action still work.
- After every significant behavior or architecture update, update `AGENTS.md` in the same change so future agents inherit current system rules and workflows.

## PR/Commit Notes Guidance

- Describe behavior impact, not just file edits.
- Mention fallback/data-loading effects explicitly when touched.
- Mention GitHub Pages base-path handling when deployment workflow changes.
- Call out any command limitations (no lint/test scripts yet).
- If you add lint/tests in the future, update this `AGENTS.md` in the same change.
