/* pharmat.js — les quelques comportements qui demandent du JavaScript. Tout le reste est fait
   de formulaires classiques : l'application fonctionne aussi sans ce fichier. */
(function () {
  'use strict';

  // 1. Confirmation avant une action irréversible : <form data-confirmer="Question ?">
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.matches('[data-confirmer]') && !f.dataset.confirme && !window.confirm(f.dataset.confirmer)) e.preventDefault();
  });

  // 2. Partie : touches A à E pour cocher, Entrée pour valider
  var formulaire = document.getElementById('formulaire-question');
  if (formulaire) {
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || /^(TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.target.tagName === 'INPUT' && !/^(checkbox|radio)$/.test(e.target.type)) return;
      var lettre = e.key.length === 1 ? e.key.toUpperCase() : '';
      var case_ = formulaire.querySelector('input[data-lettre="' + lettre + '"]');
      if (case_) {
        e.preventDefault();
        case_.checked = case_.type === 'radio' ? true : !case_.checked;
        case_.focus({ preventScroll: true });
      } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
        e.preventDefault();
        var bouton = formulaire.querySelector('button[value="suivante"]');
        formulaire.requestSubmit(bouton);
      }
    });
  }

  // 3. Chronomètre d'examen : compte à rebours, puis copie rendue avec la réponse en cours
  var chrono = document.querySelector('.pm-chrono[data-fin]');
  if (chrono) {
    var fin = Number(chrono.dataset.fin);
    var texte = chrono.querySelector('span');
    var rendu = false;
    var tic = function () {
      var reste = Math.max(0, Math.round((fin - Date.now()) / 1000));
      var h = Math.floor(reste / 3600), m = Math.floor((reste % 3600) / 60), s = reste % 60;
      texte.textContent = (h ? h + ' h ' : '') + String(m).padStart(h ? 2 : 1, '0') + ' min ' + String(s).padStart(2, '0') + ' s';
      chrono.classList.toggle('est-court', reste <= 300);
      if (reste === 0 && !rendu && formulaire) {
        rendu = true;
        var champ = document.createElement('input');
        champ.type = 'hidden'; champ.name = 'action'; champ.value = 'terminer';
        formulaire.appendChild(champ);
        formulaire.submit();
      }
    };
    tic();
    setInterval(tic, 1000);
  }

  // 4. Import de questions (administration) : fichiers lus ici, envoyés en JSON
  var depot = document.getElementById('depot');
  if (depot) {
    var entree = document.getElementById('fichiers');
    var rapport = document.getElementById('rapport');
    var afficher = function (html, type) {
      rapport.innerHTML = '<div class="bw-message bw-message--' + type + '"><svg class="bw-icone" aria-hidden="true"><use href="/identite/icones/icones.svg#' + (type === 'succes' ? 'circle-check' : type === 'erreur' ? 'circle-x' : 'info') + '"/></svg><div>' + html + '</div></div>';
    };
    var echapper = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    var envoyer = function (fichiers) {
      if (!fichiers.length) return;
      afficher('<p>Lecture de ' + fichiers.length + ' fichier(s)…</p>', 'info');
      Promise.all(Array.prototype.map.call(fichiers, function (f) {
        return f.text().then(function (t) {
          var d = JSON.parse(t);
          return Array.isArray(d) ? d : (d.questions || []);
        }).catch(function () { throw new Error('« ' + f.name + ' » n’est pas un fichier JSON lisible.'); });
      })).then(function (listes) {
        var questions = [].concat.apply([], listes);
        return fetch('/admin/questions-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: questions }),
        }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || 'Erreur du serveur.'); return j; }); });
      }).then(function (r) {
        var html = '<p><strong>' + r.ajoutees + ' ajoutée(s), ' + r.modifiees + ' mise(s) à jour, ' + r.refusees.length + ' refusée(s).</strong></p>';
        if (r.refusees.length) html += '<ul>' + r.refusees.slice(0, 50).map(function (x) { return '<li>n° ' + x.rang + ' : ' + echapper(x.raison) + '</li>'; }).join('') + '</ul>';
        afficher(html, r.refusees.length ? 'attention' : 'succes');
      }).catch(function (err) { afficher('<p>' + echapper(err.message) + '</p>', 'erreur'); });
    };
    entree.addEventListener('change', function () { envoyer(entree.files); entree.value = ''; });
    ['dragenter', 'dragover'].forEach(function (t) { depot.addEventListener(t, function (e) { e.preventDefault(); depot.classList.add('est-survol'); }); });
    ['dragleave', 'drop'].forEach(function (t) { depot.addEventListener(t, function () { depot.classList.remove('est-survol'); }); });
    depot.addEventListener('drop', function (e) { e.preventDefault(); envoyer(e.dataTransfer.files); });
  }
})();
