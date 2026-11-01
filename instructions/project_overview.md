# Voxel Demolition: Anti-Gravity Destruction Simulator

## Project Summary
A real-time 3D web application built with Three.js and Cannon-es. The project simulates a dark, neon-lit nighttime voxel cityscape where users can fly around in a first-person view and fire rockets at buildings. Instead of standard explosion animations, the structures procedurally break apart into individual voxel chunks that drift into the sky using anti-gravity physics.

## Core Technologies
*   **Three.js (WebGL):** Handles the 3D rendering. Uses `THREE.InstancedMesh` heavily to render tens of thousands of static building voxels efficiently in a single draw call.
*   **Cannon-es:** A lightweight 3D physics engine running in the background. It calculates the collisions, velocities, and anti-gravity drifting for the detached building chunks.
*   **HTML5/ES6 JavaScript:** Built using modern JavaScript modules and native browser APIs (like Pointer Lock for the camera).

## Architectural Phases
To keep the codebase understandable and debuggable, the logic is divided into distinct systems:
1.  **Setup and Main Loop:** Initializes the WebGL context, the scene, and the core `requestAnimationFrame` loop that drives the entire simulation.
2.  **Environment and Controls:** Sets up the dark, foggy nighttime aesthetics and implements a free-flying first-person camera.
3.  **City Generation:** Uses procedural loops and math to calculate building grids, feeding them into a high-performance instanced mesh.
4.  **Weapons and Collision:** Spawns rocket projectiles, moves them forward, and uses Raycasting to detect exact impact coordinates on the city mesh.
5.  **Physics and Destruction:** Hides impacted static voxels, spawns dynamic physical chunks in their place, and applies explosive forces and anti-gravity.

## Visual Aesthetic
*   Dark depth fog and ambient shadows.
*   "Glowing" emissive materials representing lit windows scattered across the voxel grids.
*   Surreal destruction where debris floats slowly upwards into the night sky instead of falling to the ground.