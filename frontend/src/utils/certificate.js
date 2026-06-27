/**
 * certificate.js — Constancia de examen imprimible (cliente).
 *
 * Genera un documento limpio en un iframe oculto y abre el diálogo de impresión
 * del navegador, donde el alumno puede "Guardar como PDF". No requiere backend ni
 * dependencias: el token del alumno es inválido tras finalizar el examen (por
 * diseño: solo vale IN_PROGRESS y se revoca al entregar), así que un endpoint de
 * servidor no podría servir la constancia post-entrega sin un canal de auth aparte.
 */
import { PASS_THRESHOLD, SCORE_MAX } from './score';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function printCertificate({
  name = '',
  examTitle = '',
  score = null,
  scoreMax = SCORE_MAX,
  passed = false,
  date = new Date(),
}) {
  const ok = '#059669';
  const danger = '#e11d48';
  const accent = '#7c3aed';
  const color = passed ? ok : danger;
  const status = passed ? 'APROBADO' : 'DESAPROBADO';
  const dateStr = date.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });

  const scoreBlock = score != null
    ? `<div class="score" style="color:${color}">${Number(score).toFixed(1)}<span class="max">/${scoreMax}</span></div>
       <div class="status" style="background:${color}">${status}</div>`
    : `<div class="status" style="background:${accent}">EXAMEN COMPLETADO</div>`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Constancia de examen</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 40px; }
  .card { max-width: 640px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; }
  .bar { background: ${accent}; color: #fff; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; }
  .bar h1 { font-size: 18px; letter-spacing: .04em; }
  .bar .brand { font-size: 13px; font-weight: 700; opacity: .9; }
  .body { padding: 40px 28px; text-align: center; }
  .intro { color: #64748b; font-size: 13px; }
  .name { font-size: 26px; font-weight: 800; margin: 10px 0 14px; }
  .exam { font-size: 14px; color: #0f172a; }
  .exam b { font-weight: 700; }
  .score { font-size: 56px; font-weight: 800; margin: 28px 0 12px; line-height: 1; }
  .score .max { font-size: 22px; color: #64748b; font-weight: 400; }
  .status { display: inline-block; color: #fff; font-weight: 700; font-size: 13px; letter-spacing: .05em; padding: 8px 18px; border-radius: 999px; }
  .meta { margin-top: 28px; font-size: 12px; color: #64748b; }
  .foot { margin-top: 12px; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 0; } .card { border: none; } @page { margin: 18mm; } }
</style></head>
<body>
  <div class="card">
    <div class="bar"><h1>CONSTANCIA DE EXAMEN</h1><span class="brand">EduTest Pro</span></div>
    <div class="body">
      <p class="intro">Se deja constancia de que</p>
      <p class="name">${esc(name) || '—'}</p>
      <p class="exam">rindió el examen <b>${esc(examTitle) || '—'}</b> y obtuvo la siguiente calificación:</p>
      ${scoreBlock}
      <p class="meta">Fecha: ${esc(dateStr)}</p>
      <p class="foot">Documento generado por EduTest Pro · Nota mínima de aprobación: ${PASS_THRESHOLD}/${scoreMax}</p>
    </div>
  </div>
</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => { try { iframe.remove(); } catch { /* ya removido */ } };
  iframe.contentWindow.onafterprint = cleanup;

  // Damos un instante a que el iframe renderice antes de imprimir.
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      cleanup();
    }
  }, 250);

  // Limpieza de respaldo por si onafterprint no dispara.
  setTimeout(cleanup, 60000);
}
