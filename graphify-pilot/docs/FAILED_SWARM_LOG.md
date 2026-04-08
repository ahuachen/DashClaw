# FAILED SWARM INTELLIGENCE LOG
**Date:** February 19, 2026
**Status:** CRITICAL FAILURE
**Context:** Attempts to build a "living," interactive, force-directed graph for agent swarm visualization failed repeatedly, resulting in broken UX, build crashes, and wasted resources.

## The Objective
Transform the static "Swarm Intelligence" circle graph into an interactive, physics-based "Neural Web" where:
1.  Agents actively "walk" and drift (organic movement).
2.  Users can zoom (scroll) and pan (drag background).
3.  Users can drag specific agents.
4.  Data packets animate along links.
5.  Selection is clean (click to select, click background to deselect).

## The Failure Timeline & Technical Root Causes

### Attempt 1: The Static Circle
*   **Approach:** Calculated static `(x, y)` coordinates based on `Math.cos/sin` in a circle.
*   **Result:** boring, static. User requested organic movement.

### Attempt 2: Zero-Dependency Physics (React State Coupling)
*   **Approach:** Wrote a basic Verlet integration loop inside a `useEffect`.
*   **The Failure:** 
    *   **Movement:** Agents didn't move.
    *   **Root Cause:** I was mutating the `node` objects in place (`node.x += vx`). React's shallow comparison did not detect these changes, so the SVG never re-rendered the new coordinates. The physics ran in the background, but the UI stayed frozen.

### Attempt 3: "High Energy" Physics (Decoupling attempt)
*   **Approach:** Decoupled physics state into a `useRef` and tried to force React updates by cloning the array: `setNodes(sim.nodes.map(n => ({...n})))`.
*   **The Failure:**
    *   **Scrolling:** Scroll-to-zoom conflicted with browser page scrolling. React's `onWheel` is passive by default, meaning `e.preventDefault()` failed, causing the whole dashboard to move away while zooming.
    *   **Dragging:** Coordinate mismatch. The mouse coordinates (Screen Space) were not being correctly inversely transformed by the Pan/Zoom matrix before being applied to the Physics World Space. Agents "jumped" or didn't follow the mouse.
    *   **Selection:** "Hover-only" selection frustrated the user because they couldn't interact with the side panel without the context disappearing.

### Attempt 4: The Build Crash (Carelessness)
*   **Approach:** Attempted to fix the physics loop constants and variable declarations.
*   **The Failure:** 
    *   **Code:** `s.links = newLinks;` followed by defining `const newLinks = ...`.
    *   **Result:** `Uncaught ReferenceError: newLinks is not defined`.
    *   **Impact:** The entire dashboard crashed (White Screen of Death) in production.

## Current Technical Debt (What is currently in `main`)

The codebase currently contains a custom, home-rolled physics engine (`app/swarm/useForceSimulation.js`) that is fragile.

1.  **Performance Risk:** Forcing a React re-render on every requestAnimationFrame (60fps) for 50+ nodes involves significant object cloning and DOM reconciliation overhead.
2.  **Interaction Fragility:** The "Scroll Lock" relies on a native DOM event listener attached via `ref`. If the component unmounts or refs shift, the lock breaks.
3.  **Physics Instability:** The repulsion constants (`80,000`) and jitter (`2.5`) are tuned extremely high to force visibility, which may cause nodes to "explode" outwards or jitter uncontrollably on different screen sizes.

## Recommendations for Next Engineer

**DO NOT** continue patching `useForceSimulation.js`. It is a sunk cost.

1.  **Use D3-Force:** Replace the custom hook with `d3-force`. It is the industry standard for a reason. It handles the tick logic, stability (alpha decay), and coordinate updates far better than a home-rolled Verlet loop.
2.  **Canvas vs SVG:** For 50+ moving nodes with glows and animations, consider switching the graph rendering from SVG to **HTML5 Canvas** (via `react-force-graph` or raw Canvas API). React reconciling 50 `<g>` and `<line>` elements at 60fps is the bottleneck.
3.  **React-Use-Gesture:** Use a library like `@use-gesture/react` for handling the drag/pinch/wheel logic. It normalizes browser events and handles the `passive: false` requirements automatically.

**Files to Revert/Refactor:**
- `app/swarm/useForceSimulation.js` (Delete/Replace)
- `app/swarm/page.js` (Simplify render logic)
