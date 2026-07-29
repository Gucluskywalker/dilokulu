/* ==========================================================
   Yes We Do Learning (YWDL)  ·  App-Engine
   Tek iskelet, çok dil, çok seviye. İçerik content/ altında.
   ========================================================== */
(function () {
'use strict';

var STORE = 'dw.v1';
var CATALOG = null;
var LANG = null;      // aktif dil nesnesi
var LEVEL = null;     // aktif seviye nesnesi
var UNIT = null;      // yüklü ünite meta
var PAGES = [];       // aktif ünite sayfaları (DOM)
var CUR = 0;
var AUDIOS = [];

/* ---------------- Arayüz metinleri (dile göre) ---------------- */
var UI_STR = {
  de: {
    unit: 'Einheit', back: 'Zurück', next: 'Weiter', toOverview: 'Zur Übersicht',
    notChecked: 'Noch nicht geprüft', notCheckedSub: 'Alıştırmaları çözün, sonra “Prüfen”e basın.',
    excellent: 'Ausgezeichnet! 🎉', excellentSub: 'Bir sonraki üniteye geçebilirsiniz.',
    veryGood: 'Sehr gut!', veryGoodSub: 'Birkaç noktayı tekrar edin, sonra devam edin.',
    good: 'Gut gemacht.', goodSub: 'Gramer sayfalarını bir kez daha okuyun.',
    keepPracticing: 'Weiter üben!', keepPracticingSub: 'Üniteyi baştan gözden geçirmeniz faydalı olur.'
  },
  en: {
    unit: 'Unit', back: 'Back', next: 'Next', toOverview: 'Back to overview',
    notChecked: 'Not checked yet', notCheckedSub: 'Alıştırmaları çözün, sonra “Check”e basın.',
    excellent: 'Excellent! 🎉', excellentSub: 'Bir sonraki üniteye geçebilirsiniz.',
    veryGood: 'Very good!', veryGoodSub: 'Birkaç noktayı tekrar edin, sonra devam edin.',
    good: 'Well done.', goodSub: 'Gramer sayfalarını bir kez daha okuyun.',
    keepPracticing: 'Keep practising!', keepPracticingSub: 'Üniteyi baştan gözden geçirmeniz faydalı olur.'
  }
};
function uiStr(k) { return (UI_STR[LANG && LANG.code] || UI_STR.en)[k]; }

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

/* ---------------- Hesap: ad + 4 haneli PIN (Cloudflare Worker) ---------------- */
var API_BASE = 'https://dilokulu-auth.bb2p4y7wds.workers.dev';
var ACCOUNT_KEY = 'ywdl.account';
function getAccount() {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY)) || null; } catch (e) { return null; }
}
function setAccount(acc) {
  try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc)); } catch (e) {}
}
function clearAccount() {
  try { localStorage.removeItem(ACCOUNT_KEY); } catch (e) {}
}

function mergeUnits(incoming) {
  if (!incoming || typeof incoming !== 'object') return 0;
  var s = load(); s.units = s.units || {}; var n = 0;
  Object.keys(incoming).forEach(function (id) {
    var a = s.units[id] || { page: 0, seen: [], score: null, total: null, done: false };
    var b = incoming[id] || {};
    var seen = (a.seen || []).slice();
    (b.seen || []).forEach(function (x) { if (seen.indexOf(x) === -1) seen.push(x); });
    var better = (b.score != null && (a.score == null || b.score > a.score));
    s.units[id] = {
      page: Math.max(a.page || 0, b.page || 0),
      seen: seen,
      score: better ? b.score : a.score,
      total: better ? b.total : a.total,
      done: !!(a.done || b.done)
    };
    n++;
  });
  save(s); return n;
}

var pushTimer = null;
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushProgress, 1200);
}
function pushProgress() {
  var acc = getAccount();
  if (!acc) return;
  var s = load();
  fetch(API_BASE + '/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: acc.name, pin: acc.pin, progress: s.units || {} })
  }).catch(function () {});
}
function pullAndMerge(acc) {
  return fetch(API_BASE + '/progress?name=' + encodeURIComponent(acc.name) + '&pin=' + encodeURIComponent(acc.pin))
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.ok) mergeUnits(d.progress); return d; })
    .catch(function () { return { ok: false, offline: true }; });
}
function apiAuth(name, pin) {
  return fetch(API_BASE + '/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, pin: pin })
  }).then(function (r) { return r.json().then(function (d) { d._status = r.status; return d; }); })
    .catch(function () { return { ok: false, offline: true }; });
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
    var a = new Audio();
    // Safari, play() çağrısının kullanıcı tıklamasıyla AYNI anda (senkron) yapılmasını
    // ister; tıklamadan sonra bir hata/geri dönüş zincirinden geçerse sessizce engeller.
    // Bu yüzden burada, sayfa açılır açılmaz (kullanıcı tıklamadan ÖNCE) hangi adresin
    // (local mı, remote mi) çalıştığını belirleyip a.src'yi ona sabitliyoruz — tıklama
    // anında yapılan tek şey doğrudan play() çağrısı oluyor.
    a.preload = 'metadata';
    var triedRemote = false, dead = false;

    if (!rec) { dead = true; bar.classList.add('miss'); st.textContent = 'Ses dosyası tanımsız'; }
    else { a.src = rec.local; a.load(); }

    a.addEventListener('error', function () {
      if (rec && rec.remote && !triedRemote) {
        triedRemote = true; a.src = rec.remote; a.load();
        return;
      }
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
        var p = a.play();
        if (p && p.then) {
          p.then(function () { pl.innerHTML = S_ICO; }).catch(function () {
            // Safari bazen ilk denemede reddeder (kaynak henüz tam hazır değilse);
            // aynı tıklama içinde değiliz ama bir kez daha deneyip kullanıcıya
            // net bir geri bildirim veriyoruz.
            st.textContent = 'Oynatılamadı — tekrar deneyin';
          });
        }
        pl.innerHTML = S_ICO;
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
  if (!touched) m = '<b>' + uiStr('notChecked') + '</b>' + uiStr('notCheckedSub');
  else if (p >= .9) m = '<b>' + uiStr('excellent') + '</b>' + uiStr('excellentSub');
  else if (p >= .75) m = '<b>' + uiStr('veryGood') + '</b>' + uiStr('veryGoodSub');
  else if (p >= .5) m = '<b>' + uiStr('good') + '</b>' + uiStr('goodSub');
  else m = '<b>' + uiStr('keepPracticing') + '</b>' + uiStr('keepPracticingSub');
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
  var pb = $('#prevBtn');
  pb.disabled = (CUR === 0);
  pb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg> ' + uiStr('back');
  var nb = $('#nextBtn');
  var last = CUR === PAGES.length - 1;
  nb.disabled = false;
  nb.innerHTML = last
    ? uiStr('toOverview')
    : uiStr('next') + ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
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
  document.title = CATALOG.app.name;
  $('#pill').hidden = true;
  $('#botnav').classList.remove('on');
  $('#prog').style.width = '0';
  $('#verLabel').textContent = 'v' + CATALOG.app.version;

  $('#levelTitle').textContent = LANG.name + ' ' + LEVEL.name + ' · ' + LEVEL.tr;
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
        '<span class="badge">' + uiStr('unit') + ' ' + m.number + '</span>' +
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
    document.title = m.title + ' · ' + CATALOG.app.name;
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
  save({}); renderHome(); toast('İlerleme sıfırlandı'); schedulePush();
};

$('#aboutBtn').onclick = function () {
  toast(CATALOG.app.name + ' · Vorwärts ruhundan ilhamla, kişisel kullanım için');
};

/* ---------------- Ekran geçişleri ---------------- */
function showScreen(id) {
  $$('.screen').forEach(function (s) { s.classList.remove('on'); });
  $('#' + id).classList.add('on');
  $('#botnav').classList.toggle('on', id === 'readerScreen');
  $('#pill').hidden = (id !== 'readerScreen');
  window.scrollTo(0, 0);
}

/* ---------------- Hub (Almanca / İngilizce / Diğer) ---------------- */
function langByCode(code) {
  var found = null;
  CATALOG.languages.forEach(function (l) { if (l.code === code) found = l; });
  return found;
}
function renderHub() {
  var acc = getAccount();
  $('#hubName').textContent = acc ? acc.name : '';
  $('#verLabelHub').textContent = 'v' + CATALOG.app.version;
}
$('#hubDe').onclick = function () {
  var l = langByCode('de'); if (!l) return;
  LANG = l; LEVEL = l.levels[0]; renderLevels(); showScreen('levelScreen');
};
$('#hubEn').onclick = function () {
  var l = langByCode('en'); if (!l) return;
  LANG = l; LEVEL = l.levels[0]; renderLevels(); showScreen('levelScreen');
};
$('#toHubBtn').onclick = function () { renderHub(); showScreen('hubScreen'); };
$('#toHubBtn2').onclick = function () { renderHub(); showScreen('hubScreen'); };

/* ---------------- Seviye seçimi (A1 aktif, A2/B1/B2 çok yakında) ---------------- */
var CEFR = ['A1', 'A2', 'B1', 'B2'];
function renderLevels() {
  $('#levelHeadTitle').textContent = esc(LANG.name);
  var grid = $('#levelGrid'); grid.innerHTML = '';
  CEFR.forEach(function (code) {
    var lv = null;
    LANG.levels.forEach(function (l) { if ((l.name || '').toUpperCase().indexOf(code) === 0) lv = l; });
    var c = el('div', 'hubcard' + (lv ? ' active' : ' disabled'));
    c.innerHTML = '<h3>' + code + '</h3><div class="sub">' + (lv ? (lv.units.length + ' ünite') : 'çok yakında') + '</div>';
    if (lv) {
      c.onclick = function () { LEVEL = lv; renderHome(); showScreen('homeScreen'); };
    }
    grid.appendChild(c);
  });
}

/* ---------------- Giriş (ad + PIN) ---------------- */
function loginStart() {
  var acc = getAccount();
  if (!acc) { showScreen('loginScreen'); return; }
  apiAuth(acc.name, acc.pin).then(function (d) {
    if (d && d.ok) {
      pullAndMerge(acc).then(function () { renderHub(); showScreen('hubScreen'); });
    } else if (d && d.error === 'pin_mismatch') {
      clearAccount(); toast('Oturum bilgisi geçersiz, yeniden giriş yapın'); showScreen('loginScreen');
    } else {
      // sunucuya ulaşılamadı — çevrimdışı devam et
      renderHub(); showScreen('hubScreen');
      toast('Çevrimdışı mod: ilerleme bu cihazda saklanıyor');
    }
  });
}
$('#loginBtn').onclick = function () {
  var name = $('#loginName').value.trim();
  var pin = $('#loginPin').value.trim();
  if (!name) { $('#loginMsg').textContent = 'Lütfen bir kullanıcı adı yazın.'; return; }
  if (!/^\d{4}$/.test(pin)) { $('#loginMsg').textContent = '4 haneli rakamdan oluşan bir PIN girin.'; return; }
  $('#loginBtn').disabled = true; $('#loginMsg').textContent = 'Bağlanıyor…';
  apiAuth(name, pin).then(function (d) {
    $('#loginBtn').disabled = false;
    if (d && d.ok) {
      setAccount({ name: name, pin: pin });
      pullAndMerge({ name: name, pin: pin }).then(function () {
        renderHub(); showScreen('hubScreen');
      });
    } else if (d && d.error === 'pin_mismatch') {
      $('#loginMsg').textContent = 'Bu kullanıcı adı için PIN yanlış. Tekrar deneyin.';
    } else {
      // sunucuya ulaşılamadı — yine de bu cihazda devam et
      setAccount({ name: name, pin: pin });
      renderHub(); showScreen('hubScreen');
      toast('Çevrimdışı mod: ilerleme bu cihazda saklanıyor');
    }
  });
};
$('#logoutBtn').onclick = function () {
  clearAccount();
  $('#loginName').value = ''; $('#loginPin').value = '';
  $('#loginMsg').textContent = 'Yeni bir isimse hesap otomatik oluşturulur; var olan isimse aynı PIN ile giriş yapılır.';
  showScreen('loginScreen');
};

/* ---------------- Start ---------------- */
function boot() {
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
    var h = (location.hash || '').replace('#', '');
    if (h) {
      var found = null;
      CATALOG.languages.forEach(function (l) {
        l.levels.forEach(function (lv) {
          lv.units.forEach(function (u) { if (u._meta.id === h) { found = u; LANG = l; LEVEL = lv; } });
        });
      });
      if (found) {
        renderHome();
        showScreen('homeScreen');
        var acc = getAccount();
        if (acc) apiAuth(acc.name, acc.pin).then(function (d) { if (d && d.ok) pullAndMerge(acc); });
        openUnit(found);
        return;
      }
    }
    loginStart();
  }).catch(function (err) {
    document.querySelector('#loginScreen .home').innerHTML =
      '<div class="sheet"><h2>Uygulama yüklenemedi</h2>' +
      '<p class="lede">İçerik kataloğuna ulaşılamadı.</p>' +
      '<p class="lede">Bu uygulamanın bir web sunucusundan açılması gerekir — dosyaya çift tıklayarak değil. ' +
      'GitHub Pages adresinden ya da yerel bir sunucudan açın.</p>' +
      '<p class="lede" style="color:var(--ink-3);font-size:13px">' + esc(String(err)) + '</p></div>';
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}

boot();
})();
