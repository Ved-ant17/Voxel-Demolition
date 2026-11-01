import * as THREE from 'three';

/**
 * Phase 2: Environment Setup
 * Creates a clear, well-illuminated nighttime city atmosphere:
 * rich twilight sky, balanced depth fog, atmospheric hemisphere lighting,
 * primary moonlight with shadows, and an opposing fill light for clarity.
 * 
 * @param {THREE.Scene} [existingScene] Optional existing scene to configure.
 * @returns {THREE.Scene} The configured Three.js scene.
 */
export function createEnvironment(existingScene) {
    const scene = existingScene || new THREE.Scene();

    // 1. Scene Background & Depth Fog
    // Rich twilight deep navy - clear visibility with nighttime mood
    const nightSkyColor = new THREE.Color('#12162c');
    scene.background = nightSkyColor;
    
    // Balanced fog: softly blends distant horizons without obscuring the city
    scene.fog = new THREE.FogExp2('#12162c', 0.0055);

    // 2. Clear Atmospheric Lighting
    // Hemisphere light gives subtle ambient sky light from above and soft bounce from below
    const hemiLight = new THREE.HemisphereLight(0x8fa8dc, 0x242a3e, 1.4);
    hemiLight.position.set(0, 150, 0);
    scene.add(hemiLight);

    // Primary cool directional moonlight (casts sharp shadows)
    const moonLight = new THREE.DirectionalLight(0xb4c8f5, 2.2);
    moonLight.position.set(70, 130, 70);
    moonLight.castShadow = true;

    // Shadow map bounds
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 400;
    const shadowDistance = 160;
    moonLight.shadow.camera.left = -shadowDistance;
    moonLight.shadow.camera.right = shadowDistance;
    moonLight.shadow.camera.top = shadowDistance;
    moonLight.shadow.camera.bottom = -shadowDistance;
    moonLight.shadow.bias = -0.0005;
    scene.add(moonLight);

    // Secondary opposing fill light - illuminates dark sides of buildings and alleyways
    const fillLight = new THREE.DirectionalLight(0x566d96, 1.1);
    fillLight.position.set(-80, 70, -80);
    scene.add(fillLight);

    // 3. Ground Plane
    const groundGeometry = new THREE.PlaneGeometry(1200, 1200);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x161a2c,
        roughness: 0.85,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    return scene;
}
