import * as THREE from 'three';

// Reusable geometry and material for all rockets
const rocketGeometry = new THREE.CylinderGeometry(0.1, 0.18, 0.9, 8);
// Orient along +Z axis so rocket.lookAt() points forward
rocketGeometry.rotateX(Math.PI / 2);

const rocketMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3300,
    emissive: 0xff6600,
    emissiveIntensity: 3.0,
    roughness: 0.2,
    metalness: 0.5
});

// Maintain array of active in-flight projectiles
export const activeRockets = [];

// Reusable raycaster for collision checks
const raycaster = new THREE.Raycaster();

// Active visual impact flashes
const activeFlashes = [];
const flashGeometry = new THREE.SphereGeometry(1.2, 12, 12);

/**
 * Phase 4: Fire Rocket
 * Instantiates a rocket at the camera position, facing the camera view direction,
 * and launches it forward at high velocity.
 * 
 * @param {THREE.Camera} camera 
 * @param {THREE.Scene} scene 
 */
export function fireRocket(camera, scene) {
    if (!camera || !scene) return;

    // 1. Get camera forward direction
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.normalize();

    // 2. Spawn rocket mesh slightly ahead of camera to avoid clipping
    const rocketMesh = new THREE.Mesh(rocketGeometry, rocketMaterial);
    const spawnPos = camera.position.clone().addScaledVector(direction, 1.2);
    rocketMesh.position.copy(spawnPos);

    // Orient rocket toward forward flight direction
    const targetPoint = spawnPos.clone().add(direction);
    rocketMesh.lookAt(targetPoint);

    // Optional dynamic point light attached to rocket for nighttime illumination
    const rocketLight = new THREE.PointLight(0xff7700, 3, 15);
    rocketMesh.add(rocketLight);

    scene.add(rocketMesh);

    // 3. Track active rocket
    activeRockets.push({
        mesh: rocketMesh,
        direction: direction,
        speed: 80.0, // Units per second
        distanceTraveled: 0,
        maxDistance: 600
    });
}

/**
 * Creates a brief energetic impact flash at the collision coordinate
 */
function createImpactFlash(position, scene) {
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 0.9
    });
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.copy(position);

    const flashLight = new THREE.PointLight(0xffaa22, 10, 20);
    flashLight.position.copy(position);

    scene.add(flashMesh);
    scene.add(flashLight);

    activeFlashes.push({
        mesh: flashMesh,
        light: flashLight,
        life: 0.18, // Duration in seconds
        maxLife: 0.18
    });
}

/**
 * Phase 4: Weapons Update Loop
 * Moves all active rockets forward and performs raycasting collision detection
 * against the instanced city mesh.
 * 
 * @param {number} deltaTime Time elapsed since last frame
 * @param {THREE.Scene} scene The active Three.js scene
 * @param {THREE.InstancedMesh} cityMesh The instanced city mesh to test for collisions
 * @param {Function} [onHit] Optional destruction callback (impactPoint, instanceId, hit)
 */
export function updateWeapons(deltaTime, scene, cityMesh, onHit) {
    // 1. Update Rockets
    for (let i = activeRockets.length - 1; i >= 0; i--) {
        const rocket = activeRockets[i];
        const stepDistance = rocket.speed * deltaTime;

        // Perform raycast forward along flight trajectory
        raycaster.set(rocket.mesh.position, rocket.direction);
        raycaster.far = stepDistance + 0.2;

        const targets = [];
        if (cityMesh) targets.push(cityMesh);

        const intersects = raycaster.intersectObjects(targets, false);

        if (intersects.length > 0 && intersects[0].distance <= stepDistance + 0.2) {
            const hit = intersects[0];
            const impactPoint = hit.point.clone();
            const instanceId = hit.instanceId;

            console.log(
                `💥 Rocket Impact! Coordinates: x=${impactPoint.x.toFixed(2)}, ` +
                `y=${impactPoint.y.toFixed(2)}, z=${impactPoint.z.toFixed(2)} | ` +
                `Instance ID: ${instanceId !== undefined ? instanceId : 'N/A'}`
            );

            // Visual impact flash
            createImpactFlash(impactPoint, scene);

            // Trigger destruction callback (for Phase 5)
            if (typeof onHit === 'function') {
                onHit(impactPoint, instanceId, hit);
            }

            // Remove rocket
            scene.remove(rocket.mesh);
            activeRockets.splice(i, 1);
            continue;
        }

        // Move rocket forward
        rocket.mesh.position.addScaledVector(rocket.direction, stepDistance);
        rocket.distanceTraveled += stepDistance;

        // Clean up rockets that fly out of bounds
        if (rocket.distanceTraveled >= rocket.maxDistance || rocket.mesh.position.y < 0) {
            // If it hits the ground plane
            if (rocket.mesh.position.y <= 0) {
                createImpactFlash(rocket.mesh.position, scene);
            }
            scene.remove(rocket.mesh);
            activeRockets.splice(i, 1);
        }
    }

    // 2. Update Impact Flashes
    for (let j = activeFlashes.length - 1; j >= 0; j--) {
        const flash = activeFlashes[j];
        flash.life -= deltaTime;

        const progress = flash.life / flash.maxLife;
        if (flash.life <= 0) {
            scene.remove(flash.mesh);
            scene.remove(flash.light);
            flash.mesh.geometry.dispose();
            flash.mesh.material.dispose();
            activeFlashes.splice(j, 1);
        } else {
            flash.mesh.scale.setScalar(1 + (1 - progress) * 2.5);
            flash.mesh.material.opacity = progress * 0.9;
            flash.light.intensity = progress * 8.0;
        }
    }
}
