// ─── Haptic Vibration Feedback ─────────────────────────────────────────────────
// Uses the Vibration API (Android Chrome) with iOS AudioContext fallback

const canVibrate = (): boolean => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
};

const vibrate = (pattern: number | number[]): void => {
  if (canVibrate()) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently fail — some browsers block vibration without user gesture
    }
  }
};

// ─── Game Event Vibrations ─────────────────────────────────────────────────────

/** Triple short buzz for game start */
export const vibrateGameStart = (): void => {
  vibrate([100, 50, 100, 50, 100]);
};

/** Quick tap for playing a card */
export const vibrateCardPlay = (): void => {
  vibrate([30]);
};

/** Double medium buzz for +2 */
export const vibrateDrawTwo = (): void => {
  vibrate([150, 100, 150]);
};

/** Strong escalating pattern for +4 */
export const vibrateDrawFour = (): void => {
  vibrate([100, 50, 150, 50, 200, 50, 250]);
};

/** Long dramatic buzz for UNO call */
export const vibrateUnoCall = (): void => {
  vibrate([300, 100, 300]);
};

/** Celebration pattern for winning */
export const vibrateWin = (): void => {
  vibrate([100, 50, 100, 50, 100, 100, 200, 100, 300]);
};

/** Error double tap for invalid action */
export const vibrateError = (): void => {
  vibrate([50, 100, 50]);
};

/** Skip turn — single strong pulse */
export const vibrateSkip = (): void => {
  vibrate([200]);
};

/** Reverse — alternating pattern */
export const vibrateReverse = (): void => {
  vibrate([80, 40, 80, 40, 80]);
};
