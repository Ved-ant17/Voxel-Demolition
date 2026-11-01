import * as THREE from 'three';

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
let gameStarted = false;

const mouseSensitivity = 0.0022;
const moveSpeed = 35.0; // Units per second for smooth flying exploration

// Reusable direction vectors to prevent garbage collection spikes in the render loop
const forwardVec = new THREE.Vector3();
const rightVec = new THREE.Vector3();
const upVec = new THREE.Vector3(0, 1, 0);

/**
 * Setup First-Person Flying Camera & Pointer Lock Controls
 * 
 * @param {HTMLCanvasElement} canvas The canvas element to attach mouse listeners to.
 * @returns {THREE.PerspectiveCamera} The initialized perspective camera.
 */
export function setupControls(canvas) {
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    // Initial position elevated with view over the scene
    camera.position.set(0, 30, 75);
    camera.rotation.order = 'YXZ'; // Critical for correct first-person yaw and pitch

    const overlay = document.getElementById('instructionsOverlay');
    const playBtn = document.getElementById('playBtn');

    function lockPointer() {
        try {
            const promise = canvas.requestPointerLock();
            if (promise && promise.catch) {
                promise.catch((err) => {
                    console.warn('Pointer lock request catch:', err);
                });
            }
        } catch (err) {
            console.warn('Pointer lock error:', err);
        }
    }

    function enterGame(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        gameStarted = true;
        isLocked = true;

        if (overlay) {
            overlay.style.display = 'none';
        }
        lockPointer();
    }

    // Attach listeners directly to overlay and play button so clicking ANYWHERE on the popup dismisses it
    if (playBtn) {
        playBtn.addEventListener('click', enterGame);
    }
    if (overlay) {
        overlay.addEventListener('click', enterGame);
    }

    canvas.addEventListener('click', () => {
        if (!isLocked) {
            enterGame();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        const currentlyLocked = (document.pointerLockElement === canvas);
        isLocked = currentlyLocked;

        if (overlay) {
            if (currentlyLocked) {
                overlay.style.display = 'none';
            } else if (gameStarted) {
                // When unlocked with ESC, show overlay with "CLICK TO RESUME"
                overlay.style.display = 'flex';
                if (playBtn) {
                    playBtn.textContent = 'CLICK TO RESUME';
                }
            }
        }
    });

    document.addEventListener('pointerlockerror', (err) => {
        console.warn('Pointer lock error or blocked by browser:', err);
        // Ensure popup is still removed so game is playable
        if (overlay) {
            overlay.style.display = 'none';
        }
        isLocked = true;
    });

    // --- Mouse Look (Yaw & Pitch) ---
    document.addEventListener('mousemove', (event) => {
        if (!isLocked) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        if (movementX !== 0 || movementY !== 0) {
            // Yaw: rotate around world Y axis
            camera.rotation.y -= movementX * mouseSensitivity;

            // Pitch: rotate around local X axis and clamp to prevent flips
            camera.rotation.x -= movementY * mouseSensitivity;
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
 * Frame update for camera translation based on key state
 * 
 * @param {THREE.PerspectiveCamera} camera 
 * @param {number} deltaTime Time elapsed since last frame
 */
export function updateControls(camera, deltaTime) {
    if (!camera) return;

    const actualSpeed = moveSpeed * deltaTime;

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

    // Keep camera above ground level
    if (camera.position.y < 1.0) {
        camera.position.y = 1.0;
    }
}
