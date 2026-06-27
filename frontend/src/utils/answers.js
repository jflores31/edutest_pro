/**
 * answers.js — Fuente única de verdad de "¿esta respuesta cuenta como respondida?".
 *
 * Maneja correctamente todos los tipos de respuesta del examen:
 *  - opción única / V-F: string ("A") o boolean (true/false) → `false` SÍ cuenta
 *  - opción múltiple: array → cuenta solo si tiene al menos un elemento
 *  - respuesta corta: string → cuenta solo si no está vacía
 *
 * Antes esto se calculaba inline con `!value || value === ''`, que marcaba como
 * "sin responder" una respuesta booleana "Falso" y como "respondida" una múltiple vacía.
 */
export function isAnswered(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true; // boolean (incluido false), number, etc.
}
