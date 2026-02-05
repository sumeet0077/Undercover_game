
import numpy as np
import wave
import struct
import os

SAMPLE_RATE = 44100
OUTPUT_DIR = "/Users/sumeetdas/Desktop/Antigravity Workspaces/Undercover_game/undercover-game/mobile/assets/sounds"

def save_wav(filename, data, sample_rate):
    # Ensure data is 16-bit PCM
    data = (data * 32767).astype(np.int16)
    with wave.open(filename, 'w') as f:
        f.setnchannels(1) # Mono
        f.setsampwidth(2) # 16-bit
        f.setframerate(sample_rate)
        f.writeframes(data.tobytes())

def generate_tone(freq, duration, waveform='sine', volume=0.5):
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    
    if waveform == 'sine':
        wave_data = np.sin(2 * np.pi * freq * t)
    elif waveform == 'triangle':
        wave_data = 2 * np.abs(2 * (t * freq - np.floor(t * freq + 0.5))) - 1
    elif waveform == 'sawtooth':
        wave_data = 2 * (t * freq - np.floor(t * freq + 0.5)) - 1
    else:
        wave_data = np.sin(2 * np.pi * freq * t)
        
    return wave_data * volume

def apply_envelope(wave_data, attack=0.01, decay=0.1, sustain_level=0.7, release=0.1):
    total_samples = len(wave_data)
    attack_samples = int(attack * SAMPLE_RATE)
    decay_samples = int(decay * SAMPLE_RATE)
    release_samples = int(release * SAMPLE_RATE)
    
    # Ensure segments don't exceed remaining length
    if attack_samples + decay_samples + release_samples > total_samples:
        attack_samples = int(total_samples * 0.1)
        decay_samples = int(total_samples * 0.1)
        release_samples = int(total_samples * 0.2)

    sustain_samples = total_samples - (attack_samples + decay_samples + release_samples)
    
    envelope = np.ones(total_samples)
    
    # Attack (0 to 1)
    envelope[:attack_samples] = np.linspace(0, 1, attack_samples)
    
    # Decay (1 to sustain)
    envelope[attack_samples:attack_samples+decay_samples] = np.linspace(1, sustain_level, decay_samples)
    
    # Sustain (constant)
    if sustain_samples > 0:
        envelope[attack_samples+decay_samples:total_samples-release_samples] = sustain_level
    
    # Release (sustain to 0)
    envelope[-release_samples:] = np.linspace(sustain_level, 0, release_samples)
    
    return wave_data * envelope

def apply_exponential_decay(wave_data, decay_factor=5):
    t = np.linspace(0, len(wave_data)/SAMPLE_RATE, len(wave_data))
    decay = np.exp(-decay_factor * t)
    return wave_data * decay

def generate_civilian_win():
    print("Generating Civilian Win Sound...")
    # C Major Arpeggio (C4, E4, G4, C5)
    freqs = [261.63, 329.63, 392.00, 523.25]
    duration_per_note = 0.6
    stagger = 0.1
    
    total_duration = stagger * (len(freqs)-1) + duration_per_note + 0.5 # Extra for Ding
    final_audio = np.zeros(int(total_duration * SAMPLE_RATE))
    
    # Arpeggio
    for i, freq in enumerate(freqs):
        start_time = i * stagger
        start_sample = int(start_time * SAMPLE_RATE)
        
        # Triangle wave
        tone = generate_tone(freq, duration_per_note, waveform='triangle', volume=0.2)
        
        attack_time = 0.05
        decay_time = 0.55
        
        attack_samples = int(attack_time * SAMPLE_RATE)
        # decaying rest
        
        if len(tone) > attack_samples:
             env_attack = np.linspace(0, 1, attack_samples)
             t_decay = np.linspace(0, decay_time, len(tone) - attack_samples)
             env_decay = np.exp(-5 * t_decay) 
             envelope = np.concatenate([env_attack, env_decay])
             if len(envelope) > len(tone): envelope = envelope[:len(tone)]
             else: tone = tone[:len(envelope)]
             tone = tone * envelope

        end_sample = start_sample + len(tone)
        if end_sample > len(final_audio):
             # expand if needed
             new_audio = np.zeros(end_sample)
             new_audio[:len(final_audio)] = final_audio
             final_audio = new_audio
             
        final_audio[start_sample:end_sample] += tone

    # Ding
    ding_start = 0.4
    ding_start_sample = int(ding_start * SAMPLE_RATE)
    ding_duration = 0.5
    
    ding = generate_tone(1046.50, ding_duration, waveform='sine', volume=0.2)
    ding = apply_exponential_decay(ding, decay_factor=8)
    
    end_sample = ding_start_sample + len(ding)
    if end_sample > len(final_audio):
         new_audio = np.zeros(end_sample)
         new_audio[:len(final_audio)] = final_audio
         final_audio = new_audio
         
    final_audio[ding_start_sample:end_sample] += ding
    
    # Normalize
    max_val = np.max(np.abs(final_audio))
    if max_val > 1.0:
        final_audio /= max_val
        
    save_wav(os.path.join(OUTPUT_DIR, "civilian_win.wav"), final_audio, SAMPLE_RATE)


def generate_undercover_win():
    print("Generating Undercover Win Sound...")
    # Dissonant Cluster
    freqs = [138.59, 196.00, 261.63]
    duration = 3.0
    
    final_audio = np.zeros(int(duration * SAMPLE_RATE))
    
    # 1. Sawtooth Cluster
    for freq in freqs:
        tone = generate_tone(freq, duration, waveform='sawtooth', volume=0.15)
        
        # Attack 1s, Decay 2s
        attack_time = 1.0
        decay_time = 2.0
        
        attack_samples = int(attack_time * SAMPLE_RATE)
        decay_samples = len(tone) - attack_samples
        
        if decay_samples > 0:
            env_attack = np.linspace(0, 1, attack_samples)
            env_decay = np.linspace(1, 0, decay_samples)
            envelope = np.concatenate([env_attack, env_decay])
            if len(envelope) > len(tone): envelope = envelope[:len(tone)]
            else: tone = tone[:len(envelope)]
            tone = tone * envelope
        
        final_audio += tone
        
    # 2. Bass Thud
    bass_duration = 1.5
    bass_t = np.linspace(0, bass_duration, int(SAMPLE_RATE * bass_duration))
    
    # Frequency sweep
    phases = np.zeros_like(bass_t)
    current_phase = 0
    dt = 1/SAMPLE_RATE
    
    for i, t_val in enumerate(bass_t):
        if t_val < 1.0:
            inst_freq = 60.0 * ((10.0/60.0)**(t_val))
        else:
            inst_freq = 10.0
        current_phase += 2 * np.pi * inst_freq * dt
        phases[i] = current_phase
        
    bass_tone = np.sin(phases) * 0.5 
    bass_decay = np.exp(-3 * bass_t) 
    bass_tone = bass_tone * bass_decay
    
    if len(bass_tone) < len(final_audio):
        final_audio[:len(bass_tone)] += bass_tone
    else:
        final_audio += bass_tone[:len(final_audio)]

    # Normalize
    max_val = np.max(np.abs(final_audio))
    if max_val > 1.0:
        final_audio /= max_val
        
    save_wav(os.path.join(OUTPUT_DIR, "undercover_win.wav"), final_audio, SAMPLE_RATE)

if __name__ == "__main__":
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    generate_civilian_win()
    generate_undercover_win()
    print("Done.")
