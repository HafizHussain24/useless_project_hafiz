import * as THREE from './three.module.js';

export class Bike {
    constructor(scene) {
        this.scene = scene;
        
        // State
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.speed = 10;
        this.maxSpeed = 80; // units per second (will show as 160 km/h)
        this.minSpeed = 10; // 20 km/h minimum speed
        this.acceleration = 15;
        this.braking = 60; // Increased braking power
        this.steering = 25; // lateral movement speed
        
        this.roadLimit = 8; // lateral limit from center

        this.hasHelmet = false;
        this.hasPassenger = false;
        
        this.verticalVelocity = 0;
        this.isCrashed = false;
        
        // Bounding box for collisions
        this.boundingBox = new THREE.Box3();
        
        this.buildModel();
    }

    buildModel() {
        this.mesh = new THREE.Group();

        // ── Materials ────────────────────────────────────────────────────────────
        const bikeMat    = new THREE.MeshLambertMaterial({ color: 0x1a1a2e }); // dark navy
        const chromeMat  = new THREE.MeshLambertMaterial({ color: 0xc0c0c0 });
        const blackMat   = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const redMat     = new THREE.MeshLambertMaterial({ color: 0xcc1100 });
        const headlitMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
        const glassMat   = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.65 });
        const skinMat    = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
        const shirtMat   = new THREE.MeshLambertMaterial({ color: 0x2255aa });
        const pantMat    = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
        const helmetMat  = new THREE.MeshLambertMaterial({ color: 0x111111 }); // Black helmet
        const helmetStripeMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // White stripe
        const pShirtMat  = new THREE.MeshLambertMaterial({ color: 0xff00ff });
        this.p3ShirtMat = new THREE.MeshLambertMaterial({ color: 0x22aa88 });

        // ── MOTORCYCLE ───────────────────────────────────────────────────────────

        // Frame spine
        const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 2.2), chromeMat);
        spine.position.set(0, 0.85, 0);
        this.mesh.add(spine);

        // Engine / crankcase
        const engine = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.65), blackMat);
        engine.position.set(0, 0.52, 0.1);
        this.mesh.add(engine);
        // Cylinder head
        const cylHead = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 8), blackMat);
        cylHead.position.set(0, 0.88, 0.1);
        this.mesh.add(cylHead);

        // Fuel tank
        const tank = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.82), bikeMat);
        tank.position.set(0, 1.04, -0.32);
        this.mesh.add(tank);

        // Seat
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 1.0), blackMat);
        seat.position.set(0, 1.02, 0.45);
        this.mesh.add(seat);

        // Front fairing
        const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.1), bikeMat);
        fairing.position.set(0, 1.06, -1.04);
        this.mesh.add(fairing);

        // Headlight
        const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), headlitMat);
        headlight.scale.z = 0.55;
        headlight.position.set(0, 0.98, -1.18);
        this.mesh.add(headlight);

        // Front fork (two thin cylinders angled forward)
        for (const sx of [-0.12, 0.12]) {
            const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.82, 7), chromeMat);
            fork.rotation.x = 0.3;
            fork.position.set(sx, 0.64, -0.94);
            this.mesh.add(fork);
        }

        // Handlebars
        const hbar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.82, 7), chromeMat);
        hbar.rotation.z = Math.PI / 2;
        hbar.position.set(0, 1.12, -0.84);
        this.mesh.add(hbar);
        for (const sx of [-0.43, 0.43]) {
            const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.09, 7), blackMat);
            grip.rotation.z = Math.PI / 2;
            grip.position.set(sx, 1.12, -0.84);
            this.mesh.add(grip);
        }



        // Tail light
        const taillight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.07), redMat);
        taillight.position.set(0, 0.92, 1.22);
        this.mesh.add(taillight);

        // Rear mudguard
        const mudguard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.5), bikeMat);
        mudguard.position.set(0, 0.84, 1.08);
        this.mesh.add(mudguard);

        // Footpegs
        for (const sx of [-0.36, 0.36]) {
            const peg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.08), chromeMat);
            peg.position.set(sx, 0.44, 0.22);
            this.mesh.add(peg);
        }

        // Wheels
        const tyreGeom = new THREE.CylinderGeometry(0.46, 0.46, 0.14, 16);
        tyreGeom.rotateZ(Math.PI / 2);
        const rimGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 12);
        rimGeom.rotateZ(Math.PI / 2);
        const tyreMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const rimMat  = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });

        for (const [wz] of [[-1.06], [1.06]]) {
            const tyre = new THREE.Mesh(tyreGeom, tyreMat);
            tyre.position.set(0, 0.46, wz);
            this.mesh.add(tyre);
            const rim = new THREE.Mesh(rimGeom, rimMat);
            rim.position.set(0, 0.46, wz);
            this.mesh.add(rim);
        }

        // ── RIDER 1 ───────────────────────────────────────────────────────────────
        this.rider = new THREE.Group();

        // Legs (thighs flat on seat)
        for (const sx of [-0.16, 0.16]) {
            const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.48), pantMat);
            thigh.position.set(sx, 0.82, 0.06);
            this.rider.add(thigh);
            const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.36, 7), pantMat);
            shin.position.set(sx, 0.52, 0.24);
            this.rider.add(shin);
        }

        // Torso (leaning forward)
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.68, 0.35), shirtMat);
        torso.position.set(0, 1.5, 0.06);
        torso.rotation.x = -0.38;
        this.rider.add(torso);

        // Arms reaching to handlebar
        for (const sx of [-0.28, 0.28]) {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.48, 7), shirtMat);
            arm.rotation.z = sx > 0 ? -0.85 : 0.85;
            arm.rotation.x = 0.55;
            arm.position.set(sx * 1.05, 1.3, -0.34);
            this.rider.add(arm);
        }

        // Head (sphere)
        const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 9, 8), skinMat);
        rHead.position.set(0, 2.06, -0.14);
        this.rider.add(rHead);

        // Helmet
        this.helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.265, 9, 8), helmetMat);
        this.helmetMesh.position.copy(rHead.position);
        this.helmetMesh.visible = false;
        
        // White stripe
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.54, 0.54), helmetStripeMat);
        this.helmetMesh.add(stripe);
        
        this.rider.add(this.helmetMesh);
        // Visor strip
        this.helmetVisor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.055), glassMat);
        this.helmetVisor.position.set(0, 2.04, -0.35);
        this.helmetVisor.visible = false;
        this.rider.add(this.helmetVisor);

        this.mesh.add(this.rider);

        // ── PASSENGER 2 (pillion, always visible) ─────────────────────────────────
        this.passenger2 = new THREE.Group();

        for (const sx of [-0.15, 0.15]) {
            const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.44), pantMat);
            leg2.position.set(sx, 0.82, 0.72);
            this.passenger2.add(leg2);
        }
        const pTorso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.33), pShirtMat);
        pTorso.position.set(0, 1.48, 0.72);
        this.passenger2.add(pTorso);
        const pHead = new THREE.Mesh(new THREE.SphereGeometry(0.21, 9, 8), skinMat);
        pHead.position.set(0, 2.0, 0.63);
        this.passenger2.add(pHead);
        this.helmetMesh2 = new THREE.Mesh(new THREE.SphereGeometry(0.252, 9, 8), helmetMat);
        this.helmetMesh2.position.copy(pHead.position);
        this.helmetMesh2.visible = false;
        
        // White stripe
        const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.51, 0.51), helmetStripeMat);
        this.helmetMesh2.add(stripe2);
        
        this.passenger2.add(this.helmetMesh2);

        this.mesh.add(this.passenger2);

        // ── PASSENGER 3 (triples, hidden by default) ──────────────────────────────
        this.passenger3 = new THREE.Group();

        const p3Torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.32), this.p3ShirtMat);
        p3Torso.position.set(0, 1.46, 1.28);
        this.passenger3.add(p3Torso);
        const p3Head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 8), skinMat);
        p3Head.position.set(0, 1.98, 1.2);
        this.passenger3.add(p3Head);

        this.passenger3.visible = false;
        this.mesh.add(this.passenger3);

        this.scene.add(this.mesh);
    }


    update(dt, input) {
        if (this.isCrashed) return;

        // Apply handling penalty if passenger is present
        const currentMaxSpeed = this.hasPassenger ? this.maxSpeed * 0.8 : this.maxSpeed;
        const currentSteering = this.hasPassenger ? this.steering * 0.7 : this.steering;

        // Acceleration
        if (input.forward) {
            this.speed += this.acceleration * dt;
        } else if (input.backward) {
            this.speed -= this.braking * dt;
        } else {
            // Natural drag
            this.speed -= 2 * dt;
        }

        // Clamp speed
        this.speed = Math.max(this.minSpeed, Math.min(this.speed, currentMaxSpeed));

        // Steering
        if (this.speed > 0) { // Only steer if moving
            if (input.left) {
                this.position.x -= currentSteering * dt;
                this.mesh.rotation.z = Math.min(this.mesh.rotation.z + dt * 2, Math.PI / 8);
            } else if (input.right) {
                this.position.x += currentSteering * dt;
                this.mesh.rotation.z = Math.max(this.mesh.rotation.z - dt * 2, -Math.PI / 8);
            } else {
                // Return to upright
                this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt * 5);
            }
        }
        
        if (this.verticalVelocity !== 0 || this.position.y > 0) {
            this.position.y += this.verticalVelocity * dt;
            this.verticalVelocity -= 40 * dt; // Gravity
            if (this.position.y <= 0) {
                this.position.y = 0;
                this.verticalVelocity = 0;
            }
        }

        // Clamp lateral position
        this.position.x = Math.max(-this.roadLimit, Math.min(this.position.x, this.roadLimit));

        // Move forward (negative Z is forward in Three.js default)
        this.position.z -= this.speed * dt;

        // Update mesh position
        this.mesh.position.copy(this.position);

        // Update Bounding Box
        this.boundingBox.setFromObject(this.mesh);
    }

    setHelmet(state) {
        this.hasHelmet = state;
        this.helmetMesh.visible = state;
        this.helmetMesh2.visible = state;
        if (this.helmetVisor) this.helmetVisor.visible = state;
    }

    setPassenger(state, colorHex = null) {
        this.hasPassenger = state;
        if (state) {
            this.mesh.add(this.passenger3);
            this.passenger3.position.set(0, 0, 0);
            this.passenger3.rotation.set(0, 0, 0);
            this.passenger3.visible = true;
            if (colorHex !== null) {
                this.p3ShirtMat.color.setHex(colorHex);
            }
        } else {
            this.passenger3.visible = false;
        }
    }

    crash() {
        this.isCrashed = true;
        this.speed = 0;
        // Simple crash animation: topple over
        this.mesh.rotation.z = Math.PI / 2;
    }

    reset() {
        this.isCrashed = false;
        this.speed = this.minSpeed;
        this.verticalVelocity = 0;
        this.position.set(0, 0, 0);
        this.mesh.position.set(0, 0, 0);
        this.mesh.rotation.set(0, 0, 0);
        this.setHelmet(false);
        this.setPassenger(false);
        
        // Reset main passenger (in case they flew off)
        this.mesh.add(this.passenger2);
        this.passenger2.position.set(0, 0, 0);
        this.passenger2.rotation.set(0, 0, 0);
        this.passenger2.visible = true;
    }
}
