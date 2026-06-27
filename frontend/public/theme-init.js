// Aplicar tema guardado antes del primer paint para evitar flash (FOUC).
// Externalizado de index.html para poder usar una CSP sin script-src 'unsafe-inline'.
(function () {
  try {
    var t = localStorage.getItem('edutest_theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
