/**
 * Voxel Demolition - Complete Audio System
 * 
 * Features:
 * - Dynamic Polyphonic Weapon Gunfire SFX (Pistol, SMG, Shotgun, Railgun, Missile)
 * - Punchy Missile Explosion & Demolition Detonation SFX
 * - Ambient Cyberpunk Background Music with Dynamic Ducking:
 *     - Volume increases when the menu is open / toggled
 *     - Volume decreases when playing in-game for maximum punch & clarity
 * - Atmospheric Rain Ambience that smoothly loops during Thunderstorms and fades out during clear/fog weather
 * - Browser Autoplay Policy compliant (unlocks seamlessly on first interaction)
 */

// --- 1. AUDIO CONFIGURATION & ASSET PATHS ---
const AUDIO_PATHS = {
    weapons: {
        pistol: '/audio/weapon/pistol-shot.wav',
        smg: '/audio/weapon/smg.m4a?v=2',
        shotgun: '/audio/weapon/shotgun.wav',
        railgun: '/audio/weapon/railgun.wav',
        missile: '/audio/weapon/missilelauncher.m4a'
    },
    explosion: '/audio/weapon/explosion.wav',
    bgm: '/audio/bg_music.mp3',
    rain: '/audio/raining.m4a'
};

// Target Volume Levels
const VOLUMES = {
    bgmMenu: 0.50,   // Background music volume when menu is open / toggled
    bgmGame: 0.04,   // Background music volume while playing in-game (reduced when menu is not toggled)
    rain: 0.85,      // Rain volume when thunderstorm weather is active (boosted for immersive heavy rainfall)
    sfxMaster: 0.85  // Weapon and explosion SFX master gain
};

// --- 2. INTERNAL STATE ---
let audioCtx = null;
let sfxGainNode = null;
let isAudioInitialized = false;
let userHasInteracted = false;

// Decoded AudioBuffer cache for Web Audio SFX
const soundBuffers = {};
// Fallback HTMLAudioElement pools
const fallbackAudioPools = {};

// Background Music and Rain Audio Elements
let bgAudio = null;
let rainAudio = null;

let isMenuOpen = true;
let isRaining = false;

let currentBgmVolume = 0.0;
let targetBgmVolume = VOLUMES.bgmMenu;

let currentRainVolume = 0.0;
let targetRainVolume = 0.0;

/**
 * Initializes the Web Audio Context and audio elements
 */
export function initAudio() {
    if (isAudioInitialized) return;
    isAudioInitialized = true;

    // Create Background Music HTML5 Audio Element
    bgAudio = new Audio(AUDIO_PATHS.bgm);
    bgAudio.loop = true;
    bgAudio.preload = 'auto';
    bgAudio.volume = 0; // Starts at 0, smoothly fades in on user gesture

    // Create Raining HTML5 Audio Element
    rainAudio = new Audio(AUDIO_PATHS.rain);
    rainAudio.loop = true;
    rainAudio.preload = 'auto';
    rainAudio.volume = 0;

    // Preload Web Audio buffers
    preloadSoundBuffers();

    // Setup global interaction listeners to resume audio context per browser autoplay rules
    const unlockHandler = () => {
        resumeAudio();
        // Remove listener once unlocked
        window.removeEventListener('pointerdown', unlockHandler);
        window.removeEventListener('keydown', unlockHandler);
        window.removeEventListener('click', unlockHandler);
    };

    window.addEventListener('pointerdown', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
    window.addEventListener('click', unlockHandler, { passive: true });
}

/**
 * Ensures AudioContext is active and starts background music on first user interaction
 */
export function resumeAudio() {
    userHasInteracted = true;

    // 1. Resume Web Audio Context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx && AudioContextClass) {
        audioCtx = new AudioContextClass();
        sfxGainNode = audioCtx.createGain();
        sfxGainNode.gain.value = VOLUMES.sfxMaster;
        sfxGainNode.connect(audioCtx.destination);
    }

    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch((err) => console.warn('AudioContext resume catch:', err));
    }

    // 2. Start Background Music if not already playing
    if (bgAudio && bgAudio.paused) {
        bgAudio.play().catch((err) => console.warn('Background music autoplay blocked, awaiting gesture:', err));
    }

    // 3. Start Rain Audio if rain is currently active
    if (isRaining && rainAudio && rainAudio.paused) {
        rainAudio.play().catch((err) => console.warn('Rain audio autoplay blocked, awaiting gesture:', err));
    }
}

/**
 * Preloads all sound effects into Web Audio buffers for instant polyphonic playback
 */
async function preloadSoundBuffers() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx && AudioContextClass) {
        audioCtx = new AudioContextClass();
        sfxGainNode = audioCtx.createGain();
        sfxGainNode.gain.value = VOLUMES.sfxMaster;
        sfxGainNode.connect(audioCtx.destination);
    }

    const loadSound = async (id, url) => {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            if (audioCtx) {
                audioCtx.decodeAudioData(
                    arrayBuffer,
                    (decoded) => {
                        soundBuffers[id] = decoded;
                    },
                    (decodeErr) => {
                        console.warn(`decodeAudioData failed for ${url}, using HTML5 Audio fallback:`, decodeErr);
                        createFallbackPool(id, url);
                    }
                );
            } else {
                createFallbackPool(id, url);
            }
        } catch (err) {
            console.warn(`Failed to fetch sound ${url}, using fallback:`, err);
            createFallbackPool(id, url);
        }
    };

    // Load weapon shot sounds
    for (const [key, path] of Object.entries(AUDIO_PATHS.weapons)) {
        loadSound(`weapon_${key}`, path);
    }

    // Load explosion sound
    loadSound('explosion', AUDIO_PATHS.explosion);
}

/**
 * Fallback pool for HTML5 Audio playback if Web Audio decoding is unavailable
 */
function createFallbackPool(id, url) {
    const pool = [];
    for (let i = 0; i < 4; i++) {
        const audio = new Audio(url);
        audio.preload = 'auto';
        pool.push(audio);
    }
    fallbackAudioPools[id] = { pool, index: 0 };
}

function playFallback(id, volume = 1.0) {
    const entry = fallbackAudioPools[id];
    if (!entry) return;
    const audio = entry.pool[entry.index];
    entry.index = (entry.index + 1) % entry.pool.length;
    audio.volume = Math.min(1.0, Math.max(0.0, volume));
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

/**
 * Plays a weapon shot sound effect with subtle pitch variance for realistic feedback
 * 
 * @param {string} weaponId ('pistol' | 'smg' | 'shotgun' | 'railgun' | 'missile')
 */
export function playWeaponSound(weaponId) {
    resumeAudio();

    const bufferKey = `weapon_${weaponId}`;
    const buffer = soundBuffers[bufferKey];

    if (buffer && audioCtx) {
        try {
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;

            // Slight pitch variance (±4%) to avoid robotic repetition on rapid fire
            const pitchVariance = (Math.random() - 0.5) * 0.08;
            source.playbackRate.value = 1.0 + pitchVariance;

            // Weapon-specific volume tuning
            let weaponGainValue = 1.0;
            if (weaponId === 'smg') weaponGainValue = 0.95;
            if (weaponId === 'shotgun') weaponGainValue = 1.1;
            if (weaponId === 'railgun') weaponGainValue = 1.15;
            if (weaponId === 'missile') weaponGainValue = 1.25;

            const gainNode = audioCtx.createGain();
            gainNode.gain.value = weaponGainValue;

            source.connect(gainNode);
            gainNode.connect(sfxGainNode);

            source.start(0);
        } catch (e) {
            console.warn('Web Audio playback error, using fallback:', e);
            playFallback(bufferKey, 0.8);
        }
    } else {
        playFallback(bufferKey, 0.8);
    }
}

/**
 * Plays a deep, punchy explosion sound for missile detonations and demolition craters
 */
export function playExplosionSound() {
    resumeAudio();

    const buffer = soundBuffers['explosion'];

    if (buffer && audioCtx) {
        try {
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;

            // Pitch variance between 0.94 and 1.06
            source.playbackRate.value = 0.94 + Math.random() * 0.12;

            const gainNode = audioCtx.createGain();
            gainNode.gain.value = 1.35; // Loud, resonant blast

            source.connect(gainNode);
            gainNode.connect(sfxGainNode);

            source.start(0);
        } catch (e) {
            playFallback('explosion', 1.0);
        }
    } else {
        playFallback('explosion', 1.0);
    }
}

/**
 * Sets menu mode to control background music ducking:
 * - When menu is open (isMenuOpen === true): BG sound increases to VOLUMES.bgmMenu
 * - When playing in-game (isMenuOpen === false): BG sound decreases to VOLUMES.bgmGame
 * 
 * @param {boolean} open True if the menu is open/toggled, false if actively playing
 */
export function setMenuMode(open) {
    isMenuOpen = open;
    targetBgmVolume = isMenuOpen ? VOLUMES.bgmMenu : VOLUMES.bgmGame;

    if (userHasInteracted && bgAudio && bgAudio.paused) {
        bgAudio.play().catch(() => {});
    }
}

/**
 * Updates weather audio:
 * - When weather is 'storm', smoothly fades in the raining sound
 * - When weather is 'clear' or 'fog', smoothly fades out the raining sound
 * 
 * @param {'clear' | 'storm' | 'fog'} weatherType 
 */
export function setWeatherAudio(weatherType) {
    isRaining = (weatherType === 'storm');
    targetRainVolume = isRaining ? VOLUMES.rain : 0.0;

    if (isRaining && rainAudio && rainAudio.paused) {
        resumeAudio();
        rainAudio.play().catch(() => {});
    }
}

/**
 * Frame update for buttery-smooth volume transitions (called in main animation loop)
 * 
 * @param {number} deltaTime Frame delta in seconds (typically ~0.016 for 60 FPS)
 */
export function updateAudio(deltaTime = 0.016) {
    // 1. Smoothly interpolate Background Music Volume
    if (bgAudio) {
        const lerpFactor = 1.0 - Math.exp(-deltaTime * 4.5); // Smooth ~0.5s transition
        currentBgmVolume += (targetBgmVolume - currentBgmVolume) * lerpFactor;

        // Apply clamped volume
        const safeBgmVol = Math.max(0.0, Math.min(1.0, currentBgmVolume));
        if (Math.abs(bgAudio.volume - safeBgmVol) > 0.001) {
            bgAudio.volume = safeBgmVol;
        }

        // Keep playing if user has interacted
        if (userHasInteracted && bgAudio.paused && targetBgmVolume > 0) {
            bgAudio.play().catch(() => {});
        }
    }

    // 2. Smoothly interpolate Rain Sound Volume
    if (rainAudio) {
        const lerpFactor = 1.0 - Math.exp(-deltaTime * 4.0);
        currentRainVolume += (targetRainVolume - currentRainVolume) * lerpFactor;

        const safeRainVol = Math.max(0.0, Math.min(1.0, currentRainVolume));
        if (Math.abs(rainAudio.volume - safeRainVol) > 0.001) {
            rainAudio.volume = safeRainVol;
        }

        // Pause rain audio when fully faded out to conserve CPU / battery
        if (!isRaining && currentRainVolume < 0.005 && !rainAudio.paused) {
            rainAudio.pause();
            rainAudio.currentTime = 0;
            currentRainVolume = 0;
            rainAudio.volume = 0;
        } else if (isRaining && userHasInteracted && rainAudio.paused) {
            rainAudio.play().catch(() => {});
        }
    }
}
