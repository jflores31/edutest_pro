/**
 * score.js — Fuente única de verdad del umbral de aprobación en el frontend.
 *
 * Escala vigesimal 0–20. Debe coincidir con `PASS_THRESHOLD` de
 * `backend/services/exam_engine.py`. No repitas el número en otros archivos:
 * importa `PASS_THRESHOLD` / `isPassing` desde aquí.
 */
export const PASS_THRESHOLD = 14;
export const SCORE_MAX = 20;

/** ¿La nota aprueba? (>= umbral). `null`/`undefined` → false. */
export function isPassing(score) {
  return score != null && Number(score) >= PASS_THRESHOLD;
}

/** Tono semántico para una nota: 'ok' si aprueba, 'danger' si no, 'neutral' si no hay nota. */
export function scoreTone(score) {
  if (score == null) return 'neutral';
  return isPassing(score) ? 'ok' : 'danger';
}
