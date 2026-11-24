var TAX = 0.02; // taxe de mise en vente
var kuReady = false; // passe à vrai quand toute la page est initialisée

// ---------- Onglets ----------
var buttons = document.querySelectorAll('#nav button[data-tab]');
function navOpen(open) {
  document.body.classList.toggle('nav-open', open);
  document.getElementById('burger').setAttribute('aria-expanded', open ? 'true' : 'false');
}
// Sous-menus : ouvre le groupe de l'onglet actif, repère la page affichée
function navSync(name) {
  document.querySelectorAll('#nav .grp').forEach(function (g) {
    if (name) g.classList.toggle('open', g.querySelector('[data-tab]').dataset.tab === name);
  });
  document.querySelectorAll('#nav [data-sub]').forEach(function (b) {
    var cur = document.querySelector('section.active'), pane = document.getElementById(b.dataset.sub);
    var on = cur && cur.id === b.dataset.parent && pane && pane.classList.contains('active');
    b.classList.toggle('active', !!on);
  });
  var cur = document.querySelector('#nav [data-tab].active'), sub = document.querySelector('#nav [data-sub].active');
  if (cur) document.getElementById('curTab').textContent = cur.textContent.replace('▸', '').trim() + (sub ? ' › ' + sub.textContent.trim() : '');
}
function showTab(name) {
  document.querySelectorAll('section').forEach(function (s) {
    s.classList.toggle('active', s.id === name);
  });
  buttons.forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === name);
    if (b.dataset.tab === name) document.getElementById('curTab').textContent = b.textContent.replace('▸', '').trim();
  });
  navSync(name);
  if (kuReady) refreshViews();
}
buttons.forEach(function (b) {
  b.addEventListener('click', function () {
    var grp = b.closest('.grp'), was = b.classList.contains('active');
    var wasOpen = grp ? grp.classList.contains('open') : false; // état avant le clic (showTab ouvre le groupe de l'onglet actif)
    showTab(b.dataset.tab);
    if (grp) { if (was) grp.classList.toggle('open', !wasOpen); }   // groupe : un clic replie ou déplie le sous-menu
    else navOpen(false);
    window.scrollTo(0, 0);
  });
});
document.querySelectorAll('#nav [data-sub]').forEach(function (b) {
  b.addEventListener('click', function () {
    showTab(b.dataset.parent);
    var sid = b.dataset.sub;
    if (sid.indexOf('iv-') === 0) showIvPane(sid); else if (sid.indexOf('at-') === 0) showAtPane(sid); else showCalc(sid);
    window.scrollTo(0, 0); // le menu reste ouvert et déplié : on peut enchaîner les pages
  });
});
document.getElementById('burger').addEventListener('click', function () { navOpen(!document.body.classList.contains('nav-open')); });
document.getElementById('navClose').addEventListener('click', function () { navOpen(false); });
document.getElementById('navOv').addEventListener('click', function () { navOpen(false); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') navOpen(false); });

// ---------- Calculateur de runes ----------
var el = {
  base: document.getElementById('base'),
  pa: document.getElementById('pa'),
  ra: document.getElementById('ra'),
  mode: document.getElementById('raMode'),
  winner: document.getElementById('winner'),
  net: document.getElementById('winnerNet'),
  detail: document.getElementById('detail')
};

function num(input) {
  var v = parseFloat(String(input.value).replace(/\s/g, '').replace(',', '.'));
  return isFinite(v) ? v : 0;
}

// ---------- Champs numériques : espaces entre les milliers (5 000, 9 500 000) ----------
function fmtField(raw) {
  var s = String(raw == null ? '' : raw).replace(/[^\d.,]/g, '');
  var i = s.search(/[.,]/);
  var ent = i < 0 ? s : s.slice(0, i);
  var dec = i < 0 ? null : s.slice(i + 1).replace(/[.,]/g, '');
  ent = ent.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return ent + (dec === null ? '' : ',' + dec);
}
document.addEventListener('input', function (e) {
  var t = e.target;
  if (!t || !t.hasAttribute || !t.hasAttribute('data-num')) return;
  var pos = t.selectionStart;
  var before = t.value.slice(0, pos).replace(/[^\d.,]/g, '').length;
  var f = fmtField(t.value);
  if (f === t.value) return;
  t.value = f;
  var count = 0, p = 0;
  while (p < f.length && count < before) {
    if (/[\d,]/.test(f.charAt(p))) count++;
    p++;
  }
  try { t.setSelectionRange(p, p); } catch (err) {}
});
function fmt(n) {
  var r = Math.round(n * 10) / 10; // 1 décimale max
  return r.toLocaleString('fr-FR') + ' K';
}

function compute() {
  var base = num(el.base), pa = num(el.pa), ra = num(el.ra);
  var coutPA = 3 * base;
  var coutRA = el.mode.value === 'pa' ? 3 * pa : 9 * base;

  var netPA = pa - coutPA;
  var netRA = ra - coutRA;

  // Comparaison à quantité égale : 1 rune RA demande autant de matière que 3 runes PA.
  // Comparer 1 PA à 1 RA désignait la RA dès que son bénéfice dépassait celui d'une seule PA.
  var lotPA = 3 * netPA;
  var best = lotPA >= netRA ? { n: 'PA', v: lotPA } : { n: 'RA', v: netRA };
  el.winner.textContent = best.n;
  el.net.textContent = fmt(best.v);
  el.net.className = 'v ' + (best.v >= 0 ? 'pos' : 'neg');

  el.detail.innerHTML =
    row('3 × PA', 3 * coutPA, 3 * pa, lotPA) +
    row('1 × RA', coutRA, ra, netRA);

  try {
    localStorage.setItem('ku_runes', JSON.stringify({
      base: el.base.value, pa: el.pa.value, ra: el.ra.value, mode: el.mode.value
    }));
  } catch (e) {}
}
function row(name, cout, vente, net) {
  return '<tr><td>' + name + '</td><td>' + fmt(cout) + '</td><td>' + fmt(vente) +
    '</td><td class="' + (net >= 0 ? 'pos' : 'neg') + '">' + fmt(net) + '</td></tr>';
}

// Restaure les dernières valeurs saisies (propres à chaque navigateur)
try {
  var saved = JSON.parse(localStorage.getItem('ku_runes') || 'null');
  if (saved) {
    el.base.value = saved.base; el.pa.value = saved.pa;
    el.ra.value = saved.ra; el.mode.value = saved.mode;
  }
} catch (e) {}

[el.base, el.pa, el.ra, el.mode].forEach(function (i) {
  i.addEventListener('input', compute);
  i.addEventListener('change', compute);
});
compute();

// ---------- Sous-onglets des calculateurs ----------
var pillBtns = document.querySelectorAll('#pills button');
function showCalc(id) {
  document.querySelectorAll('.calc').forEach(function (c) {
    c.classList.toggle('active', c.id === id);
  });
  pillBtns.forEach(function (b) {
    b.classList.toggle('active', b.dataset.calc === id);
  });
  try { localStorage.setItem('ku_calc', id); } catch (e) {}
  navSync();
}
pillBtns.forEach(function (b) {
  b.addEventListener('click', function () { showCalc(b.dataset.calc); });
});

// ---------- Calculateur d'alliances ----------
function fmtInt(n) { return Math.round(n).toLocaleString('fr-FR'); }
function setSigned(node, text, value) {
  node.textContent = text;
  node.className = 'v ' + (value >= 0 ? 'pos' : 'neg');
}

var al = {
  orPrix: document.getElementById('orPrix'),
  alPrix: document.getElementById('alPrix'),
  orPer: document.getElementById('orPer'),
  frais: document.getElementById('alFrais'),
  qOr: document.getElementById('qOr'),
  qAl: document.getElementById('qAl'),
  net: document.getElementById('alNet'),
  possible: document.getElementById('qPossible'),
  total1: document.getElementById('qTotal1'),
  need: document.getElementById('qNeed'),
  total2: document.getElementById('qTotal2')
};

function computeAlliances() {
  var prixOr = num(al.orPrix), pv = num(al.alPrix);
  var per = num(al.orPer), frais = num(al.frais);

  var cout = per * prixOr + frais;
  var net = pv * (1 - TAX) - cout;
  setSigned(al.net, fmtInt(net) + ' K', net);

  // Panneau « Calcul des quantités »
  var possible = per > 0 ? Math.floor(num(al.qOr) / per) : 0;
  al.possible.textContent = fmtInt(possible);
  setSigned(al.total1, fmtInt(possible * net), possible * net);

  var qAl = num(al.qAl);
  al.need.textContent = fmtInt(qAl * per);
  setSigned(al.total2, fmtInt(qAl * net), qAl * net);

  try {
    localStorage.setItem('ku_alliances', JSON.stringify({
      orPrix: al.orPrix.value, alPrix: al.alPrix.value, orPer: al.orPer.value,
      frais: al.frais.value, qOr: al.qOr.value, qAl: al.qAl.value
    }));
  } catch (e) {}
}

try {
  var sa = JSON.parse(localStorage.getItem('ku_alliances') || 'null');
  if (sa) {
    al.orPrix.value = sa.orPrix; al.alPrix.value = sa.alPrix; al.orPer.value = sa.orPer;
    al.frais.value = sa.frais; al.qOr.value = sa.qOr; al.qAl.value = sa.qAl;
  }
  var sc = localStorage.getItem('ku_calc');
  if (sc && document.getElementById(sc)) showCalc(sc);
} catch (e) {}

['orPrix', 'alPrix', 'orPer', 'frais', 'qOr', 'qAl'].forEach(function (k) {
  al[k].addEventListener('input', computeAlliances);
});

var drawer = document.getElementById('drawer');
document.getElementById('openQty').addEventListener('click', function () {
  drawer.classList.add('open');
});
document.getElementById('drawerClose').addEventListener('click', function () {
  drawer.classList.remove('open');
});
document.getElementById('drawerBack').addEventListener('click', function () {
  drawer.classList.remove('open');
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') drawer.classList.remove('open');
});

computeAlliances();

// ---------- Calculateur de montures (seuils de rentabilité) ----------
var mPrix = document.getElementById('mPrix');
var mGrid = document.getElementById('mGrid');

function computeMontures() {
  var prix = num(mPrix);
  var html = '';
  for (var gen = 2; gen <= 10; gen++) {
    // Prix de vente minimal pour ne pas perdre d'argent après la taxe de 2 %,
    // arrondi à la centaine supérieure : arrondir en dessous donnait un seuil légèrement à perte.
    var seuil = Math.ceil((prix * gen) / (1 - TAX) / 100) * 100;
    html += '<div class="card"><div class="k" style="font-size:18px;font-weight:700;color:var(--accent);margin-bottom:4px">Gen ' + gen + '</div><div class="v">' +
      fmtInt(seuil) + '</div></div>';
  }
  mGrid.innerHTML = html;
  try { localStorage.setItem('ku_montures', mPrix.value); } catch (e) {}
}

try {
  var sm = localStorage.getItem('ku_montures');
  if (sm !== null) mPrix.value = sm;
} catch (e) {}
mPrix.addEventListener('input', computeMontures);
computeMontures();

// ---------- Calculateur de parchemins (scores de rentabilité) ----------
var P_ELEMS = [
  { n: 'Vitalité', e: '⚪' }, { n: 'Sagesse', e: '🟣' }, { n: 'Intelligence', e: '🔴' },
  { n: 'Agilité', e: '🟢' }, { n: 'Force', e: '🟤' }, { n: 'Chance', e: '🔵' }
];
var P_SIZES = [
  { n: 'Petit', e: '👏', c: 20, g: 10 }, { n: 'Normal', e: '👌', c: 60, g: 30 },
  { n: 'Grand', e: '💪', c: 140, g: 70 }, { n: 'Puissant', e: '🏋️', c: 340, g: 170 }
];

var pTable = document.getElementById('pTable');
var pTop = document.getElementById('pTop');
var pCats = document.getElementById('pCats');

// Construit le tableau de saisie (éléments en lignes, tailles en colonnes)
var head = '<thead><tr><th></th>';
P_SIZES.forEach(function (s) {
  head += '<th data-col="' + P_SIZES.indexOf(s) + '">' + s.n + ' ' + s.e + '</th>';
});
head += '</tr></thead>';
var body = '<tbody>';
P_ELEMS.forEach(function (el_, i) {
  body += '<tr data-row="' + i + '"><td>' + el_.n + ' ' + el_.e + '</td>';
  P_SIZES.forEach(function (s, j) {
    body += '<td data-col="' + j + '"><input type="text" data-num inputmode="decimal" min="0" step="any" ' +
      'placeholder="—" data-e="' + i + '" data-s="' + j + '"></td>';
  });
  body += '</tr>';
});
body += '</tbody>';
pTable.innerHTML = head + body;
var pInputs = pTable.querySelectorAll('input[data-num]');

function priceOf(input) {
  if (input.value === '') return null;
  var v = parseFloat(String(input.value).replace(/\s/g, '').replace(',', '.'));
  return isFinite(v) && v > 0 ? v : null;
}

// Filtres : menus déroulants (un seul type et/ou une seule statistique) ; les autres prix restent enregistrés
var pOn = { s: null, e: null };
function visS(s) { return pOn.s === null || pOn.s === s; }
function visE(e) { return pOn.e === null || pOn.e === e; }
var pfS = document.getElementById('pfS'), pfE = document.getElementById('pfE');
pfS.innerHTML = '<option value="">Tous les types</option>' + P_SIZES.map(function (x, i) { return '<option value="' + i + '">' + x.n + ' ' + x.e + '</option>'; }).join('');
pfE.innerHTML = '<option value="">Toutes les statistiques</option>' + P_ELEMS.map(function (x, i) { return '<option value="' + i + '">' + x.n + ' ' + x.e + '</option>'; }).join('');
function pApplyFilters() {
  pTable.querySelectorAll('[data-col]').forEach(function (n) { n.classList.toggle('off', !visS(+n.dataset.col)); });
  pTable.querySelectorAll('[data-row]').forEach(function (n) { n.classList.toggle('off', !visE(+n.dataset.row)); });
}
pfS.addEventListener('change', function () { pOn.s = pfS.value === '' ? null : +pfS.value; computeParchemins(); });
pfE.addEventListener('change', function () { pOn.e = pfE.value === '' ? null : +pfE.value; computeParchemins(); });

function pRender(ck, pTop, pCats) {
  var factor = 1;
  var scores = P_ELEMS.map(function () { return P_SIZES.map(function () { return null; }); });
  pInputs.forEach(function (inp) {
    var e = +inp.dataset.e, s = +inp.dataset.s;
    var p = priceOf(inp);
    if (p !== null) scores[e][s] = p * factor / P_SIZES[s][ck];
  });
  // Meilleur score global
  var best = null;
  scores.forEach(function (row, e) {
    if (!visE(e)) return;
    row.forEach(function (sc, s) {
      if (!visS(s)) return;
      if (sc !== null && (best === null || sc > best.sc)) best = { sc: sc, e: e, s: s };
    });
  });
  pTop.innerHTML = best
    ? '<div class="card"><div class="v">' + fmtInt(best.sc) + '</div></div>' +
      '<div class="card"><div class="k">' + P_SIZES[best.s].n + ' ' + P_SIZES[best.s].e + '</div>' +
      '<div class="v" style="font-size:20px">' + P_ELEMS[best.e].n + ' ' + P_ELEMS[best.e].e + '</div></div>'
    : '<div class="card"><div class="k">Saisis au moins un prix</div><div class="v">–</div></div>';

  // Meilleur élément pour chaque taille
  var bestPerSize = [];
  var cats = '';
  P_SIZES.forEach(function (sz, s) {
    var b = null;
    P_ELEMS.forEach(function (_, e) {
      if (!visE(e)) return;
      var sc = scores[e][s];
      if (sc !== null && (b === null || sc > b.sc)) b = { sc: sc, e: e };
    });
    bestPerSize.push(b);
    if (!visS(s)) return;
    cats += '<div class="card"><div class="k">' + sz.n + ' ' + sz.e + '</div>' +
      '<div class="v">' + (b ? fmtInt(b.sc) : '–') + '</div>' +
      '<div class="sub-line">' + (b ? P_ELEMS[b.e].n + ' ' + P_ELEMS[b.e].e : '') + '</div></div>';
  });
  pCats.innerHTML = cats;

}

function computeParchemins() {
  pApplyFilters();
  var saved = [];
  pInputs.forEach(function (inp) { saved.push(inp.value); });
  pRender('c', pTop, pCats);
  pRender('g', document.getElementById('pTopG'), document.getElementById('pCatsG'));
  try {
    localStorage.setItem('ku_parchemins', JSON.stringify({ prices: saved, net: true }));
  } catch (e) {}
}

try {
  var sp = JSON.parse(localStorage.getItem('ku_parchemins') || 'null');
  if (sp) {
    pInputs.forEach(function (inp, i) { if (sp.prices && sp.prices[i] !== undefined) inp.value = sp.prices[i]; });
  }
} catch (e) {}
pInputs.forEach(function (inp) { inp.addEventListener('input', computeParchemins); });
computeParchemins();

// ===== Runes songes : seuil de rentabilité = (quantité de Reflets × prix du reflet) ÷ (1 − taxe 2 %) =====
var T_RUNES = [
  { n: 'Do So', q: 120 }, { n: 'Do Dist', q: 100 }, { n: 'Do Arme', q: 20 },
  { n: 'Do Mélée', q: 80 }, { n: 'Ré Dist', q: 60 }, { n: 'Ré Mélée', q: 40 }
];
var tReflet = document.getElementById('tReflet');
var tGrid = document.getElementById('tGrid');
function computeTransc() {
  var v = parseFloat(String(tReflet.value).replace(/\s/g, '').replace(',', '.'));
  var ok = isFinite(v) && v > 0;
  tGrid.innerHTML = T_RUNES.map(function (r) {
    var craft = ok ? v * r.q : null;
    return '<div class="card"><div class="k" style="font-size:18px;font-weight:700;color:var(--accent);margin-bottom:4px">' + r.n + '</div>' +
      '<div class="v">' + (ok ? fmtInt(Math.ceil(craft / (1 - TAX))) + ' K' : '–') + '</div></div>';
  }).join('');
  try { localStorage.setItem('ku_transc', JSON.stringify({ reflet: tReflet.value })); } catch (e) {}
}
try {
  var st = JSON.parse(localStorage.getItem('ku_transc') || 'null');
  if (st) tReflet.value = st.reflet || '';
} catch (e) {}
tReflet.addEventListener('input', computeTransc);
computeTransc();

// ---------- Investissements (rentabilité d'un craft) ----------
var API = 'https://api.dofusdb.fr';
var iv = { rows: [], editing: null, icon: null };
var ivEl = {
  head: document.getElementById('ivHead'),
  msg: document.getElementById('ivMsg'), saveMsg: document.getElementById('ivSaveMsg'),
  name: document.getElementById('ivName'),
  tbody: document.getElementById('ivRows'),
  net: document.getElementById('ivNet'),
  clear: document.getElementById('ivClear')
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function nv(s) {
  var v = parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
  return isFinite(v) ? v : 0;
}
function blankRows(n) {
  var r = [];
  for (var i = 0; i < n; i++) r.push({ name: '', qty: '', price: '' });
  return r;
}
function setMsg(node, text, cls) {
  node.textContent = text || '';
  node.className = 'msg' + (cls ? ' ' + cls : '');
}

// Images des items : DofusDB en premier, puis le site d'Ankama en secours
function imgTag(iconId, cls) {
  iconId = String(iconId == null ? '' : iconId).replace(/\D/g, '');
  if (!iconId) return '';
  var u1 = API + '/img/items/' + iconId + '.png';
  var u2 = 'https://static.ankama.com/dofus/www/game/items/200/' + iconId + '.png';
  return '<img class="' + cls + '" src="' + u1 + '" data-alt="' + u2 + '" alt="" loading="lazy" onerror="ivImgErr(this)">';
}
function ivImgErr(img) {
  if (img.dataset.alt) { var a = img.dataset.alt; img.dataset.alt = ''; img.src = a; }
  else { img.style.display = 'none'; }
}
function ivRenderHead() {
  var name = ivEl.name.value.trim();
  if (iv.icon && name) {
    ivEl.head.className = 'item-head on';
    ivEl.head.innerHTML = imgTag(iv.icon, 'hi') + '<div class="hn">' + esc(name) + '</div>';
  } else {
    ivEl.head.className = 'item-head';
    ivEl.head.innerHTML = '';
  }
}

function ivRenderRows() {
  var h = '';
  iv.rows.forEach(function (r, i) {
    h += '<tr>' +
      '<td><div class="rname">' + imgTag(r.icon, 'ri') +
      '<input type="text" data-i="' + i + '" data-f="name" placeholder="Ressource" value="' + esc(r.name) + '" style="min-width:140px"></div></td>' +
      '<td><input type="text" data-num inputmode="decimal" min="0" step="any" data-i="' + i + '" data-f="qty" placeholder="0" value="' + esc(fmtField(r.qty)) + '" style="min-width:64px"></td>' +
      '<td><input type="text" data-num inputmode="decimal" min="0" step="any" data-i="' + i + '" data-f="price" placeholder="0" value="' + esc(fmtField(r.price)) + '">' +
      '<small class="iv-pdate" data-pd="' + i + '"></small></td>' +
      '</tr>';
  });
  ivEl.tbody.innerHTML = h;
  ivPriceLabels();
}

// ----- Prix des ressources dans le craft -----
// r.src : 'auto' (repris du fichier de prix ou de tes prix saisis) ou 'manuel' (tapé ici) ; r.at : date du prix.
// Un prix « auto » suit le prix le plus récent tant que le craft n'est pas déjà enregistré ;
// un prix tapé ici n'est jamais remplacé, un prix plus récent est seulement proposé.
function ivSyncPrices() {
  if (iv.editing) return false; // craft enregistré : son coût ne bouge plus tout seul
  var changed = false;
  iv.rows.forEach(function (r) {
    if (!String(r.name || '').trim()) return;
    var manual = r.src === 'manuel' || (!r.src && nv(r.price) > 0); // anciens brouillons : prix tapé
    if (manual) return;
    var i = rsInfo(r.name, r.id, 0);
    if (!(i.price > 0)) return;
    if (nv(r.price) !== i.price || r.at !== i.at || r.from !== i.src) {
      r.price = String(i.price); r.src = 'auto'; r.at = i.at; r.from = i.src; r.fr = i.fr || '';
      changed = true;
    }
  });
  return changed;
}
function ivPriceLabel(r, i) {
  var name = String(r.name || '').trim();
  if (!name) return '';
  var info = rsInfo(r.name, r.id, 0), txt;
  if (nv(r.price) > 0 && r.src === 'auto') {
    txt = (r.from === 'fichier' ? 'Price.json' : 'ton prix') + (r.at > 0 ? ' · ' + dateFr(r.at) : '') +
      (RS_FRESH[r.fr] ? ' (' + RS_FRESH[r.fr] + ')' : '');
  } else if (nv(r.price) > 0) {
    txt = 'tapé ici' + (r.at > 0 ? ' le ' + dateFr(r.at) : '');
  } else {
    txt = info.price > 0 ? '' : 'aucun prix connu';
  }
  // Prix plus récent disponible (prix tapé, craft enregistré, ou champ vide)
  var newer = info.price > 0 && (info.price !== nv(r.price)) && (!(nv(r.price) > 0) || info.at > (+r.at || 0));
  return esc(txt) + (newer ? (txt ? ' · ' : '') + '<button type="button" class="iv-use" data-use="' + i + '">utiliser ' +
    esc(fmtInt(info.price)) + ' K (' + esc(info.src === 'fichier' ? 'Price.json' : 'ton prix') + (info.at > 0 ? ', ' + esc(dateFr(info.at)) : '') + ')</button>' : '');
}
function ivPriceLabels() {
  iv.rows.forEach(function (r, i) {
    var n = ivEl.tbody.querySelector('[data-pd="' + i + '"]');
    if (n) n.innerHTML = ivPriceLabel(r, i);
  });
}
// Après un chargement ou une relecture du fichier de prix
function ivRefreshPrices() {
  if (ivSyncPrices()) { ivRenderRows(); ivCompute(); } else ivPriceLabels();
}
ivEl.tbody.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-use]') : null;
  if (!b) return;
  var r = iv.rows[+b.dataset.use];
  if (!r) return;
  var i = rsInfo(r.name, r.id, 0);
  if (!(i.price > 0)) return;
  r.price = String(i.price); r.src = 'auto'; r.at = i.at; r.from = i.src; r.fr = i.fr || '';
  ivRenderRows(); ivCompute();
});

function ivCalc() {
  var cout = 0, subs = [];
  iv.rows.forEach(function (r) {
    var s = nv(r.qty) * nv(r.price);
    subs.push(s);
    cout += s;
  });
  return { cout: cout, subs: subs };
}

function ivCompute() {
  var c = ivCalc();
  ivEl.net.textContent = c.cout > 0 ? fmtInt(c.cout) + ' K' : '–';
  try { localStorage.setItem('ku_iv_draft', JSON.stringify(ivSnapshot())); } catch (e) {}
}

function ivSnapshot() {
  return {
    name: ivEl.name.value, rows: iv.rows, icon: iv.icon
  };
}
function ivApply(d) {
  ivEl.name.value = d.name || '';
  iv.rows = (d.rows && d.rows.length) ? d.rows.map(function (r) {
    return { name: r.name || '', qty: r.qty, price: r.price, icon: r.icon, id: r.id, src: r.src, at: r.at, from: r.from, fr: r.fr };
  }) : blankRows(8);
  iv.editing = null;
  iv.icon = d.icon || null;
  ivSyncPrices();
  ivRenderHead();
  ivRenderRows();
  ivCompute();
}

// Saisie dans le tableau des ressources
ivEl.tbody.addEventListener('input', function (e) {
  var t = e.target;
  if (t.dataset && t.dataset.f) {
    var r = iv.rows[+t.dataset.i];
    r[t.dataset.f] = t.value;
    if (t.dataset.f === 'price') { r.src = 'manuel'; r.at = Date.now(); r.from = ''; r.fr = ''; }
    if (t.dataset.f === 'name') r.id = null; // autre ressource : l'identifiant ne vaut plus
    var n = ivEl.tbody.querySelector('[data-pd="' + t.dataset.i + '"]');
    if (n) n.innerHTML = ivPriceLabel(r, +t.dataset.i);
    ivCompute();
  }
});
[ivEl.name].forEach(function (i) {
  i.addEventListener('input', ivCompute);
});
// Si on retape le nom à la main, l'image de l'ancien item n'a plus lieu d'être
ivEl.name.addEventListener('input', function () {
  if (iv.icon) { iv.icon = null; ivRenderHead(); }
});

// ----- Import depuis DofusDB -----
function getJson(url) {
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error('erreur ' + r.status);
    return r.json();
  });
}
function firstOf(x) {
  if (x && x.data) x = x.data;
  return Array.isArray(x) ? x[0] : x;
}
function nameOf(o) {
  if (!o) return '';
  var n = o.name;
  if (n && typeof n === 'object') n = n.fr || n.en || '';
  return n || '';
}
function itemInfo(id) {
  return getJson(API + '/items/' + id + '?lang=fr').then(function (o) {
    var n = nameOf(o);
    if (!n) throw new Error('nom introuvable');
    return { name: n, icon: o.iconId || null };
  }).catch(function () {
    return getJson(API + '/items?id=' + id + '&lang=fr&$limit=1').then(function (r) {
      var o = firstOf(r);
      return { name: nameOf(o) || ('Ressource n°' + id), icon: o ? (o.iconId || null) : null };
    });
  }).catch(function () { return { name: 'Ressource n°' + id, icon: null }; });
}

function ivImportId(id) {
  setMsg(ivEl.msg, 'Import en cours…');

  getJson(API + '/recipes/' + id)
    .catch(function () { return getJson(API + '/recipes?resultId=' + id); })
    .then(function (r) {
      var rec = firstOf(r);
      if (!rec || !rec.ingredientIds || !rec.ingredientIds.length) {
        throw new Error('aucune recette trouvée pour cet item');
      }
      var ids = [id].concat(rec.ingredientIds);
      return Promise.all(ids.map(itemInfo)).then(function (infos) {
        return { rec: rec, infos: infos };
      });
    })
    .then(function (res) {
      iv.rows = res.rec.ingredientIds.map(function (rid, k) {
        var info = res.infos[k + 1];
        return { name: info.name, icon: info.icon, id: rid, qty: res.rec.quantities ? res.rec.quantities[k] : '', price: '' };
      });
      var head = res.infos[0];
      if (head.name.indexOf('Ressource n°') !== 0) ivEl.name.value = head.name; // sinon on garde la saisie
      iv.icon = head.icon;
      iv.editing = null;
      ivSyncPrices(); // prix repris automatiquement (fichier de prix ou tes prix saisis)
      var repris = iv.rows.filter(function (r) { return r.src === 'auto'; }).length;
      ivRenderHead();
      ivRenderRows();
      ivCompute();
      var n = iv.rows.length;
      setMsg(ivEl.msg, 'Recette importée (' + n + ' ressource' + (n > 1 ? 's' : '') + '). ' +
        (repris === n ? 'Tous les prix ont été repris (tes prix saisis ou le fichier de prix) : vérifie-les.'
          : repris ? repris + ' prix repris (tes prix saisis ou le fichier de prix), il te reste à saisir les autres.'
          : 'Il te reste à saisir les prix.'), 'ok');
    })
    .catch(function (err) {
      setMsg(ivEl.msg, 'Import impossible (' + err.message + '). Tu peux saisir la recette à la main.', 'err');
    });
}

// ----- Crafts enregistrés -----
function ivSaved() {
  try { return JSON.parse(localStorage.getItem('ku_invest') || '[]'); } catch (e) { return []; }
}
function ivStore(a) {
  try { localStorage.setItem('ku_invest', JSON.stringify(a)); } catch (e) {}
}
// Identifiants consécutifs : on part après le plus grand existant, sinon deux
// enregistrements rapprochés de plusieurs exemplaires produisent des doublons.
function idLibre(a) {
  var base = Date.now();
  a.forEach(function (it) { if (+it.id >= base) base = +it.id + 1; });
  return base;
}
// Recette valide du formulaire (nom + au moins une ressource avec une quantité)
function ivRecipe() {
  var snap = ivSnapshot();
  var rows = snap.rows.filter(function (r) { return r && String(r.name || '').trim() && nv(r.qty) > 0; })
    .map(function (r) { return { name: String(r.name).trim(), icon: r.icon || null, qty: nv(r.qty), price: r.price, id: r.id || null }; });
  var name = snap.name.trim();
  if (!name || !rows.length) { setMsg(ivEl.saveMsg, 'Choisis un item avec sa recette (nom + ressources) avant de continuer.', 'err'); return null; }
  var n = Math.floor(nv(document.getElementById('ivQty').value)); n = n < 1 ? 1 : (n > 200 ? 200 : n);
  return { name: name, icon: snap.icon || null, rows: rows, n: n };
}
// Craft rapide : un exemplaire par objet directement dans l'Inventaire, au coût actuel, sans mise en vente
document.getElementById('ivQuick').addEventListener('click', function () {
  var r = ivRecipe();
  if (!r) return;
  var cout = 0; r.rows.forEach(function (x) { cout += nv(x.qty) * nv(x.price); });
  var a = ivSaved(), base = idLibre(a);
  for (var k = r.n - 1; k >= 0; k--) {
    a.unshift({
      id: base + k, name: r.name, prix: '', rows: JSON.parse(JSON.stringify(r.rows)), net: -cout, cout: cout,
      seuil: 0, icon: r.icon, cost: cout, price: 0, date: new Date().toISOString(), inv: true
    });
  }
  ivStore(a);
  document.getElementById('ivQty').value = '1';
  refreshViews();
  setMsg(ivEl.saveMsg, r.n + ' × ' + r.name + ' ajouté' + (r.n > 1 ? 's' : '') + ' à l\'Inventaire (coût : ' + fmtInt(cout) + ' K l\'unité). Fixe le prix de vente depuis l\'onglet Inventaire.', 'ok');
});

ivEl.clear.addEventListener('click', function () {
  ivApply({});
  setMsg(ivEl.msg, '');
  setMsg(ivEl.saveMsg, '');
});
// ----- Recherche d'item (menu déroulant), réutilisable pour plusieurs champs -----
// Texte comparable au « slug » de DofusDB : minuscules, sans accents (« Étreinte » → « etreinte »)
function plain(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, '\'');
}
var SUGG_MAX = 15;
// Craft : seulement les items qui ont une recette (l'id d'une recette est celui de l'objet fabriqué).
// Si DofusDB ne répond pas à cette vérification, rien n'est masqué.
function craftableSet(ids) {
  function q(field) {
    var url = API + '/recipes?$limit=50&$select[]=id&$select[]=resultId&' +
      ids.map(function (id) { return field + '[$in][]=' + encodeURIComponent(id); }).join('&');
    return getJson(url).then(function (r) {
      var rows = r && r.data ? r.data : (Array.isArray(r) ? r : []);
      var set = {};
      rows.forEach(function (x) { if (x && x.resultId != null) set[x.resultId] = 1; if (x && x.id != null) set[x.id] = 1; });
      return set;
    });
  }
  return q('resultId').then(function (set) {
    return Object.keys(set).length ? set : q('id');
  }).catch(function () { return null; });
}
// Renvoie { list, hidden } : hidden = résultats écartés parce qu'ils n'ont pas de recette (opts.recipe)
function fetchItems(term, opts) {
  opts = opts || {};
  // Chaque mot tapé doit apparaître, dans n'importe quel ordre ; les élisions (l', d') sont ignorées
  var words = plain(term).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 1 || /\d/.test(w); });
  if (!words.length) return Promise.resolve({ list: [], hidden: 0 });
  var all = '^' + words.map(function (w) { return '(?=.*' + w + ')'; }).join('');
  var rx = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var base = API + '/items?lang=fr&$limit=50&$select[]=id&$select[]=name&$select[]=slug&$select[]=level&$select[]=iconId';
  // Plusieurs formulations tentées l'une après l'autre jusqu'à obtenir des résultats
  var tries = [
    base + '&slug.fr[$regex]=' + encodeURIComponent(all),
    base + '&name.fr[$regex]=' + encodeURIComponent(rx) + '&name.fr[$options]=i'
  ];
  var q = words.join(' ');
  // Pertinence : nom qui commence par la saisie, puis un mot qui commence par le premier mot, puis le plus court
  function rank(o) {
    var n = plain(o.name);
    if (n.indexOf(q) === 0) return 0;
    if (n.indexOf(q) >= 0) return 1;
    if ((' ' + n).indexOf(' ' + words[0]) >= 0) return 2;
    return 3;
  }
  function attempt(k) {
    if (k >= tries.length) return Promise.resolve({ list: [], hidden: 0 });
    return getJson(tries[k]).then(function (r) {
      var list = (r && r.data ? r.data : (Array.isArray(r) ? r : []))
        .map(function (o) { return { id: o.id, name: nameOf(o), level: o.level, icon: o.iconId }; })
        .filter(function (o) { return o.id && o.name; });
      list.forEach(function (o) { o.r = rank(o); });
      list.sort(function (a, b) { return a.r - b.r || a.name.length - b.name.length || a.name.localeCompare(b.name, 'fr'); });
      if (!list.length) return attempt(k + 1);
      if (!opts.recipe) return { list: list.slice(0, SUGG_MAX), hidden: 0 };
      return craftableSet(list.map(function (o) { return o.id; })).then(function (set) {
        var kept = set ? list.filter(function (o) { return set[o.id]; }) : list;
        return { list: kept.slice(0, SUGG_MAX), hidden: list.length - kept.length };
      });
    }).catch(function () { return attempt(k + 1); });
  }
  return attempt(0);
}

function makeSearch(input, box, onPick, getOpts) {
  var items = [], sel = -1, timer = null, seq = 0;
  var wrap = input.closest('.sugg-wrap');

  function close() {
    seq++;
    box.className = 'suggest';
    box.innerHTML = '';
    items = [];
    sel = -1;
  }
  function info(text) {
    box.className = 'suggest open';
    box.innerHTML = '<div class="info">' + esc(text) + '</div>';
  }
  function render() {
    box.className = 'suggest open';
    box.innerHTML = items.map(function (it, i) {
      return '<div data-pick="' + i + '" class="' + (i === sel ? 'sel' : '') + '"><span>' +
        imgTag(it.icon, 'si') + esc(it.name) + '</span>' +
        (it.level ? '<small>Niv. ' + esc(it.level) + '</small>' : '') + '</div>';
    }).join('');
  }
  function search(term) {
    var my = ++seq;
    info('Recherche…');
    fetchItems(term, getOpts ? getOpts() : null).then(function (res) {
      if (my !== seq) return;
      var list = res.list;
      if (!list.length) { info(res.hidden ? 'Aucun item craftable trouvé pour cette recherche' : 'Aucun résultat'); return; }
      items = list;
      sel = -1;
      render();
    });
  }
  function pick(i) {
    var it = items[i];
    if (!it) return;
    input.value = it.name;
    close();
    onPick(it);
  }

  input.addEventListener('input', function () {
    clearTimeout(timer);
    var term = input.value.trim();
    if (term.length < 3) { close(); return; }
    timer = setTimeout(function () { search(term); }, 300);
  });
  input.addEventListener('keydown', function (e) {
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % items.length; render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; render(); }
    else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); pick(sel); }
    else if (e.key === 'Escape') { close(); }
  });
  box.addEventListener('click', function (e) {
    var d = e.target.closest ? e.target.closest('[data-pick]') : null;
    if (d) pick(+d.dataset.pick);
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest || e.target.closest('.sugg-wrap') !== wrap) close();
  });
  return { close: close };
}

// Craft : le choix d'un item importe sa recette
makeSearch(ivEl.name, document.getElementById('ivSuggest'), function (it) { ivImportId(it.id); },
  function () { return { recipe: true }; });

// ---------- Investissements : achat-revente ----------
var fl = { icon: null, editing: null };
var flEl = {
  name: document.getElementById('flName'), achat: document.getElementById('flAchat'),
  vente: document.getElementById('flVente'), net: document.getElementById('flNet'),
  head: document.getElementById('flHead'), save: document.getElementById('flSave'),
  clear: document.getElementById('flClear'), saveMsg: document.getElementById('flSaveMsg'),
  bulk: document.getElementById('flBulk'), qty: document.getElementById('flQty')
};
// Affichage des nombres décimaux (prix unitaires de lots : 0,35 K par exemple)
function fmtDec(n) { return (Math.round(n * 1000) / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 }); }

function flRenderHead() {
  var name = flEl.name.value.trim();
  if (fl.icon && name) {
    flEl.head.className = 'item-head on';
    flEl.head.innerHTML = imgTag(fl.icon, 'hi') + '<div class="hn">' + esc(name) + '</div>';
  } else {
    flEl.head.className = 'item-head';
    flEl.head.innerHTML = '';
  }
}
function flQtyVal() { var n = Math.floor(nv(flEl.qty.value)); return n < 1 ? 1 : n; }
function flCalc() { // bénéfice net d'UNE unité
  return nv(flEl.vente.value) * (1 - TAX) - nv(flEl.achat.value);
}
function flSnapshot() {
  return { name: flEl.name.value, achat: flEl.achat.value, vente: flEl.vente.value, icon: fl.icon, editing: fl.editing,
    bulk: flEl.bulk.checked, qty: flEl.qty.value };
}
function flLayout() {
  var b = flEl.bulk.checked;
  document.getElementById('flQtyField').style.display = b ? '' : 'none';
  document.getElementById('flUnitCard').style.display = b ? '' : 'none';
  document.getElementById('flInvCard').style.display = b ? '' : 'none';
  document.getElementById('flAchatL').textContent = b ? "Prix d'achat unitaire" : "Prix d'achat";
  document.getElementById('flVenteL').textContent = b ? 'Prix de vente unitaire' : 'Prix de vente';
  document.getElementById('flNetK').textContent = b ? 'Bénef net total' : 'Bénef net';
  document.getElementById('flHelp').textContent = b
    ? "Prix de vente unitaire après taxe de 2 %, moins le prix d'achat unitaire, multiplié par la quantité."
    : "Prix de vente après taxe de 2 %, moins le prix d'achat.";
}
function flCompute() {
  var unit = flCalc(), b = flEl.bulk.checked, q = b ? flQtyVal() : 1;
  flLayout();
  setSigned(flEl.net, fmtInt(unit * q) + ' K', unit * q);
  setSigned(document.getElementById('flUnitNet'), fmtDec(unit) + ' K', unit);
  document.getElementById('flInvest').textContent = fmtInt(nv(flEl.achat.value) * q) + ' K';
  try { localStorage.setItem('ku_fl_draft', JSON.stringify(flSnapshot())); } catch (e) {}
}
function flApply(d) {
  flEl.name.value = d.name || '';
  flEl.achat.value = fmtField(d.achat);
  flEl.vente.value = fmtField(d.vente);
  flEl.bulk.checked = !!d.bulk;
  flEl.qty.value = d.bulk && d.qty ? fmtField(d.qty) : '';
  fl.icon = d.icon || null;
  fl.editing = d.editing || null;
  flRenderHead();
  flCompute();
}

[flEl.achat, flEl.vente, flEl.qty].forEach(function (i) { i.addEventListener('input', flCompute); });
flEl.bulk.addEventListener('change', flCompute);
flEl.name.addEventListener('input', function () {
  if (fl.icon) { fl.icon = null; flRenderHead(); }
  flCompute();
});
// Recherche : le choix d'un item affiche son image (pas de recette ici)
makeSearch(flEl.name, document.getElementById('flSuggest'), function (it) {
  fl.icon = it.icon || null;
  flRenderHead();
  flCompute();
});

function flSaved() {
  try { return JSON.parse(localStorage.getItem('ku_flips') || '[]'); } catch (e) { return []; }
}
function flStore(a) {
  try { localStorage.setItem('ku_flips', JSON.stringify(a)); } catch (e) {}
}
flEl.save.addEventListener('click', function () {
  var snap = flSnapshot();
  var name = snap.name.trim() || 'Sans nom';
  var bulk = !!snap.bulk, q = bulk ? flQtyVal() : 1;
  var entry = {
    id: fl.editing || Date.now(), name: name, achat: snap.achat, vente: snap.vente,
    icon: fl.icon, net: flCalc() * q, cost: nv(snap.achat), price: nv(snap.vente),
    date: new Date().toISOString()
  };
  if (bulk) { entry.bulk = true; entry.qty = q; entry.stock = q; }
  var a = flSaved(), idx = -1;
  a.forEach(function (it, i) { if (it.id === entry.id) idx = i; });
  if (idx >= 0) {
    var old = a[idx];
    keepHdv(entry, old);
    if (bulk && old.bulk) { // on garde le nombre d'unités déjà vendues
      var sold = Math.max(0, Math.floor(nv(old.qty)) - Math.floor(nv(old.stock)));
      entry.stock = Math.max(0, q - sold);
    }
    if (!bulk && old.bulk) { delete entry.fees; delete entry.updates; delete entry.listPrice; } // lot redevenu objet seul
    a[idx] = entry;
  } else a.unshift(entry);
  fl.editing = entry.id;
  flStore(a);
  refreshViews();
  flCompute();
  setMsg(flEl.saveMsg, 'Enregistré : ' + (bulk ? fmtInt(q) + ' × ' : '') + name + '. ' + (bulk ? 'Le lot apparaît dans Hôtel de vente avec son stock.' : 'Il apparaît dans Hôtel de vente.'), 'ok');
});
flEl.clear.addEventListener('click', function () {
  flApply({});
  setMsg(flEl.saveMsg, '');
});
// ---------- Boutons de navigation entre pages : data-go="onglet[:page[:ancre]]" ----------
document.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-go]') : null;
  if (!b) return;
  var parts = b.dataset.go.split(':'), tab = parts[0], pane = parts[1], anchor = parts[2];
  showTab(tab);
  if (pane) {
    if (pane.indexOf('at-') === 0) showAtPane(pane);
    else if (pane.indexOf('iv-') === 0) showIvPane(pane);
    else showCalc(pane);
  }
  var target = anchor ? document.getElementById(anchor) : null;
  if (target && target.offsetParent) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); else window.scrollTo(0, 0);
});

// ---------- Sous-pages de l'Atelier (Liste de courses / Forgemagie) ----------
function showAtPane(id) {
  document.querySelectorAll('.atpane').forEach(function (p) { p.classList.toggle('active', p.id === id); });
  try { localStorage.setItem('ku_atp', id); } catch (e) {}
  navSync();
}
try {
  var atp = localStorage.getItem('ku_atp');
  if (atp && document.getElementById(atp) && /^at-/.test(atp)) showAtPane(atp);
} catch (e) {}

// ---------- Forgemagie : une session coûte (valeur du stock de runes avant - après) ----------
// On enregistre chaque session sur un objet de l'inventaire : les coûts s'additionnent au coût de craft.
var fm = { sel: null, loaded: false };
var fmEl = {
  item: document.getElementById('fmItem'), hint: document.getElementById('fmHint'),
  avant: document.getElementById('fmAvant'), apres: document.getElementById('fmApres'),
  gain: document.getElementById('fmGain'), saved: document.getElementById('fmSaved'), total: document.getElementById('fmTotal'),
  savedCard: document.getElementById('fmSavedCard'), totalCard: document.getElementById('fmTotalCard'),
  back: document.getElementById('fmBack'), undo: document.getElementById('fmUndo'), msg: document.getElementById('fmMsg')
};
function fmItems() { return hdvEntries().filter(function (e) { return e.kind === 'craft' && isInv(e); }); }
function fmUsed() { return fmEl.avant.value !== '' || fmEl.apres.value !== ''; }
function fmSessionCost() { return nv(fmEl.avant.value) - nv(fmEl.apres.value); }
function fmShowSession() {
  var c = fmSessionCost();
  if (fmUsed()) setSigned(fmEl.gain, (c > 0 ? '−' : (c < 0 ? '+' : '')) + fmtInt(Math.abs(c)) + ' K', -c);
  else { fmEl.gain.textContent = '–'; fmEl.gain.className = 'v'; }
}
function fmCompute() {
  fmShowSession();
  try { localStorage.setItem('ku_fm_draft', JSON.stringify({ avant: fmEl.avant.value, apres: fmEl.apres.value })); } catch (er) {}
}
// Recharge la liste des objets et le récapitulatif de l'objet choisi (appelé à chaque rafraîchissement des vues)
function fmRefresh() {
  if (!fm.loaded) {
    fm.loaded = true;
    try { fm.sel = +localStorage.getItem('ku_fm_sel') || null; } catch (e) {}
    try {
      var d = JSON.parse(localStorage.getItem('ku_fm_draft') || 'null');
      if (d) { fmEl.avant.value = fmtField(d.avant); fmEl.apres.value = fmtField(d.apres); }
    } catch (e) {}
  }
  var list = fmItems(), counts = {};
  if (fm.sel && !list.some(function (e) { return e.it.id === fm.sel; })) fm.sel = null;
  fmEl.item.innerHTML = '<option value="">Aucun : calcul libre</option>' + list.map(function (e) {
    counts[e.it.name] = (counts[e.it.name] || 0) + 1;
    return '<option value="' + e.it.id + '"' + (e.it.id === fm.sel ? ' selected' : '') + '>' + esc(e.it.name) + ' (n° ' + counts[e.it.name] + ') · coût ' + esc(fmtInt(entryCost(e))) + ' K</option>';
  }).join('');
  var cur = fm.sel ? findEntry('craft', fm.sel) : null;
  fmEl.hint.textContent = cur
    ? 'Saisis les valeurs de ta session, puis enregistre : son coût s\'ajoute au coût de l\'objet. Tu peux enchaîner plusieurs sessions.'
    : (list.length ? 'Choisis un objet pour y enregistrer tes sessions, ou clique sur « 🪄 Forgemager » dans l\'Inventaire.' : 'Aucun objet en inventaire : calcul libre. Les objets craftés apparaîtront ici.');
  fmEl.savedCard.style.display = fmEl.totalCard.style.display = fmEl.back.style.display = cur ? '' : 'none';
  var n = cur && cur.it.fmLog ? cur.it.fmLog.length : 0;
  fmEl.undo.style.display = n ? '' : 'none';
  if (cur) {
    fmEl.saved.textContent = n ? '−' + fmtInt(+cur.it.fmCost || 0) + ' K (' + n + ' session' + (n > 1 ? 's' : '') + ')' : 'Aucune';
    fmEl.saved.className = 'v' + (n ? ' neg' : '');
    fmEl.total.textContent = fmtInt(entryCost(cur)) + ' K';
  }
  fmShowSession();
}
function fmSelect(id) {
  fm.sel = id || null; fm.loaded = true;
  try { localStorage.setItem('ku_fm_sel', fm.sel ? String(fm.sel) : ''); } catch (e) {}
  setMsg(fmEl.msg, '');
  showTab('atelier');
  showAtPane('at-fm');
  window.scrollTo(0, 0);
}
[fmEl.avant, fmEl.apres].forEach(function (i) { i.addEventListener('input', fmCompute); });
fmEl.item.addEventListener('change', function () {
  fm.sel = +fmEl.item.value || null;
  try { localStorage.setItem('ku_fm_sel', fm.sel ? String(fm.sel) : ''); } catch (e) {}
  setMsg(fmEl.msg, '');
  fmRefresh();
});
fmEl.back.addEventListener('click', function () { showTab('inventaire'); window.scrollTo(0, 0); });
document.getElementById('fmSave').addEventListener('click', function () {
  if (!fm.sel || !findEntry('craft', fm.sel)) { setMsg(fmEl.msg, 'Choisis d\'abord l\'objet de l\'inventaire sur lequel enregistrer cette session.', 'err'); return; }
  if (!fmUsed()) { setMsg(fmEl.msg, 'Saisis la valeur de ton stock de runes avant et après la session.', 'err'); return; }
  var cost = fmSessionCost(), name = findEntry('craft', fm.sel).it.name;
  updateEntry('craft', fm.sel, function (it) {
    it.fmLog = (it.fmLog || []).concat([{ cost: cost, date: new Date().toISOString() }]);
    it.fmCost = (+it.fmCost || 0) + cost;
  });
  fmEl.avant.value = ''; fmEl.apres.value = '';
  fmCompute();
  refreshViews();
  setMsg(fmEl.msg, 'Session enregistrée sur « ' + name + ' » : ' + (cost >= 0 ? '−' : '+') + fmtInt(Math.abs(cost)) + ' K.', 'ok');
});
fmEl.undo.addEventListener('click', function () {
  var e = fm.sel ? findEntry('craft', fm.sel) : null;
  if (!e || !e.it.fmLog || !e.it.fmLog.length) return;
  updateEntry('craft', fm.sel, function (it) {
    var last = it.fmLog.pop();
    it.fmCost = (+it.fmCost || 0) - (+last.cost || 0);
    if (!it.fmLog.length) { delete it.fmLog; delete it.fmCost; }
  });
  refreshViews();
  setMsg(fmEl.msg, 'Dernière session annulée.', 'ok');
});

// ---------- Sous-onglets d'Investissements (Craft / Achat-revente) ----------
var ivPillBtns = document.querySelectorAll('#ivPills button');
function showIvPane(id) {
  document.querySelectorAll('.ivpane').forEach(function (p) {
    p.classList.toggle('active', p.id === id);
  });
  ivPillBtns.forEach(function (b) {
    b.classList.toggle('active', b.dataset.ivp === id);
  });
  try { localStorage.setItem('ku_ivp', id); } catch (e) {}
  navSync();
}
ivPillBtns.forEach(function (b) {
  b.addEventListener('click', function () { showIvPane(b.dataset.ivp); });
});

// ---------- Hôtel de vente & Dashboard ----------
var FEE = 0.01; // frais à chaque actualisation du prix : 1 % du nouveau prix

// Un objet enregistré = un craft ou un achat-revente. Il est « en vente » tant qu'il n'a pas de date de vente.
function hdvEntries() {
  var out = [];
  ivSaved().forEach(function (it) { out.push({ kind: 'craft', it: it }); });
  flSaved().forEach(function (it) { out.push({ kind: 'flip', it: it }); });
  out.sort(function (a, b) { return String(b.it.date || '').localeCompare(String(a.it.date || '')); });
  return out;
}
function findEntry(kind, id) {
  var r = null;
  hdvEntries().forEach(function (e) { if (e.kind === kind && e.it.id === id) r = e; });
  return r;
}
function entryPrice(e) {
  var it = e.it;
  if (it.price != null && isFinite(it.price)) return +it.price;
  return nv(e.kind === 'craft' ? it.prix : it.vente);
}
// Coût d'un craft = ressources (coût de base) + sessions de forgemagie + frais des mises en vente précédentes
function entryCost(e) {
  return entryBaseCost(e) + (e.kind === 'craft' ? (+e.it.fmCost || 0) + (+e.it.extra || 0) : 0);
}
function entryBaseCost(e) {
  var it = e.it;
  if (it.cost != null && isFinite(it.cost)) return +it.cost;
  if (e.kind === 'flip') return nv(it.achat);
  return nv(it.prix) * (1 - TAX) - (+it.net || 0); // anciens crafts : coût déduit du bénéfice enregistré
}
function entryFees(e) { return +e.it.fees || 0; }
// La taxe de 2 % est payée une fois, sur le prix de la mise en vente ; une actualisation
// ne coûte que ses frais de 1 %. Le prix d'origine est figé à la première actualisation.
function entryTaxBase(e) {
  var lp = e.it.listPrice;
  return lp != null && isFinite(lp) ? +lp : entryPrice(e);
}
function entryNet(e, price) {
  var p = price == null ? entryPrice(e) : price;
  var unit = p - TAX * entryTaxBase(e) - entryCost(e);
  return (isLot(e) ? lotStock(e) * unit : unit) - entryFees(e);
}
function isSold(e) { return !!e.it.soldAt; }
// Un lot = achat de gros : on suit un stock, vendu par morceaux
function isLot(e) { return e.kind === 'flip' && !!e.it.bulk && !e.it.sale; }
function lotStock(e) { return Math.max(0, Math.floor(nv(e.it.stock))); }
function isInv(e) { return !!e.it.inv && !e.it.soldAt; }
function isListed(e) { return !e.it.soldAt && !e.it.inv; }

// Quand on ré-enregistre depuis un calculateur, on garde l'historique de l'HDV
function keepHdv(entry, old) {
  ['fees', 'updates', 'listPrice', 'soldAt', 'soldPrice', 'soldNet', 'inv'].forEach(function (k) {
    if (old[k] != null) entry[k] = old[k];
  });
  if (old.date) entry.date = old.date;
}
function updateEntry(kind, id, fn) {
  var a = kind === 'craft' ? ivSaved() : flSaved();
  var found = false;
  a.forEach(function (it) { if (it.id === id) { fn(it); found = true; } });
  if (found) (kind === 'craft' ? ivStore : flStore)(a);
}
function removeEntry(kind, id) {
  if (kind === 'craft') ivStore(ivSaved().filter(function (it) { return it.id !== id; }));
  else flStore(flSaved().filter(function (it) { return it.id !== id; }));
  if (kind === 'craft' && iv.editing === id) iv.editing = null;
  if (kind === 'flip' && fl.editing === id) fl.editing = null;
}

// ----- Onglet Hôtel de vente -----
var hdvEl = {
  list: document.getElementById('hdvList'), info: document.getElementById('hdvInfo'),
  soldList: document.getElementById('hdvSoldList'), soldSum: document.getElementById('hdvSoldSum'),
  soldBox: document.getElementById('hdvSoldBox'),
  inv: document.getElementById('hdvInv')
};

var LOT_SIZES = [1, 10, 100, 1000];
function hdvLotHtml(e) {
  var it = e.it, unit = entryPrice(e), cost = entryCost(e), fees = entryFees(e), stock = lotStock(e);
  var total = Math.max(stock, Math.floor(nv(it.qty))), n = +it.updates || 0, net = entryNet(e);
  var value = stock * unit;
  return '<div class="hdv-item" data-k="flip" data-id="' + it.id + '" data-lot="1">' +
    '<div class="hdv-top"><div class="n">' + imgTag(it.icon, 'si') + '<span>' + esc(it.name) + '</span></div>' +
    '<div class="hdv-net ' + (net >= 0 ? 'pos' : 'neg') + '">' + fmtInt(net) + ' K</div></div>' +
    '<div class="hdv-meta" style="margin:0 0 10px">Stock restant : <b>' + fmtInt(stock) + '</b> / ' + fmtInt(total) +
    ' · déjà vendus : ' + fmtInt(total - stock) + '<br>' +
    'Valeur du stock : <b>' + fmtInt(value) + ' K</b> (≈ ' + fmtInt(value - stock * TAX * entryTaxBase(e)) + ' K après taxe de 2 %)<br>' +
    'Prix d\'achat unitaire : ' + fmtDec(cost) + ' K · prix de vente unitaire : <b>' + fmtDec(unit) + ' K</b></div>' +
    '<div class="hdv-lbl">Actualiser le prix</div>' +
    '<div class="hdv-price"><select class="ls" style="flex:none;width:auto">' + LOT_SIZES.map(function (l) {
      return '<option value="' + l + '">Lot de ' + l + '</option>'; }).join('') + '</select>' +
    '<div class="input-wrap"><input type="text" data-num inputmode="decimal" class="lp" value="' + esc(fmtField(Math.round(unit * 1000) / 1000)) + '"><span class="unit">K / lot</span></div>' +
    '<button class="btn-s" data-act="lotupd" disabled>Actualiser</button></div>' +
    '<div class="hdv-prev"></div>' +
    '<div class="hdv-meta">Frais d\'actualisation payés : ' + fmtInt(fees) + ' K' +
    (n ? ' (' + n + ' actualisation' + (n > 1 ? 's' : '') + ')' : '') + '</div>' +
    '<div class="hdv-lbl" style="margin-top:12px">Vente</div>' +
    '<div class="hdv-price"><div class="input-wrap"><input type="text" data-num inputmode="numeric" class="sq" placeholder="Quantité vendue"></div>' +
    '<button class="btn-s" data-act="lotsold">✓ Vendu</button></div>' +
    '<div class="msg lot-msg" style="margin:6px 0 0"></div>' +
    '<div class="hdv-btns"><button class="btn-s alt" data-act="edit">Modifier le calcul</button>' +
    '<button class="btn-s alt" data-act="rm">Supprimer</button></div></div>';
}
function hdvItemHtml(e) {
  if (isLot(e)) return hdvLotHtml(e);
  var it = e.it, price = entryPrice(e), cost = entryCost(e), fees = entryFees(e), net = entryNet(e);
  var n = +it.updates || 0;
  // Prix à partir duquel une actualisation (frais de 1 % inclus) laisse encore un bénéfice
  // (taxe déjà payée sur le prix de mise en vente, frais de 1 % sur le nouveau prix)
  var minPrice = Math.ceil(Math.max(cost + fees + TAX * entryTaxBase(e), 0) / (1 - FEE));
  return '<div class="hdv-item" data-k="' + e.kind + '" data-id="' + it.id + '">' +
    '<div class="hdv-top"><div class="n">' + imgTag(it.icon, 'si') + '<span>' + esc(it.name) + '</span></div>' +
    '<div class="hdv-net ' + (net >= 0 ? 'pos' : 'neg') + '">' + fmtInt(net) + ' K</div></div>' +
    '<div class="hdv-lbl">Prix en HDV</div>' +
    '<div class="hdv-price"><div class="input-wrap"><input type="text" data-num inputmode="decimal" class="hp" value="' + esc(fmtField(price)) + '"><span class="unit">K</span></div>' +
    '<button class="btn-s" data-act="upd" disabled>Actualiser</button></div>' +
    '<div class="hdv-prev"></div>' +
    '<div class="hdv-meta">Frais d\'actualisation payés : ' + fmtInt(fees) + ' K' +
    (n ? ' (' + n + ' actualisation' + (n > 1 ? 's' : '') + ')' : '') +
    '<br>Prix minimum pour une prochaine actualisation : <b>' + fmtInt(minPrice) + ' K</b></div>' +
    '<div class="hdv-btns"><button class="btn-s" data-act="sold">✓ Vendu</button>' +
    (e.kind === 'craft' ? '<button class="btn-s alt" data-act="unlist">↩ Retirer de la vente</button>' : '') +
    (e.kind === 'flip' ? '<button class="btn-s alt" data-act="edit">Modifier le calcul</button>' : '') +
    '<button class="btn-s alt" data-act="rm">Supprimer</button></div></div>';
}
function invPrevText(price, cost) {
  var net = price * (1 - TAX) - cost;
  return 'Bénéfice estimé : <b class="' + (net >= 0 ? 'pos' : 'neg') + '">' + fmtInt(net) + ' K</b> (taxe de 2 % déduite)';
}
function hdvInvHtml(e) {
  var it = e.it, price = entryPrice(e), cost = entryCost(e), net = price * (1 - TAX) - cost;
  return '<div class="saved-item" data-k="' + e.kind + '" data-id="' + it.id + '"><div>' +
    '<div class="n">' + imgTag(it.icon, 'si') + '<span>' + esc(it.name) + '</span></div>' +
    '<div class="s">Coût de craft : ' + fmtInt(entryBaseCost(e)) + ' K' +
    (it.fmLog && it.fmLog.length ? '<br>Forgemagie : <b class="neg">−' + fmtInt(+it.fmCost || 0) + ' K</b> (' + it.fmLog.length + ' session' + (it.fmLog.length > 1 ? 's' : '') + ')' : '') +
    (+it.extra > 0 ? '<br>Frais des mises en vente précédentes : <b class="neg">−' + fmtInt(+it.extra) + ' K</b>' : '') +
    ((it.fmLog && it.fmLog.length) || +it.extra > 0 ? '<br>Coût total : <b>' + fmtInt(cost) + ' K</b>' : '') + '</div>' +
    '<div class="hdv-lbl" style="margin-top:10px">Prix de vente</div>' +
    '<div class="input-wrap" style="max-width:240px"><input type="text" data-num inputmode="decimal" class="ip" placeholder="Prix en HDV" value="' + (price > 0 ? esc(fmtField(price)) : '') + '"><span class="unit">K</span></div>' +
    '<div class="s inv-prev" style="margin-top:6px">' + (price > 0 ? invPrevText(price, cost) : '') + '</div></div>' +
    '<div class="b"><button class="btn-s alt" data-act="fm">🪄 Forgemager</button>' +
    '<button class="btn-s" data-act="list">🏷️ Mettre en vente</button>' +
    '<button class="btn-s alt" data-act="rm">Supprimer</button></div></div>';
}
function dateFr(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function hdvSoldHtml(e) {
  var it = e.it;
  var sale = !!it.sale;
  return '<div class="saved-item" data-k="' + e.kind + '" data-id="' + it.id + '"><div>' +
    '<div class="n">' + imgTag(it.icon, 'si') + '<span>' + esc(it.name) + '</span></div>' +
    '<div class="s">Vendu le ' + esc(dateFr(it.soldAt)) + (sale ? ' : ' + fmtInt(nv(it.qty)) + ' × à ' + fmtDec(+it.soldPrice || 0) + ' K' : ' à ' + fmtInt(+it.soldPrice || 0) + ' K') + '</div></div>' +
    '<div class="v ' + ((+it.soldNet || 0) >= 0 ? 'pos' : 'neg') + '" style="font-size:18px;font-weight:700">' + fmtInt(+it.soldNet || 0) + ' K</div>' +
    '<div class="b">' + (sale ? '' : '<button class="btn-s" data-act="unsold">Remettre en vente</button>') +
    '<button class="btn-s alt" data-act="rm">Supprimer</button></div></div>';
}
function hdvRender() {
  var all = hdvEntries();
  var act = all.filter(isListed);
  var inv = all.filter(isInv);
  var sold = all.filter(isSold).sort(function (a, b) { return b.it.soldAt - a.it.soldAt; });

  hdvEl.info.textContent = act.length
    ? act.length + ' objet' + (act.length > 1 ? 's' : '') + ' en vente. Modifie le prix ici quand tu le changes en jeu : les frais de 1 % sont comptés dans ton bénéfice.'
    : '';
  hdvEl.list.innerHTML = act.length
    ? act.map(hdvItemHtml).join('')
    : '<div class="soon">Aucun objet en vente. Mets un objet de ton Inventaire en vente, ou enregistre un achat-revente depuis Investissements.</div>';

  hdvEl.inv.innerHTML = inv.length
    ? inv.map(hdvInvHtml).join('')
    : '<div class="soon" style="margin-bottom:18px">Inventaire vide. Enregistre un craft depuis Investissements : il arrivera ici.</div>';

  hdvEl.soldSum.textContent = 'Vendus (' + sold.length + ')';
  hdvEl.soldList.innerHTML = sold.length
    ? sold.map(hdvSoldHtml).join('')
    : '<div class="soon">Aucun objet vendu pour le moment.</div>';
}

// Aperçu en direct quand on change le prix : bénéfice après les frais de 1 %
function hdvPreview(box) {
  var e = findEntry(box.dataset.k, +box.dataset.id);
  if (!e) return;
  var inp = box.querySelector('.hp'), btn = box.querySelector('[data-act="upd"]'), prev = box.querySelector('.hdv-prev');
  var p = nv(inp.value);
  if (!(p > 0) || p === entryPrice(e)) { prev.innerHTML = ''; btn.disabled = true; return; }
  var fee = p * FEE;
  var net = entryNet(e, p) - fee;
  btn.disabled = false;
  prev.innerHTML = 'Après actualisation à ' + fmtInt(p) + ' K : frais +' + fmtInt(fee) + ' K, bénéfice <b class="' +
    (net >= 0 ? 'pos' : 'neg') + '">' + fmtInt(net) + ' K</b>' + (net < 0 ? ' (actualisation à perte)' : '');
}
// Lots : prix par lot (1, 10, 100…) -> prix unitaire ; frais de 1 % sur la valeur du stock remis en vente
function lotInputs(box) {
  var L = +box.querySelector('.ls').value || 1;
  var lotPrice = nv(box.querySelector('.lp').value);
  return { L: L, lotPrice: lotPrice, unit: lotPrice / L };
}
function hdvLotPreview(box) {
  var e = findEntry(box.dataset.k, +box.dataset.id);
  if (!e) return;
  var btn = box.querySelector('[data-act="lotupd"]'), prev = box.querySelector('.hdv-prev');
  var q = lotInputs(box), stock = lotStock(e);
  if (!(q.unit > 0) || Math.abs(q.unit - entryPrice(e)) < 1e-9 || !stock) { prev.innerHTML = ''; btn.disabled = true; return; }
  var fee = q.unit * stock * FEE, net = entryNet(e, q.unit) - fee;
  btn.disabled = false;
  prev.innerHTML = 'Soit ' + fmtDec(q.unit) + ' K l\'unité. Remise en vente de ' + fmtInt(stock) + ' unités (' + fmtDec(stock / q.L) + ' lot' + (stock / q.L > 1 ? 's' : '') +
    ' de ' + q.L + ') : frais +' + fmtInt(fee) + ' K, bénéfice potentiel <b class="' + (net >= 0 ? 'pos' : 'neg') + '">' + fmtInt(net) + ' K</b>' +
    (net < 0 ? ' (à perte)' : '');
}
function hdvLotUpdate(box) {
  var kind = box.dataset.k, id = +box.dataset.id, e = findEntry(kind, id);
  if (!e) return;
  var q = lotInputs(box), stock = lotStock(e);
  if (!(q.unit > 0) || !stock) return;
  var fee = q.unit * stock * FEE, net = entryNet(e, q.unit) - fee;
  if (net < 0 && !window.confirm('À ce prix, l\'actualisation te fait perdre de l\'argent (bénéfice potentiel : ' + fmtInt(net) + ' K). Actualiser quand même ?')) return;
  var before = entryPrice(e);
  updateEntry(kind, id, function (it) {
    if (it.listPrice == null) it.listPrice = before;
    it.price = q.unit;
    it.fees = (+it.fees || 0) + fee;
    it.updates = (+it.updates || 0) + 1;
  });
  refreshViews();
}
function hdvLotSold(box) {
  var kind = box.dataset.k, id = +box.dataset.id, e = findEntry(kind, id);
  var msg = box.querySelector('.lot-msg');
  if (!e) return;
  var stock = lotStock(e), q = Math.floor(nv(box.querySelector('.sq').value));
  if (!(q >= 1)) { setMsg(msg, 'Indique la quantité vendue.', 'err'); return; }
  if (q > stock) { setMsg(msg, 'Tu n\'as que ' + fmtInt(stock) + ' unités en stock.', 'err'); return; }
  var unit = entryPrice(e), cost = entryCost(e), feeShare = entryFees(e) * q / stock;
  var soldNet = q * (unit - TAX * entryTaxBase(e) - cost) - feeShare;
  var a = flSaved(), now = Date.now();
  var rest = [];
  a.forEach(function (it) {
    if (it.id !== id) { rest.push(it); return; }
    it.stock = stock - q;
    it.fees = Math.max(0, (+it.fees || 0) - feeShare);
    if (it.stock > 0) rest.push(it); // stock épuisé : le lot disparaît, l'historique reste dans « Vendus »
  });
  rest.unshift({
    id: now + Math.floor(Math.random() * 1000), name: e.it.name, icon: e.it.icon || null, bulk: true, sale: true,
    qty: q, soldAt: now, soldPrice: unit, soldNet: soldNet, cost: cost, date: new Date(now).toISOString()
  });
  flStore(rest);
  if (stock - q <= 0 && fl.editing === id) fl.editing = null;
  refreshViews();
}
function hdvUpdate(box) {
  var kind = box.dataset.k, id = +box.dataset.id;
  var e = findEntry(kind, id);
  var p = nv(box.querySelector('.hp').value);
  if (!e || !(p > 0) || p === entryPrice(e)) return;
  var net = entryNet(e, p) - p * FEE;
  if (net < 0 && !window.confirm('À ce prix, l\'actualisation te fait perdre de l\'argent (bénéfice : ' + fmtInt(net) + ' K). Actualiser quand même ?')) return;
  var before = entryPrice(e);
  updateEntry(kind, id, function (it) {
    if (it.listPrice == null) it.listPrice = before;
    it.price = p;
    it.fees = (+it.fees || 0) + p * FEE;
    it.updates = (+it.updates || 0) + 1;
  });
  refreshViews();
}

function hdvClick(e) {
  var b = e.target.closest ? e.target.closest('[data-act]') : null;
  if (!b) return;
  var box = b.closest('[data-k]');
  if (!box) return;
  var kind = box.dataset.k, id = +box.dataset.id, act = b.dataset.act;
  var entry = findEntry(kind, id);
  if (!entry) return;

  if (act === 'lotupd') {
    hdvLotUpdate(box);
  } else if (act === 'lotsold') {
    hdvLotSold(box);
  } else if (act === 'upd') {
    hdvUpdate(box);
  } else if (act === 'sold') {
    updateEntry(kind, id, function (it) {
      var x = { kind: kind, it: it };
      it.soldAt = Date.now();
      it.soldPrice = entryPrice(x);
      it.soldNet = entryNet(x);
    });
    refreshViews();
  } else if (act === 'unlist') {
    // retour en inventaire : les frais déjà payés deviennent un coût de l'objet, tout continue de s'additionner
    var back = entry.it.name, fees = entryFees(entry);
    updateEntry(kind, id, function (it) {
      it.extra = (+it.extra || 0) + (+it.fees || 0);
      delete it.fees; delete it.updates; delete it.listPrice;
      it.inv = true;
    });
    refreshViews();
    setMsg(document.getElementById('hdvMsg'), '« ' + back + ' » est retiré de la vente et revient dans l\'Inventaire' + (fees > 0 ? ' (frais déjà payés : ' + fmtInt(fees) + ' K, ajoutés à son coût)' : '') + '. Tu peux le forgemager puis le remettre en vente.', 'ok');
  } else if (act === 'fm') {
    fmSelect(id);
  } else if (act === 'list') {
    var ip = box.querySelector('.ip'), pr = ip ? nv(ip.value) : entryPrice(entry);
    if (!(pr > 0)) { setMsg(document.getElementById('invMsg'), 'Indique le prix de vente de « ' + entry.it.name + ' » avant de le mettre en vente.', 'err'); if (ip) ip.focus(); return; }
    updateEntry(kind, id, function (it) { delete it.inv; delete it.listPrice; it.price = pr; it.prix = String(pr); it.date = new Date().toISOString(); });
    refreshViews();
    setMsg(document.getElementById('invMsg'), '« ' + entry.it.name + ' » est maintenant dans l\'onglet Hôtel de vente.', 'ok');
  } else if (act === 'unsold') {
    updateEntry(kind, id, function (it) { delete it.soldAt; delete it.soldPrice; delete it.soldNet; });
    refreshViews();
  } else if (act === 'rm') {
    if (!window.confirm('Supprimer « ' + entry.it.name + ' » ?')) return;
    removeEntry(kind, id);
    refreshViews();
  } else if (act === 'edit') {
    var it = entry.it, price = fmtField(entryPrice(entry));
    showTab('investissements');
    if (kind === 'craft') {
      showIvPane('iv-craft');
      ivApply({ name: it.name, prix: price, rows: it.rows, avant: it.avant, apres: it.apres, editing: it.id, icon: it.icon });
      setMsg(ivEl.msg, ''); setMsg(ivEl.saveMsg, '');
    } else {
      showIvPane('iv-flip');
      flApply({ name: it.name, achat: it.achat, vente: price, icon: it.icon, editing: it.id, bulk: it.bulk, qty: it.qty });
      setMsg(flEl.saveMsg, '');
    }
    window.scrollTo(0, 0);
  }
}
hdvEl.list.addEventListener('click', hdvClick);
hdvEl.soldList.addEventListener('click', hdvClick);
hdvEl.inv.addEventListener('click', hdvClick);
hdvEl.inv.addEventListener('input', function (e) {
  if (!(e.target.classList && e.target.classList.contains('ip'))) return;
  var box = e.target.closest('[data-k]'), en = box && findEntry(box.dataset.k, +box.dataset.id);
  if (!en) return;
  var pr = nv(e.target.value), out = box.querySelector('.inv-prev');
  out.innerHTML = pr > 0 ? invPrevText(pr, entryCost(en)) : '';
});
hdvEl.list.addEventListener('input', function (e) {
  var c = e.target.classList;
  if (c && c.contains('hp')) hdvPreview(e.target.closest('.hdv-item'));
  if (c && c.contains('lp')) hdvLotPreview(e.target.closest('.hdv-item'));
});
// Changer la taille du lot : le prix du lot suit (prix unitaire x taille)
hdvEl.list.addEventListener('change', function (e) {
  if (!(e.target.classList && e.target.classList.contains('ls'))) return;
  var box = e.target.closest('.hdv-item'), en = findEntry(box.dataset.k, +box.dataset.id);
  if (!en) return;
  box.querySelector('.lp').value = fmtField(Math.round(entryPrice(en) * (+e.target.value || 1) * 1000) / 1000);
  hdvLotPreview(box);
});

// ----- Dashboard -----
var DONUT_COLORS = ['#4e97c0', '#c4896d', '#7bb87a', '#b48ad0', '#d6b85a', '#6fb7b0', '#c76f87'];
var DONUT_OTHER = '#8a8f98';

function donutHtml(list) {
  if (!list.length) {
    return donutSvg([], 0) + '<div class="legend"><span class="none">Rien en vente</span></div>';
  }
  var items = list.map(function (e) { return { name: e.it.name, net: entryNet(e) }; })
    .sort(function (a, b) { return b.net - a.net; });
  var total = items.reduce(function (s, x) { return s + x.net; }, 0);
  var pos = items.filter(function (x) { return x.net > 0; });
  var losses = items.length - pos.length;
  var parts = pos.slice(0, 7).map(function (x, i) { return { name: x.name, v: x.net, color: DONUT_COLORS[i] }; });
  if (pos.length > 7) {
    parts.push({
      name: 'Autres (' + (pos.length - 7) + ')', color: DONUT_OTHER,
      v: pos.slice(7).reduce(function (s, x) { return s + x.net; }, 0)
    });
  }
  var legend = parts.map(function (p) {
    return '<span><i style="background:' + p.color + '"></i>' + esc(p.name) + '</span>';
  }).join('');
  if (losses) legend += '<span class="none">' + losses + ' objet' + (losses > 1 ? 's' : '') + ' sans bénéfice, non représenté' + (losses > 1 ? 's' : '') + '</span>';
  return donutSvg(parts, total) + '<div class="legend">' + legend + '</div>';
}
function donutSvg(parts, total) {
  var R = 72, C = 2 * Math.PI * R, off = 0;
  var sum = parts.reduce(function (s, p) { return s + p.v; }, 0);
  var svg = '<svg class="donut" viewBox="0 0 200 200" role="img" aria-label="Répartition des bénéfices">' +
    '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="#2a2a2a" stroke-width="30"/>';
  parts.forEach(function (p) {
    var len = sum > 0 ? p.v / sum * C : 0;
    svg += '<circle cx="100" cy="100" r="' + R + '" fill="none" stroke="' + p.color + '" stroke-width="30" ' +
      'stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 100 100)">' +
      '<title>' + esc(p.name) + ' : ' + fmtInt(p.v) + ' K</title></circle>';
    off += len;
  });
  svg += '<text class="dc-k" x="100" y="96" text-anchor="middle">Bénéfices</text>' +
    '<text class="dc-v" x="100" y="118" text-anchor="middle">' + (parts.length || total ? fmtInt(total) + ' K' : '–') + '</text></svg>';
  return svg;
}

var period = 'week';
try { period = localStorage.getItem('ku_period') || 'week'; } catch (e) {}
var periodBtns = document.querySelectorAll('#periodPills button');
periodBtns.forEach(function (b) {
  b.addEventListener('click', function () {
    period = b.dataset.period;
    try { localStorage.setItem('ku_period', period); } catch (e) {}
    dashRender();
  });
});
// Semaine = du lundi au dimanche en cours ; mois = mois en cours
function periodRange() {
  var d = new Date(), start, end, cap;
  if (period === 'month') {
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    cap = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } else {
    var day = (d.getDay() + 6) % 7;
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + 7);
    var last = new Date(end.getTime() - 86400000);
    var f = { weekday: 'short', day: 'numeric', month: 'short' };
    cap = 'Semaine du ' + start.toLocaleDateString('fr-FR', f) + ' au ' + last.toLocaleDateString('fr-FR', f);
  }
  return { start: start.getTime(), end: end.getTime(), cap: cap };
}

function dashRender() {
  var all = hdvEntries();
  var act = all.filter(isListed);
  var ben = 0;
  act.forEach(function (e) { ben += entryNet(e); });
  setSigned(document.getElementById('dBen'), fmtInt(ben) + ' K', ben);

  document.getElementById('dDonutCraft').innerHTML = donutHtml(act.filter(function (e) { return e.kind === 'craft'; }));
  document.getElementById('dDonutFlip').innerHTML = donutHtml(act.filter(function (e) { return e.kind === 'flip'; }));

  var r = periodRange();
  var sold = all.filter(function (e) { return isSold(e) && e.it.soldAt >= r.start && e.it.soldAt < r.end; });
  var profit = 0;
  sold.forEach(function (e) { profit += +e.it.soldNet || 0; });
  var units = 0;
  sold.forEach(function (e) { units += e.it.sale ? Math.max(1, Math.floor(nv(e.it.qty))) : 1; });
  document.getElementById('dSoldCount').textContent = fmtInt(units);
  setSigned(document.getElementById('dSoldProfit'), fmtInt(profit) + ' K', profit);
  document.getElementById('dPeriodCap').textContent = r.cap;
  periodBtns.forEach(function (b) { b.classList.toggle('active', b.dataset.period === period); });
}

document.getElementById('goHdv').addEventListener('click', function () { showTab('hdv'); window.scrollTo(0, 0); });

function refreshViews() {
  rsRender();
  ivRefreshPrices();
  hdvRender();
  dashRender();
  almRender();
  atRender();
  fmRefresh();
  backupRender();
}


// ---------- Almanax (données : API Dofusdude) ----------
var ALM_BASE = 'https://api.dofusdu.de/dofus3/v1/fr/almanax';
var ALM_CHUNK = 30, ALM_CHUNKS = 13; // 13 x 30 jours = environ 1 an d'avance
var alm = { status: 'idle', list: [], error: '', shown: 7, diag: '', view: 'fav', pickOpen: false, types: [] };
var almEl = {
  today: document.getElementById('almToday'), list: document.getElementById('almList'),
  more: document.getElementById('almMore'), retry: null
};

function ymdOf(d) {
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function ymdToTs(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : NaN;
}
function safeUrl(u) { return typeof u === 'string' && /^https:\/\//i.test(u) ? u : ''; }

function almNorm(o) {
  if (!o || typeof o !== 'object') return null;
  var bonus = o.bonus || {};
  var btype = bonus.type && typeof bonus.type === 'object' ? (bonus.type.name || bonus.type.id || '') : (bonus.type || '');
  var tr = o.tribute || o.offering || {};
  var item = tr.item || o.item || {};
  var imgs = item.image_urls || item.images || {};
  var img = typeof imgs === 'string' ? imgs : (imgs.icon || imgs.sd || imgs.hq || imgs.hd || item.image_url || item.img || '');
  var q = tr.quantity != null ? tr.quantity : o.quantity;
  var id = parseInt(item.ankama_id != null ? item.ankama_id : item.id, 10);
  var r = {
    date: String(o.date || ''), btype: String(btype || ''), bdesc: String(bonus.description || bonus.text || ''),
    iname: String(item.name || item.title || ''), qty: isFinite(+q) ? +q : null, img: safeUrl(img),
    id: id > 0 ? id : null, reward: isFinite(+o.reward_kamas) && o.reward_kamas != null ? +o.reward_kamas : null
  };
  return isNaN(ymdToTs(r.date)) ? null : r;
}
function almParse(r) {
  var arr = Array.isArray(r) ? r : (r && Array.isArray(r.data) ? r.data : (r && Array.isArray(r.days) ? r.days : (r && r.date ? [r] : [])));
  return arr.map(almNorm).filter(Boolean).sort(function (a, b) { return ymdToTs(a.date) - ymdToTs(b.date); });
}

// Plusieurs plages de 30 jours demandées en parallèle : on garde tout ce qui répond, la plus lointaine date disponible est affichée
function almFetchList() {
  var base = new Date(), reqs = [], errs = [];
  for (var i = 0; i < ALM_CHUNKS; i++) {
    (function (i) {
      var from = ymdOf(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i * ALM_CHUNK));
      var to = ymdOf(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i * ALM_CHUNK + ALM_CHUNK - 1));
      var url = ALM_BASE + '?range%5Bfrom%5D=' + from + '&range%5Bto%5D=' + to + '&timezone=Europe%2FParis';
      reqs.push(getJson(url).then(almParse).catch(function (e) {
        if (errs.length < 2) { errs.push(from + ' → ' + (e && e.message)); alm.diag = errs.join(' · '); }
        return [];
      }));
    })(i);
  }
  return Promise.all(reqs).then(function (parts) {
    var seen = {}, list = [];
    parts.forEach(function (p) { p.forEach(function (x) { if (!seen[x.date]) { seen[x.date] = 1; list.push(x); } }); });
    list.sort(function (a, b) { return ymdToTs(a.date) - ymdToTs(b.date); });
    if (list.length) return list;
    // dernier recours : la date du jour seule
    return getJson(ALM_BASE + '/' + ymdOf(base)).then(almParse).then(function (l) {
      if (!l.length) throw new Error('réponse inattendue');
      return l;
    });
  });
}

function almLoad(force) {
  var today = ymdOf(new Date());
  if (!force) {
    try {
      var c = JSON.parse(localStorage.getItem('kc_alm') || 'null');
      if (c && c.v === 2 && c.day === today && Array.isArray(c.list) && c.list.length) {
        alm.list = c.list; alm.status = 'ok'; almRender(); return;
      }
    } catch (e) {}
  }
  alm.status = 'loading';
  almRender();
  almFetchList().then(function (list) {
    alm.list = list; alm.status = 'ok';
    try { localStorage.setItem('kc_alm', JSON.stringify({ v: 2, day: today, list: list })); } catch (e) {}
    almRender();
  }).catch(function (err) {
    alm.status = 'error';
    alm.error = err && err.message && err.message !== 'Failed to fetch' ? err.message : 'connexion impossible';
    almRender();
  });
}

function almImg(url, cls) {
  return url ? '<img class="' + cls + '" src="' + esc(url) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '';
}
function almDateFr(s, opts) { return new Date(ymdToTs(s)).toLocaleDateString('fr-FR', opts); }
// Prix de l'offrande : le plus récent entre ton prix saisi et le fichier de prix
function almPrice(x) {
  var i = rsInfo(x.iname, x.id, 0);
  if (!(i.price > 0)) return null;
  var q = x.qty != null ? x.qty : 1;
  return { unit: i.price, total: i.price * q, info: i };
}
function almPriceSrc(i) {
  return (i.src === 'fichier' ? 'Price.json' : 'ton prix') + (i.at > 0 ? ', ' + dateFr(i.at) : '') + (RS_FRESH[i.fr] ? ', ' + RS_FRESH[i.fr] : '');
}

// Bonus suivis (3 maximum) : par défaut « Économie d'ingrédients » tant que rien n'a été choisi
var ALM_MAXFAV = 3;
function almFavGet(types) {
  var raw = null;
  try { raw = localStorage.getItem('ku_alm_fav'); } catch (e) {}
  if (raw === null) {
    var d = types.filter(function (t) { return /conomie d.ingr/i.test(t); });
    return d.slice(0, 1);
  }
  try {
    var a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }).slice(0, ALM_MAXFAV) : [];
  } catch (e) { return []; }
}
function almFavSet(a) { try { localStorage.setItem('ku_alm_fav', JSON.stringify(a)); } catch (e) {} }
function almWhen(n) { return n === 0 ? 'aujourd\'hui' : (n === 1 ? 'demain' : 'dans ' + n + ' jours'); }

function almRender() {
  almEl.favs = almEl.favs || document.getElementById('almFavs');
  almEl.seg = almEl.seg || document.getElementById('almSeg');
  almEl.pick = almEl.pick || document.getElementById('almPick');
  almEl.note = almEl.note || document.getElementById('almNote');
  function clear() { almEl.favs.innerHTML = almEl.seg.innerHTML = almEl.list.innerHTML = almEl.pick.innerHTML = ''; almEl.more.style.display = 'none'; }
  if (alm.status === 'loading' || alm.status === 'idle') {
    almEl.today.innerHTML = '<div class="soon">Chargement de l\'Almanax…</div>';
    clear(); almEl.note.innerHTML = '';
    return;
  }
  if (alm.status === 'error') {
    almEl.today.innerHTML = '<div class="soon">Almanax indisponible pour le moment (' + esc(alm.error) + ').<br>' +
      '<div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
      '<button class="btn-s" id="almRetry">Réessayer</button>' +
      '<a class="btn-s alt" href="https://www.krosmoz.com/fr/almanax" target="_blank" rel="noopener" style="text-decoration:none;color:inherit">Voir l\'Almanax officiel</a></div>' +
      (alm.diag ? '<details style="margin-top:12px;text-align:left"><summary>Détails techniques</summary><div style="font-size:12px;word-break:break-word;margin-top:6px">' + esc(alm.diag) + '</div></details>' : '') + '</div>';
    clear(); almEl.note.innerHTML = '';
    document.getElementById('almRetry').addEventListener('click', function () { almLoad(true); });
    return;
  }
  var todayTs = ymdToTs(ymdOf(new Date()));
  var upcoming = alm.list.filter(function (x) { return ymdToTs(x.date) >= todayTs; });
  if (!upcoming.length) upcoming = alm.list.slice(-1);
  var first = upcoming[0];
  var isToday = ymdToTs(first.date) === todayTs;
  var dayN = function (x) { return Math.round((ymdToTs(x.date) - todayTs) / 86400000); };

  // 1) carte du jour
  almEl.today.innerHTML = '<div class="alm-today">' + almImg(first.img, 'alm-big') + '<div class="alm-tx">' +
    '<div class="k">' + (isToday ? 'Aujourd\'hui' : 'Prochain Almanax') + ' · ' + esc(almDateFr(first.date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</div>' +
    '<div class="alm-item">' + esc(first.iname || '—') + (first.qty != null ? ' <b>× ' + fmtInt(first.qty) + '</b>' : '') + '</div>' +
    almPriceHtml(first) +
    (first.btype || first.bdesc ? '<div class="alm-bonus">' + (first.btype ? '<b>' + esc(first.btype) + '</b>' : '') +
      (first.btype && first.bdesc ? ' : ' : '') + esc(first.bdesc) + '</div>' : '') + '</div></div>';

  function almPriceHtml(x) {
    var p = almPrice(x), rw = x.reward;
    var h = '<div class="alm-prix">';
    h += p ? 'Coût : <b>' + fmtInt(p.total) + ' K</b>' + (x.qty > 1 ? ' (' + fmtInt(p.unit) + ' K l\'unité)' : '') +
      ' <small>· ' + esc(almPriceSrc(p.info)) + '</small>' : 'Coût : <span class="muted">prix inconnu</span>';
    if (rw != null) {
      h += '<br>Récompense : <b>' + fmtInt(rw) + ' K</b>';
      if (p) { var bil = rw - p.total; h += ' · bilan <b class="' + (bil >= 0 ? 'pos' : 'neg') + '">' + (bil > 0 ? '+' : '') + fmtInt(bil) + ' K</b>'; }
    }
    return h + '</div>';
  }
  // 2) bonus suivis : une ligne par bonus avec le prochain jour concerné
  var types = {};
  upcoming.forEach(function (x) { if (x.btype) types[x.btype] = 1; });
  var names = Object.keys(types).sort();
  var favs = almFavGet(names);
  almEl.favs.innerHTML = favs.map(function (f) {
    var hit = null;
    for (var i = 0; i < upcoming.length && !hit; i++) if (upcoming[i].btype === f) hit = upcoming[i];
    return '<div class="alm-fav">⭐ <b>' + esc(f) + '</b> · ' + (hit
      ? esc(almDateFr(hit.date, { weekday: 'short', day: 'numeric', month: 'short' })) + ' <span>(' + almWhen(dayN(hit)) + ')</span>'
      : '<span>aucun jour connu pour l\'instant</span>') + '</div>';
  }).join('');

  // 3) liste : « Mes bonus » ou « Tous les jours »
  var view = favs.length ? alm.view : 'all';
  var rest = upcoming.slice(1);
  var base = view === 'fav' ? rest.filter(function (x) { return favs.indexOf(x.btype) >= 0; }) : rest;
  var shown = base.slice(0, alm.shown);
  almEl.seg.innerHTML = favs.length
    ? '<div class="alm-seg"><button class="alm-chip' + (view === 'fav' ? ' on' : '') + '" data-view="fav">⭐ Mes bonus</button>' +
      '<button class="alm-chip' + (view === 'all' ? ' on' : '') + '" data-view="all">Tous les jours</button></div>'
    : '<p class="opt" style="margin:14px 0 8px">Choisis les bonus à suivre en bas de cette carte : tu verras ici uniquement les jours qui t\'intéressent.</p>';
  almEl.list.innerHTML = shown.length ? shown.map(function (x) {
    var n = dayN(x);
    var when = view === 'fav' ? almWhen(n) : (n === 1 ? 'demain' : '');
    return '<div class="alm-row"><div class="alm-day"><b>' + esc(almDateFr(x.date, { day: 'numeric' })) + '</b><span>' +
      esc(almDateFr(x.date, { weekday: 'short' }).replace('.', '')) + ' ' + esc(almDateFr(x.date, { month: 'short' }).replace('.', '')) + '</span></div>' +
      almImg(x.img, 'alm-ico') + '<div class="alm-main"><div class="alm-rn">' + esc(x.iname || '—') + (x.qty != null ? ' <b>× ' + fmtInt(x.qty) + '</b>' : '') + '</div>' +
      (x.btype && !(view === 'fav' && favs.length === 1) ? '<div class="alm-rb">' + esc(x.btype) + '</div>' : '') + '</div>' +
      '<div class="alm-side">' + almRowPrice(x) + (when ? '<div class="alm-when">' + when + '</div>' : '') + '</div></div>';
  }).join('') : '<div class="soon">' + (view === 'fav' ? 'Aucun jour avec tes bonus pour le moment.' : 'Rien à afficher.') + '</div>';
  almEl.more.style.display = base.length > alm.shown ? '' : 'none';

  // 4) choix des bonus suivis (replié)
  alm.types = names;
  almEl.pick.innerHTML = '<details class="alm-pick"' + (alm.pickOpen ? ' open' : '') + '><summary>⚙ Choisir mes bonus à suivre (' + favs.length + '/' + ALM_MAXFAV + ')</summary>' +
    names.map(function (n, i) {
      return '<label class="check"><input type="checkbox" data-fav="' + i + '"' + (favs.indexOf(n) >= 0 ? ' checked' : '') + '> ' + esc(n) + '</label>';
    }).join('') + '</details>';

  var last = upcoming[upcoming.length - 1];
  almEl.note.innerHTML = 'Données jusqu\'au ' + esc(almDateFr(last.date, { day: 'numeric', month: 'long', year: 'numeric' })) +
    ' · Source : <a href="https://www.dofusdu.de/" target="_blank" rel="noopener">Dofusdude</a> · <a href="https://www.krosmoz.com/fr/almanax" target="_blank" rel="noopener">Almanax officiel</a>';
}
function almRowPrice(x) {
  var p = almPrice(x);
  return '<div class="alm-rp" title="' + (p ? esc(almPriceSrc(p.info)) : 'prix inconnu') + '">' + (p ? fmtInt(p.total) + ' K' : '–') + '</div>';
}
almEl.more.addEventListener('click', function () { alm.shown += 30; almRender(); });
document.getElementById('almBox').addEventListener('click', function (e) {
  var c = e.target.closest ? e.target.closest('[data-view]') : null;
  if (c) { alm.view = c.dataset.view; alm.shown = 7; almRender(); }
});
document.getElementById('almBox').addEventListener('change', function (e) {
  var t = e.target;
  if (!t.dataset || t.dataset.fav == null) return;
  var name = alm.types && alm.types[+t.dataset.fav];
  if (!name) return;
  var cur = almFavGet(alm.types || []).filter(function (x) { return x !== name; });
  if (t.checked) cur.push(name);
  if (cur.length > ALM_MAXFAV) { cur = cur.slice(cur.length - ALM_MAXFAV); } // le plus ancien est remplacé
  almFavSet(cur);
  alm.shown = 7;
  almRender();
});
document.getElementById('almBox').addEventListener('toggle', function (e) {
  if (e.target && e.target.classList && e.target.classList.contains('alm-pick')) alm.pickOpen = e.target.open;
}, true);


// ---------- Atelier : plusieurs objets à fabriquer + liste de courses ----------
var atEl = {
  items: document.getElementById('atItems'), shop: document.getElementById('atShop'),
  msg: document.getElementById('atMsg'), sec: document.getElementById('atShopSec')
};
function atSaved() {
  try { var a = JSON.parse(localStorage.getItem('ku_atelier') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function atStore(a) { try { localStorage.setItem('ku_atelier', JSON.stringify(a)); } catch (e) {} }
function atDone() {
  try { var d = JSON.parse(localStorage.getItem('ku_atelier_done') || '{}'); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; } catch (e) { return {}; }
}
function atDoneStore(d) { try { localStorage.setItem('ku_atelier_done', JSON.stringify(d)); } catch (e) {} }
function atStock() {
  try { var d = JSON.parse(localStorage.getItem('ku_atelier_stock') || '{}'); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; } catch (e) { return {}; }
}
function atKey(n) { return String(n).trim().toLowerCase(); }
function atQty(v) { var n = Math.floor(nv(v)); return n < 1 ? 1 : (n > 9999 ? 9999 : n); }

// Totaux par ressource, tous objets confondus
function atTotals() {
  var map = {}, order = [];
  atSaved().forEach(function (it) {
    var n = atQty(it.qty);
    (it.rows || []).forEach(function (r) {
      var name = String(r.name || '').trim(), q = nv(r.qty);
      if (!name || q <= 0) return;
      var k = atKey(name);
      if (!map[k]) { map[k] = { key: k, name: name, icon: r.icon || null, id: null, qty: 0, price: 0 }; order.push(k); }
      map[k].qty += q * n;
      if (!map[k].id && r.id) map[k].id = r.id;
      if (!map[k].icon && r.icon) map[k].icon = r.icon;
      if (nv(r.price) > 0) map[k].rprice = nv(r.price);
    });
  });
  return order.map(function (k) {
    var t = map[k];
    t.rprice = t.rprice || 0;
    t.info = rsInfo(t.name, t.id, t.rprice);
    t.price = t.info.price;
    return t;
  });
}

function atRender() {
  var items = atSaved();
  if (!items.length) {
    atEl.items.innerHTML = '<div class="soon">Aucun objet pour le moment.</div>';
    atEl.sec.style.display = 'none';
    return;
  }
  atEl.sec.style.display = '';
  atEl.items.innerHTML = items.map(function (it) {
    var rows = (it.rows || []).filter(function (r) { return r && r.name && nv(r.qty) > 0; }).length;
    var unit = 0;
    (it.rows || []).forEach(function (r) { unit += nv(r.qty) * rsInfo(r.name, r.id, nv(r.price)).price; });
    var n = atQty(it.qty);
    return '<div class="at-item" data-id="' + esc(it.id) + '">' + imgTag(it.icon, '') +
      '<div class="at-name">' + esc(it.name || 'Sans nom') + '<small>' + rows + ' ressource' + (rows > 1 ? 's' : '') + '</small></div>' +
      (unit > 0 ? '<div class="at-cost"><b>' + fmtInt(unit * n) + ' K</b><small>' + fmtInt(unit) + ' K l\'unité</small></div>' : '') +
      '<div class="at-step"><button data-at="minus" aria-label="Moins">−</button>' +
      '<input type="text" inputmode="numeric" data-at="qty" value="' + atQty(it.qty) + '">' +
      '<button data-at="plus" aria-label="Plus">+</button></div>' +
      '<button class="at-x" data-at="del" aria-label="Retirer">✕</button>' +
      '<div class="at-act"><button class="btn-s" data-at="crafted">✓ Crafté</button>' +
      (n > 1 ? '<button class="btn-s alt" data-at="craftedall">✓ Tout crafté (' + n + ')</button>' : '') + '</div></div>';
  }).join('');

  var done = atDone(), stock = atStock(), tot = atTotals(), all = 0, left = 0;
  atEl.shop.innerHTML = tot.length ? tot.map(function (t) {
    var have = Math.max(0, nv(stock[t.key])), need = Math.max(0, t.qty - have);
    var cost = t.price * need, isDone = !!done[t.key] || need === 0;
    all += cost; if (!isDone) left += cost;
    var sub = 'Besoin : ' + fmtInt(t.qty) + (have > 0 ? ' · stock : ' + fmtInt(have) : '') +
      (t.price > 0 && need > 0 ? ' · ' + fmtInt(cost) + ' K' : '');
    return '<div class="at-row' + (isDone ? ' done' : '') + '"><input type="checkbox" data-at="chk" data-k="' + esc(t.key) + '"' + (isDone ? ' checked' : '') + (need === 0 ? ' disabled' : '') + '>' +
      imgTag(t.icon, '') + '<div class="at-name">' + esc(t.name) + '<small>' + sub + '</small></div>' +
      '<input class="at-stock" type="text" inputmode="numeric" placeholder="Stock" aria-label="Stock de ' + esc(t.name) + '" data-at="stock" data-k="' + esc(t.key) + '" value="' + (have > 0 ? esc(fmtInt(have)) : '') + '">' +
      '<div class="at-q">× ' + fmtInt(need) + '</div></div>';
  }).join('') + (all > 0 ? '<div class="at-tot"><span>Coût total estimé : ' + fmtInt(all) + ' K</span><span>Reste à acheter : ' + fmtInt(left) + ' K</span></div>' : '')
    : '<div class="soon">Aucune ressource avec une quantité.</div>';
}

// Objet crafté en jeu : un exemplaire par unité part dans l'Inventaire, les ressources utilisées sortent du stock
function atCraft(a, idx, n) {
  var it = a[idx];
  n = Math.max(1, Math.min(n, atQty(it.qty)));
  var rows = (it.rows || []).filter(function (r) { return r && String(r.name || '').trim() && nv(r.qty) > 0; })
    .map(function (r) { return { name: r.name, qty: r.qty, price: r.price, icon: r.icon || null, id: r.id || null }; });
  var cout = 0; rows.forEach(function (r) { cout += nv(r.qty) * nv(r.price); });
  var cost = it.cost != null && isFinite(it.cost) ? +it.cost : cout, prix = nv(it.prix);
  var inv = ivSaved(), base = idLibre(inv);
  for (var k = n - 1; k >= 0; k--) {
    inv.unshift({
      id: base + k, name: it.name, prix: it.prix || '', rows: JSON.parse(JSON.stringify(rows)),
      avant: it.avant || '', apres: it.apres || '', net: prix > 0 ? prix * (1 - TAX) - cost : -cost,
      cout: cout, seuil: 0, icon: it.icon || null, cost: cost, price: prix,
      date: new Date().toISOString(), inv: true
    });
  }
  ivStore(inv);
  var st = atStock();
  rows.forEach(function (r) {
    var key = atKey(r.name), left = Math.max(0, nv(st[key]) - nv(r.qty) * n);
    if (left > 0) st[key] = left; else delete st[key];
  });
  try { localStorage.setItem('ku_atelier_stock', JSON.stringify(st)); } catch (e) {}
  it.qty = atQty(it.qty) - n;
  if (it.qty < 1) a.splice(idx, 1);
  atStore(a);
  refreshViews();
  setMsg(document.getElementById('atItemMsg'), n + ' × ' + it.name + ' ajouté' + (n > 1 ? 's' : '') + ' à l\'Inventaire (une ligne par objet). Les ressources utilisées sont retirées de ton stock.', 'ok');
}

atEl.items.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-at]') : null;
  var row = e.target.closest ? e.target.closest('.at-item') : null;
  if (!b || !row || b.dataset.at === 'qty') return;
  var id = row.dataset.id, a = atSaved();
  var idx = -1; a.forEach(function (it, i) { if (String(it.id) === id) idx = i; });
  if (idx < 0) return;
  if (b.dataset.at === 'crafted' || b.dataset.at === 'craftedall') { atCraft(a, idx, b.dataset.at === 'craftedall' ? atQty(a[idx].qty) : 1); return; }
  if (b.dataset.at === 'del') a.splice(idx, 1);
  else a[idx].qty = Math.max(1, atQty(a[idx].qty) + (b.dataset.at === 'plus' ? 1 : -1));
  atStore(a); atRender();
});
atEl.items.addEventListener('change', function (e) {
  var t = e.target, row = t.closest ? t.closest('.at-item') : null;
  if (!row || t.dataset.at !== 'qty') return;
  var a = atSaved();
  a.forEach(function (it) { if (String(it.id) === row.dataset.id) it.qty = atQty(t.value); });
  atStore(a); atRender();
});
atEl.shop.addEventListener('change', function (e) {
  var t = e.target;
  if (t.dataset && t.dataset.at === 'stock') {
    var st = atStock(), v = Math.floor(nv(t.value));
    if (v > 0) st[t.dataset.k] = v; else delete st[t.dataset.k];
    try { localStorage.setItem('ku_atelier_stock', JSON.stringify(st)); } catch (e) {}
    atRender();
    return;
  }
  if (!t.dataset || t.dataset.at !== 'chk') return;
  var d = atDone();
  if (t.checked) d[t.dataset.k] = 1; else delete d[t.dataset.k];
  atDoneStore(d); atRender();
});
document.getElementById('atUncheck').addEventListener('click', function () { atDoneStore({}); atRender(); setMsg(atEl.msg, ''); });
document.getElementById('atClear').addEventListener('click', function () {
  if (!window.confirm('Vider tout l\'Atelier (objets et liste de courses) ?')) return;
  atStore([]); atDoneStore({}); try { localStorage.removeItem('ku_atelier_stock'); } catch (e) {} atRender(); setMsg(atEl.msg, 'Atelier vidé.', 'ok');
});
document.getElementById('atCopy').addEventListener('click', function () {
  var lines = ['Objets à fabriquer :'];
  atSaved().forEach(function (it) { lines.push('- ' + atQty(it.qty) + ' × ' + (it.name || 'Sans nom')); });
  lines.push('', 'Liste de courses :');
  var d = atDone();
  var stk = atStock();
  atTotals().forEach(function (t) {
    var need = Math.max(0, t.qty - Math.max(0, nv(stk[t.key])));
    if (need > 0) lines.push((d[t.key] ? '[x] ' : '[ ] ') + fmtInt(need) + ' × ' + t.name);
  });
  var text = lines.join('\n');
  var ok = function () { setMsg(atEl.msg, 'Liste copiée dans le presse-papiers.', 'ok'); };
  var ko = function () { setMsg(atEl.msg, 'Copie impossible depuis ce navigateur.', 'err'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, ko); else ko();
});

// Depuis Investissements → Craft
document.getElementById('ivAtAdd').addEventListener('click', function () {
  var r = ivRecipe();
  if (!r) return;
  var cout = 0; r.rows.forEach(function (x) { cout += nv(x.qty) * nv(x.price); });
  var a = atSaved(), found = null;
  a.forEach(function (it) { if (atKey(it.name) === atKey(r.name)) found = it; });
  if (found) { found.qty = Math.min(9999, atQty(found.qty) + r.n); found.rows = r.rows; found.icon = r.icon || found.icon || null; found.cost = cout; delete found.prix; }
  else a.push({ id: Date.now(), name: r.name, icon: r.icon, qty: r.n, rows: r.rows, cost: cout });
  atStore(a);
  document.getElementById('ivQty').value = '1';
  refreshViews();
  setMsg(ivEl.saveMsg, 'Ajouté à l\'Atelier : ' + r.n + ' × ' + r.name + '.', 'ok');
});

// ---------- Prix des ressources (pour les crafts de l'Atelier) ----------
// Trois sources par ressource : prix saisi ici, fichier de prix (donnees/Price/, via le serveur
// local), prix tapé dans la recette. Entre le prix saisi et celui du fichier, le plus récent gagne.
function rsPrices() {
  try { var d = JSON.parse(localStorage.getItem('ku_prix') || '{}'); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; } catch (e) { return {}; }
}
function rsStore(d) { try { localStorage.setItem('ku_prix', JSON.stringify(d)); } catch (e) {} }
// Identifiants DofusDB retrouvés à partir des noms (objets ajoutés à l'Atelier avant cette version)
function rsIds() {
  try { var d = JSON.parse(localStorage.getItem('ku_ids') || '{}'); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; } catch (e) { return {}; }
}
var rsFile = { prix: {}, fichiers: [], serveurs: [], etat: 'absent' };

function rsInfo(name, id, rprice) {
  var m = rsPrices()[atKey(name || '')];
  if (!(m && m.price > 0)) m = null;
  var fid = +id || +rsIds()[atKey(name || '')] || 0;
  var f = fid ? rsFile.prix[fid] : null;
  var fAt = f ? (Date.parse(f[1]) || 0) : -1;
  if (m && (+m.at || 0) >= fAt) return { price: m.price, src: 'saisi', at: +m.at || 0 };
  if (f) return { price: f[0], src: 'fichier', at: fAt, q: f[2], fr: f[3], older: m };
  if (rprice > 0) return { price: rprice, src: 'recette' };
  return { price: 0, src: '' };
}
var RS_FRESH = { recent: 'récent', aging: 'à vérifier', stale: 'ancien' };
function rsSource(i) {
  if (i.src === 'saisi') return 'prix saisi le ' + dateFr(i.at);
  if (i.src === 'fichier') {
    var tags = [RS_FRESH[i.fr], i.q === 'imported_unverified' ? 'non vérifié' : ''].filter(Boolean);
    return 'prix du fichier' + (i.at > 0 ? ', ' + dateFr(i.at) : '') + (tags.length ? ' (' + tags.join(', ') + ')' : '') +
      (i.older ? ' · ton prix du ' + dateFr(i.older.at) + ' est plus ancien' : '');
  }
  return i.src === 'recette' ? 'prix de la recette' : '';
}

var rsEl = {
  list: document.getElementById('rsList'), sum: document.getElementById('rsSum'),
  total: document.getElementById('rsTotal'), missing: document.getElementById('rsMissing'),
  file: document.getElementById('rsFichier'), reload: document.getElementById('rsReload')
};
function rsNeed(t, stock) { return Math.max(0, t.qty - Math.max(0, nv(stock[t.key]))); }
function rsRowSub(t, need, have) {
  var src = rsSource(t.info);
  return 'Besoin : ' + fmtInt(t.qty) + (have > 0 ? ' · stock : ' + fmtInt(have) + ' · reste ' + fmtInt(need) : '') + (src ? ' · ' + src : '');
}
// Totaux seuls : appelé à chaque frappe, sans reconstruire la liste (le curseur reste en place)
function rsTotals() {
  var stock = atStock(), tot = atTotals(), sum = 0, missing = 0;
  tot.forEach(function (t) {
    var need = rsNeed(t, stock);
    var sub = rsEl.list.querySelector('[data-rs-sub="' + CSS.escape(t.key) + '"]');
    if (sub) sub.textContent = rsRowSub(t, need, Math.max(0, nv(stock[t.key])));
    var inp = rsEl.list.querySelector('[data-rs="' + CSS.escape(t.key) + '"]');
    if (inp) inp.placeholder = t.info.src !== 'saisi' && t.price > 0 ? fmtField(t.price) : 'Prix';
    if (need > 0 && !(t.price > 0)) missing++;
    sum += t.price * need;
    var cell = rsEl.list.querySelector('[data-rs-tot="' + CSS.escape(t.key) + '"]');
    if (cell) cell.textContent = t.price > 0 && need > 0 ? fmtInt(t.price * need) + ' K' : (need > 0 ? '–' : 'en stock');
  });
  rsEl.total.textContent = fmtInt(sum) + ' K';
  rsEl.missing.textContent = fmtInt(missing);
  rsEl.missing.className = 'v ' + (missing ? 'neg' : 'pos');
}
function rsFileRender() {
  var n = Object.keys(rsFile.prix).length;
  rsEl.reload.style.display = rsFile.etat === 'absent' ? 'none' : '';
  rsEl.file.textContent = rsFile.etat === 'absent'
    ? 'Fichier de prix : disponible seulement avec le serveur local (serveur.py), dans donnees/Price/.'
    : rsFile.etat === 'chargement' ? 'Fichier de prix : chargement…'
    : rsFile.etat === 'erreur' ? 'Fichier de prix : lecture impossible.'
    : !rsFile.fichiers.length ? 'Fichier de prix : aucun fichier .json dans donnees/Price/.'
    : 'Fichier de prix' + (rsFile.serveurs.length ? ' (' + rsFile.serveurs.join(', ') + ')' : '') + ' : ' + fmtInt(n) +
      ' objets (' + rsFile.fichiers.map(function (f) { return f.nom + ' du ' + dateFr(f.date); }).join(', ') + ')';
}
function rsRender() {
  rsFileRender();
  var tot = atTotals(), stock = atStock(), prix = rsPrices();
  rsEl.sum.style.display = tot.length ? '' : 'none';
  if (!tot.length) {
    rsEl.list.innerHTML = '<div class="soon">Aucune ressource : ajoute d\'abord des objets à l\'Atelier depuis Investissements → Craft.</div>';
    return;
  }
  rsEl.list.innerHTML = tot.map(function (t) {
    var need = rsNeed(t, stock), m = t.info.src === 'saisi' ? prix[t.key] : null;
    return '<div class="at-row rs-row' + (need === 0 ? ' done' : '') + '">' + imgTag(t.icon, '') +
      '<div class="at-name">' + esc(t.name) + '<small data-rs-sub="' + esc(t.key) + '"></small></div>' +
      '<div class="input-wrap rs-in"><input type="text" data-num inputmode="decimal" data-rs="' + esc(t.key) + '" data-name="' + esc(t.name) + '"' +
      ' data-id="' + esc(rsIdOf(t) || '') + '"' +
      ' aria-label="Prix unitaire de ' + esc(t.name) + '" placeholder="Prix"' +
      ' value="' + (m ? esc(fmtField(m.price)) : '') + '"><span class="unit">K</span></div>' +
      '<div class="at-q rs-tot" data-rs-tot="' + esc(t.key) + '"></div></div>';
  }).join('');
  rsTotals();
  rsResolveIds();
}

function rsIdOf(t) { return +t.id || +rsIds()[t.key] || 0; }
// Retrouve l'identifiant des ressources qui n'en ont pas, par leur nom exact (50 par requête)
var rsTried = {};
function rsResolveIds() {
  if (!(window.kuStockage && window.kuStockage.mode() === 'disque')) return; // utile seulement avec les fichiers de prix
  var ids = rsIds();
  var todo = atTotals().filter(function (t) { return !t.id && !ids[t.key] && !rsTried[t.key]; }).slice(0, 50);
  if (!todo.length) return;
  todo.forEach(function (t) { rsTried[t.key] = 1; });
  var url = API + '/items?lang=fr&$limit=50&$select[]=id&$select[]=name' +
    todo.map(function (t) { return '&name.fr[$in][]=' + encodeURIComponent(t.name); }).join('');
  getJson(url).then(function (r) {
    var d = rsIds(), found = 0;
    (r && r.data || []).forEach(function (o) {
      var k = atKey(nameOf(o));
      if (o.id && todo.some(function (t) { return t.key === k; }) && !d[k]) { d[k] = o.id; found++; }
    });
    if (found) {
      try { localStorage.setItem('ku_ids', JSON.stringify(d)); } catch (e) {}
      refreshViews();
    }
  }).catch(function () { todo.forEach(function (t) { delete rsTried[t.key]; }); });
}

function rsFetchFile() {
  return fetch('api/prix', { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('erreur ' + r.status);
    return r.json();
  });
}
function rsApplyFile(j) {
  rsFile.prix = j && j.prix && typeof j.prix === 'object' ? j.prix : {};
  rsFile.fichiers = Array.isArray(j.fichiers) ? j.fichiers : [];
  rsFile.serveurs = Array.isArray(j.serveurs) ? j.serveurs : [];
  rsFile.etat = 'ok';
  refreshViews();
}
function rsLoadFile() {
  if (!(window.kuStockage && window.kuStockage.mode() === 'disque')) { rsFile.etat = 'absent'; rsFileRender(); return; }
  rsFile.etat = 'chargement'; rsFileRender();
  rsFetchFile().then(rsApplyFile).catch(function () { rsFile.etat = 'erreur'; rsFileRender(); });
}
// Les fichiers de prix peuvent changer sans le site (Update_HDV_price, récupération) :
// toutes les 20 s, onglet visible, on relit s'ils ont été modifiés sur le disque.
setInterval(function () {
  if (rsFile.etat !== 'ok' || document.visibilityState !== 'visible') return;
  rsFetchFile().then(function (j) {
    if (JSON.stringify(j.fichiers || []) !== JSON.stringify(rsFile.fichiers)) rsApplyFile(j);
  }).catch(function () {});
}, 20000);

rsEl.list.addEventListener('input', function (e) {
  var t = e.target;
  if (!t.dataset || !t.dataset.rs) return;
  var d = rsPrices(), v = nv(t.value);
  if (v > 0) d[t.dataset.rs] = { name: t.dataset.name, price: v, at: Date.now(), id: +t.dataset.id || null };
  else delete d[t.dataset.rs];
  rsStore(d);
  rsTotals();
  if (v > 0) rsPushLater(t.dataset.rs);
});
// En quittant le champ : envoi immédiat au fichier de prix, puis coûts de l'Atelier
rsEl.list.addEventListener('change', function (e) {
  if (e.target.dataset && e.target.dataset.rs) { rsPush(e.target.dataset.rs); atRender(); dashRender(); }
});

// ----- Prix modifiés → fichier de prix (donnees/Price/, via le serveur local) -----
var rsTimers = {}, rsSent = {};
function rsMsg(text, cls) { setMsg(document.getElementById('rsMsg'), text, cls); }
function rsPushLater(key) {
  clearTimeout(rsTimers[key]);
  rsTimers[key] = setTimeout(function () { rsPush(key); }, 1000);
}
function rsPush(key) {
  clearTimeout(rsTimers[key]); delete rsTimers[key];
  if (!(window.kuStockage && window.kuStockage.mode() === 'disque')) return;
  var e = rsPrices()[key];
  if (!e || !(e.price > 0)) return;
  var sig = e.price + '@' + e.at;
  if (rsSent[key] === sig) return; // déjà envoyé
  var name = e.name || key;
  var id = +e.id || +rsIds()[key] || 0;
  if (!id) { rsMsg(name + ' : objet inconnu de DofusDB, prix gardé sur le site seulement.', 'err'); return; }
  rsSent[key] = sig;
  fetch('api/prix', {
    method: 'PUT', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-KamasUltra': '1' },
    body: JSON.stringify({ itemId: id, price: e.price, at: e.at })
  }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) throw new Error(j && j.erreur ? j.erreur : 'erreur ' + r.status);
      return j;
    });
  }).then(function (j) {
    var old = rsFile.prix[id];
    rsFile.prix[id] = [e.price, j.date, old ? old[2] : 'manual', 'recent'];
    rsMsg(name + ' : ' + fmtInt(e.price) + ' K ' + (j.ajoute ? 'ajouté à ' : 'enregistré dans ') + (j.fichiers || []).join(', ') + '.', 'ok');
  }).catch(function (err) {
    delete rsSent[key];
    rsMsg(name + ' : fichier de prix non mis à jour (' + err.message + ').', 'err');
  });
}
rsEl.reload.addEventListener('click', rsLoadFile);
document.getElementById('rsGoAtelier').addEventListener('click', function () { showTab('atelier'); window.scrollTo(0, 0); });
document.getElementById('atGoPrix').addEventListener('click', function () { showTab('ressources'); window.scrollTo(0, 0); });
// ---------- Générateur de QR code (octets, correction d'erreurs M, versions 1 à 25) ----------
var QR = (function () {
  var ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 34, 28, 30, 28, 30];
  var BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21];
  var MAXV = 22;
  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCw(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v]; }
  function capacity(v) { return dataCw(v) - (v < 10 ? 2 : 3); } // octets utilisables
  var EXP = [], LOG = [];
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  function gmul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsGen(deg) {
    var g = [1];
    for (var i = 0; i < deg; i++) {
      var n = g.concat([0]);
      for (var j = 0; j < g.length; j++) { n[j + 1] ^= gmul(g[j], EXP[i]); }
      g = n;
    }
    return g; // g[0] = 1 (coefficient dominant)
  }
  function rsRem(data, deg) {
    var g = rsGen(deg), res = [], i, j;
    for (i = 0; i < deg; i++) res.push(0);
    for (i = 0; i < data.length; i++) {
      var f = data[i] ^ res[0];
      res.shift(); res.push(0);
      for (j = 0; j < deg; j++) res[j] ^= gmul(g[j + 1], f);
    }
    return res;
  }
  function alignPos(v) {
    if (v === 1) return [];
    var n = Math.floor(v / 7) + 2, size = v * 4 + 17;
    var step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    var r = [6];
    for (var p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
    return r;
  }
  function build(bytes) {
    var v, need = bytes.length;
    for (v = 1; v <= MAXV; v++) if (capacity(v) >= need) break;
    if (v > MAXV) return null;
    var size = v * 4 + 17, i, j;
    // bits de données
    var bits = [];
    function put(val, len) { for (var k = len - 1; k >= 0; k--) bits.push((val >>> k) & 1); }
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCw(v) * 8;
    put(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = [];
    for (i = 0; i < bits.length; i += 8) { var by = 0; for (j = 0; j < 8; j++) by = (by << 1) | bits[i + j]; data.push(by); }
    // blocs + correction d'erreurs + entrelacement
    var nb = BLK[v], ecl = ECC[v], rawCw = Math.floor(rawModules(v) / 8);
    var nShort = nb - rawCw % nb, shortLen = Math.floor(rawCw / nb);
    var blocks = [], ecs = [], off = 0;
    for (i = 0; i < nb; i++) {
      var len = shortLen - ecl + (i < nShort ? 0 : 1);
      var d = data.slice(off, off + len); off += len;
      blocks.push(d); ecs.push(rsRem(d, ecl));
    }
    var all = [];
    for (i = 0; i < blocks[nb - 1].length; i++) blocks.forEach(function (b) { if (i < b.length) all.push(b[i]); });
    for (i = 0; i < ecl; i++) ecs.forEach(function (e) { all.push(e[i]); });
    // matrice
    var m = [], fn = [];
    for (i = 0; i < size; i++) { m.push(new Array(size).fill(0)); fn.push(new Array(size).fill(false)); }
    function setf(x, y, dark) { m[y][x] = dark ? 1 : 0; fn[y][x] = true; }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue;
        var d2 = Math.max(Math.abs(dx), Math.abs(dy));
        setf(x, y, d2 !== 2 && d2 !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    for (i = 0; i < size; i++) { if (!fn[6][i]) setf(i, 6, i % 2 === 0); if (!fn[i][6]) setf(6, i, i % 2 === 0); }
    var ap = alignPos(v);
    ap.forEach(function (cy, a) { ap.forEach(function (cx, b) {
      if ((a === 0 && b === 0) || (a === 0 && b === ap.length - 1) || (a === ap.length - 1 && b === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setf(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    // zones réservées (format) et bit sombre
    for (i = 0; i < 9; i++) { fn[8][i] = true; fn[i][8] = true; }
    for (i = 0; i < 8; i++) { fn[8][size - 1 - i] = true; fn[size - 1 - i][8] = true; }
    setf(8, size - 8, true);
    if (v >= 7) {
      var rem = v; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (v << 12) | rem;
      for (i = 0; i < 18; i++) {
        var bit = (vb >>> i) & 1, a = size - 11 + i % 3, b2 = Math.floor(i / 3);
        setf(a, b2, bit); setf(b2, a, bit);
      }
    }
    // placement en zigzag
    var k = 0, up = true, x, y, c;
    var pts = [];
    for (x = size - 1; x >= 1; x -= 2) {
      if (x === 6) x = 5;
      for (j = 0; j < size; j++) {
        y = up ? size - 1 - j : j;
        for (c = 0; c < 2; c++) {
          var xx = x - c;
          if (!fn[y][xx]) pts.push([xx, y]);
        }
      }
      up = !up;
    }
    var base = m.map(function (r) { return r.slice(); });
    pts.forEach(function (pt, idx) {
      var bit = idx < all.length * 8 ? (all[idx >> 3] >>> (7 - (idx & 7))) & 1 : 0;
      base[pt[1]][pt[0]] = bit;
    });
    function maskFn(mk, x, y) {
      switch (mk) {
        case 0: return (x + y) % 2 === 0; case 1: return y % 2 === 0; case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0; case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
        case 5: return x * y % 2 + x * y % 3 === 0; case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
        default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
      }
    }
    function withMask(mk) {
      var g = base.map(function (r) { return r.slice(); });
      pts.forEach(function (pt) { if (maskFn(mk, pt[0], pt[1])) g[pt[1]][pt[0]] ^= 1; });
      var data2 = mk; // niveau M : bits 00
      var rem2 = data2; for (var q = 0; q < 10; q++) rem2 = (rem2 << 1) ^ ((rem2 >>> 9) * 0x537);
      var fbits = ((data2 << 10) | rem2) ^ 0x5412;
      function gb(n) { return (fbits >>> n) & 1; }
      for (var t = 0; t <= 5; t++) g[t][8] = gb(t);
      g[7][8] = gb(6); g[8][8] = gb(7); g[8][7] = gb(8);
      for (t = 9; t < 15; t++) g[8][14 - t] = gb(t);
      for (t = 0; t < 8; t++) g[8][size - 1 - t] = gb(t);
      for (t = 8; t < 15; t++) g[size - 15 + t][8] = gb(t);
      g[size - 8][8] = 1;
      return g;
    }
    function penalty(g) {
      var p = 0, r, c2, run, dark = 0;
      function line(get) {
        for (var a = 0; a < size; a++) {
          run = 1;
          for (var b = 1; b < size; b++) {
            if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
          }
          for (b = 0; b + 11 <= size; b++) {
            var s = '';
            for (var t = 0; t < 11; t++) s += get(a, b + t);
            if (s === '10111010000' || s === '00001011101') p += 40;
          }
        }
      }
      line(function (a, b) { return g[a][b]; });
      line(function (a, b) { return g[b][a]; });
      for (r = 0; r < size - 1; r++) for (c2 = 0; c2 < size - 1; c2++) {
        var s2 = g[r][c2]; if (s2 === g[r][c2 + 1] && s2 === g[r + 1][c2] && s2 === g[r + 1][c2 + 1]) p += 3;
      }
      for (r = 0; r < size; r++) for (c2 = 0; c2 < size; c2++) dark += g[r][c2];
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = null, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) { var g = withMask(mk), pe = penalty(g); if (pe < bestP) { bestP = pe; best = g; } }
    return best;
  }
  function utf8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 128) out.push(c);
      else if (c < 2048) out.push(192 | c >> 6, 128 | c & 63);
      else out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
    }
    return out;
  }
  return {
    maxBytes: capacity(MAXV),
    matrix: function (text) { return build(utf8(text)); },
    svg: function (text, px) {
      var m = build(utf8(text)); if (!m) return '';
      var n = m.length, q = 4, d = '';
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z';
      var t = n + q * 2;
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + ' ' + t + '" width="' + px + '" height="' + px + '" shape-rendering="crispEdges" role="img" aria-label="QR code">' +
        '<rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
    }
  };
})();

// ---------- Transfert vers un autre appareil par QR code ----------
// Les données sont compressées, découpées en parties ; chaque QR code contient un lien du site avec une partie.
// L'appareil qui scanne n'a besoin d'aucune application : l'appareil photo ouvre le lien, le site assemble les parties.
var SYNC_SKIP = { ku_iv_draft: 1, ku_fl_draft: 1, ku_fm_draft: 1, ku_fm_sel: 1, ku_atp: 1, ku_tab: 1, ku_ivp: 1, ku_calc: 1, ku_period: 1 };
var SYNC_CHUNK = 350;
var sync = { urls: [], i: 0 };

function b64u(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i += 4096) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(str) {
  var t = str.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  var bin = atob(t), out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function streamBytes(bytes, stream) {
  return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); });
}
function syncPack() {
  var data = {};
  bkKeys().forEach(function (k) {
    if (SYNC_SKIP[k]) return;
    try { data[k] = localStorage.getItem(k); } catch (e) {}
  });
  var json = JSON.stringify({ app: 'KamasUltra', version: 1, date: new Date().toISOString(), data: data });
  var bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'undefined') return Promise.resolve('r' + b64u(bytes));
  return streamBytes(bytes, new CompressionStream('deflate-raw')).then(function (z) { return 'z' + b64u(z); });
}
function syncUnpack(str) {
  var flag = str.charAt(0), bytes = unb64u(str.slice(1));
  var p = flag === 'z'
    ? (typeof DecompressionStream === 'undefined' ? Promise.reject(new Error('navigateur trop ancien')) : streamBytes(bytes, new DecompressionStream('deflate-raw')))
    : Promise.resolve(bytes);
  return p.then(function (b) {
    if (b.length > 4000000) throw new Error('données trop volumineuses');
    return JSON.parse(new TextDecoder().decode(b));
  });
}
function syncBase() { return window.location.href.split('#')[0]; }
function syncMake() {
  return syncPack().then(function (str) {
    var id = Math.random().toString(36).slice(2, 8), parts = [];
    for (var i = 0; i < str.length; i += SYNC_CHUNK) parts.push(str.slice(i, i + SYNC_CHUNK));
    var n = parts.length;
    return {
      id: id, whole: syncBase() + '#sync=' + id + '.1.1.' + str,
      urls: parts.map(function (c, k) { return syncBase() + '#sync=' + id + '.' + (k + 1) + '.' + n + '.' + c; })
    };
  });
}
var syncEl = {
  gen: document.getElementById('syncGen'), box: document.getElementById('syncBox'), qr: document.getElementById('syncQr'),
  pos: document.getElementById('syncPos'), prev: document.getElementById('syncPrev'), next: document.getElementById('syncNext'),
  copy: document.getElementById('syncCopy'), msg: document.getElementById('syncMsg')
};
function syncShow() {
  var n = sync.urls.length;
  syncEl.qr.innerHTML = QR.svg(sync.urls[sync.i], 300);
  syncEl.pos.textContent = 'QR code ' + (sync.i + 1) + ' sur ' + n;
  syncEl.prev.disabled = sync.i === 0;
  syncEl.next.disabled = sync.i === n - 1;
  syncEl.prev.style.visibility = syncEl.next.style.visibility = n > 1 ? 'visible' : 'hidden';
}
syncEl.gen.addEventListener('click', function () {
  setMsg(syncEl.msg, 'Préparation…');
  syncMake().then(function (r) {
    sync.urls = r.urls; sync.whole = r.whole; sync.i = 0;
    if (!r.urls.length || r.urls.some(function (u) { return !QR.matrix(u); })) throw new Error('génération impossible');
    syncEl.box.hidden = false;
    syncShow();
    var n = r.urls.length;
    setMsg(syncEl.msg, n > 1 ? n + ' QR codes à scanner dans l\'ordre (utilise les flèches pour passer au suivant).' : 'Un seul QR code à scanner.', 'ok');
  }).catch(function (e) { setMsg(syncEl.msg, 'Impossible de préparer le transfert (' + (e && e.message || 'erreur') + '). Utilise la sauvegarde par fichier.', 'err'); });
});
syncEl.prev.addEventListener('click', function () { if (sync.i > 0) { sync.i--; syncShow(); } });
syncEl.next.addEventListener('click', function () { if (sync.i < sync.urls.length - 1) { sync.i++; syncShow(); } });
syncEl.copy.addEventListener('click', function () {
  var ok = function () { setMsg(syncEl.msg, 'Lien copié : envoie-le-toi (messagerie, e-mail) et ouvre-le sur l\'autre appareil.', 'ok'); };
  var ko = function () { setMsg(syncEl.msg, 'Copie impossible depuis ce navigateur.', 'err'); };
  if (navigator.clipboard && navigator.clipboard.writeText && sync.whole) navigator.clipboard.writeText(sync.whole).then(ok, ko); else ko();
});

// Réception : le lien scanné contient une partie ; quand toutes sont là, on propose d'importer
function syncReceive() {
  var m = /^#sync=([a-z0-9]{1,12})\.(\d{1,3})\.(\d{1,3})\.([A-Za-z0-9_-]+)$/.exec(window.location.hash || '');
  if (!m) return;
  try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
  var id = m[1], i = +m[2], n = +m[3], chunk = m[4];
  if (!(i >= 1 && i <= n && n <= 200)) return;
  showTab('sauvegarde');
  var st = null;
  try { st = JSON.parse(localStorage.getItem('kc_sync') || 'null'); } catch (e) {}
  if (!st || st.id !== id || st.n !== n || Date.now() - st.t > 3600000) st = { id: id, n: n, t: Date.now(), parts: {} };
  st.parts[i] = chunk;
  var have = Object.keys(st.parts).length;
  try { localStorage.setItem('kc_sync', JSON.stringify(st)); } catch (e) {}
  if (have < n) {
    var missing = [];
    for (var k = 1; k <= n; k++) if (!st.parts[k]) missing.push(k);
    setMsg(syncEl.msg, 'Partie ' + i + ' reçue (' + have + ' sur ' + n + '). Il reste à scanner : QR ' + missing.join(', ') + '.', 'ok');
    return;
  }
  var all = '';
  for (var j = 1; j <= n; j++) all += st.parts[j];
  try { localStorage.removeItem('kc_sync'); } catch (e) {}
  setMsg(syncEl.msg, 'Toutes les parties sont reçues, vérification…');
  syncUnpack(all).then(function (payload) {
    if (!payload || payload.app !== 'KamasUltra' || !payload.data || typeof payload.data !== 'object') throw new Error('contenu invalide');
    bkRestore(payload, syncEl.msg);
  }).catch(function (e) { setMsg(syncEl.msg, 'Transfert impossible (' + (e && e.message || 'erreur') + '). Recommence depuis l\'autre appareil.', 'err'); });
}

// ---------- Sauvegarde : export / import de toutes les données du site ----------
var BK_PREFIX = 'ku_';
var bkEl = {
  summary: document.getElementById('bkSummary'), msg: document.getElementById('bkMsg'),
  file: document.getElementById('bkFile')
};

function bkKeys() {
  var keys = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(BK_PREFIX) === 0) keys.push(k);
    }
  } catch (e) {}
  return keys;
}
function plural(n, one, many) { return n + ' ' + (n > 1 ? many : one); }

function backupRender() {
  var all = hdvEntries();
  var sold = all.filter(isSold).length;
  var act = all.filter(isListed).length;
  bkEl.summary.textContent = all.length
    ? 'Actuellement sur cet appareil : ' + plural(act, 'objet en vente', 'objets en vente') + ' et ' + plural(sold, 'objet vendu', 'objets vendus') + '.'
    : 'Actuellement sur cet appareil : aucun objet enregistré.';
  var nInv = all.filter(isInv).length;
  if (nInv) bkEl.summary.textContent += ' ' + plural(nInv, 'objet', 'objets') + ' en inventaire.';
}

function bkExport() {
  var data = {};
  bkKeys().forEach(function (k) {
    try { data[k] = localStorage.getItem(k); } catch (e) {}
  });
  var payload = { app: 'KamasUltra', version: 1, date: new Date().toISOString(), data: data };
  var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  var d = new Date();
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var name = 'kamasultra-sauvegarde-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json';
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  setMsg(bkEl.msg, 'Sauvegarde créée : le fichier « ' + name + ' » a été téléchargé. Garde-le précieusement.', 'ok');
}

// Un fichier de sauvegarde peut venir d'ailleurs : on ne garde que ce qu'on sait afficher sans danger
function cleanList(raw) {
  var arr;
  try { arr = JSON.parse(raw); } catch (e) { return '[]'; }
  if (!Array.isArray(arr)) return '[]';
  var iconOf = function (v) { var n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : null; };
  return JSON.stringify(arr.filter(function (it) {
    return it && typeof it === 'object' && typeof it.id === 'number' && isFinite(it.id);
  }).map(function (it) {
    it.icon = iconOf(it.icon);
    if (Array.isArray(it.rows)) {
      it.rows = it.rows.filter(function (r) { return r && typeof r === 'object'; }).map(function (r) {
        r.icon = iconOf(r.icon);
        return r;
      });
    }
    return it;
  }));
}
function cleanDraft(raw) {
  var d;
  try { d = JSON.parse(raw); } catch (e) { return null; }
  if (!d || typeof d !== 'object') return null;
  d.icon = parseInt(d.icon, 10) > 0 ? parseInt(d.icon, 10) : null;
  if (Array.isArray(d.rows)) {
    d.rows = d.rows.filter(function (r) { return r && typeof r === 'object'; }).map(function (r) {
      r.icon = parseInt(r.icon, 10) > 0 ? parseInt(r.icon, 10) : null;
      return r;
    });
  }
  return JSON.stringify(d);
}

// Applique une sauvegarde (fichier ou transfert par QR) après vérification et confirmation
function bkRestore(payload, msgNode) {
  var out = msgNode || bkEl.msg;
  var clean = {};
  Object.keys(payload.data).forEach(function (k) {
    var v = payload.data[k];
    if (k.indexOf(BK_PREFIX) !== 0 || typeof v !== 'string') return;
    if (k === 'ku_invest' || k === 'ku_flips' || k === 'ku_atelier') clean[k] = cleanList(v);
    else if (k === 'ku_iv_draft' || k === 'ku_fl_draft') { var c = cleanDraft(v); if (c) clean[k] = c; }
    else clean[k] = v;
  });
  var nb = 0;
  ['ku_invest', 'ku_flips'].forEach(function (k) {
    try { nb += JSON.parse(clean[k] || '[]').length; } catch (e) {}
  });
  var when = payload.date ? new Date(payload.date) : null;
  var whenTxt = when && !isNaN(when) ? ' du ' + when.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  if (!window.confirm('Restaurer la sauvegarde' + whenTxt + ' (' + plural(nb, 'objet', 'objets') + ') ?\n\nAttention : les données actuellement présentes sur cet appareil seront remplacées.')) {
    setMsg(out, 'Restauration annulée. Rien n\'a été modifié.');
    return;
  }
  try {
    bkKeys().forEach(function (k) { localStorage.removeItem(k); });
    Object.keys(clean).forEach(function (k) { localStorage.setItem(k, clean[k]); });
  } catch (e) {
    setMsg(out, 'Impossible d\'écrire les données dans ce navigateur (navigation privée ?).', 'err');
    return;
  }
  setMsg(out, 'Sauvegarde restaurée, rechargement…', 'ok');
  // Avec le serveur local, on attend que le fichier sur le disque soit à jour avant de recharger
  var recharger = function () { window.location.reload(); };
  var fin = window.kuStockage ? window.kuStockage.flush() : Promise.resolve();
  fin.then(function () { setTimeout(recharger, 400); }, recharger);
}

function bkImport(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onerror = function () { setMsg(bkEl.msg, 'Impossible de lire ce fichier.', 'err'); };
  reader.onload = function () {
    var payload;
    try { payload = JSON.parse(String(reader.result)); } catch (e) { payload = null; }
    if (!payload || payload.app !== 'KamasUltra' || !payload.data || typeof payload.data !== 'object') {
      setMsg(bkEl.msg, 'Ce fichier n\'est pas une sauvegarde KamasUltra.', 'err');
      return;
    }
    bkRestore(payload);
  };
  reader.readAsText(file);
}

document.getElementById('bkExport').addEventListener('click', bkExport);
bkEl.file.addEventListener('change', function () {
  bkImport(bkEl.file.files[0]);
  bkEl.file.value = '';
});

// Restaure les brouillons en cours
try {
  var draft = JSON.parse(localStorage.getItem('ku_iv_draft') || 'null');
  ivApply(draft || {});
} catch (e) { ivApply({}); }

try {
  var fdraft = JSON.parse(localStorage.getItem('ku_fl_draft') || 'null');
  flApply(fdraft || {});
} catch (e) { flApply({}); }

try {
  var ivp = localStorage.getItem('ku_ivp');
  if (ivp && document.getElementById(ivp)) showIvPane(ivp);
} catch (e) {}

// Met en forme tous les champs numériques déjà remplis (valeurs par défaut et valeurs mémorisées)
document.querySelectorAll('[data-num]').forEach(function (i) { i.value = fmtField(i.value); });

kuReady = true;
refreshViews();
almLoad(false);
rsLoadFile();
syncReceive();
window.addEventListener('hashchange', syncReceive); // lien scanné pendant que le site est déjà ouvert
