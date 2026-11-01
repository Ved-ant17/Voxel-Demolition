<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voxel Demolition - Phase 1</title>
    <style>
        /* Remove default margins and hide scrollbars for a full-screen experience */
        body {
            margin: 0;
            overflow: hidden;
            background-color: #000; /* Fallback background */
        }
        #gameCanvas {
            display: block;
            width: 100vw;
            height: 100vh;
        }
    </style>
    
    <!-- Import Maps allow us to use ES6 module imports cleanly -->
    <script type="importmap">
        {
            "imports": {
                "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
                "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
                "cannon-es": "https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js"
            }
        }
    </script>
</head>
<body>
    <canvas id="gameCanvas"></canvas>

    <!-- Main JavaScript Logic -->
    <script type="module">
        import * as THREE from 'three';
        import * as CANNON from 'cannon-es';

        // --- 1. CORE SETUP ---
        const canvas = document.getElementById('gameCanvas');
        
        // Initialize the Three.js Renderer
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimize for high-DPI displays

        // Initialize the Scene
        const scene = new THREE.Scene();
        // Temporary background color to verify rendering (will be replaced by dark fog in Phase 2)
        scene.background = new THREE.Color('#11111a'); 

        // Initialize the Camera
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 2, 5); // Pull camera back slightly so we can see the center

        // Initialize the Physics World (Cannon-es)
        const world = new CANNON.World();
        // Setting Y to a positive value for anti-gravity
        world.gravity.set(0, 2, 0); 

        // --- 2. TEMPORARY PLACEHOLDER OBJECT ---
        // Adding a spinning cube just to visually confirm the render loop is working perfectly.
        // This will be removed when we build the city in Phase 3.
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
        const testCube = new THREE.Mesh(geometry, material);
        scene.add(testCube);

        // --- 3. RESIZE HANDLER ---
        window.addEventListener('resize', () => {
            // Update camera aspect ratio
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            
            // Update renderer size
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // --- 4. MAIN ANIMATION LOOP ---
        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);

            // Calculate time passed since last frame (deltaTime)
            const deltaTime = clock.getDelta();

            // Step the physics world forward
            // (1/60 is the fixed time step, deltaTime is actual time passed)
            world.step(1 / 60, deltaTime, 3);

            // Rotate our test cube so we know the animation loop is running
            testCube.rotation.x += 1 * deltaTime;
            testCube.rotation.y += 1 * deltaTime;

            // Update controls and weapons here in future phases...
            // updateControls(camera, deltaTime);
            // updateWeapons(deltaTime, scene, cityMesh);

            // Render the scene
            renderer.render(scene, camera);
        }

        // Start the loop
        animate();
        
        console.log("Phase 1 initialized: WebGL Renderer, Scene, Camera, and Main Loop are running.");
    </script>
</body>
</html>