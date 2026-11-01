# Phase 2: Environment and Controls

## Objective
Create the visual atmosphere for the nighttime city and implement a flying first-person camera.

## Instructions

1.  **Create `environment.js`:**
    *   Export a function `createEnvironment()`.
    *   Inside, instantiate a `THREE.Scene`.
    *   Set the scene background to a very dark blue/black (`#0a0a1a`).
    *   Add `THREE.FogExp2` with the same dark color to create depth and hide the edges of the world.
    *   Add a `THREE.AmbientLight` (dim) and a `THREE.DirectionalLight` (simulating moonlight).
    *   Create a large, flat ground plane using `THREE.PlaneGeometry` and a dark, non-reflective material.
    *   Return the `scene`.

2.  **Create `controls.js`:**
    *   Export a function `setupControls(canvas)`.
    *   Instantiate a `THREE.PerspectiveCamera` (FOV ~75).
    *   Implement keyboard listeners for W, A, S, D, Space (Up), and Shift (Down) to track movement intent.
    *   Implement mouse/pointer lock controls. When the user clicks the canvas, request pointer lock. Use `mousemove` events to adjust the camera's yaw and pitch (rotation).
    *   Export an `updateControls(camera, deltaTime)` function to be called in `main.js`. This function translates the camera based on the active movement keys and the direction the camera is facing.

## Expected Output
A dark scene with a ground plane where the user can click to lock the mouse, look around freely in 3D space, and fly around using WASD keys.