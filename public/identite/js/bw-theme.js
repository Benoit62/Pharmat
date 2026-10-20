/* bw-theme.js — pose le thème avant le premier affichage (à charger dans <head>, sans defer).
   Même règle que bw-ui.js : choix mémorisé (clé bw-theme : clair | sombre | systeme), sinon
   <html data-theme-defaut="…">, sinon « systeme ». */
(function () {
  var r = document.documentElement, v = null;
  try { v = localStorage.getItem('bw-theme'); } catch (e) { /* stockage indisponible */ }
  if (v !== 'clair' && v !== 'sombre' && v !== 'systeme') v = r.getAttribute('data-theme-defaut') || 'systeme';
  if (v === 'clair') r.setAttribute('data-theme', 'light');
  else if (v === 'sombre') r.setAttribute('data-theme', 'dark');
  else r.removeAttribute('data-theme');
})();
