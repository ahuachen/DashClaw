---
source-of-truth: true
owner: Frontend Lead
last-verified: 2026-02-19
doc-type: decision
---

# Decision Record: Dashboard Redesign & Tile Visibility

**Date:** 2026-02-19
**Status:** Approved
**Context:** The dashboard layout had become cluttered as new features (Evaluation, Drift, Learning, etc.) were added. Tiles were stacked chronologically rather than by importance. Additionally, users needed a way to declutter their view without affecting the underlying grid structure.

## The Problem
1.  **Poor Information Hierarchy:** Critical status indicators (Fleet Presence) were mixed with secondary metrics.
2.  **Visual Noise:** The dashboard displayed over 20 tiles by default, which was overwhelming for some users.
3.  **Layout Fragmentation:** Breakpoints (lg, md, sm) were inconsistent and didn't maximize space efficiently.

## The Solution
1.  **Redesigned Default Layout:**
    - Established a "Newspaper" style hierarchy.
    - Top row dedicated to full-width fleet status.
    - Secondary rows for high-frequency operational cards (Risk, Actions).
    - Grouped tiles by functional domain (Intelligence, Quality, Resources).
2.  **Tile Visibility Toggle:**
    - Added a "Customize" modal allowing users to show/hide individual tiles.
    - Used `localStorage` (`dashclaw_hidden_tiles`) for persistent visibility state.
    - Filtered both the grid items and the layout configurations to maintain grid integrity when tiles are hidden.
3.  **Versioned Layout State:**
    - Incremented `LAYOUT_VERSION` to `5` in `dashboardLayoutState.js` to force-refresh all client dashboards to the new redesigned and fixed layout.

## Fixes Included
1.  **ScoringProfileCard Structural Fix:** Corrected a bug where the card would render `null` during loading, causing the grid cell to collapse and the resize handle to float. It now uses `CardSkeleton` for proper layout preservation and `h-full` to correctly fill the grid cell.

## Key Constraints Respected
- **Stability:** Maintained `useContainerWidth` and `measureBeforeMount` to prevent the zero-width initialization bug documented in `2026-02-13-revert-draggable-dashboard.md`.
- **Interactivity:** Preserved `draggableCancel` to ensure buttons and links within cards remain clickable.
- **Performance:** Used a single `localStorage` key for visibility to avoid fragmentation and kept the existing layout persistence logic intact.

## Alternatives Considered
- **Role-Based Layouts:** Considered predefined layouts based on user role (Dev vs Ops), but opted for user-level customization as it provides more flexibility.
- **Auto-Hiding:** Considered hiding low-activity tiles automatically, but decided against it to maintain predictable spatial memory for the user.

## Future Recommendations
- Store visibility and layout state in the database (user settings) for cross-device synchronization.
- Implement "Collapse to Widget" mode for large cards.
