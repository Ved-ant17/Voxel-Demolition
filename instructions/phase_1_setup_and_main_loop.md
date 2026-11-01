# Phase 1: Setup and Main Loop

## Objective
Set up the foundational HTML structure, import the necessary libraries (Three.js and Cannon-es), and create the main orchestrator script (`main.js`) that will drive the rendering and physics loops.

## Instructions

1.  **Create `index.html`:**
    *   Set up a standard HTML5 boilerplate.
    *   Add a full-screen `<canvas>` element with the id `gameCanvas`.
    *   Use an `<script type="importmap">` to map bare specifiers for `three` and `cannon-es` to a CDN (like unpkg or skypack).
    *   Link the main module script: `<script type="module" src="main.js"></script>`.
    *   Add basic CSS to remove margins and hide overflow (`body { margin: 0; overflow: hidden; }`).

2.  **Create `main.js`:**
    *   Import Three.js.
    *   Select the `gameCanvas` element.
    *   Initialize a `THREE.WebGLRenderer`. Set its size to the window inner dimensions and enable shadows.
    *   Create placeholders for `scene`, `camera`, and `world` (Cannon-es physics world) which will be populated by other modules later.
    *   Handle the `window.addEventListener('resize', ...)` event to update the renderer size and camera aspect ratio.
    *   Set up the `requestAnimationFrame` loop. Inside this loop, you will eventually call updates for physics, controls, weapons, and then render the scene: `renderer.render(scene, camera)`.

## Expected Output
A blank canvas that successfully initializes WebGL without any console errors, ready to receive scene objects.