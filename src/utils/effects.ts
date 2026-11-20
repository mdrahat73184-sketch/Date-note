import confetti from 'canvas-confetti';

const CELEBRATION_COLORS = ['#B91C3B', '#5C7C65', '#E8A5AE', '#F4C97A', '#DF7E8D'];
const MUTE_STORAGE_KEY = 'date_proposal_sound_muted_v1';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {
      // Ignore autoplay resume rejection before gesture
    });
  }

  return audioCtx;
}

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

function canPlaySound(): boolean {
  if (typeof window === 'undefined') return false;
  if (isSoundMuted()) return false;
  return true;
}

/**
 * Resolves the best cross-device shareable origin.
 * In AI Studio, `ais-dev-*` preview URLs require the creator's developer login,
 * whereas `ais-pre-*` is the public/shared app URL for other people's phones.
 */
export function getShareableOrigin(): { origin: string; isDevPreview: boolean } {
  if (typeof window === 'undefined') {
    return { origin: '', isDevPreview: false };
  }
  const current = window.location.origin;
  if (current.startsWith('https://ais-dev-')) {
    return {
      origin: current.replace('https://ais-dev-', 'https://ais-pre-'),
      isDevPreview: true,
    };
  }
  return { origin: current, isDevPreview: false };
}

/**
 * Subtle warm "pop" for standard UI taps (plan pills, selections, copy, submit).
 */
export function playPopSound(): void {
  if (!canPlaySound()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.045);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.065);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  } catch {
    // Ignore Web Audio errors
  }
}

/**
 * Light playful blip when the "No" button dodges away.
 */
export function playDodgeSound(): void {
  if (!canPlaySound()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.065);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // Ignore Web Audio errors
  }
}

/**
 * Playful rising squeeze "pop" when receiver tries to make sender pay (taps 1-4).
 */
export function playShrinkSound(tapNumber: number): void {
  if (!canPlaySound()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const baseFreq = 380 + Math.min(tapNumber, 5) * 85;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, now + 0.055);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  } catch {
    // Ignore Web Audio errors
  }
}

/**
 * Warm, affectionate two-note chime when sender insists on paying (taps 1-4).
 */
export function playGenerousShrinkSound(tapNumber: number): void {
  if (!canPlaySound()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const base = 440 + Math.min(tapNumber, 5) * 55;
    [base, base * 1.25].forEach((freq, idx) => {
      const start = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.15);
    });
  } catch {
    // Ignore Web Audio errors
  }
}

/**
 * Soft airy "poof!" (filtered noise puff + sparkle drop) when the card disappears on tap 5.
 */
export function playPoofSound(): void {
  if (!canPlaySound()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const duration = 0.22;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(360, now + duration);
    filter.Q.value = 1.2;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.11, now + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.16);

    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.linearRampToValueAtTime(0.06, now + 0.012);
    oscGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.17);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    // Ignore Web Audio errors
  }
}

/**
 * Warm ascending sparkle poof when the "I'll treat" card vanishes because sender insists on paying.
 */
export function playSparklePoofSound(): void {
  if (!canPlaySound()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880, 1174.66]; // D5 major sparkle
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch {
    // Ignore Web Audio errors
  }
}

/**
 * Warm, gentle celebratory chime (used when clicking YES or sealing the letter).
 */
export function playCelebrationChime(): void {
  if (!canPlaySound()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.4);
    });
  } catch {
    // Ignore Web Audio errors
  }
}

/**
 * Multi-angle confetti explosion using canvas-confetti.
 */
export function fireConfettiExplosion(style: 'yes' | 'sealed' = 'yes'): void {
  if (typeof window === 'undefined') return;

  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) return;

  try {
    if (style === 'yes') {
      void confetti({
        particleCount: 75,
        spread: 72,
        startVelocity: 42,
        origin: { y: 0.62 },
        colors: CELEBRATION_COLORS,
        disableForReducedMotion: true,
      });

      window.setTimeout(() => {
        void confetti({
          particleCount: 40,
          angle: 60,
          spread: 55,
          origin: { x: 0.12, y: 0.68 },
          colors: CELEBRATION_COLORS,
          disableForReducedMotion: true,
        });
        void confetti({
          particleCount: 40,
          angle: 120,
          spread: 55,
          origin: { x: 0.88, y: 0.68 },
          colors: CELEBRATION_COLORS,
          disableForReducedMotion: true,
        });
      }, 180);
    } else {
      void confetti({
        particleCount: 65,
        angle: 60,
        spread: 65,
        startVelocity: 45,
        origin: { x: 0.08, y: 0.65 },
        colors: CELEBRATION_COLORS,
        disableForReducedMotion: true,
      });
      void confetti({
        particleCount: 65,
        angle: 120,
        spread: 65,
        startVelocity: 45,
        origin: { x: 0.92, y: 0.65 },
        colors: CELEBRATION_COLORS,
        disableForReducedMotion: true,
      });

      window.setTimeout(() => {
        void confetti({
          particleCount: 55,
          spread: 95,
          startVelocity: 32,
          origin: { y: 0.55 },
          colors: CELEBRATION_COLORS,
          disableForReducedMotion: true,
        });
      }, 240);
    }
  } catch {
    // Ignore canvas errors in unsupported environments
  }
}
