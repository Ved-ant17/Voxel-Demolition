# Phase 3: City Generation

## Objective
Procedurally generate a large number of voxel-based buildings using `THREE.InstancedMesh` for optimal performance.

## Instructions

1.  **Create `city.js`:**
    *   Define voxel dimensions (e.g., 1x1x1 units).
    *   Determine a grid layout for the city (e.g., 5x5 blocks of buildings).
    *   Calculate the total maximum number of voxels you might need (e.g., 100,000) for the instanced mesh.
    *   Create a single `THREE.BoxGeometry(1, 1, 1)` and a `THREE.MeshStandardMaterial` (use an array of materials if you want glowing windows, but a single dark material with slight emissive properties is a good start).
    *   Instantiate `THREE.InstancedMesh(geometry, material, totalVoxels)`.
    *   Write a loop that iterates through building plots. For each building, determine a random width, depth, and height in voxels.
    *   Use a nested loop (x, y, z) to place individual voxels for that building. 
    *   Use a `THREE.Object3D` dummy. Set its position for the current voxel, call `dummy.updateMatrix()`, and apply it to the instanced mesh: `instancedMesh.setMatrixAt(index, dummy.matrix)`.
    *   Keep track of the voxel data (position, building ID, and instance index) in an array or map so it can be queried later during destruction.

## Expected Output
A sprawling nighttime cityscape rendered efficiently in a single draw call. The camera can fly through the dense voxel skyscrapers smoothly at 60 FPS.