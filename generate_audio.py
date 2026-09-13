import wave
import struct
import math

# Audio parameters
sample_rate = 44100
num_channels = 1
sample_width = 2
duration = 2.0
num_samples = int(sample_rate * duration)

file_path = "audio/gameover.wav"

# Frequencies for a descending retro "game over" arpeggio
# C5, G4, Eb4, C4, G3, C3
notes = [523.25, 392.00, 311.13, 261.63, 196.00, 130.81]
note_duration = duration / len(notes)

with wave.open(file_path, 'w') as wav_file:
    wav_file.setnchannels(num_channels)
    wav_file.setsampwidth(sample_width)
    wav_file.setframerate(sample_rate)

    for i in range(num_samples):
        t = float(i) / sample_rate
        
        # Determine which note we are playing
        note_index = int(t / note_duration)
        if note_index >= len(notes):
            note_index = len(notes) - 1
            
        freq = notes[note_index]
        
        # Simple square wave
        period = 1.0 / freq
        val = 1.0 if (t % period) < (period / 2) else -1.0
        
        # Add some vibrato
        vibrato = math.sin(2 * math.pi * 10 * t) * 5
        period_v = 1.0 / (freq + vibrato)
        val = 1.0 if (t % period_v) < (period_v / 2) else -1.0
        
        # Envelope: slight decay per note
        t_note = t % note_duration
        envelope = max(0.0, 1.0 - (t_note / note_duration))
        
        # Global fade out
        if t > duration - 0.5:
            envelope *= (duration - t) / 0.5
            
        # Write sample
        sample = int(val * envelope * 16000)
        wav_file.writeframes(struct.pack('h', sample))

print(f"Generated {file_path}")
