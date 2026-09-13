import * as THREE from './three.module.js';

export class HazardSpawner {
    constructor(scene) {
        this.scene = scene;
        this.hazards = []; // Active hazards and interactables
        
        // Basic materials for procedural generation
        this.materials = {
            speedbump: new THREE.MeshLambertMaterial({ color: 0xffff00 }),
            pothole: new THREE.MeshLambertMaterial({ color: 0x111111 }),
            cow: new THREE.MeshLambertMaterial({ color: 0xffffff }),
            cowSpots: new THREE.MeshLambertMaterial({ color: 0x000000 }),
            dog: new THREE.MeshLambertMaterial({ color: 0x8b4513 }),
            jeep: new THREE.MeshLambertMaterial({ color: 0xffffff }),
            jeepStripe: new THREE.MeshLambertMaterial({ color: 0x0000ff }), // MVD colors
            siren: new THREE.MeshLambertMaterial({ color: 0xff0000 }),
            chayakada: new THREE.MeshLambertMaterial({ color: 0x8b4513 }), // wood brown
            roof: new THREE.MeshLambertMaterial({ color: 0x005500 }), // green sheet
            passenger: new THREE.MeshLambertMaterial({ color: 0xff00ff }), // bright shirt
            signPost: new THREE.MeshLambertMaterial({ color: 0x777777 }),
            treeTrunk: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
            treeLeaves: new THREE.MeshLambertMaterial({ color: 0x228B22 }),
            building: new THREE.MeshLambertMaterial({ color: 0x555555 }),
            window: new THREE.MeshBasicMaterial({ color: 0xffffaa }),
            grassBlade: new THREE.MeshLambertMaterial({ color: 0x4cc958 })
        };

        // Create Canvas Textures for Speed Limit signs
        this.materials.signBoards = {};
        [40, 50, 60].forEach(speed => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 15;
            ctx.beginPath();
            ctx.arc(64, 64, 50, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'black';
            ctx.font = 'bold 50px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(speed.toString(), 64, 64);
            
            const signTexture = new THREE.CanvasTexture(canvas);
            this.materials.signBoards[speed] = new THREE.MeshBasicMaterial({ map: signTexture });
        });

        // Create Canvas Texture for 'E' bubble
        const eCanvas = document.createElement('canvas');
        eCanvas.width = 128;
        eCanvas.height = 128;
        const eCtx = eCanvas.getContext('2d');
        eCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        eCtx.beginPath();
        eCtx.arc(64, 64, 50, 0, Math.PI * 2);
        eCtx.fill();
        eCtx.fillStyle = 'black';
        eCtx.font = 'bold 60px Arial';
        eCtx.textAlign = 'center';
        eCtx.textBaseline = 'middle';
        eCtx.fillText('E', 64, 64);
        this.materials.eSprite = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(eCanvas), depthTest: false });

        // Cache geometries to prevent memory leaks (lag/freezes)
        this.geometries = {
            speedbump: (() => {
                const g = new THREE.CylinderGeometry(0.3, 0.3, 16, 8);
                g.rotateZ(Math.PI / 2);
                return g;
            })(),
            pothole: (() => {
                const g = new THREE.CircleGeometry(1.5, 16);
                g.rotateX(-Math.PI / 2);
                return g;
            })(),
            cowBody: new THREE.BoxGeometry(2, 1.5, 3),
            cowHead: new THREE.BoxGeometry(1, 1, 1.5),
            dogBody: new THREE.BoxGeometry(0.6, 0.8, 1.5),
            dogHead: new THREE.BoxGeometry(0.5, 0.5, 0.6),
            jeepBase: new THREE.BoxGeometry(3, 1.5, 5),
            jeepTop: new THREE.BoxGeometry(3, 1, 2.5),
            siren: new THREE.CylinderGeometry(0.2, 0.2, 0.5),
            chayakadaBase: new THREE.BoxGeometry(4, 3, 3),
            chayakadaRoof: new THREE.BoxGeometry(4.5, 0.2, 4.5),
            passTorso: new THREE.BoxGeometry(0.6, 1.0, 0.4),
            passHead: new THREE.BoxGeometry(0.4, 0.4, 0.4),
            signPost: new THREE.CylinderGeometry(0.1, 0.1, 3),
            signBoard: new THREE.CircleGeometry(0.8, 16),
            treeTrunk: new THREE.CylinderGeometry(0.5, 0.5, 5, 8),
            treeLeaves: new THREE.ConeGeometry(3, 6, 8),
            building: new THREE.BoxGeometry(8, 15, 8),
            window: new THREE.BoxGeometry(1.5, 2, 0.2),
            grassBlade: (() => {
                const g = new THREE.ConeGeometry(0.3, 1.5, 3);
                g.translate(0, 0.75, 0); // Anchor at base
                return g;
            })()
        };

        this.buildMasterModels();

        // Object Pool to prevent GC freezes
        this.pool = {
            speedbump: [],
            pothole: [],
            cow: [],
            dog: [],
            jeep: [],
            chayakada: [],
            passenger: [],
            scenery: [],
            tree: [],
            building: [],
            grass: []
        };
        
        this.tempVec = new THREE.Vector3();

        // Pre-warm pools (kept small — models are complex, pool grows lazily)
        const prewarmCounts = {
            speedbump: 3,
            pothole: 8,
            cow: 2,
            dog: 2,
            jeep: 2,
            scenery: 2,
            tree: 6,
            building: 3
        };
        for (const [type, count] of Object.entries(prewarmCounts)) {
            for (let i = 0; i < count; i++) {
                if (type === 'scenery') {
                    this.spawnChayakada(0);
                } else if (type === 'jeep') {
                    this.spawnJeep(0);
                } else {
                    this.spawnHazard(type, 0, 0);
                }
            }
        }
        this.reset();
    }

    spawnHazardsForSegment(segmentZ, length, phaseType) {
        // Based on phase, determine density and types
        let densityMultiplier = 1;
        let allowedHazards = ['pothole'];
        
        switch (phaseType) {
            case 'Amenity Centre':
                densityMultiplier = 1.2;
                allowedHazards = ['pothole', 'pothole', 'pothole', 'pothole', 'dog', 'cow']; 
                break;
            case 'Sahara Hostel':
                densityMultiplier = 1.8;
                allowedHazards = ['pothole', 'pothole', 'pothole', 'speedbump', 'cow', 'dog'];
                break;
            case 'SOE':
                densityMultiplier = 2.2;
                allowedHazards = ['pothole', 'pothole', 'pothole', 'speedbump', 'cow', 'dog'];
                break;
            case 'Pipeline Road':
                densityMultiplier = 3.0;
                allowedHazards = ['speedbump', 'speedbump', 'speedbump', 'speedbump', 'pothole', 'dog'];
                break;
        }

        const numHazards = Math.floor(Math.random() * (length / 30)) * densityMultiplier;
        
        for (let i = 0; i < numHazards; i++) {
            const z = segmentZ - (Math.random() * length);
            const x = (Math.random() - 0.5) * 16; // Random lane position (-8 to 8)
            
            const type = allowedHazards[Math.floor(Math.random() * allowedHazards.length)];
            this.spawnHazard(type, x, z);
        }

        // Spawn Scenery (Trees and Buildings)
        const numScenery = Math.floor(Math.random() * 4) + 2;
        for (let i = 0; i < numScenery; i++) {
            const z = segmentZ - (Math.random() * length);
            const side = Math.random() > 0.5 ? 1 : -1;
            const x = side * (12 + Math.random() * 10); // Off the road (12 to 22 units away)
            const isBuilding = Math.random() > 0.7; // 30% chance for building, 70% for tree
            this.spawnHazard(isBuilding ? 'building' : 'tree', x, z);
        }

        // Spawn Grass Tufts (Amenity Centre only)
        if (phaseType === 'Amenity Centre') {
            const numGrass = 15 + Math.floor(Math.random() * 10);
            for (let i = 0; i < numGrass; i++) {
                const z = segmentZ - (Math.random() * length);
                const side = Math.random() > 0.5 ? 1 : -1;
                const x = side * (10 + Math.random() * 15); // Spread them off-road
                this.spawnHazard('grass', x, z);
            }
        }

        // 10% chance to spawn an MVD jeep per segment
        if (Math.random() < 0.1) {
            const z = segmentZ - (Math.random() * length);
            this.spawnJeep(z);
        }

        // Chance to spawn Chayakada + Passenger
        if ((phaseType === 'Pipeline Road' || phaseType === 'Amenity Centre') && Math.random() < 0.2) {
            const z = segmentZ - (Math.random() * length);
            this.spawnChayakada(z);
        }
    }

    spawnHazard(type, x, z) {
        let mesh;
        let customData = { type: type };

        if (type === 'speedbump') {
            // Pick a random speed limit
            const speeds = [40, 50, 60];
            const limit = speeds[Math.floor(Math.random() * speeds.length)];
            customData.limit = limit;
            customData.hitPassed = false; // Add reset for hit flag

            if (this.pool[type] && this.pool[type].length > 0) {
                mesh = this.pool[type].pop();
                mesh.position.set(0, 0, z);
                mesh.children[2].material = this.materials.signBoards[limit]; // Update sign
            } else {
                mesh = new THREE.Group();
                const bump = new THREE.Mesh(this.geometries.speedbump, this.materials.speedbump);
                mesh.add(bump);
                
                // Sign Post
                const post = new THREE.Mesh(this.geometries.signPost, this.materials.signPost);
                post.position.set(7.5, 1.5, 0); // Side of the road
                const sign = new THREE.Mesh(this.geometries.signBoard, this.materials.signBoards[limit]);
                sign.position.set(7.5, 3, 0);
                mesh.add(post, sign);
                
                mesh.position.set(0, 0, z);
            }
        } else {
            if (this.pool[type] && this.pool[type].length > 0) {
                mesh = this.pool[type].pop();
                mesh.position.set(type === 'pothole' ? x : x, type === 'pothole' ? 0.01 : 0, z);
                if (type === 'cow' || type === 'dog') {
                    customData.movement = (Math.random() - 0.5) * (type === 'cow' ? 2 : 4); 
                    mesh.rotation.y = customData.movement > 0 ? -Math.PI / 2 : Math.PI / 2;
                } else if (type === 'building') {
                    mesh.rotation.y = x > 0 ? -Math.PI/2 : Math.PI/2;
                } else if (type === 'grass') {
                    mesh.rotation.y = Math.random() * Math.PI * 2;
                }
            } else {
                switch (type) {
                    case 'pothole':
                        mesh = new THREE.Mesh(this.geometries.pothole, this.materials.pothole);
                        mesh.position.set(x, 0.01, z);
                        break;

                    case 'cow':
                        mesh = this.masterModels.cow.clone();
                        mesh.position.set(x, 0, z);
                        customData.movement = (Math.random() - 0.5) * 2;
                        mesh.rotation.y = customData.movement > 0 ? -Math.PI / 2 : Math.PI / 2;
                        break;

                    case 'dog':
                        mesh = this.masterModels.dog.clone();
                        mesh.position.set(x, 0, z);
                        customData.movement = (Math.random() - 0.5) * 4;
                        mesh.rotation.y = customData.movement > 0 ? -Math.PI / 2 : Math.PI / 2;
                        break;
                    case 'tree':
                        mesh = new THREE.Group();
                        const trunk = new THREE.Mesh(this.geometries.treeTrunk, this.materials.treeTrunk);
                        trunk.position.y = 2.5;
                        const leaves = new THREE.Mesh(this.geometries.treeLeaves, this.materials.treeLeaves);
                        leaves.position.y = 6;
                        mesh.add(trunk, leaves);
                        mesh.position.set(x, 0, z);
                        const tScale = 0.8 + Math.random() * 0.6;
                        mesh.scale.set(tScale, tScale, tScale);
                        break;
                    case 'building':
                        const bType = Math.floor(Math.random() * this.masterModels.buildings.length);
                        mesh = this.masterModels.buildings[bType].clone();
                        mesh.position.set(x, 0, z);
                        mesh.rotation.y = x > 0 ? -Math.PI/2 : Math.PI/2;
                        break;
                    case 'grass':
                        mesh = new THREE.Group();
                        const numBlades = 4 + Math.floor(Math.random() * 4);
                        for(let b=0; b<numBlades; b++) {
                            const blade = new THREE.Mesh(this.geometries.grassBlade, this.materials.grassBlade);
                            blade.position.set((Math.random()-0.5)*1.2, 0, (Math.random()-0.5)*1.2);
                            blade.rotation.x = (Math.random()-0.5)*0.6;
                            blade.rotation.z = (Math.random()-0.5)*0.6;
                            blade.rotation.y = Math.random() * Math.PI * 2;
                            const scale = 0.5 + Math.random() * 1.5;
                            blade.scale.set(scale, scale, scale);
                            mesh.add(blade);
                        }
                        mesh.position.set(x, 0, z);
                        mesh.rotation.y = Math.random() * Math.PI * 2;
                        break;
                }
            }
        }

        if (mesh) {
            mesh.visible = true;
            if (!mesh.parent) {
                this.scene.add(mesh);
            }
            mesh.updateMatrixWorld(true); // Ensure bounding box computes at new position
            const boundingBox = new THREE.Box3().setFromObject(type === 'speedbump' ? mesh.children[0] : mesh);
            this.hazards.push({ mesh, type, boundingBox, ...customData });
        }
    }

    spawnJeep(z) {
        let mesh;
        const side = Math.random() > 0.5 ? 1 : -1;

        if (this.pool['jeep'].length > 0) {
            mesh = this.pool['jeep'].pop();
            mesh.position.set(side * 10, 0, z);
        } else {
            mesh = new THREE.Group();

            const whiteMat  = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
            const blueMat   = new THREE.MeshLambertMaterial({ color: 0x0033bb });
            const blackMat  = new THREE.MeshLambertMaterial({ color: 0x111111 });
            const glassMat  = new THREE.MeshBasicMaterial({ color: 0x99ccee, transparent: true, opacity: 0.65 });
            const sirenRed  = new THREE.MeshLambertMaterial({ color: 0xff1100 });
            const chromeMat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
            const hlMat     = new THREE.MeshBasicMaterial({ color: 0xffffcc });

            // Lower body
            const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 4.6), whiteMat);
            body.position.y = 0.9;
            mesh.add(body);

            // Upper cab
            const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.05, 2.4), whiteMat);
            cab.position.set(0, 1.98, 0.55);
            mesh.add(cab);

            // Hood (front)
            const hood = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.42, 1.2), whiteMat);
            hood.position.set(0, 1.0, -2.3);
            mesh.add(hood);

            // Blue stripe on both sides of body
            for (const sx of [-1.07, 1.07]) {
                const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 4.6), blueMat);
                stripe.position.set(sx, 0.98, 0);
                mesh.add(stripe);
            }

            // Windshield
            const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.82, 0.08), glassMat);
            windshield.position.set(0, 1.7, -1.34);
            windshield.rotation.x = -0.22;
            mesh.add(windshield);

            // Side windows
            for (const sx of [-1.02, 1.02]) {
                const win = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.92), glassMat);
                win.position.set(sx, 1.78, 0.62);
                mesh.add(win);
            }

            // Rear window
            const rearWin = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.65, 0.07), glassMat);
            rearWin.position.set(0, 1.72, 1.76);
            mesh.add(rearWin);

            // Roof
            const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 2.4), whiteMat);
            roof.position.set(0, 2.54, 0.55);
            mesh.add(roof);

            // Siren bar
            const sirenBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.32), blueMat);
            sirenBar.position.set(0, 2.72, 0.55);
            mesh.add(sirenBar);
            for (const [sx, mat] of [[-0.28, sirenRed], [0.28, blueMat]]) {
                const dome = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 5), mat);
                dome.scale.y = 0.7;
                dome.position.set(sx, 2.86, 0.55);
                mesh.add(dome);
            }

            // Front bumper
            const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 0.18), chromeMat);
            bumper.position.set(0, 0.5, -2.55);
            mesh.add(bumper);

            // Grille
            const grille = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.38, 0.1), blackMat);
            grille.position.set(0, 0.96, -2.5);
            mesh.add(grille);

            // Headlights
            for (const sx of [-0.68, 0.68]) {
                const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.1), hlMat);
                hl.position.set(sx, 1.04, -2.52);
                mesh.add(hl);
            }

            // 4 Wheels
            const tGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.22, 14);
            tGeom.rotateZ(Math.PI / 2);
            const rGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.24, 10);
            rGeom.rotateZ(Math.PI / 2);
            const tMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
            const rMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

            for (const [wx, wz] of [[-1.14,-1.5],[1.14,-1.5],[-1.14,1.5],[1.14,1.5]]) {
                const tw = new THREE.Mesh(tGeom, tMat);
                tw.position.set(wx, 0.4, wz);
                mesh.add(tw);
                const rw = new THREE.Mesh(rGeom, rMat);
                rw.position.set(wx, 0.4, wz);
                mesh.add(rw);
            }

            // Spare tyre on back
            const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.2, 14), tMat);
            spare.position.set(0, 0.98, 2.45);
            mesh.add(spare);

            mesh.position.set(side * 10, 0, z);
        }
        
        mesh.visible = true;
        if (!mesh.parent) {
            this.scene.add(mesh);
        }
        mesh.updateMatrixWorld(true);
        const boundingBox = new THREE.Box3().setFromObject(mesh);
        
        this.hazards.push({ mesh, type: 'jeep', boundingBox, side, passed: false });
    }

    spawnChayakada(z) {
        let mesh;
        const side = Math.random() > 0.5 ? 1 : -1;

        if (this.pool['scenery'].length > 0) {
            mesh = this.pool['scenery'].pop();
            mesh.position.set(side * 12, 0, z);
            mesh.lookAt(0, 0, z);
        } else {
            mesh = new THREE.Group();
            
            const base = new THREE.Mesh(this.geometries.chayakadaBase, this.materials.chayakada);
            base.position.y = 1.5;
            const roof = new THREE.Mesh(this.geometries.chayakadaRoof, this.materials.roof);
            roof.position.set(0, 3.1, 0.5);
            roof.rotation.x = -Math.PI / 16;
            
            mesh.add(base, roof);
            mesh.position.set(side * 12, 0, z);
            mesh.lookAt(0, 0, z); 
        }
        
        mesh.visible = true;
        if (!mesh.parent) {
            this.scene.add(mesh);
        }
        this.hazards.push({ mesh: mesh, type: 'scenery', boundingBox: new THREE.Box3() }); 

        // Spawn a waiting passenger nearby
        const colors = [0x22aa88, 0xee5522, 0x3366cc, 0xffcc00, 0x9933cc, 0xff5555];
        const randColor = colors[Math.floor(Math.random() * colors.length)];
        
        let passMesh;
        if (this.pool['passenger'].length > 0) {
            passMesh = this.pool['passenger'].pop();
            passMesh.position.set(side * 9, 0, z + 2);
            passMesh.children[0].material.color.setHex(randColor);
        } else {
            passMesh = new THREE.Group();
            const pTorso = new THREE.Mesh(this.geometries.passTorso, new THREE.MeshLambertMaterial({color: randColor}));
            pTorso.position.y = 1;
            const pHead = new THREE.Mesh(this.geometries.passHead, new THREE.MeshLambertMaterial({color: 0xffcc99}));
            pHead.position.y = 1.7;
            passMesh.add(pTorso, pHead);
            
            // Add 'E' sprite above head
            const eSprite = new THREE.Sprite(this.materials.eSprite);
            eSprite.position.set(0, 3, 0);
            eSprite.scale.set(2, 2, 2);
            eSprite.visible = false; // Hidden by default
            passMesh.add(eSprite);

            passMesh.position.set(side * 9, 0, z + 2);
        }
        
        passMesh.visible = true;
        if (!passMesh.parent) {
            this.scene.add(passMesh);
        }
        passMesh.updateMatrixWorld(true);
        const boundingBox = new THREE.Box3().setFromObject(passMesh);

        this.hazards.push({ mesh: passMesh, type: 'passenger', boundingBox, isPickedUp: false, shirtColor: randColor });
    }

    update(dt, playerPos) {
        for (const hazard of this.hazards) {
            if (!hazard.mesh.visible) continue;

            if (hazard.type === 'cow' || hazard.type === 'dog') {
                const moveAmount = hazard.movement * dt;
                hazard.mesh.position.x += moveAmount;
                
                // Keep them within the road bounds, bounce back if they hit edge
                if (hazard.mesh.position.x > 8 || hazard.mesh.position.x < -8) {
                    hazard.movement *= -1;
                    // Flip rotation when bouncing
                    hazard.mesh.rotation.y = hazard.movement > 0 ? -Math.PI/2 : Math.PI/2; 
                }
                
                // Extremely fast AABB translation instead of full vertex recalculation
                this.tempVec.set(moveAmount, 0, 0);
                hazard.boundingBox.translate(this.tempVec);
            }

            if (hazard.type === 'passenger' && playerPos) {
                // Show 'E' bubble if player is close (within 30 units)
                const dist = hazard.mesh.position.distanceTo(playerPos);
                if (hazard.mesh.children[2]) {
                    hazard.mesh.children[2].visible = (dist < 30);
                }
            }
        }
    }

    cleanup(playerZ, renderDistance) {
        // Remove hazards that are far behind the player
        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const hazard = this.hazards[i];
            if (hazard.mesh.position.z > playerZ + 50) { 
                hazard.mesh.visible = false;
                
                // Return to pool
                if (this.pool[hazard.type]) {
                    this.pool[hazard.type].push(hazard.mesh);
                }
                
                this.hazards.splice(i, 1);
            }
        }
    }

    reset() {
        for (const hazard of this.hazards) {
            hazard.mesh.visible = false;
            if (this.pool[hazard.type]) {
                this.pool[hazard.type].push(hazard.mesh);
            }
        }
        this.hazards = [];
    }

    buildMasterModels() {
        this.masterModels = {};

        // ─── COW (fixed tail) ───────────────────────────────────────────────────
        const cowWhite  = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
        const cowSpot   = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const cowPink   = new THREE.MeshLambertMaterial({ color: 0xffaabb });
        const cowHoof   = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const cowEye    = new THREE.MeshLambertMaterial({ color: 0x111111 });

        const cowGrp = new THREE.Group();

        // Body — center y=1.6, depth 3.2 → rear at z=+1.6
        const cowBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 3.2), cowWhite);
        cowBody.position.y = 1.6;
        cowGrp.add(cowBody);

        // Spots
        const spot1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.85), cowSpot);
        spot1.position.set(0.92, 1.88, 0.4); cowGrp.add(spot1);
        const spot2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 0.65), cowSpot);
        spot2.position.set(-0.92, 1.52, -0.7); cowGrp.add(spot2);

        // Neck
        const cowNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 0.88, 8), cowWhite);
        cowNeck.rotation.x = -0.4;
        cowNeck.position.set(0, 2.2, -1.4);
        cowGrp.add(cowNeck);

        // Head sphere
        const cowHead = new THREE.Mesh(new THREE.SphereGeometry(0.64, 10, 8), cowWhite);
        cowHead.position.set(0, 2.7, -2.0); cowGrp.add(cowHead);

        // Snout
        const cowSnout = new THREE.Mesh(new THREE.SphereGeometry(0.37, 8, 6), cowPink);
        cowSnout.scale.z = 0.55;
        cowSnout.position.set(0, 2.55, -2.6); cowGrp.add(cowSnout);

        for (const ox of [-0.13, 0.13]) {
            const n = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 5), cowEye);
            n.position.set(ox, 2.5, -2.8); cowGrp.add(n);
        }
        for (const ox of [-0.28, 0.28]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), cowEye);
            eye.position.set(ox, 2.84, -2.45); cowGrp.add(eye);
        }
        for (const ox of [-0.7, 0.7]) {
            const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 0.38, 6), cowWhite);
            ear.rotation.z = ox > 0 ? -Math.PI/4 : Math.PI/4;
            ear.position.set(ox, 3.0, -2.0); cowGrp.add(ear);
        }
        for (const ox of [-0.5, 0.5]) {
            const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.1, 0.48, 6),
                new THREE.MeshLambertMaterial({ color: 0xccaa55 }));
            horn.rotation.z = ox > 0 ? -0.5 : 0.5;
            horn.position.set(ox, 3.3, -2.0); cowGrp.add(horn);
        }

        // Legs
        for (const [lx, lz] of [[-0.7,1.1],[0.7,1.1],[-0.7,-1.1],[0.7,-1.1]]) {
            const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.78, 7), cowWhite);
            upper.position.set(lx, 0.9, lz); cowGrp.add(upper);
            const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.78, 7), cowWhite);
            lower.position.set(lx, 0.2, lz); cowGrp.add(lower);
            const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.17, 7), cowHoof);
            hoof.position.set(lx, -0.16, lz); cowGrp.add(hoof);
        }

        // TAIL — starts from RUMP: rear of body top (0, 2.0, 1.6)
        // rotation.x = +0.7 tilts top toward +z (backward)
        const tailBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.72, 6), cowWhite);
        tailBase.rotation.x = 0.7;
        tailBase.position.set(0, 1.98, 1.6);  // rump position
        cowGrp.add(tailBase);
        // End of tailBase: dy=+0.36*cos(0.7)≈+0.28, dz=+0.36*sin(0.7)≈+0.25
        const tailTuft = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), cowSpot);
        tailTuft.position.set(0, 2.26, 1.88);
        cowGrp.add(tailTuft);

        this.masterModels.cow = cowGrp;

        // ─── DOG (fixed tail) ───────────────────────────────────────────────────
        const dogFur  = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        const dogLite = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
        const dogEye  = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const dogNose = new THREE.MeshLambertMaterial({ color: 0x220000 });

        const dogGrp = new THREE.Group();

        // Body — center y=0.65, depth 1.4 → rear at z=+0.7
        const dBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 1.4), dogFur);
        dBody.position.y = 0.65; dogGrp.add(dBody);

        const dNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.38, 7), dogFur);
        dNeck.rotation.x = -0.3;
        dNeck.position.set(0, 1.0, -0.56); dogGrp.add(dNeck);

        const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.34, 9, 8), dogFur);
        dHead.scale.set(1, 0.9, 1.1);
        dHead.position.set(0, 1.3, -0.9); dogGrp.add(dHead);

        const dSnout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.19, 0.28), dogLite);
        dSnout.position.set(0, 1.2, -1.18); dogGrp.add(dSnout);

        const dNoseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), dogNose);
        dNoseMesh.position.set(0, 1.28, -1.32); dogGrp.add(dNoseMesh);

        for (const ox of [-0.15, 0.15]) {
            const dE = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), dogEye);
            dE.position.set(ox, 1.4, -1.06); dogGrp.add(dE);
        }
        for (const ox of [-0.3, 0.3]) {
            const ear = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.28, 0.1), dogFur);
            ear.rotation.z = ox > 0 ? -0.35 : 0.35;
            ear.position.set(ox, 1.54, -0.88); dogGrp.add(ear);
        }
        for (const [lx, lz] of [[-0.27,0.55],[0.27,0.55],[-0.27,-0.55],[0.27,-0.55]]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.62, 6), dogFur);
            leg.position.set(lx, 0.31, lz); dogGrp.add(leg);
            const paw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), dogLite);
            paw.scale.set(1, 0.5, 1.2);
            paw.position.set(lx, 0.01, lz + (lz > 0 ? 0.04 : -0.04)); dogGrp.add(paw);
        }

        // TAIL — starts from RUMP: rear of body (0, 0.88, 0.7)
        // rotation.x = +0.8 tilts top toward +z (backward)
        const dTail1 = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.38, 6), dogFur);
        dTail1.rotation.x = 0.8;
        dTail1.position.set(0, 0.88, 0.7);
        dogGrp.add(dTail1);
        // End: dy=+0.19*cos(0.8)≈+0.133, dz=+0.19*sin(0.8)≈+0.136
        const dTail2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.052, 0.28, 6), dogFur);
        dTail2.rotation.x = 1.4;
        dTail2.position.set(0, 1.02, 0.86);
        dogGrp.add(dTail2);

        this.masterModels.dog = dogGrp;

        // ─── KERALA BUILDINGS (max 2 stories) ───────────────────────────────────
        this.masterModels.buildings = [];

        const makeWin = (w = 0.9, h = 1.1) =>
            new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1),
                new THREE.MeshBasicMaterial({ color: 0x99ccdd, transparent: true, opacity: 0.8 }));

        // ── 0: Traditional Kerala house (single story, tiled roof, veranda) ──────
        {
            const g = new THREE.Group();
            const wallMat  = new THREE.MeshLambertMaterial({ color: 0xf5f0e8 });
            const roofMat  = new THREE.MeshLambertMaterial({ color: 0xaa3311 }); // terracotta
            const trimMat  = new THREE.MeshLambertMaterial({ color: 0xddccbb });
            const doorMat  = new THREE.MeshLambertMaterial({ color: 0x6b3a1f });

            // Walls
            const walls = new THREE.Mesh(new THREE.BoxGeometry(9, 3.8, 6), wallMat);
            walls.position.y = 1.9; g.add(walls);

            // Hip roof (pyramid approximation)
            const roofBody = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.2, 6.6), roofMat);
            roofBody.position.y = 3.8; g.add(roofBody);
            const roofPeak = new THREE.Mesh(new THREE.CylinderGeometry(0, 5.0, 2.2, 4), roofMat);
            roofPeak.rotation.y = Math.PI / 4;
            roofPeak.position.y = 5.0; g.add(roofPeak);

            // Veranda
            const porch = new THREE.Mesh(new THREE.BoxGeometry(9, 0.14, 1.8), trimMat);
            porch.position.set(0, 0.14, 4.0); g.add(porch);
            for (const px of [-3.5, 0, 3.5]) {
                const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 2.1, 7), trimMat);
                pillar.position.set(px, 1.2, 4.0); g.add(pillar);
            }
            const beam = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, 0.2), trimMat);
            beam.position.set(0, 2.3, 4.0); g.add(beam);
            const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.15, 2.0), roofMat);
            porchRoof.rotation.x = -0.1;
            porchRoof.position.set(0, 2.4, 4.1); g.add(porchRoof);

            // Door
            const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.4, 0.1), doorMat);
            door.position.set(0, 1.2, 3.06); g.add(door);
            // Windows
            for (const px of [-2.8, 2.8]) {
                const win = makeWin();
                win.position.set(px, 1.9, 3.06); g.add(win);
            }
            // Compound wall
            const cwall = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.85, 0.2), trimMat);
            cwall.position.set(0, 0.45, 5.5); g.add(cwall);
            for (const px of [-1.1, 1.1]) {
                const gp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.35, 0.3), trimMat);
                gp.position.set(px, 0.68, 5.5); g.add(gp);
            }

            this.masterModels.buildings.push(g);
        }

        // ── 1: 2-story Kerala commercial (ground floor shops + first floor flat) ─
        {
            const g = new THREE.Group();
            const wallMat  = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });
            const slabMat  = new THREE.MeshLambertMaterial({ color: 0xbbaa99 });
            const shutMat  = new THREE.MeshLambertMaterial({ color: 0x336699 });
            const doorMat  = new THREE.MeshLambertMaterial({ color: 0x5a2e0a });

            // Ground floor
            const gf = new THREE.Mesh(new THREE.BoxGeometry(8, 3.4, 5.5), wallMat);
            gf.position.y = 1.7; g.add(gf);

            // Floor slab
            const slab = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.28, 5.8), slabMat);
            slab.position.y = 3.54; g.add(slab);

            // First floor
            const ff = new THREE.Mesh(new THREE.BoxGeometry(8, 3.0, 5.5), wallMat);
            ff.position.y = 5.04; g.add(ff);

            // Roof parapet
            const parapet = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.5, 5.8), slabMat);
            parapet.position.y = 6.79; g.add(parapet);

            // Ground floor: 2 shop shutters
            for (const px of [-2.2, 2.2]) {
                const shut = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.75, 0.1), shutMat);
                shut.position.set(px, 1.38, 2.82); g.add(shut);
            }
            // Ground floor awning
            const awning = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.14, 1.1), slabMat);
            awning.position.set(0, 3.42, 3.45); g.add(awning);

            // First floor balcony rail
            const rail = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.55, 0.1), slabMat);
            rail.position.set(0, 4.4, 2.82); g.add(rail);
            for (let i = 0; i < 8; i++) {
                const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.55, 5), slabMat);
                bal.position.set(-3.4 + i * 0.96, 4.12, 2.82); g.add(bal);
            }

            // First floor windows
            for (const px of [-2.5, 0, 2.5]) {
                const win = makeWin(1.1, 1.2);
                win.position.set(px, 5.35, 2.82); g.add(win);
            }
            // Side staircase door
            const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.2, 0.1), doorMat);
            door.position.set(3.6, 1.1, 2.82); g.add(door);

            this.masterModels.buildings.push(g);
        }

        // ── 2: Kerala petty shop / tea stall (single story, colourful) ──────────
        {
            const g = new THREE.Group();
            const wallMat   = new THREE.MeshLambertMaterial({ color: 0xfff0cc });
            const roofMat   = new THREE.MeshLambertMaterial({ color: 0x226633 });
            const shutMat   = new THREE.MeshLambertMaterial({ color: 0xcc3311 });
            const pillarMat = new THREE.MeshLambertMaterial({ color: 0xddccaa });
            const signMat   = new THREE.MeshLambertMaterial({ color: 0xffffff });
            const doorMat   = new THREE.MeshLambertMaterial({ color: 0x5a2e0a });

            const walls = new THREE.Mesh(new THREE.BoxGeometry(7, 3.0, 4.5), wallMat);
            walls.position.y = 1.5; g.add(walls);

            // Sloped sheet roof (two slopes)
            for (const [ry, rz, rot] of [[3.42, -1.0, -0.2], [3.42, 1.0, 0.2]]) {
                const rs = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.16, 2.8), roofMat);
                rs.rotation.x = rot;
                rs.position.set(0, ry, rz); g.add(rs);
            }
            const ridge = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.22, 0.28), roofMat);
            ridge.position.set(0, 3.6, 0); g.add(ridge);

            // Front shutter
            const shutter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.35, 0.1), shutMat);
            shutter.position.set(-0.5, 1.18, 2.3); g.add(shutter);
            // Side door
            const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.0, 0.1), doorMat);
            door.position.set(2.7, 1.0, 2.3); g.add(door);

            // Awning
            const awning = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.12, 1.6), roofMat);
            awning.rotation.x = -0.18;
            awning.position.set(0, 3.1, 3.3); g.add(awning);

            // Front pillars
            for (const px of [-3, 0, 3]) {
                const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 3.0, 7), pillarMat);
                pillar.position.set(px, 1.5, 2.8); g.add(pillar);
            }

            // Sign board
            const sign = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.65, 0.14), signMat);
            sign.position.set(-0.5, 3.1, 2.38); g.add(sign);

            // Low compound wall at back
            const cwall = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.65, 0.14), pillarMat);
            cwall.position.set(0, 0.33, -2.4); g.add(cwall);

            this.masterModels.buildings.push(g);
        }
    }
}
