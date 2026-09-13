import * as THREE from './three.module.js';

export class Engine {
    constructor() {
        this.container = document.getElementById('game-container');
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.015); // Add some depth

        // Camera setup (Third-person view behind the bike)
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.cameraOffset = new THREE.Vector3(0, 5, 10);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: false }); // False for low-poly look
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        this.setupLights();

        // Handle resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.idealCameraPos = new THREE.Vector3();
        this.lookAtPos = new THREE.Vector3();
        this.lookAtOffset = new THREE.Vector3(0, 2, -10);
        
        this.shakeIntensity = 0;
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;
        
        const d = 100;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;

        this.scene.add(dirLight);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateCamera(targetPosition) {
        // Smoothly follow the target (bike) without creating new objects
        this.idealCameraPos.copy(targetPosition).add(this.cameraOffset);
        this.camera.position.lerp(this.idealCameraPos, 0.1);
        
        this.lookAtPos.copy(targetPosition).add(this.lookAtOffset);
        this.camera.lookAt(this.lookAtPos);
        
        if (this.shakeIntensity > 0) {
            this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.z += (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity = Math.max(0, this.shakeIntensity - 0.2);
        }
    }
    
    shake(intensity) {
        this.shakeIntensity = intensity;
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
