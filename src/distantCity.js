import * as THREE from 'three';
import { setFlightBoundaries } from './controls.js';

let distantCityMesh = null;
let neonCityGrid = null;
let currentTexture = null;

// Base dimensions for default city size (size 6)
const BASE_RADIUS = 130;
const BASE_HEIGHT = 85;

const textureLoader = new THREE.TextureLoader();

// Dynamic lighting, emissive glow, and neon grid presets matching the environment sky presets
const THEME_PRESETS = {
    night: {
        emissive: 0x1c2a4a,
        emissiveIntensity: 0.75,
        roughness: 0.75,
        gridPrimary: 0x00ffcc,
        gridSecondary: 0x09415c,
        gridOpacity: 0.65
    },
    sunset: {
        emissive: 0x5a2d1d,
        emissiveIntensity: 0.8,
        roughness: 0.65,
        gridPrimary: 0xff7733,
        gridSecondary: 0x4d1d12,
        gridOpacity: 0.60
    },
    day: {
        emissive: 0x111824,
        emissiveIntensity: 0.2,
        roughness: 0.9,
        gridPrimary: 0x00d0ff,
        gridSecondary: 0x1e3a5f,
        gridOpacity: 0.45
    },
    cyberpunk: {
        emissive: 0x551960,
        emissiveIntensity: 0.95,
        roughness: 0.55,
        gridPrimary: 0xe879f9,
        gridSecondary: 0x06b6d4,
        gridOpacity: 0.80
    },
    space: {
        emissive: 0x1b2048,
        emissiveIntensity: 0.6,
        roughness: 0.8,
        gridPrimary: 0x818cf8,
        gridSecondary: 0x1e1b4b,
        gridOpacity: 0.60
    }
};

let currentPresetName = 'night';

/**
 * Updates vertex colors on the neon grid helper
 */
function updateGridVertexColors(primaryHex, secondaryHex) {
    if (!neonCityGrid || !neonCityGrid.geometry) return;
    const colors = neonCityGrid.geometry.attributes.color;
    if (!colors) return;

    const c1 = new THREE.Color(primaryHex);
    const c2 = new THREE.Color(secondaryHex);

    for (let i = 0; i < colors.count; i++) {
        // The two center axis lines are the first 4 vertices in GridHelper
        const targetColor = (i < 4) ? c1 : c2;
        colors.setXYZ(i, targetColor.r, targetColor.g, targetColor.b);
    }
    colors.needsUpdate = true;
}

/**
 * Resizes the distant 2D city cylinder and neon grid based on current city size
 * 
 * @param {number} citySize Grid size of the city (3 to 14)
 */
export function updateDistantCitySize(citySize = 6) {
    // City radius extends to (citySize * 8)
    // Distance buffer brings the distant city close to the city boundary (~70-95 units away)
    const targetRadius = (citySize * 10) + 70;
    const targetHeight = 55 + (citySize * 5);

    const scaleRadius = targetRadius / BASE_RADIUS;
    const scaleHeight = targetHeight / BASE_HEIGHT;

    // 1. Scale distant skyline cylinder
    if (distantCityMesh) {
        distantCityMesh.scale.set(scaleRadius, scaleHeight, scaleRadius);
        // Position base flush at ground level
        distantCityMesh.position.set(0, targetHeight / 2 - 1.2, 0);
    }

    // 2. Scale neon city grid to span seamlessly beneath city out to the skyline
    if (neonCityGrid) {
        // Grid base size is 280 (at scale 1.0, covers radius 140)
        const gridScale = (targetRadius * 1.08) / 140;
        neonCityGrid.scale.set(gridScale, 1, gridScale);
    }

    // 3. Update flight boundaries:
    // Radius: stop 10 units before the skyline cylinder wall
    const allowedFlightRadius = Math.max(60, targetRadius - 10);
    // Height: ceiling at 78% of skyline height (always frames above camera)
    const allowedFlightHeight = Math.max(40, targetHeight * 0.78);

    setFlightBoundaries(allowedFlightRadius, allowedFlightHeight);
}

/**
 * Initializes the close 2D city skyline and the glowing neon city grid
 * 
 * @param {THREE.Scene} scene The active Three.js scene
 * @param {number} [initialCitySize=6] Initial city grid size
 */
export function createDistantCity(scene, initialCitySize = 6) {
    if (distantCityMesh) {
        scene.remove(distantCityMesh);
    }
    if (neonCityGrid) {
        scene.remove(neonCityGrid);
    }

    // --- 1. NEON CITY MATRIX GRID ---
    // Sized to stretch across the ground beneath the city buildings out to the skyline
    const gridBaseSize = 280;
    const gridDivisions = 56; // 5-unit grid spacing for detailed cyber matrix pattern
    neonCityGrid = new THREE.GridHelper(gridBaseSize, gridDivisions, 0x00ffcc, 0x09415c);
    neonCityGrid.position.y = 0.04; // Slightly above ground plane to prevent z-fighting
    if (neonCityGrid.material) {
        neonCityGrid.material.transparent = true;
        neonCityGrid.material.opacity = 0.65;
        neonCityGrid.material.depthWrite = false;
    }
    scene.add(neonCityGrid);

    // --- 2. 2D CITY SKYLINE CYLINDER ---
    const radialSegments = 64;
    const geometry = new THREE.CylinderGeometry(BASE_RADIUS, BASE_RADIUS, BASE_HEIGHT, radialSegments, 1, true);

    // Invert geometry so front faces point inward towards the player with correct UVs
    geometry.scale(-1, 1, 1);

    currentTexture = textureLoader.load(
        '/textures/distant_city.png',
        (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            // Repeat horizontally 7 times around the closer perimeter for natural skyscraper aspect ratio
            tex.repeat.set(7, 1);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.needsUpdate = true;
        },
        undefined,
        (err) => {
            console.warn('Could not load distant city texture:', err);
        }
    );

    const material = new THREE.MeshStandardMaterial({
        map: currentTexture,
        transparent: true,
        alphaTest: 0.05,
        depthWrite: true,
        side: THREE.FrontSide,
        roughness: 0.75,
        metalness: 0.15,
        emissive: new THREE.Color(0x1c2a4a),
        emissiveIntensity: 0.75,
        fog: true
    });

    distantCityMesh = new THREE.Mesh(geometry, material);
    distantCityMesh.renderOrder = -1; // Render before foreground alpha particles

    scene.add(distantCityMesh);

    // Set initial size and flight boundaries
    updateDistantCitySize(initialCitySize);

    // Apply active theme colors
    updateDistantCityPreset(currentPresetName);

    return distantCityMesh;
}

/**
 * Updates distant city lighting & neon grid colors based on time of day
 * 
 * @param {'night' | 'sunset' | 'day' | 'cyberpunk' | 'space'} presetName 
 */
export function updateDistantCityPreset(presetName) {
    currentPresetName = presetName;
    const config = THEME_PRESETS[presetName] || THEME_PRESETS.night;

    if (distantCityMesh && distantCityMesh.material) {
        distantCityMesh.material.emissive.set(config.emissive);
        distantCityMesh.material.emissiveIntensity = config.emissiveIntensity;
        distantCityMesh.material.roughness = config.roughness;
    }

    if (neonCityGrid && neonCityGrid.material) {
        neonCityGrid.material.opacity = config.gridOpacity;
        updateGridVertexColors(config.gridPrimary, config.gridSecondary);
    }
}

/**
 * Returns the distant city mesh reference
 */
export function getDistantCityMesh() {
    return distantCityMesh;
}

/**
 * Returns the neon grid mesh reference
 */
export function getNeonGridMesh() {
    return neonCityGrid;
}
