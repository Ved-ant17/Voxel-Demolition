import * as THREE from 'three';
import { createEnvironment, setTimeOfDay, getCurrentTimePreset, TIME_PRESETS } from './environment.js';
import { setupControls, updateControls, isLocked, enterGame } from './controls.js';
import { createCity } from './city.js';
import {
    initWeapons,
    fireActiveWeapon,
    updateWeapons,
    switchNextWeapon,
    switchPrevWeapon,
    selectWeapon,
    getActiveWeapon,
    WEAPON_TYPES
} from './weapons.js';
import { initPhysics, updatePhysics } from './physics.js';
import { triggerExplosion, updateDestruction, clearAllDebris } from './destruction.js';
import { initWeather, setWeather, updateWeather, getActiveWeather, WEATHER_TYPES } from './weather.js';
import { updateDistantCitySize } from './distantCity.js';

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

// Initialize Environment (Skybox panoramas, depth fog, dynamic lighting, and ground)
export const scene = createEnvironment();

// Initialize Dynamic Weather Particle System & Lightning
initWeather(scene);

// Initialize First-Person Flying Camera & Pointer Lock Controls
export const camera = setupControls(canvas);
scene.add(camera);

// Initialize First-Person 3D Gun Viewmodels, Arsenal & Particle FX
initWeapons(camera, scene);

// Initialize Cannon-es Physics World (Standard downward gravity, ground collider, contact materials)
export const { world, debrisMaterial } = initPhysics();

// --- 2. PROCEDURAL VOXEL CITY ---
let currentCitySize = 6;
export let city = createCity(scene, currentCitySize);
export let cityMesh = city.instancedMesh;

// Initialize distant 2D city dimensions and flight boundary limits for starting city size
updateDistantCitySize(currentCitySize);

/**
 * Rebuilds the city with a new grid size and clears debris
 * @param {number} newGridSize 
 */
export function rebuildCity(newGridSize) {
    if (city && city.dispose) {
        city.dispose();
    }
    clearAllDebris(world, scene);

    currentCitySize = parseInt(newGridSize, 10);
    city = createCity(scene, currentCitySize);
    cityMesh = city.instancedMesh;

    // Dynamically expand/shrink distant 2D city skyline and flight boundaries
    updateDistantCitySize(currentCitySize);

    // Adjust camera position so the player can view the new city size nicely
    const plotSpacing = 16;
    const viewDistance = Math.max(60, currentCitySize * plotSpacing * 0.75);
    camera.position.set(0, Math.max(25, currentCitySize * 5.5), viewDistance);

    updateUIElements();
}

// --- 3. UI MANAGEMENT & MODULAR SUB-PANELS ---

const menuOverlay = document.getElementById('menuOverlay');
const allSubPanels = document.querySelectorAll('.sub-panel-view');

// Navigation between Main Menu and Sub-Panels
function switchPanel(targetPanelId) {
    allSubPanels.forEach((panel) => panel.classList.remove('active'));
    const target = document.getElementById(targetPanelId);
    if (target) {
        target.classList.add('active');
    }
}

// Open buttons on main dashboard
document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-open');
        switchPanel(targetId);
    });
});

// Back buttons inside sub-panels
document.querySelectorAll('[data-back-to]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-back-to');
        switchPanel(targetId);
    });
});

// Resume action buttons inside sub-panels
document.querySelectorAll('.resume-action').forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        enterGame();
    });
});

// UI Text Display Cache
const previewCityText = document.getElementById('previewCityText');
const previewTimeText = document.getElementById('previewTimeText');
const previewWeatherText = document.getElementById('previewWeatherText');

const citySizeSlider = document.getElementById('citySizeSlider');
const citySizeDisplay = document.getElementById('citySizeDisplay');
const cityVoxelBadge = document.getElementById('cityVoxelBadge');
const regenCityBtn = document.getElementById('regenCityBtn');

const timeButtons = document.querySelectorAll('.time-btn');
const weatherButtons = document.querySelectorAll('.weather-btn');

const hudTimeName = document.getElementById('hudTimeName');
const hudWeatherName = document.getElementById('hudWeatherName');
const hudCityInfo = document.getElementById('hudCityInfo');
const hudVoxelCount = document.getElementById('hudVoxelCount');

function updateUIElements() {
    if (!city) return;

    const currentPreset = getCurrentTimePreset();
    const activeWeather = getActiveWeather();

    // 1. Update Main Menu Dashboard Previews
    if (previewCityText) {
        previewCityText.textContent = `${currentCitySize}×${currentCitySize} Grid (${currentCitySize * currentCitySize} Plots - ${city.totalVoxels.toLocaleString()} Voxels)`;
    }
    if (previewTimeText) {
        const timeName = TIME_PRESETS[currentPreset]?.name || 'Night';
        previewTimeText.textContent = `${timeName} Sky`;
    }
    if (previewWeatherText) {
        const wInfo = WEATHER_TYPES[activeWeather];
        previewWeatherText.textContent = `${wInfo?.name || 'Clear'}`;
    }

    // 2. Update City Size Sub-panel Labels
    if (citySizeDisplay) {
        citySizeDisplay.textContent = `${currentCitySize}×${currentCitySize} Grid (${currentCitySize * currentCitySize} Skyscraper Plots)`;
    }
    if (cityVoxelBadge) {
        cityVoxelBadge.textContent = `${city.totalVoxels.toLocaleString()} Voxels`;
    }

    // 3. Update In-Game HUD
    if (hudTimeName) hudTimeName.textContent = TIME_PRESETS[currentPreset]?.name || 'Night';
    if (hudWeatherName) hudWeatherName.textContent = WEATHER_TYPES[activeWeather]?.name || 'Clear';
    if (hudCityInfo) hudCityInfo.textContent = `${currentCitySize}×${currentCitySize} Blocks`;
    if (hudVoxelCount) hudVoxelCount.textContent = `${city.totalVoxels.toLocaleString()} Voxels`;
}

// 1. Time of Day Button Listeners
timeButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedTime = btn.getAttribute('data-time');
        setTimeOfDay(selectedTime);

        timeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        updateUIElements();
    });
});

// 2. Weather Button Listeners
weatherButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedWeather = btn.getAttribute('data-weather');
        setWeather(selectedWeather);

        weatherButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        updateUIElements();
    });
});

// 3. City Size Slider Listeners
if (citySizeSlider) {
    citySizeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (citySizeDisplay) {
            citySizeDisplay.textContent = `${val}×${val} Grid (${val * val} Skyscraper Plots)`;
        }
        if (cityVoxelBadge) {
            const estimated = Math.round(val * val * (720 + (val > 8 ? (val - 8) * 55 : 0)));
            cityVoxelBadge.textContent = `~${estimated.toLocaleString()} Voxels`;
        }
    });

    citySizeSlider.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        rebuildCity(val);
    });
}

// 4. Regenerate City Button Listener
if (regenCityBtn) {
    regenCityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = citySizeSlider ? parseInt(citySizeSlider.value, 10) : currentCitySize;
        rebuildCity(val);
    });
}

// Initial UI setup
updateUIElements();

// --- 4. WEAPONS FIRING INPUT & WEAPON SWITCHING ---
let isFiring = false;

window.addEventListener('mousedown', (event) => {
    // Prevent firing when interacting with menus
    if (menuOverlay && menuOverlay.style.display !== 'none') return;

    if (event.button === 0 && (document.pointerLockElement === canvas || isLocked)) {
        isFiring = true;
        fireActiveWeapon(camera, scene);
    }
});

window.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
        isFiring = false;
    }
});

// Mouse Scroll Wheel Weapon Switching (Requirement 2)
window.addEventListener('wheel', (event) => {
    if (menuOverlay && menuOverlay.style.display !== 'none') return;
    if (!isLocked && document.pointerLockElement !== canvas) return;

    if (event.deltaY > 0) {
        switchNextWeapon();
    } else if (event.deltaY < 0) {
        switchPrevWeapon();
    }
}, { passive: true });

// Number Keys 1-5 for Direct Weapon Selection
window.addEventListener('keydown', (event) => {
    if (menuOverlay && menuOverlay.style.display !== 'none') return;
    if (event.code >= 'Digit1' && event.code <= 'Digit5') {
        const slot = parseInt(event.code.replace('Digit', ''), 10) - 1;
        selectWeapon(slot);
    }
});

// Clickable HUD Weapon Bar Slots
document.querySelectorAll('.weapon-slot').forEach((slot) => {
    slot.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotIdx = parseInt(slot.getAttribute('data-slot'), 10);
        selectWeapon(slotIdx);
    });
});

// --- 5. RESIZE HANDLER ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- 6. REAL-TIME FPS MONITOR ---
const fpsValueElem = document.getElementById('fpsValue');
const fpsDotElem = document.querySelector('.fps-dot');
let frameCount = 0;
let lastFpsUpdateTime = performance.now();

function updateFPS() {
    frameCount++;
    const now = performance.now();
    const elapsed = now - lastFpsUpdateTime;

    // Sample over 800ms window for rock-solid stability without jitter
    if (elapsed >= 800) {
        // Enforce maximum 60 FPS ceiling
        const calculatedFps = Math.round((frameCount * 1000) / elapsed);
        const currentFps = Math.min(60, calculatedFps);

        if (fpsValueElem) {
            fpsValueElem.textContent = `${currentFps} FPS`;
            // Health color indicator
            if (currentFps >= 50) {
                fpsValueElem.style.color = '#00ffcc';
                if (fpsDotElem) {
                    fpsDotElem.style.backgroundColor = '#00ffcc';
                    fpsDotElem.style.boxShadow = '0 0 6px #00ffcc';
                }
            } else if (currentFps >= 30) {
                fpsValueElem.style.color = '#ffb703';
                if (fpsDotElem) {
                    fpsDotElem.style.backgroundColor = '#ffb703';
                    fpsDotElem.style.boxShadow = '0 0 6px #ffb703';
                }
            } else {
                fpsValueElem.style.color = '#ff4444';
                if (fpsDotElem) {
                    fpsDotElem.style.backgroundColor = '#ff4444';
                    fpsDotElem.style.boxShadow = '0 0 6px #ff4444';
                }
            }
        }
        frameCount = 0;
        lastFpsUpdateTime = now;
    }
}

// --- 7. MAIN ANIMATION & SIMULATION LOOP (PINNED AT 60 FPS) ---
const TARGET_FPS = 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS; // 16.6667ms
// Threshold tuned to prevent VSync aliasing frame drops on 60Hz/75Hz displays
const THROTTLE_THRESHOLD = FRAME_INTERVAL * 0.82; // ~13.6ms
let lastRenderTime = performance.now();
const BLAST_RADIUS = 3.2; // Destruction crater radius

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const elapsed = now - lastRenderTime;

    // Throttle frames arriving faster than 60 FPS while avoiding VSync skips
    if (elapsed < THROTTLE_THRESHOLD) {
        return;
    }

    lastRenderTime = now;

    // Fixed 1/60 delta time for consistent 60 FPS simulation
    const deltaTime = 1 / 60;

    // 0. Update Real-time FPS Monitor
    updateFPS();

    // 1. Update First-Person Flying Controls & ADS Zoom
    updateControls(camera, deltaTime);

    // 2. Step Physics Simulation
    updatePhysics(world, deltaTime);

    // 3. Update Weather Particle Simulation & Lightning Strikes
    updateWeather(deltaTime, camera);

    // Automatic fire spray while holding left-click (e.g. Rapid SMG)
    if (isFiring && (document.pointerLockElement === canvas || isLocked)) {
        const activeWep = getActiveWeapon();
        if (activeWep && activeWep.type === 'auto') {
            fireActiveWeapon(camera, scene);
        }
    }

    // 4. Update Projectile Weapons, Raycast Collisions, and Trigger Voxel Demolition
    updateWeapons(deltaTime, scene, cityMesh, (impactPoint, instanceId, hit, weapon) => {
        const radius = weapon?.blastRadius || BLAST_RADIUS;
        triggerExplosion(impactPoint, radius, city, world, scene, debrisMaterial);
    }, camera);

    // 5. Synchronize Dynamic Debris Meshes with Cannon.js Bodies
    updateDestruction(deltaTime, world, scene);

    // 6. Render Scene
    renderer.render(scene, camera);
}

// Start simulation loop locked to 60 FPS
requestAnimationFrame(animate);

console.log('Simulation ready: Modular UI, City Sizer, 360 Skybox Time selector, and Dynamic Weather System active.');
