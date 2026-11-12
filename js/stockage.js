// ---------- Stockage permanent ----------
// Avec serveur.py, les données ku_* sont gardées dans donnees/kamasultra.json :
// au chargement le fichier remplit le localStorage, puis chaque modification
// y est recopiée. Sans serveur (fichier ouvert directement, GitHub Pages),
// le site fonctionne comme avant, avec le seul stockage du navigateur.
(function () {
  var PREFIX = 'ku_', API = 'api/donnees';
  var st = { mode: 'navigateur', erreur: '', silence: false };
  var timer = null, enCours = null, aRefaire = false;

  function cles() {
    var k = [];
    for (var i = 0; i < localStorage.length; i++) {
      var c = localStorage.key(i);
      if (c && c.indexOf(PREFIX) === 0) k.push(c);
    }
    return k;
  }
  function instantane() {
    var d = {};
    cles().forEach(function (k) { d[k] = localStorage.getItem(k); });
    return d;
  }

  // Bandeau d'état (page Sauvegarde) et alerte en cas d'échec d'écriture
  function afficher() {
    document.documentElement.setAttribute('data-stockage', st.mode);
    var n = document.getElementById('stkEtat');
    if (n) {
      n.className = 'bk-sum stk-' + (st.erreur ? 'err' : st.mode);
      n.textContent = st.erreur
        ? '⚠️ Enregistrement sur le disque impossible (' + st.erreur + '). Tes dernières modifications ne sont que dans le navigateur.'
        : st.mode === 'disque'
          ? '✅ Données enregistrées sur ton ordinateur, dans le dossier « donnees » de KamasUltra.'
          : 'ℹ️ Données gardées dans ce navigateur uniquement. Lance KamasUltra avec serveur.py pour les garder sur le disque.';
    }
    var b = document.getElementById('stkAlerte');
    if (b) b.hidden = !st.erreur;
  }

  function envoyer(keepalive) {
    var corps = JSON.stringify({ data: instantane() });
    return fetch(API, {
      method: 'PUT', body: corps, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-KamasUltra': '1' },
      keepalive: !!keepalive && corps.length < 60000 // limite du navigateur pour keepalive
    }).then(function (r) {
      if (!r.ok) throw new Error('erreur ' + r.status);
      if (st.erreur) { st.erreur = ''; afficher(); }
    }).catch(function (e) {
      st.erreur = e && e.message && e.message !== 'Failed to fetch' ? e.message : 'serveur arrêté ?';
      afficher();
    });
  }
  // Un seul envoi à la fois, dans l'ordre : le dernier état gagne toujours
  function flush() {
    clearTimeout(timer); timer = null;
    if (st.mode !== 'disque') return Promise.resolve();
    if (enCours) { aRefaire = true; return enCours; }
    enCours = envoyer(false).then(function () {
      enCours = null;
      if (aRefaire) { aRefaire = false; return flush(); }
    });
    return enCours;
  }
  function planifier() {
    if (st.mode !== 'disque' || st.silence) return;
    clearTimeout(timer);
    timer = setTimeout(flush, 300);
  }

  // Toute écriture ku_* du site passe par ici, sans rien changer dans app.js
  var P = Storage.prototype, set = P.setItem, rm = P.removeItem, clr = P.clear;
  P.setItem = function (k, v) {
    set.call(this, k, v);
    if (this === window.localStorage && String(k).indexOf(PREFIX) === 0) planifier();
  };
  P.removeItem = function (k) {
    rm.call(this, k);
    if (this === window.localStorage && String(k).indexOf(PREFIX) === 0) planifier();
  };
  P.clear = function () {
    clr.call(this);
    if (this === window.localStorage) planifier();
  };

  // Onglet fermé ou mis en arrière-plan : on n'attend pas la fin du délai
  function partir() { if (timer) { clearTimeout(timer); timer = null; envoyer(true); } }
  window.addEventListener('pagehide', partir);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') partir(); });

  window.kuStockage = { flush: flush, mode: function () { return st.mode; } };

  function charger() {
    if (!/^https?:$/.test(location.protocol)) return Promise.resolve();
    return fetch(API, { cache: 'no-store' }).then(function (r) {
      var type = r.headers.get('Content-Type') || '';
      if (!r.ok || type.indexOf('application/json') < 0) return;
      return r.json().then(function (j) {
        if (!j || j.app !== 'KamasUltra') return; // pas notre serveur (hébergement statique)
        st.mode = 'disque';
        if (j.absent) { flush(); return; } // premier lancement : on recopie le navigateur sur le disque
        if (!j.data || typeof j.data !== 'object') return;
        st.silence = true;
        try {
          cles().forEach(function (k) { if (!(k in j.data)) rm.call(localStorage, k); });
          Object.keys(j.data).forEach(function (k) {
            if (k.indexOf(PREFIX) === 0 && typeof j.data[k] === 'string') set.call(localStorage, k, j.data[k]);
          });
        } finally { st.silence = false; }
      });
    }).catch(function () { /* pas de serveur : stockage du navigateur seul */ });
  }

  function demarrer() {
    afficher();
    var s = document.createElement('script');
    s.src = 'js/app.js';
    s.onload = afficher;
    document.body.appendChild(s);
  }
  charger().then(demarrer, demarrer);
})();
