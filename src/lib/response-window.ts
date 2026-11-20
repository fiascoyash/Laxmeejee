export const RESPONSE_WINDOW_MS = 15 * 60 * 1000;

/** Milliseconds left in the 15-minute reply window (negative once overdue). */
export function responseMsLeft(createdAt: string | number | Date, now: number = Date.now()): number {
  return new Date(createdAt).getTime() + RESPONSE_WINDOW_MS - now;
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
