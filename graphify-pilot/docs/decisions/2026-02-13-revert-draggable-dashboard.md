---
source-of-truth: true
owner: Frontend Lead
last-verified: 2026-02-13
doc-type: decision
---

# Decision Record: Reverting Draggable Dashboard

**Date:** 2026-02-13
**Status:** Superseded (re-implemented 2026-02-15)
**Context:** Attempted to replace the static CSS Grid dashboard with a customizable, drag-and-drop version using `react-grid-layout`.

## The Attempt
We refactored `app/components/DraggableDashboard.js` to use `react-grid-layout`'s `Responsive` grid. We implemented:
1.  **State Persistence:** Saving layout positions and hidden widgets to `localStorage`.
2.  **Custom WidthProvider:** A `ResizeObserver`-based HOC to handle container width measurement.
3.  **Edit Mode:** A toolbar for toggling drag/drop and visibility.
4.  **Robust Imports:** Workarounds for Next.js/Webpack ESM interop issues with the library.

## The Problem
Despite correct code structure and explicit breakpoint definitions, the dashboard persistently rendered as a **single vertical column of 1x1 cells** on the left side of the screen in production-like environments.

### Symptoms
- Grid items stacked vertically instead of flowing into columns.
- Items appeared to have minimal or zero width.
- The layout would briefly flash correct positions before collapsing, or stay collapsed.
- "Resetting" the layout (clearing localStorage) did not resolve the issue reliably.

### Root Cause Analysis
The issue stems from a conflict between `react-grid-layout`'s absolute positioning engine and the CSS/container environment in our Next.js app.
1.  **Zero-Width Initialization:** React's hydration or initial render often reports a width of `0` for the container before the DOM is fully painted. `react-grid-layout` interprets `width={0}` as "mobile view" and forces a single column.
2.  **CSS Isolation:** Even with `ResizeObserver` fixing the width number dynamically, the absolute positioning styles (`transform: translate(...)`) seemed to be fighting with existing CSS or not applying fast enough, leading to visual artifacts.
3.  **Complexity vs. Value:** The effort required to debug the specific race condition between the `WidthProvider`, CSS loading, and React hydration outweigh the immediate value of a movable dashboard, especially when the static grid works perfectly.

## The Decision
**Revert to the static CSS Grid.**

We are prioritizing stability and a clean user experience over customizability for now. The static grid is:
- **Reliable:** Always renders 4 columns on desktop.
- **Fast:** No JavaScript calculation overhead for layout.
- **Maintainable:** Standard Tailwind classes (`grid-cols-4`) are easier to debug than inline styles calculated by a library.

## Future Recommendations
If we attempt a draggable dashboard again:
1.  **Use a different library:** Consider `dnd-kit` or `react-beautiful-dnd` with a simple sortable list approach instead of a complex 2D grid.
2.  **Server-Side Layout:** Store layout preferences in the database (user settings) rather than `localStorage` to avoid hydration mismatches.
3.  **Strict Container:** Ensure the parent container has explicit dimensions before the grid mounts.

## Addendum: Re-implemented (2026-02-15)

The draggable dashboard was successfully re-implemented using `react-grid-layout` v2.2.2's new `useContainerWidth` hook. The key fixes:

1. **`useContainerWidth({ measureBeforeMount: true })`** — gates rendering until width is measured via `ResizeObserver`, eliminating the zero-width initialization bug.
2. **`dynamic(() => import(...), { ssr: false })`** — already in place from `app/dashboard/page.js`, avoids hydration mismatch entirely.
3. **`draggableCancel` instead of `draggableHandle`** — excludes interactive elements (links, buttons, inputs) from drag without requiring card-level modifications.
4. **Versioned localStorage** — `dashboardLayoutState.js` with version key to invalidate stale layouts on future schema changes.
5. **"Reset Layout" button** — key-based remount clears saved positions and restores defaults.
