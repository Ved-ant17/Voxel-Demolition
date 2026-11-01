import * as CANNON from 'cannon-es';

/**
 * Phase 5: Physics System Initialization
 * Sets up Cannon-es physics world with standard downward gravity,
 * contact materials for realistic debris bouncing/friction, and a ground collider.
 */
export function initPhysics() {
    const world = new CANNON.World();

    // Standard downward Earth gravity (Normal physics)
    world.gravity.set(0, -9.82, 0);

    // SAPBroadphase for high performance collision culling with multiple debris bodies
    world.broadphase = new CANNON.SAPBroadphase(world);

    // Iteration solver setup
    world.solver.iterations = 8;
    world.defaultContactMaterial.friction = 0.4;
    world.defaultContactMaterial.restitution = 0.2;

    // Contact material for debris chunks colliding with each other and the ground
    const debrisMaterial = new CANNON.Material('debris');
    const groundMaterial = new CANNON.Material('ground');

    const debrisGroundContact = new CANNON.ContactMaterial(debrisMaterial, groundMaterial, {
        friction: 0.5,
        restitution: 0.25
    });
    world.addContactMaterial(debrisGroundContact);

    const debrisDebrisContact = new CANNON.ContactMaterial(debrisMaterial, debrisMaterial, {
        friction: 0.3,
        restitution: 0.3
    });
    world.addContactMaterial(debrisDebrisContact);

    // Cannon-es Static Ground Plane Body (aligned with Three.js ground plane at y = 0)
    const groundBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
        material: groundMaterial
    });
    // In Cannon-es, Plane points along +Z by default. Rotate -90 deg around X to point along +Y (up)
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.position.set(0, 0, 0);
    world.addBody(groundBody);

    return { world, debrisMaterial, groundMaterial };
}

/**
 * Advance physics simulation by fixed time step
 * 
 * @param {CANNON.World} world 
 * @param {number} deltaTime 
 */
export function updatePhysics(world, deltaTime) {
    if (!world) return;
    // Step forward: fixed 1/60s step, clamped deltaTime to avoid instability on frame drops
    world.step(1 / 60, Math.min(deltaTime, 0.1), 3);
}
