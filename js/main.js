import * as THREE from './three.module.js';
import { Engine } from './Engine.js';
import { Bike } from './Bike.js';
import { RoadManager } from './RoadManager.js';
import { HazardSpawner } from './HazardSpawner.js';
import { Collision } from './Collision.js';
import { AudioController } from './AudioController.js';

class Game {
    constructor() {
        this.engine = new Engine();
        this.bike = new Bike(this.engine.scene);
        this.hazardSpawner = new HazardSpawner(this.engine.scene);
        this.roadManager = new RoadManager(this.engine.scene, this.hazardSpawner);
        this.audio = new AudioController();
        
        // Game State
        this.state = 'MENU'; // MENU, PLAYING, GAMEOVER
        this.score = 0;
        this.passengerDistance = 0;
        this.passengerMinDistance = 200;
        
        // Helmet Mechanic
        this.helmetHoldTime = 0;
        this.helmetHoldRequired = 1.0; // 1 second to equip
        this.helmetCooldown = 0;
        
        // Biomes
        this.biomes = {
            'Amenity Centre': { ground: new THREE.Color(0x2d5a27), sky: new THREE.Color(0x87CEEB) }, // Green Grass, Blue Sky
            'Sahara Hostel': { ground: new THREE.Color(0xe0cda9), sky: new THREE.Color(0xffdcb3) },  // Sandy Desert, Pale Sky
            'SOE': { ground: new THREE.Color(0xd2b48c), sky: new THREE.Color(0xffcc99) },            // Deep Desert, Warm Sky
            'Pipeline Road': { ground: new THREE.Color(0x8f9779), sky: new THREE.Color(0xaec6cf) }   // Dry Grass/Dirt, Cloudy Sky
        };
        
        // Input state
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            space: false,
            e: false,
            ePressedThisFrame: false
        };

        this.clock = new THREE.Clock();
        
        this.initUI();
        this.initInput();
        
        // Start loop
        this.renderer = this.engine.renderer;
        this.renderer.setAnimationLoop(() => this.loop());
    }

    initUI() {
        this.ui = {
            menu: document.getElementById('menu-screen'),
            hud: document.getElementById('hud-screen'),
            gameOver: document.getElementById('game-over-screen'),
            gameOverHeader: document.getElementById('game-over-header'),
            gameOverTip: document.getElementById('game-over-tip'),
            distanceVal: document.getElementById('distance-val'),
            pointsVal: document.getElementById('points-val'),
            speedVal: document.getElementById('speed-val'),
            speedBar: document.getElementById('speed-bar'),
            phaseVal: document.getElementById('phase-val'),
            helmetVal: document.getElementById('helmet-val'),
            helmetBar: document.getElementById('helmet-bar'),
            passengerVal: document.getElementById('passenger-val'),
            gameOverReason: document.getElementById('game-over-reason'),
            finalDistance: document.getElementById('final-distance'),
            finalScore: document.getElementById('final-score'),
            highScore: document.getElementById('high-score'),
            notify: document.getElementById('notification-area')
        };

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.startGame());
    }

    initInput() {
        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));
    }

    handleKey(e, isDown) {
        switch(e.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.input.forward = isDown;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.input.backward = isDown;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.input.left = isDown;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.input.right = isDown;
                break;
            case 'Space':
                this.input.space = isDown;
                break;
            case 'KeyE':
                if (isDown && !this.input.e) {
                    this.input.ePressedThisFrame = true;
                }
                this.input.e = isDown;
                break;
        }
    }

    startGame() {
        this.state = 'PLAYING';
        this.distance = 0;
        this.points = 0;
        this._lastPointDist = 0;
        this.helmetHoldTime = 0;
        this.helmetCooldown = 0;
        this.passengerDistance = 0;
        this.mainPassengerLost = false;
        this.ragdolls = [];
        
        this.ui.menu.classList.remove('active');
        this.ui.gameOver.classList.remove('active', 'death-busted', 'death-wasted', 'death-crash');
        this.ui.hud.classList.add('active');
        this.ui.notify.innerText = '';
        
        this.bike.reset();
        this.hazardSpawner.reset();
        this.roadManager.reset();
        
        this.audio.start();
        
        this.clock.start();
    }

    endGame(reason, type = 'crash') {
        this.state = 'GAMEOVER';
        this.bike.crash();
        this.audio.stopEngine();
        this.audio.playGameOver();
        
        this.ui.hud.classList.remove('active');
        this.ui.gameOver.classList.remove('death-busted', 'death-wasted', 'death-crash');
        this.ui.gameOver.classList.add('active', `death-${type}`);
        this.ui.gameOverReason.innerText = reason;
        
        if (type === 'busted') {
            this.ui.gameOverHeader.innerText = "BUSTED!";
            this.ui.gameOverTip.innerText = "Pro Tip: You can drop off passengers using [E] right before you pass the jeep!";
            this.ui.gameOverHeader.style.color = 'var(--light)';
        } else if (type === 'wasted') {
            this.ui.gameOverHeader.innerText = "WASTED";
            this.ui.gameOverTip.innerText = "The animals in CUSAT have the right of way. Use your brakes [S].";
            this.ui.gameOverHeader.style.color = 'var(--danger)';
        } else {
            this.ui.gameOverHeader.innerText = "SPINAL INJURY";
            this.ui.gameOverTip.innerText = "Hit a speed bump too fast. Use passengers to absorb the shock next time.";
            this.ui.gameOverHeader.style.color = 'var(--warning)';
        }
        
        const finalDist = Math.floor(this.distance);
        const finalPts = Math.floor(this.points);
        
        this.ui.finalDistance.innerText = finalDist;
        this.ui.finalScore.innerText = finalPts;
        
        // High Score
        let highScore = parseInt(localStorage.getItem('cusatHighScore') || '0');
        if (finalPts > highScore) {
            highScore = finalPts;
            localStorage.setItem('cusatHighScore', highScore.toString());
        }
        this.ui.highScore.innerText = highScore;
    }

    showNotification(msg, duration = 2000) {
        this.ui.notify.innerText = msg;
        if (this.notifyTimeout) clearTimeout(this.notifyTimeout);
        this.notifyTimeout = setTimeout(() => {
            this.ui.notify.innerText = '';
        }, duration);
    }

    updateGameplay(dt) {
        // Update modules
            this.bike.update(dt, this.input);
            this.audio.updateEngine(this.bike.speed, this.input.forward);
            this.hazardSpawner.update(dt, this.bike.mesh.position);
            this.roadManager.update(this.bike.position.z);

            // Ragdoll physics
            for (let i = this.ragdolls.length - 1; i >= 0; i--) {
                const rd = this.ragdolls[i];
                
                if (!rd.isFlat) {
                    rd.mesh.position.addScaledVector(rd.velocity, dt);
                    rd.velocity.y -= 30 * dt; // Gravity
                    rd.mesh.rotation.x += rd.rotVelocity.x * dt;
                    rd.mesh.rotation.y += rd.rotVelocity.y * dt;
                    rd.mesh.rotation.z += rd.rotVelocity.z * dt;
                    
                    // Ground collision
                    const groundLevel = 0.4;
                    if (rd.mesh.position.y <= groundLevel) {
                        rd.mesh.position.y = groundLevel;
                        rd.velocity.y *= -0.75; // More Bouncy
                        rd.velocity.x *= 0.9; // Less Friction
                        rd.velocity.z *= 0.9; // Less Friction
                        rd.bounces = (rd.bounces || 0) + 1;
                        
                        if (rd.bounces > 5 || Math.abs(rd.velocity.y) < 1.5) {
                            rd.isFlat = true;
                            rd.mesh.rotation.set(-Math.PI / 2, 0, 0); // Face plant
                            rd.velocity.y = 0;
                        }
                    }
                } else {
                    // Slide flat on the road
                    rd.velocity.x *= 0.95;
                    rd.velocity.z *= 0.95;
                    rd.mesh.position.x += rd.velocity.x * dt;
                    rd.mesh.position.z += rd.velocity.z * dt;
                }
            }
        this.hazardSpawner.cleanup(this.bike.position.z, this.roadManager.renderDistance);

        // Update score and speed (with conditional DOM update to prevent layout thrashing)
        this.distance = Math.max(this.distance, -this.bike.position.z);
        
        const newDist = Math.floor(this.distance);
        if (this._lastDist !== newDist) {
            this.ui.distanceVal.innerText = newDist + 'm';
            if (newDist > this._lastPointDist) {
                this.points += (newDist - this._lastPointDist);
                this._lastPointDist = newDist;
            }
            this._lastDist = newDist;
        }

        const newPoints = Math.floor(this.points);
        if (this._lastPoints !== newPoints) {
            this.ui.pointsVal.innerText = newPoints;
            this._lastPoints = newPoints;
        }

        const newSpeed = Math.floor(this.bike.speed * 2);
        if (this._lastSpeed !== newSpeed) {
            this.ui.speedVal.innerText = newSpeed;
            this.ui.speedBar.style.width = Math.min((newSpeed / 120) * 100, 100) + '%';
            this._lastSpeed = newSpeed;
        }

        const newPhase = this.roadManager.getPlayerPhase(this.bike.position.z);
        if (this._lastPhase !== newPhase) {
            this.ui.phaseVal.innerText = newPhase;
            this._lastPhase = newPhase;
        }

        // Biome Transition
        if (this.biomes[newPhase]) {
            const target = this.biomes[newPhase];
            const lerpSpeed = dt * 0.5; // Smooth transition over a few seconds
            this.engine.scene.background.lerp(target.sky, lerpSpeed);
            this.engine.scene.fog.color.lerp(target.sky, lerpSpeed);
            this.roadManager.materials.grass.color.lerp(target.ground, lerpSpeed);
        }

        // Helmet Mechanic
        if (this.helmetCooldown > 0) {
            this.helmetCooldown -= dt;
            this.ui.helmetVal.innerText = `COOLDOWN (${this.helmetCooldown.toFixed(1)}s)`;
            this.ui.helmetBar.style.width = '0%';
        } else {
            if (this.input.space && !this.bike.hasHelmet) {
                this.helmetHoldTime += dt;
                const progress = Math.min(this.helmetHoldTime / this.helmetHoldRequired, 1);
                this.ui.helmetBar.style.width = `${progress * 100}%`;
                this.ui.helmetVal.innerText = 'EQUIPPING...';
                
                if (this.helmetHoldTime >= this.helmetHoldRequired) {
                    this.bike.setHelmet(true);
                    this.showNotification("Helmet Equipped!");
                    this.helmetHoldTime = 0;
                }
            } else if (!this.input.space && this.bike.hasHelmet) {
                // Remove helmet
                this.bike.setHelmet(false);
                this.helmetCooldown = 5.0; // 5 second cooldown
                this.ui.helmetVal.innerText = 'OFF';
                this.ui.helmetBar.style.width = '0%';
                this.showNotification("Helmet Removed");
            } else if (!this.input.space) {
                this.helmetHoldTime = 0;
                this.ui.helmetBar.style.width = '0%';
                if (this.bike.hasHelmet) {
                    this.ui.helmetVal.innerText = 'ON';
                    this.ui.helmetBar.style.width = '100%';
                } else {
                    this.ui.helmetVal.innerText = 'OFF';
                }
            }
        }

        // Passenger Mechanic
        if (this.bike.hasPassenger) {
            this.passengerDistance += this.bike.speed * dt;
            if (this.passengerDistance >= this.passengerMinDistance) {
                this.ui.passengerVal.innerText = 'Dropoff Ready [E]';
                this.ui.passengerVal.style.color = 'var(--primary)';
            } else {
                this.ui.passengerVal.innerText = 'Yes (Riding)';
                this.ui.passengerVal.style.color = 'white';
            }
        } else {
            this.ui.passengerVal.innerText = 'No';
            this.ui.passengerVal.style.color = 'white';
        }

        // Collision Checks
        const hit = Collision.check(this.bike, this.hazardSpawner.hazards);
        if (hit && !hit.hitPassed) {
            if (hit.type === 'speedbump') {
                hit.hitPassed = true;
                const maxSafeSpeed = hit.limit / 2; // Since UI speed is bike.speed * 2
                if (this.bike.speed > maxSafeSpeed) { 
                    this.engine.shake(2);
                    if (this.bike.hasPassenger) {
                        this.bike.setPassenger(false);
                        this.engine.scene.attach(this.bike.passenger3);
                        this.bike.passenger3.visible = true;
                        
                        this.ragdolls.push({
                            mesh: this.bike.passenger3,
                            velocity: new THREE.Vector3((Math.random() - 0.5) * 5, 18, -(this.bike.speed * 1.5 + 40)),
                            rotVelocity: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
                            bounces: 0,
                            isFlat: false
                        });
                        
                        this.points = 0;
                        this.showNotification("Triples Passenger flew off! Score reset to 0.", 3000);
                        this.audio.playEject();
                        this.bike.speed = Math.max(this.bike.minSpeed, this.bike.speed - 15);
                    } else if (!this.mainPassengerLost) {
                        this.mainPassengerLost = true;
                        
                        // Detach passenger and ragdoll
                        this.engine.scene.attach(this.bike.passenger2); // keeps world transform
                        this.ragdolls.push({
                            mesh: this.bike.passenger2,
                            velocity: new THREE.Vector3((Math.random() - 0.5) * 5, 18, -(this.bike.speed * 1.5 + 40)),
                            rotVelocity: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
                            bounces: 0,
                            isFlat: false
                        });
                        
                        this.points = 0; // Reset score
                        this.showNotification("Passenger flew off! Score reset to 0.", 3000);
                        this.audio.playEject();
                        this.bike.speed = Math.max(this.bike.minSpeed, this.bike.speed - 15);
                    } else {
                        this.endGame(`Hit a speed bump too fast!`, 'crash');
                    }
                } else {
                    // Safe speed over speed bump
                    this.engine.shake(0.5);
                    this.bike.speed = Math.max(this.bike.minSpeed, this.bike.speed - 10);
                }
            } else if (hit.type === 'pothole') {
                hit.hitPassed = true;
                this.engine.shake(1.5);
                this.audio.playPothole();
                // Jump
                this.bike.verticalVelocity = 12;
                this.bike.speed = Math.max(this.bike.minSpeed, this.bike.speed - 5);
                this.points = Math.max(0, this.points - 100);
                this.showNotification("-100 Points! Hit a pothole");
            } else if (hit.type === 'cow' || hit.type === 'dog') {
                this.endGame(`Crashed into a ${hit.type}!`, 'wasted');
            }
        }
        
        // Cow Proximity Audio
        for (const hazard of this.hazardSpawner.hazards) {
            if (hazard.type === 'cow' && !hazard.mooed && hazard.mesh.position.z > this.bike.position.z - 20) {
                this.audio.playMoo();
                hazard.mooed = true;
            }
        }

        // Passenger Pickup Check
        if (this.input.ePressedThisFrame && !this.bike.hasPassenger && this.bike.speed <= this.bike.minSpeed + 2.5) {
            // Find nearby passenger
            for (const hazard of this.hazardSpawner.hazards) {
                if (hazard.type === 'passenger' && hazard.mesh.visible) {
                    const dist = hazard.mesh.position.distanceTo(this.bike.position);
                    if (dist < 15) {
                        this.bike.setPassenger(true, hazard.shirtColor);
                        this.passengerDistance = 0;
                        hazard.isPickedUp = true;
                        hazard.mesh.visible = false;
                        this.showNotification("Passenger Picked Up! Triples!");
                        break;
                    }
                }
            }
        }

        // Dropoff check
        if (this.input.ePressedThisFrame && this.bike.hasPassenger && this.bike.speed <= this.bike.minSpeed + 2.5) {
            if (this.passengerDistance >= this.passengerMinDistance) {
                this.bike.setPassenger(false);
                this.points += 500; // Bonus points
                this.showNotification("+500 Points! Dropoff Successful");
            } else {
                this.showNotification("Too soon to drop off!");
            }
        }

        // MVD Checkpoint
        const passedJeep = Collision.checkJeepPass(this.bike, this.hazardSpawner.hazards);
        if (passedJeep) {
            if (this.bike.hasPassenger) {
                this.endGame("Fine: ₹2000 - Triples Riding!", 'busted');
            } else if (!this.bike.hasHelmet) {
                this.endGame("Fine: ₹500 - No Helmet!", 'busted');
            } else {
                this.points += 200;
                this.showNotification("+200 Points! MVD Checkpoint Cleared");
            }
        }

        this.input.ePressedThisFrame = false;
    }

    loop() {
        const dt = Math.min(this.clock.getDelta(), 0.1); // Cap delta time

        if (this.state === 'PLAYING') {
            this.updateGameplay(dt);
            // Update camera to follow bike
            this.engine.updateCamera(this.bike.position);
        } else {
            // Cinematic camera pan for MENU and GAMEOVER states
            if (!this.menuAngle) this.menuAngle = 0;
            this.menuAngle += dt * 0.3; // Rotation speed
            
            // Keep drawing the scene elements at their idle positions
            this.hazardSpawner.update(dt, this.bike.position);
            
            this.engine.updateMenuCamera(this.bike.position, this.menuAngle);
        }
        
        this.engine.render();
    }
}

// Start app
window.onload = () => {
    new Game();
};
