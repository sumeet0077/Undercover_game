export const playWinSound = (winner) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (winner === 'CIVILIANS') {
        // Happy C Major Arpeggio (C4, E4, G4, C5)
        [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle'; // Smooth but bright
            osc.frequency.setValueAtTime(freq, now + i * 0.1);

            gain.gain.setValueAtTime(0, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.6);
        });

        // Add a little "ding" at the end
        setTimeout(() => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1046.50, ctx.currentTime);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        }, 400);

    } else {
        // UNDERCOVERS / MR WHITE: Dark, suspenseful chord
        // Dissonant Cluster (C#3, G3, C4)
        [138.59, 196.00, 261.63].forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth'; // Rough sound
            osc.frequency.setValueAtTime(freq, now);

            // Slow fade in
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 1);
            gain.gain.linearRampToValueAtTime(0, now + 3); // Long decay

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 3);
        });

        // Deep bass thud
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 1); // Pitch drop
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.5);
    }
};

export const playRoleSound = (role) => {
    // Reuse win sounds but INVERTED for elimination:
    // Civilian died = BAD = Play Danger Sound (Undercovers theme)
    // Imposter died = GOOD = Play Happy Sound (Civilians theme)
    const soundTheme = role === 'CIVILIAN' ? 'UNDERCOVERS' : 'CIVILIANS';
    playWinSound(soundTheme);
};
