import * as THREE from 'three';
import { setMenuMode, resumeAudio } from './audio.js';

// Track active movement keys
const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
};

export let isLocked = false;
export let isAiming = false;
let gameStarted = false;

const NORMAL_FOV = 75;
const ZOOM_FOV = 38; // Smooth zoom-in FOV for ADS aiming

const baseMouseSensitivity = 0.0022;
const moveSpeed = 35.0; // Units per second for smooth flying exploration

// --- Flight Boundaries (Ceiling Height & Distant City Wall Clamp) ---
let maxFlightRadius = 435;
let maxFlightHeight = 110;
const minFlightHeight = 1.2;

/**
 * Updates flight boundary restrictions according to distant city dimensions
 * 
 * @param {number} radius Maximum horizontal flight radius inside the distant city
 * @param {number} height Maximum flight ceiling height
 */
export function setFlightBoundaries(radius, height) {
    maxFlightRadius = radius;
    maxFlightHeight = height;
}

export function getFlightBoundaries() {
    return {
        radius: maxFlightRadius,
        height: maxFlightHeight,
        minHeight: minFlightHeight
    };
}

// Reusable direction vectors to prevent garbage collection spikes in the render loop
const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();
const upVec = new THREE.Vector3(0, 1, 0);

let canvasRef = null;
let crosshairElem = null;

export function lockPointer() {
    if (!canvasRef) return;
    try {
        const promise = canvasRef.requestPointerLock();
        if (promise && promise.catch) {
            promise.catch((err) => {
                console.warn('Pointer lock request catch:', err);
            });
        }
    } catch (err) {
        console.warn('Pointer lock error:', err);
    }
}

export function enterGame() {
    gameStarted = true;
    isLocked = true;

    const overlay = document.getElementById('menuOverlay');
    const hud = document.getElementById('inGameHUD');

    if (overlay) overlay.style.display = 'none';
    if (hud) hud.style.display = 'flex';

    // Playing state: duck background music and ensure audio is started
    setMenuMode(false);
    resumeAudio();

    lockPointer();
}

/**
 * Setup First-Person Flying Camera & Pointer Lock Controls with Right-Click Zoom
 * 
 * @param {HTMLCanvasElement} canvas The canvas element to attach mouse listeners to.
 * @returns {THREE.PerspectiveCamera} The initialized perspective camera.
 */
export function setupControls(canvas) {
    canvasRef = canvas;
    crosshairElem = document.getElementById('crosshair');

    const camera = new THREE.PerspectiveCamera(
        NORMAL_FOV,
        window.innerWidth / window.innerHeight,
        0.1,
        1500
    );

    // Initial position elevated with view over the scene
    camera.position.set(0, 30, 75);
    camera.rotation.order = 'YXZ'; // Critical for correct first-person yaw and pitch

    const overlay = document.getElementById('menuOverlay');
    const hud = document.getElementById('inGameHUD');
    const playBtn = document.getElementById('playBtn');

    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            enterGame();
        });
    }

    // Clicking directly on canvas re-engages lock if overlay was dismissed
    canvas.addEventListener('click', () => {
        if (!isLocked && (!overlay || overlay.style.display === 'none')) {
            enterGame();
        }
    });

    // Prevent default right-click context menu so it functions as weapon zoom ADS
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Right-click Aim Down Sights (ADS) Zoom Listeners
    window.addEventListener('mousedown', (event) => {
        if (event.button === 2 && isLocked) {
            isAiming = true;
            if (crosshairElem) crosshairElem.classList.add('aiming');
        }
    });

    window.addEventListener('mouseup', (event) => {
        if (event.button === 2) {
            isAiming = false;
            if (crosshairElem) crosshairElem.classList.remove('aiming');
        }
    });

    document.addEventListener('pointerlockchange', () => {
        const currentlyLocked = (document.pointerLockElement === canvas);
        isLocked = currentlyLocked;

        if (currentlyLocked) {
            if (overlay) overlay.style.display = 'none';
            if (hud) hud.style.display = 'flex';
            setMenuMode(false); // PLAYING: background music volume decreases
        } else if (gameStarted) {
            // When user releases pointer with ESC, reset zoom and show menu
            isAiming = false;
            if (crosshairElem) crosshairElem.classList.remove('aiming');

            if (overlay) overlay.style.display = 'flex';
            if (hud) hud.style.display = 'none';
            if (playBtn) playBtn.textContent = '▶ RESUME SIMULATION';
            setMenuMode(true); // MENU OPEN: background music volume increases
        }
    });

    document.addEventListener('pointerlockerror', (err) => {
        console.warn('Pointer lock blocked or errored:', err);
        if (overlay) overlay.style.display = 'none';
        isLocked = true;
    });

    // --- Mouse Look (Yaw & Pitch) with Adaptive Sensitivity ---
    document.addEventListener('mousemove', (event) => {
        if (!isLocked) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        if (movementX !== 0 || movementY !== 0) {
            // Lower sensitivity when zoomed in for precision sniper aiming
            const activeSensitivity = isAiming ? (baseMouseSensitivity * 0.45) : baseMouseSensitivity;

            // Yaw: rotate around world Y axis
            camera.rotation.y -= movementX * activeSensitivity;

            // Pitch: rotate around local X axis and clamp to prevent flips
            camera.rotation.x -= movementY * activeSensitivity;
            const maxPitch = Math.PI / 2 - 0.05; // ~87 degrees
            camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, camera.rotation.x));
        }
    });

    // --- Keyboard Listeners (WASD, Space, Shift) ---
    window.addEventListener('keydown', (event) => {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                keys.forward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                keys.backward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                keys.left = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                keys.right = true;
                break;
            case 'Space':
                keys.up = true;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                keys.down = true;
                break;
            case 'KeyM':
                // Press 'M' to toggle between in-game and menu overlay
                if (isLocked) {
                    document.exitPointerLock();
                } else {
                    enterGame();
                }
                break;
        }
    });

    window.addEventListener('keyup', (event) => {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                keys.forward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                keys.backward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                keys.left = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                keys.right = false;
                break;
            case 'Space':
                keys.up = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                keys.down = false;
                break;
        }
    });

    return camera;
}

/**
 * Frame update for camera translation and smooth zoom interpolation
 * 
 * @param {THREE.PerspectiveCamera} camera 
 * @param {number} deltaTime Time elapsed since last frame
 */
export function updateControls(camera, deltaTime) {
    if (!camera) return;

    // 1. Smooth Zoom FOV Interpolation (ADS Aim Animation)
    const targetFov = isAiming ? ZOOM_FOV : NORMAL_FOV;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
        // Fast, smooth spring-like lerp transition
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 14 * deltaTime);
        camera.updateProjectionMatrix();
    }

    // 2. Flight Movement
    // When aiming in, move slightly slower for tactical feel
    const activeMoveSpeed = isAiming ? (moveSpeed * 0.6) : moveSpeed;
    const actualSpeed = activeMoveSpeed * deltaTime;

    // Get camera's forward-facing direction
    camera.getWorldDirection(forwardVec);

    // Calculate perpendicular right vector (cross product of forward and world UP)
    rightVec.crossVectors(forwardVec, upVec).normalize();

    // 6-DOF flying movement
    if (keys.forward) {
        camera.position.addScaledVector(forwardVec, actualSpeed);
    }
    if (keys.backward) {
        camera.position.addScaledVector(forwardVec, -actualSpeed);
    }
    if (keys.right) {
        camera.position.addScaledVector(rightVec, actualSpeed);
    }
    if (keys.left) {
        camera.position.addScaledVector(rightVec, -actualSpeed);
    }
    if (keys.up) {
        camera.position.y += actualSpeed;
    }
    if (keys.down) {
        camera.position.y -= actualSpeed;
    }

    // 3. Flight Boundary Constraints (Distant City Wall & Height Limits)

    // A. Height Clamping (Stay above ground, cannot exceed sky ceiling)
    if (camera.position.y < minFlightHeight) {
        camera.position.y = minFlightHeight;
    } else if (camera.position.y > maxFlightHeight) {
        camera.position.y = maxFlightHeight;
    }

    // B. Horizontal Radial Clamping (Cannot cross or clip the distant 2D city perimeter)
    const distSq = (camera.position.x * camera.position.x) + (camera.position.z * camera.position.z);
    const maxRadiusSq = maxFlightRadius * maxFlightRadius;
    if (distSq > maxRadiusSq) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
            const factor = maxFlightRadius / dist;
            camera.position.x *= factor;
            camera.position.z *= factor;
        }
    }
}
