/* ==========================================================
   Deutsch, wieder…  ·  App-Engine
   Tek iskelet, çok dil, çok seviye. İçerik content/ altında.
   ========================================================== */
(function () {
'use strict';

var STORE = 'dw.v1';
var AUTH_STORE = 'dw.auth';
var GUEST_STORE = 'dw.guest';
var pushTimer = null;
var pushQueued = false;
var CATALOG = null;
var LANG = null;      // aktif dil nesnesi
var LEVEL = null;     // aktif seviye nesnesi
var UNIT = null;      // yüklü ünite meta
var PAGES = [];       // aktif ünite sayfaları (DOM)
var CUR = 0;
var AUDIOS = [];

/* ---------------- Speicher ---------------- */
function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
}
function save(s) {
  try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {}
}
function unitState(id) {
  var s = load();
  return (s.units && s.units[id]) || { page: 0, seen: [], score: null, total: null, done: false };
}
function setUnitState(id, patch) {
  var s = load();
  s.units = s.units || {};
  s.units[id] = Object.assign(unitState(id), patch);
  save(s);
  schedulePush();
}

/* ---------------- Giriş & senkron ---------------- */
function authLoad() {
  try { return JSON.parse(localStorage.getItem(AUTH_STORE)) || null; } catch (e) { return null; }
}
function authSave(a) { try { localStorage.setItem(AUTH_STORE, JSON.stringify(a)); } catch (e) {} }
function authClear() { try { localStorage.removeItem(AUTH_STORE); } catch (e) {} }
function isGuest() { return localStorage.getItem(GUEST_STORE) === '1'; }
function setGuest() { try { localStorage.setItem(GUEST_STORE, '1'); } catch (e) {} }
function apiBase() { return (window.DW_API || '').replace(/\/+$/, ''); }

function mergeUnitsClient(a, b) {
  a = a || {}; b = b || {};
  var out = {};
  var ids = {};
  Object.keys(a).forEach(function (k) { ids[k] = 1; });
  Object.keys(b).forEach(function (k) { ids[k] = 1; });
  Object.keys(ids).forEach(function (id) {
    var x = a[id] || {}, y = b[id] || {};
    var seenSet = {};
    (x.seen || []).concat(y.seen || []).forEach(function (p) { seenSet[p] = 1; });
    var seen = Object.keys(seenSet).map(Number);
    var xHas = x.score != null, yHas = y.score != null;
    var score = null, total = null;
    if (xHas && yHas) { if (x.score >= y.score) { score = x.score; total = x.total; } else { score = y.score; total = y.total; } }
    else if (xHas) { score = x.score; total = x.total; }
    else if (yHas) { score = y.score; total = y.total; }
    out[id] = { page: Math.max(x.page || 0, y.page || 0), seen: seen, score: score, total: total, done: !!(x.done || y.done) };
  });
  return out;
}

function pull() {
  var auth = authLoad();
  if (!auth || !apiBase()) return Promise.resolve();
  return fetch(apiBase() + '/api/progress', { headers: { 'Authorization': 'Bearer ' + auth.token } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var s = load();
      s.units = mergeUnitsClient(s.units || {}, data.units || {});
      save(s);
    })
    .catch(function () {});
}

function push() {
  var auth = authLoad();
  if (!auth || !apiBase()) return;
  var s = load();
  fetch(apiBase() + '/api/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth.token },
    body: JSON.stringify({ units: s.units || {} }),
  }).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (data) {
    pushQueued = false;
    var s2 = load();
    s2.units = mergeUnitsClient(s2.units || {}, data.units || {});
    save(s2);
  }).catch(function () { pushQueued = true; });
}

function schedulePush() {
  if (!authLoad() || !apiBase()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 3000);
}

window.addEventListener('online', function () { if (pushQueued) push(); });

function login(name, pin) {
  return fetch(apiBase() + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, pin: pin }),
  }).then(function (r) {
    return r.json().then(function (data) { return { ok: r.ok, data: data }; });
  }).then(function (res) {
    if (!res.ok) throw new Error(res.data && res.data.error || 'Giriş başarısız');
    authSave({ token: res.data.token, name: res.data.name });
    var s = load();
    s.units = mergeUnitsClient(s.units || {}, res.data.units || {});
    save(s);
    return res.data;
  });
}

function logout() {
  authClear();
  try { localStorage.removeItem(GUEST_STORE); } catch (e) {}
  save({});
}

/* ---------------- Hilfsmittel ---------------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
function el(tag, cls, html) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
var toastTimer = null;
function toast(msg) {
  var t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2200);
}

/* ---------------- Medien: lokal, sonst CDN ---------------- */
function applyMedia(root, media) {
  $$('img[data-img]', root).forEach(function (img) {
    var rec = media.img && media.img[img.dataset.img];
    if (!rec) return;
    img.loading = 'lazy';
    img.src = rec.local;
    img.addEventListener('error', function onerr() {
      img.removeEventListener('error', onerr);
      if (rec.remote && img.src.indexOf(rec.remote) === -1) { img.src = rec.remote; return; }
      img.style.background = 'repeating-linear-gradient(45deg,#F0EAE0,#F0EAE0 8px,#FAF6EF 8px,#FAF6EF 16px)';
      img.style.minHeight = '120px';
    });
  });
}

var P_ICO = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
var S_ICO = '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

function wireAudio(root, media) {
  $$('.audiobar', root).forEach(function (bar) {
    var rec = (media.audio && media.audio[bar.dataset.src]) || null;
    var pl = $('.pl', bar), st = $('.st', bar), fill = $('.track i', bar), rate = $('.rate', bar);
    var a = new Audio(); a.preload = 'none';
    var triedRemote = false, dead = false;

    if (!rec) { dead = true; bar.classList.add('miss'); st.textContent = 'Ses dosyası tanımsız'; }
    else a.src = rec.local;

    a.addEventListener('error', function () {
      if (rec && rec.remote && !triedRemote) { triedRemote = true; a.src = rec.remote; a.load(); return; }
      dead = true; bar.classList.add('miss');
      st.textContent = 'Ses dosyası yok — metni okuyun';
    });
    a.addEventListener('loadedmetadata', function () {
      bar.classList.remove('miss'); dead = false;
      st.textContent = '0:00 / ' + fmt(a.duration);
    });
    a.addEventListener('timeupdate', function () {
      st.textContent = fmt(a.currentTime) + ' / ' + fmt(a.duration);
      fill.style.width = (a.currentTime / a.duration * 100) + '%';
    });
    a.addEventListener('ended', function () { pl.innerHTML = P_ICO; fill.style.width = '0'; });

    pl.onclick = function () {
      if (dead) return;
      if (a.paused) {
        AUDIOS.forEach(function (o) { o.pause(); });
        a.play().then(function () { pl.innerHTML = S_ICO; }).catch(function () {});
      } else { a.pause(); pl.innerHTML = P_ICO; }
    };
    if (rate) {
      var rs = [1, .75, .5, 1.25], ri = 0;
      rate.onclick = function () { ri = (ri + 1) % rs.length; a.playbackRate = rs[ri]; rate.textContent = rs[ri] + '×'; };
    }
    $('.track', bar).onclick = function (ev) {
      if (dead || !a.duration) return;
      var r = this.getBoundingClientRect();
      a.currentTime = (ev.clientX - r.left) / r.width * a.duration;
    };
    AUDIOS.push(a);
  });
}
function stopAudio() { AUDIOS.forEach(function (a) { a.pause(); }); }

/* ---------------- Übungslogik ---------------- */
function norm(s) {
  return (s || '').toLowerCase().trim().replace(/[.,!?;:„“”"'’`´]/g, '').replace(/\s+/g, ' ');
}
function eq(given, want) {
  var n = norm(given);
  return (want || '').split('|').some(function (x) { return norm(x) === n; });
}
function shuffle(container) {
  var a = [].slice.call(container.children);
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    container.appendChild(a[j]); a.splice(j, 1);
  }
  if (a[0]) container.appendChild(a[0]);
}

function checkExercise(ex) {
  var right = 0, total = 0;
  $$('.fi input[data-a]', ex).forEach(function (i) {
    total++;
    if (eq(i.value, i.dataset.a)) { i.classList.add('ok'); i.classList.remove('no'); right++; }
    else { i.classList.add('no'); i.classList.remove('ok'); }
  });
  $$('.opts', ex).forEach(function (w) {
    total++;
    var sel = $('.opt.sel', w);
    [].forEach.call(w.children, function (o) {
      if (o.dataset.c === '1') { if (o === sel) { o.classList.add('ok'); right++; } else o.classList.add('rev'); }
      else if (o === sel) o.classList.add('no');
    });
    if (sel) sel.classList.remove('sel');
  });
  $$('.tf .btns', ex).forEach(function (w) {
    total++;
    var sel = $('.tfb.sel', w);
    w.dataset.got = (sel && sel.dataset.v === w.dataset.a) ? '1' : '0';
    if (w.dataset.got === '1') right++;
    [].forEach.call(w.children, function (o) {
      if (o.dataset.v === w.dataset.a) o.classList.add('ok');
      else if (o === sel) o.classList.add('no');
    });
    if (sel) sel.classList.remove('sel');
  });
  $$('.ord', ex).forEach(function (o) {
    total++;
    var d = $('.drop', o);
    var got = [].map.call(d.children, function (x) { return x.textContent.trim(); }).join(' ');
    if (eq(got, o.dataset.a)) { d.classList.add('ok'); right++; } else d.classList.add('no');
    o.classList.add('locked');
  });
  var v = $('.verdict', ex);
  if (v && total) {
    var p = right / total;
    v.textContent = right + ' / ' + total + ' richtig';
    v.className = 'verdict ' + (p === 1 ? 'good' : p >= .6 ? 'mid' : 'bad');
  }
  updateScore();
}

function solveExercise(ex) {
  $$('.fi input[data-a]', ex).forEach(function (i) {
    i.value = i.dataset.a.split('|')[0]; i.classList.add('ok'); i.classList.remove('no');
  });
  $$('.opts', ex).forEach(function (w) {
    [].forEach.call(w.children, function (o) {
      o.classList.remove('sel', 'no', 'rev');
      if (o.dataset.c === '1') o.classList.add('ok');
    });
  });
  $$('.tf .btns', ex).forEach(function (w) {
    [].forEach.call(w.children, function (o) {
      o.classList.remove('sel', 'no');
      if (o.dataset.v === w.dataset.a) o.classList.add('ok');
    });
  });
  $$('.ord', ex).forEach(function (o) {
    o.classList.add('show', 'locked');
    $('.sol', o).textContent = '→ ' + o.dataset.a.split('|')[0] + '.';
  });
  $$('.mtitem', ex).forEach(function (i) { i.classList.remove('sel'); i.classList.add('done'); });
}

function resetExercise(ex) {
  $$('.fi input', ex).forEach(function (i) { i.value = ''; i.className = i.classList.contains('w') ? 'w' : ''; });
  $$('.opt', ex).forEach(function (o) { o.className = 'opt'; });
  $$('.tfb', ex).forEach(function (o) { o.className = 'tfb'; });
  $$('.tf .btns', ex).forEach(function (w) { delete w.dataset.got; });
  $$('.ord', ex).forEach(function (o) {
    o.classList.remove('show', 'locked');
    var bank = $('.bank', o), drop = $('.drop', o);
    while (drop.firstChild) bank.appendChild(drop.firstChild);
    drop.classList.remove('ok', 'no');
    shuffle(bank);
  });
  $$('.mtitem', ex).forEach(function (i) { i.classList.remove('done', 'sel'); });
  var v = $('.verdict', ex); if (v) { v.textContent = ''; v.className = 'verdict'; }
  updateScore();
}

/* ---------------- Test-Auswertung ---------------- */
function updateScore() {
  var host = $('#testZone', $('#stage'));
  if (!host) return;
  var r = 0, t = 0;
  $$('.fi input[data-a]', host).forEach(function (i) { t++; if (i.classList.contains('ok')) r++; });
  $$('.opts', host).forEach(function (w) { t++; if ($('.opt.ok', w)) r++; });
  $$('.tf .btns', host).forEach(function (w) { t++; if (w.dataset.got === '1') r++; });
  $$('.ord', host).forEach(function (o) { t++; if ($('.drop.ok', o)) r++; });

  var no = $('#scoreNo'), tx = $('#scoreTx');
  if (!no) return;
  no.textContent = r + '/' + t;
  var touched = !!$('.ok,.no', host), p = t ? r / t : 0, m;
  if (!touched) m = '<b>Noch nicht geprüft</b>Alıştırmaları çözün, sonra “Prüfen”e basın.';
  else if (p >= .9) m = '<b>Ausgezeichnet! 🎉</b>Bir sonraki üniteye geçebilirsiniz.';
  else if (p >= .75) m = '<b>Sehr gut!</b>Birkaç noktayı tekrar edin, sonra devam edin.';
  else if (p >= .5) m = '<b>Gut gemacht.</b>Gramatik sayfalarını bir kez daha okuyun.';
  else m = '<b>Weiter üben!</b>Üniteyi baştan gözden geçirmeniz faydalı olur.';
  tx.innerHTML = m;

  if (touched && UNIT) {
    var prev = unitState(UNIT.id);
    if (prev.score == null || r > prev.score) {
      setUnitState(UNIT.id, { score: r, total: t, done: p >= .75 });
    }
  }
}

/* ---------------- Delegierte Ereignisse ---------------- */
document.addEventListener('click', function (e) {
  var t;

  if ((t = e.target.closest('.gl'))) { t.classList.toggle('open'); return; }

  if ((t = e.target.closest('.vtoggle'))) {
    var v = document.getElementById(t.dataset.for);
    if (v) {
      v.classList.toggle('hide');
      var lbl = t.querySelector('span');
      if (lbl) lbl.textContent = v.classList.contains('hide') ? 'Türkçe göster' : 'Türkçe gizle';
    }
    return;
  }
  if ((t = e.target.closest('.vrow'))) {
    var box = t.closest('.vocab');
    if (box && box.classList.contains('hide')) t.classList.toggle('rev');
    return;
  }

  if ((t = e.target.closest('.opt'))) {
    var w = t.closest('.opts');
    if ($('.ok,.no,.rev', w)) return;
    [].forEach.call(w.children, function (c) { c.classList.remove('sel'); });
    t.classList.add('sel'); return;
  }
  if ((t = e.target.closest('.tfb'))) {
    var wb = t.closest('.btns');
    if ($('.ok,.no', wb)) return;
    [].forEach.call(wb.children, function (c) { c.classList.remove('sel'); });
    t.classList.add('sel'); return;
  }
  if ((t = e.target.closest('.tok'))) {
    var ord = t.closest('.ord');
    if (ord.classList.contains('locked')) return;
    var d = $('.drop', ord), b = $('.bank', ord);
    (t.parentNode === d ? b : d).appendChild(t);
    d.classList.remove('ok', 'no'); return;
  }
  if ((t = e.target.closest('.mtitem'))) {
    if (t.classList.contains('done')) return;
    var mt = t.closest('.mt'), side = t.classList.contains('a') ? 'a' : 'b';
    var s = $('.mtitem.' + side + '.sel', mt);
    if (s && s !== t) s.classList.remove('sel');
    t.classList.toggle('sel');
    var A = $('.mtitem.a.sel', mt), B = $('.mtitem.b.sel', mt);
    if (A && B) {
      if (A.dataset.k === B.dataset.k) {
        A.classList.remove('sel'); B.classList.remove('sel');
        A.classList.add('done'); B.classList.add('done');
      } else {
        A.classList.add('shake'); B.classList.add('shake');
        setTimeout(function () { A.classList.remove('shake', 'sel'); B.classList.remove('shake', 'sel'); }, 330);
      }
    }
    return;
  }

  if ((t = e.target.closest('[data-check]'))) { checkExercise(t.closest('.ex')); return; }
  if ((t = e.target.closest('[data-sol]')))   { solveExercise(t.closest('.ex')); return; }
  if ((t = e.target.closest('[data-reset]'))) { resetExercise(t.closest('.ex')); return; }
});

document.addEventListener('input', function (e) {
  if (e.target.matches('.fi input')) e.target.classList.remove('ok', 'no');
});

/* ---------------- Navigation im Reader ---------------- */
function goPage(i) {
  if (!PAGES.length) return;
  i = Math.max(0, Math.min(i, PAGES.length - 1));
  stopAudio();
  PAGES[CUR].classList.remove('on');
  CUR = i;
  PAGES[CUR].classList.add('on');

  $('#pill').textContent = (CUR + 1) + ' / ' + PAGES.length;
  $('#prog').style.width = ((CUR + 1) / PAGES.length * 100) + '%';
  $('#prevBtn').disabled = (CUR === 0);
  var nb = $('#nextBtn');
  var last = CUR === PAGES.length - 1;
  nb.disabled = false;
  nb.innerHTML = last
    ? 'Zur Übersicht'
    : 'Weiter <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  nb.dataset.exit = last ? '1' : '';

  $$('.toc-item', $('#toc')).forEach(function (x, j) { x.classList.toggle('cur', j === CUR); });
  window.scrollTo(0, 0);

  if (UNIT) {
    var st = unitState(UNIT.id);
    var seen = st.seen || [];
    if (seen.indexOf(CUR) === -1) seen.push(CUR);
    setUnitState(UNIT.id, { page: CUR, seen: seen });
    var it = $$('.toc-item', $('#toc'))[CUR];
    if (it) it.classList.add('seen');
  }
}

/* ---------------- Inhaltsverzeichnis ---------------- */
function buildTOC() {
  var toc = $('#toc');
  var st = UNIT ? unitState(UNIT.id) : { seen: [] };
  var h = '<div class="toc-back" id="tocBack"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg> Tüm üniteler</div>';
  h += '<h4>' + esc(UNIT.title) + '</h4>';
  PAGES.forEach(function (p, i) {
    var seen = (st.seen || []).indexOf(i) !== -1;
    h += '<div class="toc-item' + (seen ? ' seen' : '') + '" data-i="' + i + '">' +
         '<span class="toc-num">' + (i + 1) + '</span><span>' +
         '<span class="toc-t">' + (p.dataset.t || '') + '</span>' +
         '<span class="toc-s">' + (p.dataset.s || '') + '</span></span></div>';
  });
  toc.innerHTML = h;
}
function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }

function closeMenu() { $('#toc').classList.remove('on'); $('#scrim').classList.remove('on'); }

/* ---------------- Home ---------------- */
function renderHome() {
  document.title = 'Deutsch, wieder…';
  $('#pill').hidden = true;
  $('#botnav').classList.remove('on');
  $('#prog').style.width = '0';
  $('#verLabel').textContent = 'v' + CATALOG.app.version;

  var auth = authLoad();
  var badge = $('#userBadge'), logoutBtn = $('#logoutBtn');
  if (auth) {
    badge.textContent = auth.name;
    badge.hidden = false;
    logoutBtn.hidden = false;
  } else {
    badge.hidden = true;
    logoutBtn.hidden = true;
  }

  // Sprachreiter
  var tabs = $('#langTabs'); tabs.innerHTML = '';
  CATALOG.languages.forEach(function (l) {
    var b = el('button', 'langtab' + (l === LANG ? ' on' : ''));
    b.innerHTML = '<span>' + esc(l.name) + '</span><span class="tr">' + esc(l.tr) + '</span>';
    b.onclick = function () { LANG = l; LEVEL = l.levels[0]; renderHome(); };
    tabs.appendChild(b);
  });
  ['English', 'Español', 'Français'].forEach(function (n) {
    var b = el('button', 'langtab soon');
    b.innerHTML = '<span>' + n + '</span><span class="tr">yakında</span>';
    tabs.appendChild(b);
  });
  $('#langNote').textContent = 'Yeni diller aynı uygulamaya eklenecek';

  $('#levelTitle').textContent = LEVEL.name + ' · ' + LEVEL.tr;
  $('#levelNote').textContent = LEVEL.units.length + ' ünite';

  // Einheiten
  var grid = $('#unitGrid'); grid.innerHTML = '';
  var doneCount = 0, pagesSeen = 0, pagesTotal = 0, bestSum = 0, bestTotal = 0;

  LEVEL.units.forEach(function (u) {
    var m = u._meta;
    var st = unitState(m.id);
    var seen = (st.seen || []).length, total = m.pages.length;
    pagesSeen += seen; pagesTotal += total;
    if (st.done) doneCount++;
    if (st.score != null) { bestSum += st.score; bestTotal += st.total; }

    var c = el('div', 'ucard' + (st.done ? ' finished' : ''));
    var cov = m.media.img[m.cover] || {};
    c.innerHTML =
      '<div class="thumb">' +
        '<img data-img="' + m.cover + '" alt="">' +
        '<span class="badge">Einheit ' + m.number + '</span>' +
        '<span class="done"><svg viewBox="0 0 24 24"><path d="M4 12l6 6L20 6"/></svg></span>' +
      '</div>' +
      '<div class="body">' +
        '<h3>' + esc(m.title) + '</h3>' +
        '<div class="sub">' + esc(m.tr) + '</div>' +
        '<div class="bar"><i style="width:' + (total ? Math.round(seen / total * 100) : 0) + '%"></i></div>' +
        '<div class="meta"><span>' + seen + ' / ' + total + ' sayfa</span>' +
        (st.score != null ? '<span class="score">Test ' + st.score + '/' + st.total + '</span>' : '<span>Test yapılmadı</span>') +
        '</div>' +
      '</div>';
    applyMedia(c, m.media);
    c.onclick = function () { openUnit(u); };
    grid.appendChild(c);
  });

  $('#heroStats').innerHTML =
    '<div><b>' + doneCount + ' / ' + LEVEL.units.length + '</b>tamamlanan ünite</div>' +
    '<div><b>' + pagesSeen + ' / ' + pagesTotal + '</b>okunan sayfa</div>' +
    (bestTotal ? '<div><b>' + bestSum + ' / ' + bestTotal + '</b>test puanı</div>' : '');

  // Menü zeigt Sprach-/Ebenenliste
  var toc = $('#toc');
  var h = '<h4>' + esc(CATALOG.app.name) + '</h4>';
  CATALOG.languages.forEach(function (l) {
    l.levels.forEach(function (lv) {
      h += '<div class="toc-item cur"><span class="toc-num">▸</span><span>' +
           '<span class="toc-t">' + esc(l.name) + ' · ' + esc(lv.name) + '</span>' +
           '<span class="toc-s">' + lv.units.length + ' ünite</span></span></div>';
    });
  });
  h += '<div class="toc-item"><span class="toc-num">·</span><span><span class="toc-t">English · Español · Français</span><span class="toc-s">yakında</span></span></div>';
  toc.innerHTML = h;
}

/* ---------------- Einheit öffnen ---------------- */
var cache = {};
function openUnit(u) {
  var m = u._meta;
  UNIT = m;
  $('#homeScreen').classList.remove('on');
  $('#readerScreen').classList.add('on');
  $('#pill').hidden = false;
  $('#botnav').classList.add('on');
  $('#stage').innerHTML = '<div class="loading"><div class="spin"></div><span>Ünite yükleniyor…</span></div>';
  window.scrollTo(0, 0);

  var done = function (html) {
    var stage = $('#stage');
    stage.innerHTML = html;
    PAGES = $$('.page', stage);
    AUDIOS = [];
    applyMedia(stage, m.media);
    wireAudio(stage, m.media);
    $$('.ord .bank', stage).forEach(shuffle);
    $$('.mt .mtcol:last-child', stage).forEach(shuffle);
    buildTOC();
    CUR = 0;
    if (PAGES.length) PAGES[0].classList.add('on');
    var st = unitState(m.id);
    goPage(Math.min(st.page || 0, PAGES.length - 1));
    document.title = m.title + ' · Deutsch, wieder…';
    location.hash = m.id;
  };

  if (cache[m.id]) { done(cache[m.id]); return; }
  fetch(m.content).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.text();
  }).then(function (html) {
    cache[m.id] = html; done(html);
  }).catch(function () {
    $('#stage').innerHTML = '<div class="sheet"><h2>Ünite yüklenemedi</h2>' +
      '<p class="lede">İçerik dosyasına ulaşılamadı: <code>' + esc(m.content) + '</code></p>' +
      '<p class="lede">Uygulamayı bir web sunucusundan açtığınızdan emin olun.</p></div>';
  });
}

function exitUnit() {
  stopAudio();
  UNIT = null; PAGES = []; CUR = 0; AUDIOS = [];
  $('#readerScreen').classList.remove('on');
  $('#homeScreen').classList.add('on');
  location.hash = '';
  renderHome();
  window.scrollTo(0, 0);
}

/* ---------------- Verdrahtung ---------------- */
$('#menuBtn').onclick = function () {
  $('#toc').classList.toggle('on'); $('#scrim').classList.toggle('on');
};
$('#scrim').onclick = closeMenu;
$('#toc').addEventListener('click', function (e) {
  if (e.target.closest('#tocBack')) { closeMenu(); exitUnit(); return; }
  var it = e.target.closest('.toc-item');
  if (it && it.dataset.i != null) { goPage(+it.dataset.i); closeMenu(); }
});
$('#prevBtn').onclick = function () { goPage(CUR - 1); };
$('#nextBtn').onclick = function () {
  if (this.dataset.exit === '1') exitUnit(); else goPage(CUR + 1);
};
document.addEventListener('keydown', function (e) {
  if (!UNIT) return;
  if (e.target.matches('input,textarea')) return;
  if (e.key === 'ArrowRight') goPage(CUR + 1);
  if (e.key === 'ArrowLeft') goPage(CUR - 1);
  if (e.key === 'Escape') exitUnit();
});

/* Wischen */
(function () {
  var sx = 0, sy = 0, tracking = false;
  var st = $('#stage');
  st.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  st.addEventListener('touchend', function (e) {
    if (!tracking) return; tracking = false;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0) { if (CUR < PAGES.length - 1) goPage(CUR + 1); }
      else goPage(CUR - 1);
    }
  }, { passive: true });
})();

$('#resetBtn').onclick = function () {
  if (!confirm('Tüm ilerleme silinecek. Emin misiniz?')) return;
  save({}); renderHome(); toast('İlerleme sıfırlandı');
};
$('#aboutBtn').onclick = function () {
  toast('Deutsch, wieder… · Vorwärts ruhundan ilhamla, kişisel kullanım için');
};

$('#logoutBtn').onclick = function () {
  if (!confirm('Çıkış yapılacak ve bu cihazdaki yerel ilerleme silinecek. Emin misiniz?')) return;
  logout();
  location.reload();
};

/* ---------------- Giriş ekranı verdirmesi ---------------- */
function showAuthScreen() {
  $('#homeScreen').classList.remove('on');
  $('#readerScreen').classList.remove('on');
  $('#authScreen').classList.add('on');
}
function hideAuthScreen() {
  $('#authScreen').classList.remove('on');
}
(function () {
  var form = $('#authForm');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#authName').value.trim();
    var pin = $('#authPin').value.trim();
    var errBox = $('#authErr');
    errBox.hidden = true;
    if (!name || !/^\d{4}$/.test(pin)) {
      errBox.textContent = 'Ad ve 4 haneli PIN gerekli.';
      errBox.hidden = false;
      return;
    }
    var btn = $('#authSubmit');
    btn.disabled = true; btn.textContent = 'Bağlanıyor…';
    login(name, pin).then(function () {
      hideAuthScreen();
      startApp();
    }).catch(function (e) {
      errBox.textContent = e.message || 'Giriş başarısız';
      errBox.hidden = false;
    }).finally(function () {
      btn.disabled = false; btn.textContent = 'Devam et';
    });
  });
  $('#authSkip').onclick = function () {
    setGuest();
    hideAuthScreen();
    startApp();
  };
})();

/* ---------------- Start ---------------- */
function startApp() {
  pull().then(function () {
  fetch('content/catalog.json').then(function (r) { return r.json(); }).then(function (cat) {
    CATALOG = cat;
    LANG = cat.languages[0];
    LEVEL = LANG.levels[0];
    var jobs = [];
    cat.languages.forEach(function (l) {
      l.levels.forEach(function (lv) {
        lv.units.forEach(function (u) {
          jobs.push(fetch(u.meta).then(function (r) { return r.json(); }).then(function (m) { u._meta = m; }));
        });
      });
    });
    return Promise.all(jobs);
  }).then(function () {
    renderHome();
    var h = (location.hash || '').replace('#', '');
    if (h) {
      var found = null;
      CATALOG.languages.forEach(function (l) {
        l.levels.forEach(function (lv) {
          lv.units.forEach(function (u) { if (u._meta.id === h) { found = u; LANG = l; LEVEL = lv; } });
        });
      });
      if (found) openUnit(found);
    }
  }).catch(function (err) {
    document.querySelector('.home').innerHTML =
      '<div class="sheet"><h2>Uygulama yüklenemedi</h2>' +
      '<p class="lede">İçerik kataloğuna ulaşılamadı.</p>' +
      '<p class="lede">Bu uygulamanın bir web sunucusundan açılması gerekir — dosyaya çift tıklayarak değil. ' +
      'GitHub Pages adresinden ya da yerel bir sunucudan açın.</p>' +
      '<p class="lede" style="color:var(--ink-3);font-size:13px">' + esc(String(err)) + '</p></div>';
  });
  });
}

function boot() {
  var auth = authLoad();
  if (apiBase() && !auth && !isGuest()) {
    showAuthScreen();
    return;
  }
  startApp();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}

boot();
})();
