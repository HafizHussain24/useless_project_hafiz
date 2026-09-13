export class AudioController {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        
        this.engineOsc = null;
        this.engineGain = null;
        this.engineRunning = false;
    }

    start() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        if (!this.engineRunning) {
            this.engineOsc = this.ctx.createOscillator();
            this.engineOsc.type = 'sawtooth';
            
            this.engineGain = this.ctx.createGain();
            this.engineGain.gain.value = 0; // Starts silent
            
            // Add a lowpass filter to muffle the raw sawtooth into a rumble
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 150;
            
            this.engineOsc.connect(filter);
            filter.connect(this.engineGain);
            this.engineGain.connect(this.masterGain);
            
            this.engineOsc.start();
            this.engineRunning = true;
        }
    }

    updateEngine(speed, isAccelerating) {
        if (!this.ctx || !this.engineRunning) return;
        
        // Base frequency 40Hz (idle), max 120Hz at high speed
        const targetFreq = 40 + (speed * 0.8);
        // Direct assignment is safer for 60FPS loops than constant setTargetAtTime overlapping
        this.engineOsc.frequency.value = targetFreq;
        
        // Slightly louder when accelerating
        const targetGain = isAccelerating ? 0.3 : 0.15;
        this.engineGain.gain.value = targetGain;
    }

    stopEngine() {
        if (this.engineRunning && this.engineGain) {
            this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
        }
    }

    playPothole() {
        if (!this.ctx) return;
        // Quick low-frequency thud, using square for more harmonics so it's audible on laptops
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        // Pitch drop from 300 to 50 for a "thwack"
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
        
        // Volume envelope
        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playEject() {
        if (!this.ctx) return;
        // Noise burst + descending oscillator
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 1000;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start();
        
        // Descending tone (like a cartoon fall)
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.5);
        
        oscGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    playMoo() {
        if (!this.ctx) return;
        // Synthesized "moo" sound
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        
        // Detune slightly for chorusing effect
        osc1.frequency.setValueAtTime(110, this.ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.3);
        osc1.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.8);
        
        osc2.frequency.setValueAtTime(112, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(122, this.ctx.currentTime + 0.3);
        osc2.frequency.exponentialRampToValueAtTime(92, this.ctx.currentTime + 0.8);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, this.ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.3);
        filter.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 0.8);
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.1);
        gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.6);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 0.8);
        osc2.stop(this.ctx.currentTime + 0.8);
    }

    playGameOver() {
        if (!this.ctx) return;
        
        // Heavy, distorted noise crash
        const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
        noiseFilter.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 1.5);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        
        // Deep descending bass drone
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 1.5);
        
        oscGain.gain.setValueAtTime(0.6, this.ctx.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.5);
        
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        
        noise.start();
        osc.start();
        osc.stop(this.ctx.currentTime + 1.5);
    }
}
