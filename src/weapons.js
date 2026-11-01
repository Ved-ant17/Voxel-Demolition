import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { isAiming } from './controls.js';
import { playWeaponSound, playExplosionSound } from './audio.js';

// --- 1. WEAPON ARSENAL SPECIFICATIONS ---
export const WEAPON_TYPES = [
    {
        id: 'pistol',
        name: 'Plasma Pistol',
        modelUrl: '/models/guns/pistol.glb',
        type: 'semi',
        fireRateMs: 170,
        blastRadius: 1.8,
        projectileSpeed: 130,
        projectileColor: 0x00f0ff,
        projectileSize: { radius: 0.06, length: 0.7 },
        particleColor: 0x00f0ff,
        recoilForce: 0.04,
        scale: 0.42,
        posOffset: [0.22, -0.18, -0.38],
        adsOffset: [0.0, -0.12, -0.30],
        description: 'Pinpoint laser sidearm with high fire rate and localized destruction'
    },
    {
        id: 'smg',
        name: 'Rapid SMG',
        modelUrl: '/models/guns/smg.glb',
        type: 'auto',
        fireRateMs: 95,
        blastRadius: 2.3,
        projectileSpeed: 140,
        projectileColor: 0xffbb00,
        projectileSize: { radius: 0.07, length: 0.5 },
        particleColor: 0xffaa00,
        recoilForce: 0.035,
        scale: 0.40,
        posOffset: [0.22, -0.18, -0.40],
        adsOffset: [0.0, -0.13, -0.32],
        description: 'Full-automatic plasma hose continuously tearing through skyscraper facades'
    },
    {
        id: 'shotgun',
        name: 'Scatter Shotgun',
        modelUrl: '/models/guns/shotgun.glb',
        type: 'semi',
        fireRateMs: 580,
        pellets: 6,
        spread: 0.045,
        blastRadius: 2.5,
        projectileSpeed: 110,
        projectileColor: 0xff3b10,
        projectileSize: { radius: 0.08, length: 0.4 },
        particleColor: 0xff4400,
        recoilForce: 0.09,
        scale: 0.42,
        posOffset: [0.23, -0.19, -0.42],
        adsOffset: [0.0, -0.14, -0.34],
        description: 'Pump-action blaster firing 6 explosive pellets in a devastating cone'
    },
    {
        id: 'railgun',
        name: 'Heavy Railgun',
        modelUrl: '/models/guns/railgun.glb',
        type: 'semi',
        fireRateMs: 720,
        blastRadius: 4.2,
        projectileSpeed: 230,
        projectileColor: 0x9933ff,
        projectileSize: { radius: 0.09, length: 1.8 },
        particleColor: 0xaa44ff,
        recoilForce: 0.08,
        scale: 0.42,
        posOffset: [0.22, -0.18, -0.42],
        adsOffset: [0.0, -0.13, -0.32],
        description: 'Hyper-velocity sniper railgun punching deep craters through reinforced walls'
    },
    {
        id: 'missile',
        name: 'Missile Launcher',
        modelUrl: '/models/guns/missile.glb',
        type: 'semi',
        fireRateMs: 950,
        isRocket: true,
        blastRadius: 8.5, // MASSIVE BOOM!
        projectileSpeed: 70,
        projectileColor: 0xff5500,
        projectileSize: { radius: 0.22, length: 1.2 },
        particleColor: 0xff4400,
        recoilForce: 0.12,
        scale: 0.42,
        posOffset: [0.24, -0.20, -0.44],
        adsOffset: [0.0, -0.14, -0.35],
        description: 'Heavy rocket launcher triggering massive fiery detonations and debris eruptions'
    }
];

let activeWeaponIndex = 0;
let lastFireTime = 0;

// --- 2. VIEWMODEL FIRST-PERSON HOLDER ---
const gltfLoader = new GLTFLoader();
const loadedGunModels = {};

let weaponHolder = null;
let currentGunMesh = null;
let muzzleLight = null;

let recoilOffset = 0;
let recoilPitch = 0;
let switchTransitionY = 0; // Animates gun lowering and raising on switch
let bobTimer = 0;

// Reusable direction vectors
const raycaster = new THREE.Raycaster();
const cameraDirection = new THREE.Vector3();
const barrelTipPos = new THREE.Vector3();

// --- 3. ACTIVE PROJECTILES & PARTICLES ARRAYS ---
export const activeProjectiles = [];
const activeMuzzleSparks = [];
const activeRocketTrails = [];
const activeMissileBooms = [];
const activeFlashes = [];

// Shared Geometries & Materials
const sparkGeometry = new THREE.DodecahedronGeometry(0.04, 0);
const smokeGeometry = new THREE.SphereGeometry(0.12, 6, 6);

// Missile geometry (cylindrical body with conical warhead and tail fins)
const missileBodyGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.9, 8);
missileBodyGeo.rotateX(Math.PI / 2);
const missileWarheadGeo = new THREE.ConeGeometry(0.14, 0.4, 8);
missileWarheadGeo.rotateX(Math.PI / 2);

const missileBodyMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
    roughness: 0.3
});
const missileWarheadMat = new THREE.MeshStandardMaterial({
    color: 0xff3b10,
    emissive: 0xff4400,
    emissiveIntensity: 3.5,
    metalness: 0.2,
    roughness: 0.2
});

/**
 * Initializes the First-Person Gun Viewmodel rig on the player's camera
 * 
 * @param {THREE.PerspectiveCamera} camera 
 * @param {THREE.Scene} scene 
 */
export function initWeapons(camera, scene) {
    if (!camera || !scene) return;

    // Camera MUST be in scene for child viewmodels to render properly
    scene.add(camera);

    // Create holder for first-person weapons
    weaponHolder = new THREE.Group();
    camera.add(weaponHolder);

    // Muzzle flash point light attached to weapon holder
    muzzleLight = new THREE.PointLight(0xffaa22, 0, 8);
    muzzleLight.position.set(0.18, -0.10, -0.65);
    weaponHolder.add(muzzleLight);

    // Preload all 5 GLB gun models asynchronously
    WEAPON_TYPES.forEach((weapon, index) => {
        gltfLoader.load(
            weapon.modelUrl,
            (gltf) => {
                const model = gltf.scene;

                // Standardize materials
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = false;
                        child.receiveShadow = false;
                        if (child.material) {
                            child.material.metalness = 0.2;
                            child.material.roughness = 0.6;
                        }
                    }
                });

                // Orient gun forward along camera's -Z view axis, pointing upward with natural FPS stance
                model.rotation.set(-0.04, -0.04, 0.02);

                loadedGunModels[weapon.id] = model;

                // If this is the starting weapon, equip it immediately
                if (index === activeWeaponIndex && !currentGunMesh) {
                    equipGunModel(index);
                }
            },
            undefined,
            (err) => {
                console.warn(`Could not load gun model ${weapon.modelUrl}:`, err);
            }
        );
    });
}

/**
 * Equips the 3D model for the given weapon index
 */
function equipGunModel(index) {
    if (!weaponHolder) return;

    const weapon = WEAPON_TYPES[index];
    if (!weapon) return;

    // Remove previous gun mesh
    if (currentGunMesh) {
        weaponHolder.remove(currentGunMesh);
        currentGunMesh = null;
    }

    const baseModel = loadedGunModels[weapon.id];
    if (!baseModel) return;

    // Clone and configure for active view
    currentGunMesh = baseModel.clone();
    currentGunMesh.scale.setScalar(weapon.scale);
    weaponHolder.add(currentGunMesh);

    // Trigger equip raise animation
    switchTransitionY = -0.25;

    // Update weapon indicator in HUD
    updateWeaponHUD();
}

/**
 * Changes active weapon by index (0 to 4)
 */
export function selectWeapon(index) {
    if (index < 0 || index >= WEAPON_TYPES.length) return;
    if (index === activeWeaponIndex) return;

    activeWeaponIndex = index;
    equipGunModel(activeWeaponIndex);
}

/**
 * Scrolls to the next weapon (mouse scroll down)
 */
export function switchNextWeapon() {
    const next = (activeWeaponIndex + 1) % WEAPON_TYPES.length;
    selectWeapon(next);
}

/**
 * Scrolls to the previous weapon (mouse scroll up)
 */
export function switchPrevWeapon() {
    const prev = (activeWeaponIndex - 1 + WEAPON_TYPES.length) % WEAPON_TYPES.length;
    selectWeapon(prev);
}

export function getActiveWeapon() {
    return WEAPON_TYPES[activeWeaponIndex];
}

export function getActiveWeaponIndex() {
    return activeWeaponIndex;
}

/**
 * Updates in-game HUD pills and bottom weapon bar
 */
function updateWeaponHUD() {
    const weapon = WEAPON_TYPES[activeWeaponIndex];
    if (!weapon) return;

    const nameElem = document.getElementById('hudWeaponName');
    const metaElem = document.getElementById('hudWeaponMeta');

    if (nameElem) nameElem.textContent = weapon.name;
    if (metaElem) {
        const typeStr = weapon.type === 'auto' ? 'Full-Auto' : (weapon.pellets ? '6x Spread' : 'Semi');
        metaElem.textContent = `${typeStr} • Blast: ${weapon.blastRadius.toFixed(1)}m`;
    }

    // Highlight active weapon slot in bottom bar
    document.querySelectorAll('.weapon-slot').forEach((slot, idx) => {
        if (idx === activeWeaponIndex) {
            slot.classList.add('active');
        } else {
            slot.classList.remove('active');
        }
    });
}

/**
 * Spawns dynamic muzzle sparks and smoke particles when a gun is fired
 */
function spawnMuzzleParticles(origin, forwardDir, colorHex, scene) {
    const count = 7;
    const baseMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95
    });

    for (let i = 0; i < count; i++) {
        const spark = new THREE.Mesh(sparkGeometry, baseMat.clone());
        spark.position.copy(origin);

        // Velocity with conical spread forward
        const spreadX = (Math.random() - 0.5) * 0.4;
        const spreadY = (Math.random() - 0.5) * 0.4;
        const spreadZ = (Math.random() - 0.5) * 0.4;

        const velocity = forwardDir.clone()
            .add(new THREE.Vector3(spreadX, spreadY, spreadZ))
            .normalize()
            .multiplyScalar(14.0 + Math.random() * 12.0);

        scene.add(spark);
        activeMuzzleSparks.push({
            mesh: spark,
            velocity: velocity,
            life: 0.16 + Math.random() * 0.08,
            maxLife: 0.24
        });
    }

    // Single muzzle smoke puff
    const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.45
    });
    const smoke = new THREE.Mesh(smokeGeometry, smokeMat);
    smoke.position.copy(origin);
    scene.add(smoke);

    activeMuzzleSparks.push({
        mesh: smoke,
        velocity: forwardDir.clone().multiplyScalar(4.0).add(new THREE.Vector3(0, 1.5, 0)),
        isSmoke: true,
        life: 0.35,
        maxLife: 0.35
    });
}

/**
 * Creates physical missile mesh with body, warhead, and engine point light
 */
function createMissileMesh() {
    const group = new THREE.Group();

    const body = new THREE.Mesh(missileBodyGeo, missileBodyMat);
    group.add(body);

    const warhead = new THREE.Mesh(missileWarheadGeo, missileWarheadMat);
    warhead.position.set(0, 0, -0.55);
    group.add(warhead);

    // Dynamic flame light attached to engine exhaust
    const engineLight = new THREE.PointLight(0xff5500, 4, 18);
    engineLight.position.set(0, 0, 0.45);
    group.add(engineLight);

    return group;
}

/**
 * Fires the active weapon from camera position
 * 
 * @param {THREE.PerspectiveCamera} camera 
 * @param {THREE.Scene} scene 
 */
export function fireActiveWeapon(camera, scene) {
    if (!camera || !scene) return;

    const weapon = WEAPON_TYPES[activeWeaponIndex];
    const now = performance.now();

    if (now - lastFireTime < weapon.fireRateMs) {
        return;
    }
    lastFireTime = now;

    // Trigger visual recoil kick
    recoilOffset = weapon.recoilForce;
    recoilPitch = weapon.recoilForce * 1.5;

    // Flash muzzle light
    if (muzzleLight) {
        muzzleLight.color.set(weapon.particleColor);
        muzzleLight.intensity = 4.5;
    }

    // Play weapon fire sound effect
    playWeaponSound(weapon.id);

    // Get camera aim direction
    camera.getWorldDirection(cameraDirection);
    cameraDirection.normalize();

    // Calculate barrel tip origin in world coordinates
    barrelTipPos.copy(camera.position).addScaledVector(cameraDirection, 0.75);
    if (!isAiming) {
        // Offset slightly to right for hip-fire origin
        const rightVec = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
        barrelTipPos.addScaledVector(rightVec, 0.16);
        barrelTipPos.addScaledVector(new THREE.Vector3(0, 1, 0), -0.08);
    }

    // Spawn shooting spark and smoke particle effects
    spawnMuzzleParticles(barrelTipPos, cameraDirection, weapon.particleColor, scene);

    // Number of projectiles (Shotgun fires multiple spread pellets)
    const count = weapon.pellets || 1;

    for (let p = 0; p < count; p++) {
        let shotDir = cameraDirection.clone();

        // Conical spread for shotgun
        if (weapon.spread) {
            const spreadAngle = (Math.random() - 0.5) * weapon.spread;
            const spreadAngleY = (Math.random() - 0.5) * weapon.spread;
            shotDir.x += spreadAngle;
            shotDir.y += spreadAngleY;
            shotDir.normalize();
        }

        let projMesh;

        if (weapon.isRocket) {
            // Heavy physical missile
            projMesh = createMissileMesh();
        } else {
            // Glowing laser tracer / bullet bolt
            const bulletGeo = new THREE.CylinderGeometry(
                weapon.projectileSize.radius,
                weapon.projectileSize.radius,
                weapon.projectileSize.length,
                6
            );
            bulletGeo.rotateX(Math.PI / 2);

            const bulletMat = new THREE.MeshBasicMaterial({
                color: weapon.projectileColor,
                transparent: true,
                opacity: 0.95
            });

            projMesh = new THREE.Mesh(bulletGeo, bulletMat);

            // Small dynamic light for tracer
            const light = new THREE.PointLight(weapon.projectileColor, 2, 8);
            projMesh.add(light);
        }

        projMesh.position.copy(barrelTipPos);
        projMesh.lookAt(barrelTipPos.clone().add(shotDir));
        scene.add(projMesh);

        activeProjectiles.push({
            mesh: projMesh,
            direction: shotDir,
            speed: weapon.projectileSpeed,
            weapon: weapon,
            distanceTraveled: 0,
            maxDistance: 650,
            isRocket: !!weapon.isRocket
        });
    }
}

/**
 * Triggers a massive explosive BOOM with expanding fire sphere, shockwave ring,
 * and high-intensity blast light for the missile launcher.
 */
function triggerMissileBoom(position, scene) {
    // 0. Play punchy missile explosive detonation sound
    playExplosionSound();

    // 1. Dynamic Shockwave Blast Light
    const blastLight = new THREE.PointLight(0xff5500, 24, 45);
    blastLight.position.copy(position);
    scene.add(blastLight);

    // 2. Expanding Fiery Core Sphere
    const coreGeo = new THREE.SphereGeometry(1.4, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffdd44,
        transparent: true,
        opacity: 0.95
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.copy(position);
    scene.add(coreMesh);

    // 3. Outer Fireball Mesh
    const fireGeo = new THREE.SphereGeometry(2.4, 16, 16);
    const fireMat = new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0xff4400,
        emissiveIntensity: 3.5,
        transparent: true,
        opacity: 0.85,
        roughness: 0.3
    });
    const fireMesh = new THREE.Mesh(fireGeo, fireMat);
    fireMesh.position.copy(position);
    scene.add(fireMesh);

    // 4. Expanding Shockwave Ring
    const ringGeo = new THREE.RingGeometry(0.5, 2.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(position);
    ringMesh.rotation.x = -Math.PI / 2;
    scene.add(ringMesh);

    // 5. 30 Fiery Spark Chunks shooting out
    const sparkCount = 30;
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xff7700, transparent: true, opacity: 0.95 });
    for (let k = 0; k < sparkCount; k++) {
        const spark = new THREE.Mesh(sparkGeometry, sparkMat.clone());
        spark.position.copy(position);
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 1.5 + 0.3,
            (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(15.0 + Math.random() * 20.0);

        scene.add(spark);
        activeMuzzleSparks.push({
            mesh: spark,
            velocity: vel,
            gravity: 18.0,
            life: 0.35 + Math.random() * 0.2,
            maxLife: 0.55
        });
    }

    activeMissileBooms.push({
        light: blastLight,
        coreMesh: coreMesh,
        fireMesh: fireMesh,
        ringMesh: ringMesh,
        life: 0.42,
        maxLife: 0.42
    });
}

/**
 * Creates energetic impact flash for standard bullet hits
 */
function createImpactFlash(position, colorHex, scene) {
    const flashGeo = new THREE.SphereGeometry(0.8, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
        color: colorHex || 0xffdd44,
        transparent: true,
        opacity: 0.9
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(position);

    const flashLight = new THREE.PointLight(colorHex || 0xffaa22, 6, 14);
    flashLight.position.copy(position);

    scene.add(flashMesh);
    scene.add(flashLight);

    activeFlashes.push({
        mesh: flashMesh,
        light: flashLight,
        life: 0.14,
        maxLife: 0.14
    });
}

/**
 * Main frame update for all active projectiles, particles, and weapon viewmodel animations
 * 
 * @param {number} deltaTime 
 * @param {THREE.Scene} scene 
 * @param {THREE.InstancedMesh} cityMesh 
 * @param {Function} onHit Callback: (impactPoint, instanceId, hit, weapon)
 * @param {THREE.PerspectiveCamera} camera 
 */
export function updateWeapons(deltaTime, scene, cityMesh, onHit, camera) {
    // 1. Update First-Person Weapon Rig Position & Animations
    if (weaponHolder && currentGunMesh) {
        const weapon = WEAPON_TYPES[activeWeaponIndex];
        const targetOffset = isAiming ? weapon.adsOffset : weapon.posOffset;

        // Smooth spring lerp toward target position
        weaponHolder.position.x = THREE.MathUtils.lerp(weaponHolder.position.x, targetOffset[0], 14 * deltaTime);
        weaponHolder.position.y = THREE.MathUtils.lerp(
            weaponHolder.position.y,
            targetOffset[1] + switchTransitionY,
            14 * deltaTime
        );
        weaponHolder.position.z = THREE.MathUtils.lerp(
            weaponHolder.position.z,
            targetOffset[2] + recoilOffset,
            18 * deltaTime
        );

        // Smoothly decay recoil kick and switch animation
        recoilOffset = THREE.MathUtils.lerp(recoilOffset, 0, 18 * deltaTime);
        recoilPitch = THREE.MathUtils.lerp(recoilPitch, 0, 18 * deltaTime);
        switchTransitionY = THREE.MathUtils.lerp(switchTransitionY, 0, 12 * deltaTime);

        // Idle weapon breathing sway
        bobTimer += deltaTime * 2.5;
        const bobX = Math.sin(bobTimer) * 0.003;
        const bobY = Math.cos(bobTimer * 2) * 0.003;

        currentGunMesh.position.set(bobX, bobY, 0);

        // Maintain forward sightline orientation with upward tilt and recoil kick
        const baseRotX = -0.04;
        const baseRotY = -0.04;
        const baseRotZ = 0.02;
        currentGunMesh.rotation.set(baseRotX - recoilPitch, baseRotY, baseRotZ);

        // Fade muzzle flash light
        if (muzzleLight && muzzleLight.intensity > 0) {
            muzzleLight.intensity = THREE.MathUtils.lerp(muzzleLight.intensity, 0, 24 * deltaTime);
        }
    }

    // 2. Update In-Flight Projectiles (Raycasting & Movement)
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
        const proj = activeProjectiles[i];
        const stepDist = proj.speed * deltaTime;

        // Spawn rocket flame & smoke trail
        if (proj.isRocket) {
            const trailPos = proj.mesh.position.clone().addScaledVector(proj.direction, -0.45);

            // Flame puff
            const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 });
            const flame = new THREE.Mesh(smokeGeometry, flameMat);
            flame.scale.setScalar(0.7);
            flame.position.copy(trailPos);
            scene.add(flame);

            activeRocketTrails.push({
                mesh: flame,
                life: 0.14,
                maxLife: 0.14,
                scaleSpeed: 3.0
            });
        }

        // Raycasting forward along flight trajectory
        raycaster.set(proj.mesh.position, proj.direction);
        raycaster.far = stepDist + 0.2;

        const targets = [];
        if (cityMesh) targets.push(cityMesh);

        const intersects = raycaster.intersectObjects(targets, false);

        if (intersects.length > 0 && intersects[0].distance <= stepDist + 0.2) {
            const hit = intersects[0];
            const impactPoint = hit.point.clone();

            if (proj.isRocket) {
                // MASSIVE MISSILE BOOM
                triggerMissileBoom(impactPoint, scene);
            } else {
                // Standard bullet impact flash
                createImpactFlash(impactPoint, proj.weapon.projectileColor, scene);
            }

            // Trigger destruction with weapon-specific blast radius
            if (typeof onHit === 'function') {
                onHit(impactPoint, hit.instanceId, hit, proj.weapon);
            }

            scene.remove(proj.mesh);
            activeProjectiles.splice(i, 1);
            continue;
        }

        // Move projectile forward
        proj.mesh.position.addScaledVector(proj.direction, stepDist);
        proj.distanceTraveled += stepDist;

        // Ground hit or out-of-bounds cleanup
        if (proj.distanceTraveled >= proj.maxDistance || proj.mesh.position.y <= 0) {
            if (proj.mesh.position.y <= 0) {
                const groundImpact = proj.mesh.position.clone();
                groundImpact.y = 0.1;
                if (proj.isRocket) {
                    triggerMissileBoom(groundImpact, scene);
                } else {
                    createImpactFlash(groundImpact, proj.weapon.projectileColor, scene);
                }
                if (typeof onHit === 'function') {
                    onHit(groundImpact, null, null, proj.weapon);
                }
            }

            scene.remove(proj.mesh);
            activeProjectiles.splice(i, 1);
        }
    }

    // 3. Update Rocket Trails
    for (let t = activeRocketTrails.length - 1; t >= 0; t--) {
        const trail = activeRocketTrails[t];
        trail.life -= deltaTime;
        if (trail.life <= 0) {
            scene.remove(trail.mesh);
            trail.mesh.geometry.dispose();
            trail.mesh.material.dispose();
            activeRocketTrails.splice(t, 1);
        } else {
            const p = trail.life / trail.maxLife;
            trail.mesh.scale.addScalar(deltaTime * (trail.scaleSpeed || 2.0));
            trail.mesh.material.opacity = p * 0.7;
        }
    }

    // 4. Update Muzzle Sparks & Shooting Particles
    for (let s = activeMuzzleSparks.length - 1; s >= 0; s--) {
        const spark = activeMuzzleSparks[s];
        spark.life -= deltaTime;

        if (spark.life <= 0) {
            scene.remove(spark.mesh);
            spark.mesh.geometry.dispose();
            spark.mesh.material.dispose();
            activeMuzzleSparks.splice(s, 1);
        } else {
            const progress = spark.life / spark.maxLife;
            spark.mesh.position.addScaledVector(spark.velocity, deltaTime);

            // Optional gravity for explosion sparks
            if (spark.gravity) {
                spark.velocity.y -= spark.gravity * deltaTime;
            }

            spark.mesh.material.opacity = progress * 0.9;
            spark.mesh.scale.setScalar(spark.isSmoke ? (1.0 + (1 - progress) * 2.0) : progress);
        }
    }

    // 5. Update Missile BOOM Detonations
    for (let b = activeMissileBooms.length - 1; b >= 0; b--) {
        const boom = activeMissileBooms[b];
        boom.life -= deltaTime;

        if (boom.life <= 0) {
            scene.remove(boom.light);
            scene.remove(boom.coreMesh);
            scene.remove(boom.fireMesh);
            scene.remove(boom.ringMesh);
            boom.coreMesh.geometry.dispose();
            boom.coreMesh.material.dispose();
            boom.fireMesh.geometry.dispose();
            boom.fireMesh.material.dispose();
            boom.ringMesh.geometry.dispose();
            boom.ringMesh.material.dispose();
            activeMissileBooms.splice(b, 1);
        } else {
            const p = boom.life / boom.maxLife; // 1 -> 0
            const expansion = (1 - p); // 0 -> 1

            // Expand core and outer fireball
            boom.coreMesh.scale.setScalar(1.0 + expansion * 6.0);
            boom.fireMesh.scale.setScalar(1.0 + expansion * 11.0);
            boom.coreMesh.material.opacity = p * 0.95;
            boom.fireMesh.material.opacity = p * 0.85;

            // Expand shockwave ring
            boom.ringMesh.scale.setScalar(1.0 + expansion * 14.0);
            boom.ringMesh.material.opacity = p * 0.8;

            // Fade blast light
            boom.light.intensity = p * 24.0;
        }
    }

    // 6. Update Standard Impact Flashes
    for (let f = activeFlashes.length - 1; f >= 0; f--) {
        const flash = activeFlashes[f];
        flash.life -= deltaTime;

        if (flash.life <= 0) {
            scene.remove(flash.mesh);
            scene.remove(flash.light);
            flash.mesh.geometry.dispose();
            flash.mesh.material.dispose();
            activeFlashes.splice(f, 1);
        } else {
            const p = flash.life / flash.maxLife;
            flash.mesh.scale.setScalar(1.0 + (1 - p) * 3.0);
            flash.mesh.material.opacity = p * 0.9;
            flash.light.intensity = p * 6.0;
        }
    }
}
