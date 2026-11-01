# Phase 5: Physics and Destruction

## Objective
Implement Cannon-es to handle the anti-gravity physics and create the localized voxel destruction logic.

## Instructions

1.  **Create `physics.js`:**
    *   Export `initPhysics()`. Create a `CANNON.World`. 
    *   *Anti-Gravity Note:* Set the gravity vector to something floating or upwards, e.g., `world.gravity.set(0, 2, 0)` or `0, 0, 0` for pure float, based on the specific "antigravity" vibe requested.
    *   Export an `updatePhysics(deltaTime)` function to call `world.step()`.

2.  **Implement the Destruction Logic (in `city.js` or a new `destruction.js`):**
    *   When the weapon raycaster detects a hit at `impactPoint`:
    *   Iterate through your stored voxel data. Find all voxels where the distance to `impactPoint` is less than the `blastRadius` (e.g., 3 units).
    *   **Hide Instances:** For each affected voxel, use the dummy object to scale its matrix to `0,0,0` and update the instanced mesh: `instancedMesh.setMatrixAt(index, dummy.matrix)`. Set `instancedMesh.instanceMatrix.needsUpdate = true`.
    *   **Spawn Debris:** For each hidden voxel, create a dynamic `CANNON.Body` (box shape) at that exact coordinate and add it to the physics world. Create a corresponding individual `THREE.Mesh` and add it to the scene.
    *   **Explosive Force:** Calculate a vector from the `impactPoint` to the voxel's position. Normalize it and multiply by an impulse scalar. Apply this as a local impulse to the Cannon body so the chunks blast outward.
    *   Inside your main animation loop, synchronize the position and rotation of the standalone Three.js debris meshes to their corresponding Cannon.js bodies.

## Expected Output
When a rocket hits a building, a spherical chunk of the building disappears from the static mesh. Individual cubes spawn in their place, blasting outward and floating away (due to the anti-gravity physics), leaving a persistent crater in the building.