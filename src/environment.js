import * as THREE from 'three';
import { createDistantCity, updateDistantCityPreset } from './distantCity.js';

// Store references to environmental lighting elements
let currentScene = null;
let currentHemiLight = null;
let currentMainLight = null;
let currentFillLight = null;
let currentGroundMesh = null;
let currentPreset = 'night';

const textureLoader = new THREE.TextureLoader();
const cachedSkyTextures = {};

export const TIME_PRESETS = {
    night: {
        name: 'Night',
        sky: '#0b0f1e',
        skyTexture: '/textures/sky/skybox-night.png',
        fogDensity: 0.0035,
        hemiSky: 0x8fa8dc,
        hemiGround: 0x242a3e,
        hemiIntensity: 1.4,
        mainColor: 0xb4c8f5,
        mainIntensity: 2.2,
        mainPos: [70, 130, 70],
        fillColor: 0x566d96,
        fillIntensity: 1.1,
        fillPos: [-80, 70, -80],
        groundColor: 0x161a2c
    },
    sunset: {
        name: 'Sunset',
        sky: '#a34832',
        skyTexture: '/textures/sky/skybox-morning.png',
        fogDensity: 0.0030,
        hemiSky: 0xffa066,
        hemiGround: 0x331828,
        hemiIntensity: 1.7,
        mainColor: 0xff7033,
        mainIntensity: 3.2,
        mainPos: [140, 38, 50],
        fillColor: 0x853468,
        fillIntensity: 1.4,
        fillPos: [-90, 50, -70],
        groundColor: 0x241726
    },
    day: {
        name: 'Day',
        sky: '#64a2e0',
        skyTexture: '/textures/sky/skybox-day.png',
        fogDensity: 0.0022,
        hemiSky: 0xd8eaff,
        hemiGround: 0x525861,
        hemiIntensity: 1.9,
        mainColor: 0xfff6e3,
        mainIntensity: 3.0,
        mainPos: [80, 160, 60],
        fillColor: 0x9bc0e4,
        fillIntensity: 1.2,
        fillPos: [-70, 70, -70],
        groundColor: 0x2c3440
    },
    cyberpunk: {
        name: 'Cyberpunk',
        sky: '#0d061c',
        skyTexture: '/textures/sky/skybox-alien.png',
        fogDensity: 0.0038,
        hemiSky: 0xe879f9,
        hemiGround: 0x06b6d4,
        hemiIntensity: 2.2,
        mainColor: 0x00f5d4,
        mainIntensity: 2.8,
        mainPos: [60, 120, 60],
        fillColor: 0xf43f5e,
        fillIntensity: 2.4,
        fillPos: [-70, 80, -70],
        groundColor: 0x130a24
    },
    space: {
        name: 'Space',
        sky: '#05050b',
        skyTexture: '/textures/sky/skybox-space.png',
        fogDensity: 0.0025,
        hemiSky: 0xa5b4fc,
        hemiGround: 0x1e1b4b,
        hemiIntensity: 1.5,
        mainColor: 0x818cf8,
        mainIntensity: 2.4,
        mainPos: [80, 140, 80],
        fillColor: 0xc084fc,
        fillIntensity: 1.3,
        fillPos: [-80, 70, -80],
        groundColor: 0x0f1120
    }
};

/**
 * Loads and applies an equirectangular 360-degree skybox panorama
 * 
 * @param {string} textureUrl Path to the sky texture
 * @param {string} targetPreset Name of the preset to verify before applying
 */
function applySkyTexture(textureUrl, targetPreset) {
    if (!currentScene) return;

    if (cachedSkyTextures[textureUrl]) {
        currentScene.background = cachedSkyTextures[textureUrl];
        return;
    }

    textureLoader.load(
        textureUrl,
        (texture) => {
            // Equirectangular mapping creates seamless 360-degree sphere panorama
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            cachedSkyTextures[textureUrl] = texture;

            // Only apply if the preset hasn't changed while loading
            if (currentPreset === targetPreset && currentScene) {
                currentScene.background = texture;
            }
        },
        undefined,
        (err) => {
            console.warn(`Could not load sky texture ${textureUrl}:`, err);
        }
    );
}

/**
 * Changes lighting, sky panorama texture, and fog according to the chosen time preset
 * 
 * @param {'night' | 'sunset' | 'day' | 'cyberpunk' | 'space'} presetName 
 */
export function setTimeOfDay(presetName) {
    const config = TIME_PRESETS[presetName];
    if (!config || !currentScene) return;

    currentPreset = presetName;

    // 1. Fallback Color & Fog
    if (!currentScene.background || !(currentScene.background instanceof THREE.Texture)) {
        currentScene.background = new THREE.Color(config.sky);
    }
    if (currentScene.fog) {
        currentScene.fog.color.set(config.sky);
        currentScene.fog.density = config.fogDensity;
    }

    // 2. Load and Apply 360° Sky Panorama Texture
    if (config.skyTexture) {
        applySkyTexture(config.skyTexture, presetName);
    }

    // 3. Update Hemisphere Ambient Light
    if (currentHemiLight) {
        currentHemiLight.color.set(config.hemiSky);
        currentHemiLight.groundColor.set(config.hemiGround);
        currentHemiLight.intensity = config.hemiIntensity;
    }

    // 4. Update Main Directional Light
    if (currentMainLight) {
        currentMainLight.color.set(config.mainColor);
        currentMainLight.intensity = config.mainIntensity;
        currentMainLight.position.set(...config.mainPos);
    }

    // 5. Update Fill Light
    if (currentFillLight) {
        currentFillLight.color.set(config.fillColor);
        currentFillLight.intensity = config.fillIntensity;
        currentFillLight.position.set(...config.fillPos);
    }

    // 6. Update Ground Color
    if (currentGroundMesh && currentGroundMesh.material) {
        currentGroundMesh.material.color.set(config.groundColor);
    }

    // 7. Update Distant 2D City Skyline Lighting & Emissive Tone
    updateDistantCityPreset(presetName);

    return currentPreset;
}

export function getCurrentTimePreset() {
    return currentPreset;
}

/**
 * Initializes sky, lights, ground, and applies default night preset
 * 
 * @param {THREE.Scene} [existingScene]
 * @returns {THREE.Scene}
 */
export function createEnvironment(existingScene) {
    const scene = existingScene || new THREE.Scene();
    currentScene = scene;

    // Base background & fog
    scene.background = new THREE.Color('#0b0f1e');
    scene.fog = new THREE.FogExp2('#0b0f1e', 0.0035);

    // Hemisphere light
    currentHemiLight = new THREE.HemisphereLight(0x8fa8dc, 0x242a3e, 1.4);
    currentHemiLight.position.set(0, 150, 0);
    scene.add(currentHemiLight);

    // Primary Directional light (casts shadows)
    currentMainLight = new THREE.DirectionalLight(0xb4c8f5, 2.2);
    currentMainLight.position.set(70, 130, 70);
    currentMainLight.castShadow = true;
    currentMainLight.shadow.mapSize.width = 2048;
    currentMainLight.shadow.mapSize.height = 2048;
    currentMainLight.shadow.camera.near = 0.5;
    currentMainLight.shadow.camera.far = 400;
    const shadowDist = 200;
    currentMainLight.shadow.camera.left = -shadowDist;
    currentMainLight.shadow.camera.right = shadowDist;
    currentMainLight.shadow.camera.top = shadowDist;
    currentMainLight.shadow.camera.bottom = -shadowDist;
    currentMainLight.shadow.bias = -0.0005;
    scene.add(currentMainLight);

    // Secondary fill light
    currentFillLight = new THREE.DirectionalLight(0x566d96, 1.1);
    currentFillLight.position.set(-100, 90, -100);
    scene.add(currentFillLight);

    // Ground plane (sized to accommodate massive mega-city generation)
    const groundGeometry = new THREE.PlaneGeometry(2500, 2500);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x161a2c,
        roughness: 0.85,
        metalness: 0.1
    });
    currentGroundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    currentGroundMesh.rotation.x = -Math.PI / 2;
    currentGroundMesh.position.y = 0;
    currentGroundMesh.receiveShadow = true;
    scene.add(currentGroundMesh);

    // Distant 2D City Skyline Backdrop (surrounding empty horizon)
    createDistantCity(scene);

    // Apply initial preset with panoramic texture
    setTimeOfDay('night');

    return scene;
}
