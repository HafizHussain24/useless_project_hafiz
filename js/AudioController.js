export class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.ctx.destination);
        
        this.buffers = {};
        this.engineSource = null;
        this.engineGain = null;
        this.engineRunning = false;
        
        this.files = {
            'bike': 'audio/Bike.m4a',
            'gutter1': 'audio/Gutter 1.m4a',
            'gutter2': 'audio/Gutter 2.m4a',
            'cow1': 'audio/Cow 1.m4a',
            'cow2': 'audio/Cow 2.m4a',
            'cow3': 'audio/Cow 3.m4a',
            'bump1': 'audio/Bump 1.m4a',
            'bump2': 'audio/Bump 2.m4a',
            'horn': 'audio/Horn.m4a',
            'mvd': 'audio/MVD.m4a',
            'gameover': 'audio/gameover.wav'
        };
    }

    async init() {
        const promises = Object.entries(this.files).map(async ([key, path]) => {
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.buffers[key] = audioBuffer;
            } catch (e) {
                console.error(`Failed to load audio: ${path}`, e);
            }
        });
        await Promise.all(promises);
        console.log("All audio loaded");
    }

    playSound(key, volume = 1.0, loop = false) {
        if (!this.buffers[key]) return null;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[key];
        source.loop = loop;
        
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        source.start();
        return { source, gainNode };
    }

    start() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        if (!this.engineRunning && this.buffers['bike']) {
            this.engineGain = this.ctx.createGain();
            this.engineGain.gain.value = 0.5; // Starts quiet/idle
            this.engineGain.connect(this.masterGain);
            
            this.engineSource = this.ctx.createBufferSource();
            this.engineSource.buffer = this.buffers['bike'];
            this.engineSource.loop = true;
            this.engineSource.connect(this.engineGain);
            this.engineSource.start();
            this.engineRunning = true;
        }
    }

    updateEngine(speed, isAccelerating) {
        if (!this.engineRunning || !this.engineSource) return;
        
        // Pitch shift the engine loop based on bike speed
        // Assuming normal playback rate is 1.0 at moderate speed
        const playbackRate = 0.8 + (speed * 0.02);
        this.engineSource.playbackRate.value = Math.min(playbackRate, 3.0);
        
        // Slightly louder when accelerating
        const targetGain = isAccelerating ? 1.0 : 0.5;
        this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    }

    stopEngine() {
        if (this.engineRunning && this.engineGain) {
            this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
            // We'll let the loop keep playing silently so we can ramp it back up if they restart without reload
        }
    }

    playPothole() {
        const choice = Math.random() > 0.5 ? 'gutter1' : 'gutter2';
        this.playSound(choice, 0.8);
    }

    playEject() {
        const choice = Math.random() > 0.5 ? 'bump1' : 'bump2';
        this.playSound(choice, 1.0);
    }

    playMoo() {
        const r = Math.random();
        let choice = 'cow1';
        if (r > 0.66) choice = 'cow3';
        else if (r > 0.33) choice = 'cow2';
        this.playSound(choice, 0.8);
    }
    
    playMVD() {
        this.playSound('mvd', 1.0);
    }
    
    playHorn() {
        this.playSound('horn', 0.8);
    }

    playGameOver() {
        if (!this.ctx) return;
        
        // If they provided a custom gameover sound, use it!
        if (this.buffers['gameover']) {
            this.playSound('gameover', 0.3);
            return;
        }

        // Procedural fallback
        const bufferSize = this.ctx.sampleRate * 1.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
        
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
        noise.start();
    }
}
