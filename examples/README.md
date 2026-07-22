# Grep Finder — example workspace

These files exist so you can **test the finder**. They live in different
folders and subfolders, they are all **unique**, but they deliberately
**share the same words** so a single search matches across many files.

## Shared tokens to search for

| Search this                     | Appears in                                      |
|---------------------------------|-------------------------------------------------|
| `calculateInvoiceTotal`         | 6 files across `billing/`, `services/`, `reports/`, `scripts/` |
| `grep-finder demo`          | a `TODO` comment in every example file          |
| `rounding`                      | several files, with different surrounding code  |
| `processing invoice batch`      | a log string in a few files                     |

## How to test

1. Press **F5** to launch the Extension Development Host with this repo open.
2. Click the **Grep Finder** icon in the Activity Bar.
3. Search `calculateInvoiceTotal`.
   - You should see one result group **per file**, in different folders.
   - Set **Both (-C)** to `2` to see context lines around each match (grep-style).
4. **Click** a result in **4 different files** to select each (rounded
   highlight), then click **Open 4 in grid**.
   - The editor splits into a **2×2 grid**, each pane scrolled to its match.
   - Scroll one pane — the others stay put (independent navigation).
5. To prove independent navigation on the *same* file, select two matches inside
   `billing/invoice.ts` and open them in a grid: two panes of one file, each at
   a different line.
6. Double-click any result to just open that one file at its match line, and use
   the chevron on a file header (or the collapse-all button) to fold results.

## Folder map

```
examples/
  billing/
    invoice.ts
    legacy/
      invoice_v1.ts
  services/
    orders/
      order-service.ts
      helpers/
        totals.ts
  reports/
    monthly/
      summary.ts
  scripts/
    migrate.js
```
