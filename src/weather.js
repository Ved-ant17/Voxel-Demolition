import * as THREE from 'three';
import { setWeatherAudio } from './audio.js';

let currentScene = null;
let activeWeather = 'clear'; // 'clear' | 'storm' | 'fog'

// Rain particle system (reduced to 450 raindrops for near-zero CPU usage and crystal clear visibility)
let rainPoints = null;
let rainGeometry = null;
const RAIN_COUNT = 450;
const RAIN_BOX_SIZE = 120; // Rain box dimensions surrounding the camera

// Lightning system for Thunderstorms
let lightningLight = null;
let lightningTimer = 0;
let nextLightningInterval = 5.0;
let flashDuration = 0;

// Base fog storage to restore when exiting storm or fog modes
let defaultFogDensity = 0.0035;

export const WEATHER_TYPES = {
    clear: {
        name: 'Clear Sky',
        description: 'Calm, clear city flight'
    },
    storm: {
        name: 'Thunderstorm & Rain',
        description: 'Atmospheric rain, misty fog & lightning'
    },
    fog: {
        name: 'Heavy Fog',
        description: 'Dense dystopian smog and low visibility'
    }
};

/**
 * Initializes weather particle geometry and dynamic lightning light
 * 
 * @param {THREE.Scene} scene 
 */
export function initWeather(scene) {
    currentScene = scene;

    // 1. Create Lightweight Rain Particle System (THREE.Points with 900 particles)
    rainGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(RAIN_COUNT * 3);

    for (let i = 0; i < RAIN_COUNT; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * RAIN_BOX_SIZE;
        positions[i * 3 + 1] = Math.random() * RAIN_BOX_SIZE;
        positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX_SIZE;
    }

    rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Sleek, semi-transparent raindrops that do not obstruct crosshair or view
    const rainMaterial = new THREE.PointsMaterial({
        color: 0x98c8f8,
        size: 0.65,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    rainPoints = new THREE.Points(rainGeometry, rainMaterial);
    rainPoints.visible = false;
    scene.add(rainPoints);

    // 2. Dynamic Lightning Light for Thunderstorms
    lightningLight = new THREE.PointLight(0xdbeafe, 0, 450);
    lightningLight.position.set(0, 150, 0);
    scene.add(lightningLight);

    if (scene.fog) {
        defaultFogDensity = scene.fog.density;
    }
}

/**
 * Changes active weather mode
 * 
 * @param {'clear' | 'storm' | 'fog'} weatherType 
 */
export function setWeather(weatherType) {
    if (!WEATHER_TYPES[weatherType] || !currentScene) return;

    activeWeather = weatherType;

    // Trigger rain audio state
    setWeatherAudio(weatherType);

    // Enable rain particles for Thunderstorm
    if (rainPoints) {
        rainPoints.visible = (weatherType === 'storm');
    }

    if (lightningLight) {
        lightningLight.intensity = 0;
        flashDuration = 0;
    }

    // Realistic Atmospheric Fog Adjustments
    if (currentScene.fog) {
        if (weatherType === 'fog') {
            currentScene.fog.density = 0.018; // Heavy dense smog
        } else if (weatherType === 'storm') {
            // Realistic atmospheric rain mist: increased subtle fog to enhance rainy mood
            currentScene.fog.density = 0.0095;
        } else {
            // Restore default sky preset fog
            currentScene.fog.density = defaultFogDensity;
        }
    }

    lightningTimer = 0;
    nextLightningInterval = 4.0 + Math.random() * 4.0;

    return activeWeather;
}

export function getActiveWeather() {
    return activeWeather;
}

/**
 * Updates rain particle positions around the camera and handles lightning flashes
 * 
 * @param {number} deltaTime 
 * @param {THREE.Camera} camera 
 */
export function updateWeather(deltaTime, camera) {
    if (!camera || !currentScene) return;

    // 1. Update Rain Particles (Optimized loop with 900 drops)
    if (activeWeather === 'storm' && rainPoints && rainPoints.visible) {
        const positions = rainGeometry.attributes.position.array;
        const fallSpeed = 85; // Units per second
        const halfBox = RAIN_BOX_SIZE / 2;

        const camX = camera.position.x;
        const camY = camera.position.y;
        const camZ = camera.position.z;

        for (let i = 0; i < RAIN_COUNT; i++) {
            const idx = i * 3;

            // Move downward
            positions[idx + 1] -= fallSpeed * deltaTime;

            // Wrap relative to current camera position so rain surrounds the player cleanly
            if (positions[idx + 1] < camY - 25 || positions[idx + 1] < 0) {
                positions[idx + 1] = camY + halfBox + (Math.random() * 15);
                positions[idx + 0] = camX + (Math.random() - 0.5) * RAIN_BOX_SIZE;
                positions[idx + 2] = camZ + (Math.random() - 0.5) * RAIN_BOX_SIZE;
            }

            // Keep within horizontal bounds of camera
            if (Math.abs(positions[idx + 0] - camX) > halfBox) {
                positions[idx + 0] = camX + (Math.random() - 0.5) * RAIN_BOX_SIZE;
            }
            if (Math.abs(positions[idx + 2] - camZ) > halfBox) {
                positions[idx + 2] = camZ + (Math.random() - 0.5) * RAIN_BOX_SIZE;
            }
        }

        rainGeometry.attributes.position.needsUpdate = true;
    }

    // 2. Update Thunderstorm Lightning Strikes
    if (activeWeather === 'storm' && lightningLight) {
        if (flashDuration > 0) {
            flashDuration -= deltaTime;
            if (flashDuration <= 0) {
                lightningLight.intensity = 0;
            } else {
                // Flickering realistic lightning burst
                lightningLight.intensity = (Math.random() > 0.3) ? (8.0 + Math.random() * 4.0) : 1.0;
            }
        } else {
            lightningTimer += deltaTime;
            if (lightningTimer >= nextLightningInterval) {
                // Trigger lightning flash!
                lightningTimer = 0;
                nextLightningInterval = 4.5 + Math.random() * 6.0;
                flashDuration = 0.14; // Flash lasts ~140ms

                // Position lightning high in sky near player
                const offsetX = (Math.random() - 0.5) * 120;
                const offsetZ = (Math.random() - 0.5) * 120;
                lightningLight.position.set(
                    camera.position.x + offsetX,
                    camera.position.y + 130,
                    camera.position.z + offsetZ
                );
                lightningLight.intensity = 10.0;
            }
        }
    }
}
