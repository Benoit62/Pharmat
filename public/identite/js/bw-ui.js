/* bw-ui.js — petits comportements du kit (aucune dépendance).
   1. Sélecteur de thème : boutons [data-theme-choix="systeme|clair|sombre"], où qu'ils soient
      (en-tête, menu mobile…). Thème par défaut : <html data-theme-defaut="clair|sombre|systeme">,
      « systeme » si l'attribut est absent. Choix mémorisé sous la clé bw-theme (partagée par
      tous les sites). Charger bw-theme.js dans <head> pour éviter un éclair au chargement.
   2. Onglets : conteneur [data-bw-onglets] avec role="tab" / role="tabpanel"
   3. Menu mobile : se referme après un clic sur un lien, ou par Échap
   4. Filtres : groupe [data-bw-filtres="id de la liste"] de .bw-filtre[data-filtre] ;
      éléments de la liste avec data-categories="a b c" ; « tous » montre tout. */
(function () {
  'use strict';
  var racine = document.documentElement;
  var CLE = 'bw-theme';
  var CHOIX = ['clair', 'sombre', 'systeme'];

  function parDefaut() {
    var d = racine.getAttribute('data-theme-defaut');
    return CHOIX.indexOf(d) >= 0 ? d : 'systeme';
  }
  function lire() {
    var v = null;
    try { v = localStorage.getItem(CLE); } catch (e) { /* stockage indisponible */ }
    return CHOIX.indexOf(v) >= 0 ? v : parDefaut();
  }
  function ecrire(v) { try { localStorage.setItem(CLE, v); } catch (e) { /* stockage indisponible : on ignore */ } }

  function appliquer(choix) {
    if (choix === 'clair') racine.setAttribute('data-theme', 'light');
    else if (choix === 'sombre') racine.setAttribute('data-theme', 'dark');
    else racine.removeAttribute('data-theme');
    document.querySelectorAll('[data-theme-choix]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-choix') === choix));
    });
  }

  function onglets() {
    document.querySelectorAll('[data-bw-onglets]').forEach(function (bloc) {
      var liste = Array.prototype.slice.call(bloc.querySelectorAll('[role="tab"]'));
      function activer(o, focus) {
        liste.forEach(function (x) {
          var actif = x === o;
          x.setAttribute('aria-selected', String(actif));
          x.tabIndex = actif ? 0 : -1;
          var p = document.getElementById(x.getAttribute('aria-controls'));
          if (p) p.hidden = !actif;
        });
        if (focus) o.focus();
      }
      liste.forEach(function (o, i) {
        o.addEventListener('click', function () { activer(o); });
        o.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight') activer(liste[(i + 1) % liste.length], true);
          if (e.key === 'ArrowLeft') activer(liste[(i - 1 + liste.length) % liste.length], true);
        });
      });
    });
  }

  function menus() {
    document.querySelectorAll('.bw-menu-mobile').forEach(function (d) {
      d.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { d.open = false; }); });
      d.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { d.open = false; var s = d.querySelector('summary'); if (s) s.focus(); }
      });
    });
  }

  function filtres() {
    document.querySelectorAll('[data-bw-filtres]').forEach(function (groupe) {
      var liste = document.getElementById(groupe.getAttribute('data-bw-filtres'));
      if (!liste) return;
      var boutons = groupe.querySelectorAll('[data-filtre]');
      var vide = liste.parentNode.querySelector('.bw-filtres__vide');
      boutons.forEach(function (b) {
        b.addEventListener('click', function () {
          var f = b.getAttribute('data-filtre'), n = 0;
          Array.prototype.forEach.call(liste.children, function (el) {
            var ok = f === 'tous' || (' ' + (el.getAttribute('data-categories') || '') + ' ').indexOf(' ' + f + ' ') >= 0;
            el.hidden = !ok;
            if (ok) n++;
          });
          liste.classList.toggle('bw-cartes--filtre', f !== 'tous');
          boutons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          if (vide) vide.hidden = n > 0;
        });
      });
    });
  }

  function init() {
    appliquer(lire());
    document.querySelectorAll('[data-theme-choix]').forEach(function (b) {
      b.addEventListener('click', function () { var v = b.getAttribute('data-theme-choix'); ecrire(v); appliquer(v); });
    });
    onglets();
    menus();
    filtres();
    document.querySelectorAll('form[data-bw-demo]').forEach(function (f) {
      f.addEventListener('submit', function (e) { e.preventDefault(); var m = f.querySelector('[data-bw-confirmation]'); if (m) m.hidden = false; });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
