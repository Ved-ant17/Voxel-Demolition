import * as THREE from 'three';

export const VOXEL_SIZE = 1;

/**
 * Phase 3: Procedural City Generation using THREE.InstancedMesh
 * 
 * Generates a grid of voxel-based skyscrapers. Tens of thousands of individual voxels
 * are batched into a single InstancedMesh draw call for 60 FPS performance.
 * 
 * Stores voxel metadata (position, color, buildingId, active state) and provides
 * a fast spatial hash grid for instantaneous radius queries during destruction.
 */
export function createCity(scene) {
    // City grid configuration
    const gridBlocks = 6;      // 6x6 grid of building plots (36 buildings)
    const plotSpacing = 16;     // Distance between center of building plots (streets)
    const startX = -((gridBlocks - 1) * plotSpacing) / 2;
    const startZ = -((gridBlocks - 1) * plotSpacing) / 2;

    // Architectural color palettes - clear modern skyscraper tones
    const baseColors = [
        new THREE.Color('#2d3650'),
        new THREE.Color('#384360'),
        new THREE.Color('#242c42'),
        new THREE.Color('#424e70')
    ];

    // Vibrant neon window colors for glowing night city aesthetic
    const neonColors = [
        new THREE.Color('#00ffff'), // Neon Cyan
        new THREE.Color('#ffb703'), // Amber Gold
        new THREE.Color('#ff007f'), // Neon Hot Pink
        new THREE.Color('#38bdf8'), // Ice Blue
        new THREE.Color('#a855f7')  // Neon Purple
    ];

    const rawVoxelList = [];
    let buildingCounter = 0;

    // Spatial hash grid (cellSize = 4 units) for microsecond blast radius lookups
    const cellSize = 4;
    const spatialGrid = new Map();

    function getCellKey(cx, cy, cz) {
        return `${cx},${cy},${cz}`;
    }

    function addVoxelToGrid(voxel) {
        const cx = Math.floor(voxel.x / cellSize);
        const cy = Math.floor(voxel.y / cellSize);
        const cz = Math.floor(voxel.z / cellSize);
        const key = getCellKey(cx, cy, cz);
        let cell = spatialGrid.get(key);
        if (!cell) {
            cell = [];
            spatialGrid.set(key, cell);
        }
        cell.push(voxel);
    }

    // 1. Procedurally generate building dimensions and voxel coordinates
    for (let gx = 0; gx < gridBlocks; gx++) {
        for (let gz = 0; gz < gridBlocks; gz++) {
            const buildingId = buildingCounter++;
            const centerX = startX + gx * plotSpacing;
            const centerZ = startZ + gz * plotSpacing;

            // Height variation: taller skyscrapers closer to downtown center
            const distFromCenter = Math.hypot(centerX, centerZ);
            const maxCenterDist = Math.hypot(startX, startZ);
            const centerWeight = 1 - Math.min(1, distFromCenter / maxCenterDist);

            // Building footprint
            const width = Math.floor(5 + Math.random() * 4); // 5 to 8 voxels wide
            const depth = Math.floor(5 + Math.random() * 4); // 5 to 8 voxels deep
            const minH = 12 + Math.floor(centerWeight * 10);
            const maxH = 24 + Math.floor(centerWeight * 18);
            const height = Math.floor(minH + Math.random() * (maxH - minH)); // 12 to 42 voxels tall

            const bldgBaseColor = baseColors[Math.floor(Math.random() * baseColors.length)];

            for (let y = 0; y < height; y++) {
                const vy = y * VOXEL_SIZE + (VOXEL_SIZE / 2);

                for (let x = 0; x < width; x++) {
                    const vx = centerX + (x - width / 2 + 0.5) * VOXEL_SIZE;

                    for (let z = 0; z < depth; z++) {
                        const vz = centerZ + (z - depth / 2 + 0.5) * VOXEL_SIZE;

                        // Check if voxel is on the outer facade
                        const isFacade = (x === 0 || x === width - 1 || z === 0 || z === depth - 1);

                        let voxelColor;
                        let isWindow = false;

                        if (isFacade && y > 1 && y < height - 1) {
                            // Lit windows scattered across exterior facades
                            if (Math.random() < 0.22) {
                                isWindow = true;
                                voxelColor = neonColors[Math.floor(Math.random() * neonColors.length)].clone();
                            } else {
                                voxelColor = bldgBaseColor.clone();
                            }
                        } else {
                            voxelColor = bldgBaseColor.clone();
                        }

                        const voxelItem = {
                            index: rawVoxelList.length,
                            x: vx,
                            y: vy,
                            z: vz,
                            buildingId: buildingId,
                            color: voxelColor,
                            isWindow: isWindow,
                            active: true
                        };

                        rawVoxelList.push(voxelItem);
                        addVoxelToGrid(voxelItem);
                    }
                }
            }
        }
    }

    const totalVoxels = rawVoxelList.length;
    console.log(`Generated ${buildingCounter} buildings with ${totalVoxels} voxels.`);

    // 2. Create the Single InstancedMesh
    const geometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Tinted per-instance by setColorAt
        roughness: 0.52,
        metalness: 0.18
    });

    const instancedMesh = new THREE.InstancedMesh(geometry, material, totalVoxels);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    // Dummy Object3D used to position each instance matrix
    const dummy = new THREE.Object3D();

    for (let i = 0; i < totalVoxels; i++) {
        const v = rawVoxelList[i];
        dummy.position.set(v.x, v.y, v.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, v.color);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
    }

    if (scene) {
        scene.add(instancedMesh);
    }

    // 3. Fast Spatial Query & Manipulation API
    /**
     * Query all active voxels within a sphere radius around impactPoint.
     * Uses spatial hash grid for O(1) cell lookup.
     */
    function getVoxelsInRadius(impactPoint, radius) {
        const radiusSq = radius * radius;
        const minCX = Math.floor((impactPoint.x - radius) / cellSize);
        const maxCX = Math.floor((impactPoint.x + radius) / cellSize);
        const minCY = Math.floor((impactPoint.y - radius) / cellSize);
        const maxCY = Math.floor((impactPoint.y + radius) / cellSize);
        const minCZ = Math.floor((impactPoint.z - radius) / cellSize);
        const maxCZ = Math.floor((impactPoint.z + radius) / cellSize);

        const result = [];

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cy = minCY; cy <= maxCY; cy++) {
                for (let cz = minCZ; cz <= maxCZ; cz++) {
                    const key = getCellKey(cx, cy, cz);
                    const cell = spatialGrid.get(key);
                    if (!cell) continue;

                    for (let i = 0; i < cell.length; i++) {
                        const voxel = cell[i];
                        if (!voxel.active) continue;

                        const dx = voxel.x - impactPoint.x;
                        const dy = voxel.y - impactPoint.y;
                        const dz = voxel.z - impactPoint.z;
                        const distSq = dx * dx + dy * dy + dz * dz;

                        if (distSq <= radiusSq) {
                            result.push(voxel);
                        }
                    }
                }
            }
        }
        return result;
    }

    /**
     * Hides an instance by scaling its matrix to 0,0,0
     */
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    function hideVoxel(index) {
        if (index < 0 || index >= totalVoxels) return;
        rawVoxelList[index].active = false;
        instancedMesh.setMatrixAt(index, zeroMatrix);
    }

    return {
        instancedMesh,
        voxelData: rawVoxelList,
        totalVoxels,
        dummy,
        getVoxelsInRadius,
        hideVoxel
    };
}
