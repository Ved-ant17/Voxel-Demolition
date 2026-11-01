import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { VOXEL_SIZE } from './city.js';

// Reusable box geometry for all debris chunks
const debrisBoxGeometry = new THREE.BoxGeometry(VOXEL_SIZE * 0.96, VOXEL_SIZE * 0.96, VOXEL_SIZE * 0.96);

// Half-extents for Cannon-es physics Box shape
const cannonBoxShape = new CANNON.Box(
    new CANNON.Vec3(VOXEL_SIZE * 0.48, VOXEL_SIZE * 0.48, VOXEL_SIZE * 0.48)
);

// Active dynamic debris chunks tracked in physics and render loops
export const activeDebris = [];

// Maximum allowed concurrent debris chunks to guarantee 60 FPS performance
const MAX_DEBRIS = 400;

/**
 * Phase 5: Trigger Localized Voxel Crater Destruction
 * 
 * 1. Queries voxels within blastRadius of impactPoint.
 * 2. Hides the static instances from the InstancedMesh, leaving a persistent 3D crater.
 * 3. Spawns individual Three.js meshes and dynamic Cannon-es physical bodies in their place.
 * 4. Applies explosive outward impulses and random spin under standard downward gravity.
 * 
 * @param {THREE.Vector3} impactPoint 3D collision coordinates
 * @param {number} blastRadius Radius of the spherical destruction crater
 * @param {Object} city City object containing voxelData and spatial query helpers
 * @param {CANNON.World} world Cannon-es physics world
 * @param {THREE.Scene} scene Three.js scene
 * @param {CANNON.Material} [debrisMaterial] Optional Cannon material for realistic bouncing
 */
export function triggerExplosion(impactPoint, blastRadius, city, world, scene, debrisMaterial) {
    if (!city || !city.getVoxelsInRadius) return;

    // 1. Find all active voxels within explosive blast radius
    const affectedVoxels = city.getVoxelsInRadius(impactPoint, blastRadius);

    if (affectedVoxels.length === 0) return;

    // Cap debris spawn per single explosion scaled with blast radius
    const maxSpawnPerHit = Math.min(85, Math.max(10, Math.round(blastRadius * 10)));
    const voxelsToProcess = affectedVoxels.slice(0, maxSpawnPerHit);

    for (let i = 0; i < voxelsToProcess.length; i++) {
        const voxel = voxelsToProcess[i];

        // 2. Hide static instance from InstancedMesh (leaves persistent crater)
        city.hideVoxel(voxel.index);

        // 3. Create standalone dynamic Three.js debris mesh
        const debrisMat = new THREE.MeshStandardMaterial({
            color: voxel.color,
            roughness: 0.7,
            metalness: 0.2,
            emissive: voxel.isWindow ? voxel.color : 0x000000,
            emissiveIntensity: voxel.isWindow ? 1.8 : 0.0
        });

        const debrisMesh = new THREE.Mesh(debrisBoxGeometry, debrisMat);
        debrisMesh.position.set(voxel.x, voxel.y, voxel.z);
        debrisMesh.castShadow = true;
        debrisMesh.receiveShadow = true;
        scene.add(debrisMesh);

        // 4. Create dynamic Cannon.js physics body with standard gravity mass
        const debrisBody = new CANNON.Body({
            mass: 1.2, // Dynamic rigid body
            shape: cannonBoxShape,
            material: debrisMaterial,
            linearDamping: 0.04,
            angularDamping: 0.08
        });
        debrisBody.position.set(voxel.x, voxel.y, voxel.z);

        // 5. Calculate explosive impulse force directed outward from impact center
        const dx = voxel.x - impactPoint.x;
        const dy = voxel.y - impactPoint.y;
        const dz = voxel.z - impactPoint.z;
        const distance = Math.hypot(dx, dy, dz) || 0.1;

        // Direction vector with an upward lift bias for explosive arcs
        const dirX = dx / distance;
        const dirY = (dy / distance) + (blastRadius > 5.0 ? 0.45 : 0.30);
        const dirZ = dz / distance;

        // Force scales with blast radius: Missiles trigger violent shockwave, pistols pop fragments
        const distanceRatio = Math.max(0.2, 1 - (distance / blastRadius));
        const baseForce = blastRadius > 5.0 ? 16.0 : (blastRadius > 3.0 ? 10.0 : 6.0);
        const impulseMagnitude = (baseForce + Math.random() * (baseForce * 0.9)) * distanceRatio;

        const impulse = new CANNON.Vec3(
            dirX * impulseMagnitude,
            dirY * impulseMagnitude,
            dirZ * impulseMagnitude
        );
        debrisBody.applyImpulse(impulse, new CANNON.Vec3(0, 0, 0));

        // Add tumbling rotation
        debrisBody.angularVelocity.set(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12
        );

        world.addBody(debrisBody);

        // 6. Track debris chunk
        activeDebris.push({
            mesh: debrisMesh,
            body: debrisBody,
            lifetime: 8.0, // Lives for 8 seconds before clean disposal
            maxLifetime: 8.0
        });
    }

    // Notify Three.js that the instanced mesh matrices were modified
    city.instancedMesh.instanceMatrix.needsUpdate = true;

    // Prune oldest debris if exceeding pool limit
    while (activeDebris.length > MAX_DEBRIS) {
        removeDebrisItem(0, world, scene);
    }
}

/**
 * Cleanly disposes of a debris item and frees memory
 */
function removeDebrisItem(index, world, scene) {
    if (index < 0 || index >= activeDebris.length) return;
    const item = activeDebris[index];
    world.removeBody(item.body);
    scene.remove(item.mesh);
    item.mesh.material.dispose();
    activeDebris.splice(index, 1);
}

/**
 * Clears all active debris bodies and meshes from the world
 */
export function clearAllDebris(world, scene) {
    while (activeDebris.length > 0) {
        removeDebrisItem(0, world, scene);
    }
}

/**
 * Phase 5: Frame Synchronization Loop
 * Synchronizes positions and orientations of Three.js debris meshes
 * to their corresponding Cannon-es physical bodies under standard gravity.
 * 
 * @param {number} deltaTime 
 * @param {CANNON.World} world 
 * @param {THREE.Scene} scene 
 */
export function updateDestruction(deltaTime, world, scene) {
    for (let i = activeDebris.length - 1; i >= 0; i--) {
        const item = activeDebris[i];
        item.lifetime -= deltaTime;

        // Lifespan expiration
        if (item.lifetime <= 0) {
            removeDebrisItem(i, world, scene);
            continue;
        }

        // Smooth shrink during final second
        if (item.lifetime < 1.0) {
            const scale = Math.max(0.01, item.lifetime);
            item.mesh.scale.set(scale, scale, scale);
        }

        // Synchronize visual Three.js mesh with physical Cannon-es body
        item.mesh.position.copy(item.body.position);
        item.mesh.quaternion.copy(item.body.quaternion);
    }
}
