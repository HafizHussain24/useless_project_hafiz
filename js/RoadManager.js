import * as THREE from './three.module.js';

export class RoadManager {
    constructor(scene, hazardSpawner) {
        this.scene = scene;
        this.hazardSpawner = hazardSpawner;
        
        this.segments = [];
        this.segmentLength = 100;
        this.renderDistance = 300; // Generate 300 units ahead
        
        this.phases = [
            'Amenity Centre',
            'Sahara Hostel',
            'SOE',
            'Pipeline Road'
        ];
        
        this.currentPhaseIndex = 0;
        this.currentPhaseDistance = 0;
        this.phaseTargetDistance = 300; // Each phase lasts for roughly 300 units initially
        
        this.materials = {
            road: new THREE.MeshLambertMaterial({ color: 0x333333 }),
            line: new THREE.MeshLambertMaterial({ color: 0xffffff }),
            grass: new THREE.MeshLambertMaterial({ color: 0x2d5a27 })
        };

        // Cache geometries to prevent memory leaks (lags/freezes)
        this.geometries = {
            roadNormal: (() => {
                const g = new THREE.PlaneGeometry(16, this.segmentLength);
                g.rotateX(-Math.PI / 2);
                return g;
            })(),
            roadNarrow: (() => {
                const g = new THREE.PlaneGeometry(12, this.segmentLength);
                g.rotateX(-Math.PI / 2);
                return g;
            })(),
            roadWide: (() => {
                const g = new THREE.PlaneGeometry(20, this.segmentLength);
                g.rotateX(-Math.PI / 2);
                return g;
            })(),
            line: (() => {
                const g = new THREE.PlaneGeometry(0.5, 4);
                g.rotateX(-Math.PI / 2);
                return g;
            })(),
            grass: (() => {
                const g = new THREE.PlaneGeometry(50, this.segmentLength);
                g.rotateX(-Math.PI / 2);
                return g;
            })()
        };

        // Pool to prevent GC freezes
        this.segmentPool = {
            'Amenity Centre': [],
            'Sahara Hostel': [],
            'SOE': [],
            'Pipeline Road': []
        };

        // Pre-warm pools to prevent mid-game stutters when phases change
        for (let p = 0; p < this.phases.length; p++) {
            this.currentPhaseIndex = p;
            for (let i = 0; i < 6; i++) {
                this.createSegment(0);
            }
        }
        
        this.currentPhaseIndex = 0;
        this.reset();
    }

    getCurrentPhase() {
        return this.phases[this.currentPhaseIndex];
    }

    getPlayerPhase(playerZ) {
        for (const seg of this.segments) {
            if (playerZ <= seg.z + this.segmentLength && playerZ >= seg.z) {
                return seg.phase;
            }
        }
        return this.phases[this.currentPhaseIndex];
    }

    generateAhead(playerZ) {
        // Find the furthest segment Z
        let furthestZ = playerZ + this.segmentLength * 2; // Generate behind player to prevent void
        if (this.segments.length > 0) {
            furthestZ = this.segments[this.segments.length - 1].z;
        }

        while (furthestZ > playerZ - this.renderDistance) {
            this.createSegment(furthestZ - this.segmentLength);
            furthestZ -= this.segmentLength;
        }
    }

    createSegment(z) {
        const phase = this.getCurrentPhase();
        let group;

        if (this.segmentPool[phase].length > 0) {
            group = this.segmentPool[phase].pop();
            group.position.set(0, 0, z + this.segmentLength/2);
            group.visible = true;
        } else {
            group = new THREE.Group();
            
            // Determine road width based on phase
            let width = 16;
            let roadGeom = this.geometries.roadNormal;

            if (phase === 'Pipeline Road') {
                width = 12;
                roadGeom = this.geometries.roadNarrow;
            }

            // Road Surface
            const road = new THREE.Mesh(roadGeom, this.materials.road);
            road.receiveShadow = true;
            group.add(road);

            // Center line (dashed)
            if (phase !== 'Pipeline Road') {
                for (let i = 0; i < this.segmentLength; i += 4) {
                    if (i % 8 === 0) {
                        const line = new THREE.Mesh(this.geometries.line, this.materials.line);
                        line.position.set(0, 0.05, i - this.segmentLength/2 + 2);
                        line.receiveShadow = true;
                        group.add(line);
                    }
                }
            }

            // Side grass
            const grassWidth = 50;
            
            const leftGrass = new THREE.Mesh(this.geometries.grass, this.materials.grass);
            leftGrass.position.set(-width/2 - grassWidth/2, -0.1, 0);
            leftGrass.receiveShadow = true;
            group.add(leftGrass);

            const rightGrass = new THREE.Mesh(this.geometries.grass, this.materials.grass);
            rightGrass.position.set(width/2 + grassWidth/2, -0.1, 0);
            rightGrass.receiveShadow = true;
            group.add(rightGrass);

            group.position.set(0, 0, z + this.segmentLength/2);
            group.userData = { phase: phase }; // Store phase for pooling
            this.scene.add(group);
        }
        
        this.segments.push({ mesh: group, z: z, phase: phase });

        // Tell hazard spawner to populate this segment
        this.hazardSpawner.spawnHazardsForSegment(z + this.segmentLength, this.segmentLength, phase);
    }

    update(playerZ) {
        this.generateAhead(playerZ);

        // Cleanup segments behind player
        for (let i = this.segments.length - 1; i >= 0; i--) {
            const seg = this.segments[i];
            if (seg.z > playerZ + this.segmentLength) {
                seg.mesh.visible = false;
                
                // Return to pool
                this.segmentPool[seg.phase].push(seg.mesh);
                
                this.segments.splice(i, 1);
                
                // Track distance to cycle phases
                this.currentPhaseDistance += this.segmentLength;
                if (this.currentPhaseDistance >= this.phaseTargetDistance) {
                    this.currentPhaseDistance = 0;
                    this.currentPhaseIndex = (this.currentPhaseIndex + 1) % this.phases.length;
                    // Randomize next phase length between 200 and 500 units
                    this.phaseTargetDistance = 200 + Math.random() * 300; 
                }
            }
        }
    }

    reset() {
        for (const seg of this.segments) {
            seg.mesh.visible = false;
            this.segmentPool[seg.phase].push(seg.mesh);
        }
        this.segments = [];
        this.currentPhaseIndex = 0;
        this.currentPhaseDistance = 0;
        this.phaseTargetDistance = 300;
        this.generateAhead(0);
    }
}
