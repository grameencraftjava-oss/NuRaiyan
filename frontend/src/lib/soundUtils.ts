// Audio synthesis utility with Web Audio API
// Supports high-gain sound boosting for extra loud calls, messages, and notifications

export interface SoundSettings {
  callTone: string;
  callVolume: number; // 0 to 100
  callEnabled: boolean;
  messageTone: string;
  messageVolume: number; // 0 to 100
  messageEnabled: boolean;
  notificationTone: string;
  notificationVolume: number; // 0 to 100
  notificationEnabled: boolean;
  superLoud: boolean; // Gain booster up to 2.5x with dynamic limiter
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  callTone: 'HIGH_DECIBEL_PULSE',
  callVolume: 100,
  callEnabled: true,
  messageTone: 'SONIC_SNAP',
  messageVolume: 100,
  messageEnabled: true,
  notificationTone: 'HIGH_CHIME',
  notificationVolume: 100,
  notificationEnabled: true,
  superLoud: true, // Default to super loud mode
};

export const CALL_TONES = [
  { id: 'HIGH_DECIBEL_PULSE', name: 'High-Decibel Pulse', desc: 'Loud rapid high-pitch dual burst, maximum penetration' },
  { id: 'SONIC_EMERGENCY', name: 'Sonic Emergency', desc: 'Ultra-sharp piercing klaxon alert siren' },
  { id: 'RETRO_TELEPHONE', name: 'Vintage Bell Phone', desc: 'Loud classic mechanical ringing bell, impossible to miss' },
  { id: 'TECHNO_STORM', name: 'Techno Strobe', desc: 'High-energy driving electronic hook' },
  { id: 'TRADITIONAL_LOUD', name: 'Classic Digital Ring', desc: 'Loud twin-tone digital ring' },
  { id: 'CYBER_RADAR', name: 'Cyber Radar Pulse', desc: 'High-pitch futuristic urgent pulse' },
  { id: 'ALARM_CHIME', name: 'Piercing Alarm Siren', desc: 'High-frequency piercing siren alert' },
  { id: 'MARIMBA_BEAT', name: 'Marimba Vibe', desc: 'Energetic melodic marimba beat' },
  { id: 'PARTY_SYNTH', name: 'Electro Synth Anthem', desc: 'Upbeat rich electronic chord loop' },
];

export const MESSAGE_TONES = [
  { id: 'SONIC_SNAP', name: 'Sonic High Snap', desc: 'Instantaneous piercing acoustic pop' },
  { id: 'DOUBLE_DING', name: 'Loud Double Ding', desc: 'Piercing dual brass high chime' },
  { id: 'LASER_BURST', name: 'Laser Rapid Pulse', desc: 'High-gain futuristic laser ping' },
  { id: 'NEON_CHORD', name: 'Neon Treble Strike', desc: 'Brilliant high treble synth hit' },
  { id: 'CRISP_POP', name: 'Loud Crisp Pop', desc: 'Instant punchy high bubble' },
  { id: 'CRYSTAL_CHIME', name: 'Crystal Glass Chime', desc: 'Two-tone bright glass chime' },
  { id: 'BOUNCY_PING', name: 'Bouncy Harmonic Ping', desc: 'High resonance harmonic ping' },
  { id: 'DIGITAL_BEEP', name: 'Modern Digital Chirp', desc: 'Swift dual-tone electronic beep' },
  { id: 'WHISTLE', name: 'Bright Rising Whistle', desc: 'Rising loud whistle tone' },
];

export const NOTIFICATION_TONES = [
  { id: 'HIGH_CHIME', name: 'Ultra High Chime', desc: 'Crystal clear 2.4kHz penetrating chime' },
  { id: 'ALERT_BUGLE', name: 'Rapid Alert Horn', desc: 'Crisp brass bugle burst, impossible to miss' },
  { id: 'PIERCING_TINKLE', name: 'Echo Spark Bell', desc: 'Multi-octave piercing chime cascade' },
  { id: 'PUNCH_BELL', name: 'Punchy Brass Bell', desc: 'Heavy attack bright bell hit' },
  { id: 'URGENT_BELL', name: 'Urgent Resonant Bell', desc: 'High harmonic brass bell chime' },
  { id: 'MODERN_DING', name: 'Modern Crisp Ding', desc: 'Crisp clean high notification' },
  { id: 'MAGIC_SPARKLE', name: 'Magic Sparkle', desc: 'Ascending high sparkle shimmer' },
  { id: 'CYBER_PING', name: 'Cyber Swift Laser', desc: 'High punch fast notification' },
  { id: 'GENTLE_HARP', name: 'Acoustic Harp Splash', desc: 'Quick melodic acoustic chime' },
];

const STORAGE_KEY = 'nuraiyan_sound_settings';

export function getStoredSoundSettings(): SoundSettings {
  if (typeof window === 'undefined') return DEFAULT_SOUND_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SOUND_SETTINGS;
    return { ...DEFAULT_SOUND_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SOUND_SETTINGS;
  }
}

export function saveStoredSoundSettings(settings: SoundSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Creates a master output bus with treble enhancement and dynamic compression for maximum loudness without distortion
 */
function createMasterBus(ctx: AudioContext, baseGain: number) {
  // Treble boost peaking filter at 2.8kHz (peak human ear sensitivity)
  const trebleBoost = ctx.createBiquadFilter();
  trebleBoost.type = 'peaking';
  trebleBoost.frequency.setValueAtTime(2800, ctx.currentTime);
  trebleBoost.Q.setValueAtTime(1.1, ctx.currentTime);
  trebleBoost.gain.setValueAtTime(3.5, ctx.currentTime);

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-14, ctx.currentTime);
  compressor.knee.setValueAtTime(30, ctx.currentTime);
  compressor.ratio.setValueAtTime(12, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.2, ctx.currentTime);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(baseGain, ctx.currentTime);

  trebleBoost.connect(compressor);
  compressor.connect(masterGain);
  masterGain.connect(ctx.destination);

  return { compressor: trebleBoost, masterGain };
}

/**
 * Play System Notification Sound
 */
export function playSystemNotification(customSettings?: Partial<SoundSettings>) {
  const settings = { ...getStoredSoundSettings(), ...(customSettings || {}) };
  if (!settings.notificationEnabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const volumeFactor = Math.max(0.05, (settings.notificationVolume / 100));
  const boost = settings.superLoud ? 2.6 : 1.3;
  const targetGain = Math.min(2.8, volumeFactor * boost);

  const { compressor } = createMasterBus(ctx, targetGain);
  const now = ctx.currentTime;

  switch (settings.notificationTone) {
    case 'HIGH_CHIME': {
      // Penetrating 2.4kHz + 3.1kHz dual chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2349.32, now);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(3135.96, now);

      gain.gain.setValueAtTime(0.95, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(compressor);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.75);
      osc2.stop(now + 0.75);
      break;
    }

    case 'ALERT_BUGLE': {
      // Rapid trumpet bugle burst
      [783.99, 1046.5, 1318.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.08;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.connect(gain);
        gain.connect(compressor);

        osc.start(t);
        osc.stop(t + 0.35);
      });
      break;
    }

    case 'PIERCING_TINKLE': {
      // Cascade of high harmonic bells
      [1567.98, 2093.0, 2637.02].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.045;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.9, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc.connect(gain);
        gain.connect(compressor);

        osc.start(t);
        osc.stop(t + 0.45);
      });
      break;
    }

    case 'PUNCH_BELL': {
      // Punchy heavy attack brass chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(1174.66, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2349.32, now);

      gain.gain.setValueAtTime(0.95, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(compressor);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.7);
      osc2.stop(now + 0.7);
      break;
    }

    case 'MODERN_DING': {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.5, now);

      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(compressor);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.7);
      osc2.stop(now + 0.7);
      break;
    }

    case 'MAGIC_SPARKLE': {
      [1046.5, 1318.5, 1567.98].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + idx * 0.08;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.85, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.45);

        osc.connect(gain);
        gain.connect(compressor);

        osc.start(noteStart);
        osc.stop(noteStart + 0.5);
      });
      break;
    }

    case 'GENTLE_HARP': {
      [392.0, 493.88, 587.33, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + idx * 0.06;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.8, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.7);

        osc.connect(gain);
        gain.connect(compressor);

        osc.start(noteStart);
        osc.stop(noteStart + 0.75);
      });
      break;
    }

    case 'CYBER_PING': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1760, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);

      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(compressor);

      osc.start(now);
      osc.stop(now + 0.4);
      break;
    }

    case 'URGENT_BELL':
    default: {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, now);
      osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.12);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, now);

      gain.gain.setValueAtTime(0.95, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(compressor);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.9);
      osc2.stop(now + 0.9);
      break;
    }
  }
}

/**
 * Play Message Chime Sound
 */
export function playMessageChime(customSettings?: Partial<SoundSettings>) {
  const settings = { ...getStoredSoundSettings(), ...(customSettings || {}) };
  if (!settings.messageEnabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const volumeFactor = Math.max(0.05, (settings.messageVolume / 100));
  const boost = settings.superLoud ? 2.6 : 1.3;
  const targetGain = Math.min(2.8, volumeFactor * boost);

  const { compressor } = createMasterBus(ctx, targetGain);
  const now = ctx.currentTime;

  switch (settings.messageTone) {
    case 'SONIC_SNAP': {
      // Piercing instantaneous snap
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(1480, now);
      osc1.frequency.exponentialRampToValueAtTime(2600, now + 0.07);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(2200, now);

      gain.gain.setValueAtTime(1.0, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(compressor);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
      break;
    }

    case 'DOUBLE_DING': {
      // Piercing dual high bell
      [1318.5, 1760].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.12;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

        osc.connect(gain);
        gain.connect(compressor);

        osc.start(t);
        osc.stop(t + 0.6);
      });
      break;
    }

    case 'LASER_BURST': {
      // 3 fast high laser chirps
      [0, 0.08, 0.16].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + offset;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2500, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.07);

        gain.gain.setValueAtTime(0.85, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

        osc.connect(gain);
        gain.connect(compressor);

        osc.start(t);
        osc.stop(t + 0.08);
      });
      break;
    }

    case 'NEON_CHORD': {
      // Bright treble synth chord strike
      [1046.5, 1318.5, 1567.98, 2093].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.75, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(compressor);

        osc.start(now);
        osc.stop(now + 0.55);
      });
      break;
    }

    case 'CRYSTAL_CHIME': {
      [659.25, 987.77].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.11;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.9, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);

        osc.connect(gain);
        gain.connect(compressor);

        osc.start(start);
        osc.stop(start + 0.65);
      });
      break;
    }

    case 'BOUNCY_PING': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.25);

      gain.gain.setValueAtTime(0.95, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(compressor);

      osc.start(now);
      osc.stop(now + 0.5);
      break;
    }

    case 'DIGITAL_BEEP': {
      [1046.5, 1318.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.09;

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.45, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

        osc.connect(gain);
        gain.connect(compressor);

        osc.start(start);
        osc.stop(start + 0.2);
      });
      break;
    }

    case 'WHISTLE': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.16);

      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(compressor);

      osc.start(now);
      osc.stop(now + 0.5);
      break;
    }

    case 'CRISP_POP':
    default: {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, now);

      gain.gain.setValueAtTime(0.95, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(compressor);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
      break;
    }
  }
}

/**
 * Play Incoming Call Ringtone in a repeating loop.
 * Returns a cancel/stop function.
 */
export function playCallRingtone(customSettings?: Partial<SoundSettings>): () => void {
  const settings = { ...getStoredSoundSettings(), ...(customSettings || {}) };
  if (!settings.callEnabled) return () => {};

  const ctx = getAudioContext();
  if (!ctx) return () => {};

  let isPlaying = true;
  let intervalId: any = null;

  const volumeFactor = Math.max(0.05, (settings.callVolume / 100));
  const boost = settings.superLoud ? 2.8 : 1.4;
  const targetGain = Math.min(3.0, volumeFactor * boost);

  const { compressor } = createMasterBus(ctx, targetGain);

  const playRingCycle = () => {
    if (!isPlaying || ctx.state === 'closed') return;
    const now = ctx.currentTime;

    switch (settings.callTone) {
      case 'HIGH_DECIBEL_PULSE': {
        // High penetrating dual-tone rapid burst
        [0, 0.16, 0.42, 0.58].forEach((offset) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + offset;

          osc1.type = 'sawtooth';
          osc1.frequency.setValueAtTime(2200, t);
          osc1.frequency.exponentialRampToValueAtTime(2600, t + 0.09);

          osc2.type = 'square';
          osc2.frequency.setValueAtTime(2800, t);

          gain.gain.setValueAtTime(0.85, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(compressor);

          osc1.start(t);
          osc2.start(t);
          osc1.stop(t + 0.13);
          osc2.stop(t + 0.13);
        });
        break;
      }

      case 'SONIC_EMERGENCY': {
        // Ultra-sharp alternating sirens
        [0, 0.28, 0.56, 0.84].forEach((offset, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + offset;
          const freq = idx % 2 === 0 ? 1760 : 2349;

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);
          osc.frequency.exponentialRampToValueAtTime(freq + 150, t + 0.2);

          gain.gain.setValueAtTime(0.9, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

          osc.connect(gain);
          gain.connect(compressor);

          osc.start(t);
          osc.stop(t + 0.24);
        });
        break;
      }

      case 'RETRO_TELEPHONE': {
        // Classic mechanical ringing phone bells
        [0, 0.45].forEach((burstOffset) => {
          for (let i = 0; i < 6; i++) {
            const t = now + burstOffset + i * 0.05;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(753, t);
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(853, t);

            gain.gain.setValueAtTime(0.75, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(compressor);

            osc1.start(t);
            osc2.start(t);
            osc1.stop(t + 0.05);
            osc2.stop(t + 0.05);
          }
        });
        break;
      }

      case 'TECHNO_STORM': {
        // Driving high synth arp
        [880, 1174, 1318, 1760, 1318, 1760, 2093].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + idx * 0.1;

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.75, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

          osc.connect(gain);
          gain.connect(compressor);

          osc.start(t);
          osc.stop(t + 0.1);
        });
        break;
      }

      case 'CYBER_RADAR': {
        [0, 0.22, 0.44].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + offset;

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(1200, t);
          osc.frequency.exponentialRampToValueAtTime(800, t + 0.12);

          gain.gain.setValueAtTime(0.7, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

          osc.connect(gain);
          gain.connect(compressor);

          osc.start(t);
          osc.stop(t + 0.16);
        });
        break;
      }

      case 'MARIMBA_BEAT': {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + idx * 0.14;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.9, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

          osc.connect(gain);
          gain.connect(compressor);

          osc.start(t);
          osc.stop(t + 0.28);
        });
        break;
      }

      case 'ALARM_CHIME': {
        [0, 0.25].forEach((offset, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + offset;

          osc.type = 'square';
          osc.frequency.setValueAtTime(idx === 0 ? 987.77 : 1318.5, t);

          gain.gain.setValueAtTime(0.55, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

          osc.connect(gain);
          gain.connect(compressor);

          osc.start(t);
          osc.stop(t + 0.22);
        });
        break;
      }

      case 'PARTY_SYNTH': {
        [440, 554.37, 659.25, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + idx * 0.12;

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.5, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

          osc.connect(gain);
          gain.connect(compressor);

          osc.start(t);
          osc.stop(t + 0.22);
        });
        break;
      }

      case 'TRADITIONAL_LOUD':
      default: {
        [0, 0.4].forEach((offset) => {
          [480, 560].forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const t = now + offset;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.9, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

            osc.connect(gain);
            gain.connect(compressor);

            osc.start(t);
            osc.stop(t + 0.32);
          });
        });
        break;
      }
    }
  };

  playRingCycle();
  intervalId = setInterval(() => {
    if (isPlaying) {
      playRingCycle();
    }
  }, 2200);

  return () => {
    isPlaying = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
