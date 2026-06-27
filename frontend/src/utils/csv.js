/**
 * csv.js — Utilidades CSV compartidas (fuente única de verdad).
 *
 * Centraliza el escapado de celdas y la descarga de CSV para que todas las
 * exportaciones del cliente apliquen la MISMA protección contra inyección de
 * fórmulas. Antes cada página tenía su propio escaper y algunos (p. ej. el
 * export de errores de importación, que re-exporta datos subidos por el
 * usuario) no neutralizaban fórmulas → riesgo de CSV formula injection al
 * abrir el archivo en Excel/Sheets.
 */

/**
 * Escapa un valor para una celda CSV:
 * 1. Neutraliza inyección de fórmulas — Excel/Sheets ejecutan celdas que
 *    empiezan por `= + - @`, tab o CR; se les antepone una comilla simple.
 * 2. RFC 4180 — entrecomilla si contiene coma, comillas o salto de línea.
 */
export function csvField(value) {
  const s = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Serializa filas (array de arrays de celdas) a un string CSV con BOM UTF-8
 * (para que Excel detecte el encoding y muestre bien tildes/ñ). EOL CRLF por
 * defecto, conforme a RFC 4180.
 */
export function rowsToCsv(rows, eol = '\r\n') {
  return '﻿' + rows.map(row => row.map(csvField).join(',')).join(eol) + eol;
}

/** Dispara la descarga de un CSV en el navegador a partir de filas de celdas. */
export function downloadCsv(filename, rows, eol = '\r\n') {
  const blob = new Blob([rowsToCsv(rows, eol)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
