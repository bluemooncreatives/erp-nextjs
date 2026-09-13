# Dashboard source audit

Source: `emp-dashboard/src/features/agents/pages/AgentDashboard.tsx`. Shared primitives and global design: `ui/src/components/ui` and `ui/src/styles/theme.css`. ERP destination: `app/(dashboard)/home/page.tsx`.

| Source section | ERP section | Presentation retained |
| --- | --- | --- |
| Welcome and actions | Welcome, New sale, Review sales | Responsive heading and primary/soft action buttons |
| Candidates | Total sale | Narrow illustrated highlight, caption pill and trend |
| Four supporting statistics | Purchases, expense, invoice due, net profit (permission filtered) | Colored icon tiles, large figures, caption pills |
| Interview throughput + report | Sales throughput + financial report | One outlined split card; chart occupies two thirds on desktop |
| Candidate breakdown | Cash position | Five icon rows, amounts and percentage annotations |
| Weekly overview | Sales vs purchases | Rounded bars with an overlaid line and summary; Details link |
| Pipeline by role | Stock by branch | Five SVG progress rings, descriptions and percentage badges |
| Top candidates | Top customers | Leading avatar, highlighted amount, comparison, stacked avatars with tooltips |
| Recent sessions | Payment due list | Full-width desktop table; stacked activity cards below xl |
| Workspace | ERP modules | Three-column shortcut grid with module icons |

## Chart implementation

- Charts use Recharts and the shared `ChartContainer`/`ChartTooltipContent` primitives, not ApexCharts.
- Throughput uses `AreaChart` and a linear `Area`, 2px primary stroke, fill opacity 0.6, a vertical gradient fading from opacity 1 at 20% to 0 at 80%, horizontal dashed grid lines, labeled X axis and custom Y ticks. The ERP series is monthly approved invoice value for the current year.
- Comparison uses `ComposedChart`, 20px rounded bars tinted with 20% primary, and a linear 3px primary line with white 3px dots. Horizontal grid lines are dashed. As in the source, there is no visible X axis; series values appear in the tooltip. ERP bars represent sales; the line represents purchases for the corresponding month.
- Branch rings use 52px SVGs, 23.5px radius, 5px stroke and the five chart accent colors. ERP percentages compare each branch with the largest stock holding; they are not capacity utilization.
- Top customers is a ranked spotlight, not a graph. Its comparison average is for the displayed top-five customers.

## Shared global code

The existing ERP port includes DM Sans/JetBrains Mono, light/dark semantic tokens, the same chart palette, card spacing variables, ring outlines, rounded corners, badges, avatars, dropdowns, skeletons and table styles. ERP fonts load through Next font. Saved ERP appearance values override the defaults. Theme overrides now reference separate default tokens instead of self-referencing CSS variables, keeping both saved colors and unset defaults valid.

Next-specific adaptations use Next links, server database queries, permission checks, serializable number-format settings, and router refresh in overflow menus. Interview subscription/plan UI is represented by ERP actions rather than introducing interview billing logic. ERP stock alerts and to-do panels remain available beneath the main dashboard.

The route loading boundary uses the same card components and grid while data loads. `scripts/verify-dashboard.mjs` performs a read-only authenticated local browser check and writes desktop/mobile/dark screenshots under `artifacts/dashboard`.

## Rollout beyond the dashboard

The dashboard homepage was the first screen onto the design system; these are the changes that carried the same vocabulary across the rest of the app.

### Dropdowns

Every select in the product was a native `<select>`. It could be made to match `Input` when closed, but its open list is drawn by the operating system and no stylesheet reaches it, so each dropdown left the design system the moment it was clicked - system font, system highlight, system scrollbar.

`components/erp/select-control.tsx` renders the Radix listbox with a hidden input carrying the value under the same `name`, so `FormData` receives exactly what the native control submitted. `FormSelect` delegates to it, which moved all 107 call sites at once; the 13 remaining selects - line-item editors and GET filter forms - use `SelectControl` directly. `e.target.value` handlers keep working: the change event is passed through in native shape. There are now no native `<select>` elements left. The one thing given up is submitting with JavaScript disabled, on screens that already depended on client state for their own totals.

### The summary tile row

Every list screen in the source design system opens with `PageHeader`, then a row of `StatCard`s, then the table. The ERP port had the header and the table but carried its figures inside the card's title string - "Suppliers (12) - $4,300.00". Those figures now sit in a `ReportSummary` tile row and the card title is just a title. 86 of 105 table screens now carry the row; the remainder are print views and record-detail pages, where a KPI row is not the right shape.

### Toolbar, pagination, sorting

- `components/erp/data-toolbar.tsx` is the source `DataToolbar` driven by the URL rather than local state: debounced search, filter selects, a chip per active filter with its own clear, "Clear all", and a result count. Filters reset paging, since page 4 of a narrower list rarely exists.
- `Pagination` was rebuilt to `DataPagination`'s shape: "Showing 1-10 of 48" or "No results", a page window that collapses gaps to ellipses rather than sliding a fixed three-page strip (page 1 and the last page used to drop out of reach entirely on a long list), a compact "3 / 12" on phones, and an opt-in rows-per-page control.
- `DataTable` accepts a `sort` descriptor and `sortKey` per column, drawing link-based sort headers that cycle ascending, descending, unsorted. It is opt-in per screen: a listing has to read `sort`/`dir` in its own query before its headers can offer it.
