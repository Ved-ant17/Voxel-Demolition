# Phase 4: Weapons and Collision

## Objective
Allow the user to fire rockets from the camera's position and detect when those rockets hit the instanced city mesh.

## Instructions

1.  **Create `weapons.js`:**
    *   Maintain an array of active rockets.
    *   Export a `fireRocket(camera, scene)` function. Bind this to a mouse click event in `main.js` (or `controls.js`).
    *   When fired, create a small `THREE.CylinderGeometry` mesh to represent the rocket. Set its initial position to the camera's position.
    *   Extract the camera's forward directional vector. Apply velocity to the rocket along this vector. Add the rocket to the scene and the active rockets array.
    *   Export an `updateWeapons(deltaTime, scene, cityMesh)` function.
    *   Inside the update loop, move each rocket forward.
    *   **Collision Detection:** For each rocket, use a `THREE.Raycaster`. Set the raycaster's origin to the rocket's position and its direction to the rocket's velocity vector. Check for intersections with `cityMesh` (the InstancedMesh).
    *   If an intersection distance is less than the rocket's speed per frame, a hit has occurred! Remove the rocket, and trigger a destruction callback with the intersection point.

## Expected Output
The ability to left-click to shoot glowing projectiles that fly straight. When they strike a building, they disappear, logging the exact 3D coordinate of the impact to the console.