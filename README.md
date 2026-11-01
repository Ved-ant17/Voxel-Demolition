# Voxel Demolition

A real-time 3D voxel skyscraper destruction simulator built with **Three.js** and **Cannon-es**.

Fly around a dark, neon-lit nighttime cityscape in a first-person perspective, fire rockets at buildings, and watch voxel structures procedurally shatter into dynamic physical debris with persistent 3D craters.

---

## Features

- **Procedural Voxel City:** Over 20,000+ voxels batched in a single `THREE.InstancedMesh` draw call for smooth 60 FPS performance.
- **First-Person Flight:** 6-DOF flying camera with mouse pointer lock.
- **Rocket Weaponry:** Raycast collision detection with dynamic lighting and visual impact flashes.
- **Voxel Demolition:** Procedurally carves out spherical 3D craters on impact.
- **Realistic Physics:** Individual debris chunks blast outward with explosive impulses and fall realistically to the ground under standard gravity.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone <YOUR_REPO_URL>
   cd web_gl-project
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

---

## Controls

- **Click to Play / Resume:** Lock cursor and engage first-person camera
- **WASD:** Fly Forward / Left / Backward / Right
- **Space / Shift:** Ascend / Descend
- **Mouse:** Aim and look around
- **Left-Click:** Fire rockets
- **ESC:** Pause and release cursor
