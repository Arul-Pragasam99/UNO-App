// ─── Haptic Vibration Feedback ─────────────────────────────────────────────────
// Uses Vibration API (Android) with AudioContext fallback for iOS

let audioContext: AudioContext | null = null;

const initAudioContext = () => {
  if (typeof window !== 'undefined' && !audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
};

const playBeep = (duration: number, frequency: number = 440) => {
  if (!audioContext) return;
  
  // Resume if suspended (iOS requires user interaction)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.00001, now + duration / 1000);
  
  oscillator.start();
  oscillator.stop(now + duration / 1000);
};

const canVibrate = (): boolean => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
};

const vibrate = (pattern: number | number[]): void => {
  if (canVibrate()) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently fail
    }
  } else {
    // iOS fallback - play beeps
    const patternArray = Array.isArray(pattern) ? pattern : [pattern];
    let time = 0;
    for (let i = 0; i < patternArray.length; i++) {
      const duration = patternArray[i];
      setTimeout(() => {
        playBeep(duration, i % 2 === 0 ? 440 : 880);
      }, time);
      time += duration + (patternArray[i + 1] || 0);
    }
  }
};

// Initialize on first user interaction
export const initHaptics = () => {
  initAudioContext();
};

export const vibrateGameStart = (): void => {
  vibrate([100, 50, 100, 50, 100]);
};

export const vibrateCardPlay = (): void => {
  vibrate([30]);
};

export const vibrateDrawTwo = (): void => {
  vibrate([150, 100, 150]);
};

export const vibrateDrawFour = (): void => {
  vibrate([100, 50, 150, 50, 200, 50, 250]);
};

export const vibrateUnoCall = (): void => {
  vibrate([300, 100, 300]);
};

export const vibrateWin = (): void => {
  vibrate([100, 50, 100, 50, 100, 100, 200, 100, 300]);
};

export const vibrateError = (): void => {
  vibrate([50, 100, 50]);
};

export const vibrateSkip = (): void => {
  vibrate([200]);
};

export const vibrateReverse = (): void => {
  vibrate([80, 40, 80, 40, 80]);
};