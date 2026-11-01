import * as THREE from 'three';
import { createEnvironment } from './environment.js';
import { setupControls, updateControls, isLocked } from './controls.js';
import { createCity } from './city.js';
import { fireRocket, updateWeapons } from './weapons.js';
import { initPhysics, updatePhysics } from './physics.js';
import { triggerExplosion, updateDestruction } from './destruction.js';

// --- 1. CORE SETUP ---
const canvas = document.getElementById('gameCanvas');

// Initialize WebGL Renderer
export const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

// Initialize Environment (Dark night sky, exponential fog, moonlight, and ground)
export const scene = createEnvironment();

// Initialize First-Person Flying Camera & Pointer Lock Controls
export const camera = setupControls(canvas);
camera.position.set(0, 30, 75);

// Initialize Cannon-es Physics World (Normal downward gravity, ground collider, contact materials)
export const { world, debrisMaterial } = initPhysics();

// --- 2. PROCEDURAL VOXEL CITY (PHASE 3) ---
export const city = createCity(scene);
export const cityMesh = city.instancedMesh;

// --- 3. WEAPONS FIRING INPUT (PHASE 4) ---
let lastFireTime = 0;
const fireCooldownMs = 180;

window.addEventListener('mousedown', (event) => {
    // Only fire with primary button (left click) while gameplay is active
    const overlay = document.getElementById('instructionsOverlay');
    if (overlay && overlay.style.display !== 'none') return;

    if (event.button === 0 && (document.pointerLockElement === canvas || isLocked)) {
        const now = performance.now();
        if (now - lastFireTime >= fireCooldownMs) {
            lastFireTime = now;
            fireRocket(camera, scene);
        }
    }
});

// --- 4. RESIZE HANDLER ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- 5. MAIN ANIMATION & SIMULATION LOOP ---
const clock = new THREE.Clock();
const BLAST_RADIUS = 3.2; // Destruction crater radius in voxel units

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // 1. Update First-Person Flying Controls
    updateControls(camera, deltaTime);

    // 2. Step Physics Simulation
    updatePhysics(world, deltaTime);

    // 3. Update Projectile Weapons, Raycast Collisions, and Trigger Voxel Destruction
    updateWeapons(deltaTime, scene, cityMesh, (impactPoint) => {
        // Phase 5: Procedural crater destruction and dynamic physical debris
        triggerExplosion(impactPoint, BLAST_RADIUS, city, world, scene, debrisMaterial);
    });

    // 4. Synchronize Dynamic Debris Meshes with Cannon.js Bodies
    updateDestruction(deltaTime, world, scene);

    // 5. Render Scene
    renderer.render(scene, camera);
}

// Start simulation loop
animate();

console.log('Phase 5 Complete: Full simulation active with procedural voxel demolition and normal gravity physics!');
