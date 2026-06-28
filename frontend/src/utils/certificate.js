/**
 * certificate.js — Imprime un documento HTML como PDF (lado cliente).
 *
 * El HTML del certificado lo renderiza ahora el backend
 * (GET /attempts/:id/certificate/), que aplica la regla "solo aprobados". Aquí solo
 * queda el mecanismo de impresión: escribir el HTML en un iframe oculto y abrir el
 * diálogo de impresión del navegador ("Guardar como PDF").
 */

export function printHtml(html) {
  if (!html) return;

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
