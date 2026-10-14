(function () {
  'use strict';
  var SIZES = [['Petit', 22], ['Moyen', 26], ['Grand', 32], ['Très grand', 40]];
  var STYLES = ['Mushaf', 'Crème', 'Nuit'];
  var SPEEDS = [['Très lent', 0.1], ['Lent', 0.2], ['Moyen', 0.35], ['Vite', 0.6], ['Très vite', 1.0]];
  var LF = [1.7, 1.8, 1.7];
  var VERSION = '__VERSION__';

  var V = [], T = null, pageStart = [], juzStart = [0];
  var firstOfSura = [], countOfSura = [];
  var base = null, wordCount = 4;
  var S = { style: 0, size: 1, auto: 0, speed: 1, tab: 0, bookmarks: [], last: null };
  var cur = 0, sel = null, showTr = false;
  var playing = false, raf = 0, prog = 0, lastT = 0, wake = null;

  var $ = function (id) { return document.getElementById(id); };
  var wrap = $('pageWrap'), pageEl = $('page');

  function loadPrefs() {
    try { Object.assign(S, JSON.parse(localStorage.getItem('alquran') || '{}')); } catch (e) {}
    S.style = Math.min(Math.max(S.style | 0, 0), 2);
    S.size = Math.min(Math.max(S.size | 0, 0), SIZES.length - 1);
    S.speed = Math.min(Math.max(S.speed | 0, 0), SPEEDS.length - 1);
    if (!Array.isArray(S.bookmarks)) S.bookmarks = [];
  }
  function savePrefs() { try { localStorage.setItem('alquran', JSON.stringify(S)); } catch (e) {} }

  function baseLetters(s) { return s.normalize('NFD').replace(/\p{M}/gu, ''); }
  function splitBasmala(i) {
    var v = V[i];
    if (!base || v[1] !== 1 || v[0] === 1 || v[0] === 9) return null;
    var words = v[2].split(' ');
    if (words.length <= wordCount) return null;
    var head = words.slice(0, wordCount).join(' ');
    if (baseLetters(head) !== base) return null;
    return [head, words.slice(wordCount).join(' ')];
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function lastBefore(arr, i) {
    var lo = 0, hi = arr.length - 1, ans = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (arr[mid] <= i) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }
  function pageOf(i) { return lastBefore(pageStart, i); }
  function juzOf(i) { return lastBefore(juzStart, i) + 1; }
  function lastOfPage(p) { return p + 1 < pageStart.length ? pageStart[p + 1] - 1 : V.length - 1; }
  function suraName(n) { return window.SURAS[n - 1][1]; }

  function init(D) {
    V = D.v; T = D.t && D.t.length === V.length ? D.t : null;
    var bv = V[0];
    if (bv) { base = baseLetters(bv[2]); wordCount = bv[2].split(' ').length; }
    pageStart = (D.p || []).slice();
    juzStart = (D.j || []).slice();
    if (pageStart.length < 300) {
      pageStart = []; var c = 0;
      V.forEach(function (v, i) { if (i === 0 || v[1] === 1 || c >= 10) { pageStart.push(i); c = 0; } c++; });
    }
    if (!juzStart.length) juzStart = [0];
    V.forEach(function (v, i) {
      if (v[1] === 1) firstOfSura[v[0]] = i;
      countOfSura[v[0]] = (countOfSura[v[0]] || 0) + 1;
    });
    S.bookmarks = S.bookmarks.filter(function (i) { return i >= 0 && i < V.length; });
    if (S.last != null && !(S.last >= 0 && S.last < V.length)) S.last = null;
    applyLook();
    renderHome();
    $('loading').hidden = true;
  }

  function applyLook() {
    document.body.className = 'style-' + S.style + (sel != null ? ' panel-open' : '');
    document.documentElement.style.setProperty('--fs', SIZES[S.size][1] + 'px');
    document.documentElement.style.setProperty('--lf', LF[S.style]);
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = S.style === 2 ? '#121212' : '#3F4E66';
  }

  // ---------- Accueil ----------
  function resumeCard() {
    if (S.last == null) return '';
    var v = V[S.last];
    return '<div class="resume" data-open="' + S.last + '"><div><small>Reprendre la lecture</small><b>' +
      suraName(v[0]) + ' · verset ' + v[1] + '</b></div><span class="ar">' + window.SURAS[v[0] - 1][0] + '</span></div>';
  }
  function renderHome() {
    var body = $('homeBody'), h = '';
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', +b.dataset.tab === S.tab); });
    if (S.tab === 0) {
      h = resumeCard();
      for (var n = 1; n <= 114; n++) {
        h += '<div class="row" data-open="' + firstOfSura[n] + '"><div class="num">' + n + '</div><div class="mid"><b>' + suraName(n) +
          '</b><small>' + (window.MEDINAN.indexOf(n) >= 0 ? 'Médinoise' : 'Mecquoise') + ' · ' + countOfSura[n] +
          ' versets</small></div><span class="ar">' + window.SURAS[n - 1][0] + '</span></div>';
      }
    } else if (S.tab === 1) {
      h = resumeCard();
      if (!S.bookmarks.length) h += '<div class="empty">Aucun marque-page. Dans la lecture, touche un verset puis « Marque-page ».</div>';
      S.bookmarks.forEach(function (i) {
        var v = V[i], p = pageOf(i);
        h += '<div class="row" data-open="' + i + '"><span class="star">★</span><div class="mid"><b>' + suraName(v[0]) + ' · verset ' + v[1] +
          '</b><small>Page ' + (p + 1) + ' · Juz\' ' + juzOf(i) + '</small></div><button class="x" data-rm="' + i + '">✕</button></div>';
      });
    } else {
      h = '<div class="settings"><h2>Affichage</h2><div class="lab">Style</div><div class="choices" data-k="style">' +
        STYLES.map(function (s, i) { return '<button data-v="' + i + '"' + (i === S.style ? ' class="on"' : '') + '>' + s + '</button>'; }).join('') +
        '</div><div class="lab">Taille du texte</div><div class="choices" data-k="size">' +
        SIZES.map(function (s, i) { return '<button data-v="' + i + '"' + (i === S.size ? ' class="on"' : '') + '>' + s[0] + '</button>'; }).join('') +
        '</div><div class="lab">Défilement automatique</div><div class="choices" data-k="auto">' +
        '<button data-v="0"' + (!S.auto ? ' class="on"' : '') + '>Désactivé</button><button data-v="1"' + (S.auto ? ' class="on"' : '') + '>Activé</button></div>';
      if (S.auto) {
        h += '<div class="lab">Vitesse</div><div class="choices" data-k="speed">' +
          SPEEDS.map(function (s, i) { return '<button data-v="' + i + '"' + (i === S.speed ? ' class="on"' : '') + '>' + s[0] + '</button>'; }).join('') +
          '</div><div class="lab">En lecture, un bouton ▶ apparaît en bas à gauche : il lance ou arrête le défilement. Toucher la page l\'arrête.</div>';
      }
      h += '<div class="about">Appli de lecture du Coran à usage familial (version web ' + VERSION + ').\n' +
        '• Fonctionne sans internet une fois chargée ; rien n\'est envoyé, tout reste sur ce téléphone (marque-pages, dernière page lue).\n' +
        '• Texte du Coran (Uthmani) : projet Tanzil, tanzil.net, texte non modifié.\n' +
        '• Traduction française : M. Hamidullah, via Tanzil.\n' +
        '• Police : Amiri Quran (licence libre OFL).\n' +
        '• Astuce : tourne le téléphone à l\'horizontale pour un texte très agrandi.\n' +
        '• Sur iPhone : Safari › Partager › « Sur l\'écran d\'accueil » pour installer l\'appli.</div></div>';
    }
    body.innerHTML = h;
  }

  $('homeBody').addEventListener('click', function (e) {
    var rm = e.target.closest('[data-rm]');
    if (rm) { e.stopPropagation(); toggleBookmark(+rm.dataset.rm); renderHome(); return; }
    var ch = e.target.closest('.choices button');
    if (ch) {
      var k = ch.parentNode.dataset.k, val = +ch.dataset.v;
      S[k] = val; savePrefs(); applyLook(); renderHome(); return;
    }
    var o = e.target.closest('[data-open]');
    if (o) openReader(+o.dataset.open);
  });
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    S.tab = +b.dataset.tab; renderHome(); $('homeBody').scrollTop = 0;
  });

  function toggleBookmark(i) {
    var k = S.bookmarks.indexOf(i);
    if (k >= 0) S.bookmarks.splice(k, 1); else S.bookmarks.unshift(i);
    savePrefs();
  }

  // ---------- Lecture ----------
  function renderPage(p) {
    var first = pageStart[p], last = lastOfPage(p);
    var h = '<div class="hd"><span>الجزء ' + juzOf(first) + '</span><span>سورة ' + window.SURAS[V[first][0] - 1][0] + '</span></div>';
    var para = [];
    function flush() { if (para.length) { h += '<p class="para">' + para.join(' ') + '</p>'; para = []; } }
    for (var i = first; i <= last; i++) {
      var v = V[i], text = v[2];
      if (v[1] === 1) {
        flush();
        h += '<div class="banner">سورة ' + window.SURAS[v[0] - 1][0] + '</div>';
        var sp = splitBasmala(i);
        if (sp) { h += '<div class="basmala">' + esc(sp[0]) + '</div>'; text = sp[1]; }
      }
      para.push('<span class="v' + (i === sel ? ' sel' : '') + '" data-i="' + i + '">' + esc(text) + '&nbsp;<span class="mk' +
        (v[1] > 99 ? ' w3' : '') + '"><b>' + v[1] + '</b></span></span>');
    }
    flush();
    h += '<div class="pn">' + (p + 1) + '</div>';
    pageEl.innerHTML = h;
  }

  function goPage(p, then) {
    p = Math.max(0, Math.min(pageStart.length - 1, p));
    if (p === cur) { if (then) then(); return; }
    pageEl.classList.add('fade');
    setTimeout(function () {
      cur = p; sel = null; closePanel(); renderPage(cur); wrap.scrollTop = 0;
      pageEl.classList.remove('fade');
      S.last = pageStart[cur]; savePrefs();
      if (then) then();
    }, 130);
  }

  function openReader(i) {
    stopAuto(); sel = null; showTr = false;
    cur = pageOf(i);
    S.last = pageStart[cur]; savePrefs();
    renderPage(cur); wrap.scrollTop = 0;
    $('home').hidden = true; $('reader').hidden = false;
    updateControls(); applyLook();
    try { history.pushState({ r: 1 }, ''); } catch (e) {}
  }
  function doClose() {
    stopAuto(); sel = null; closePanel();
    $('reader').hidden = true; $('home').hidden = false;
    renderHome(); applyLook();
  }
  function closeReader() {
    if (history.state && history.state.r) history.back(); else doClose();
  }
  window.addEventListener('popstate', function () { if (!$('reader').hidden) doClose(); });
  $('btnHome').addEventListener('click', closeReader);

  // Toucher un verset : surlignage + menu ; toucher ailleurs : ferme le menu.
  wrap.addEventListener('click', function (e) {
    var el = e.target.closest('.v');
    if (!el) { closePanel(); return; }
    var i = +el.dataset.i;
    if (sel === i) { closePanel(); return; }
    sel = i; showTr = false; markSel(); openPanel();
  });
  function markSel() {
    pageEl.querySelectorAll('.v.sel').forEach(function (n) { n.classList.remove('sel'); });
    if (sel != null) { var n = pageEl.querySelector('.v[data-i="' + sel + '"]'); if (n) n.classList.add('sel'); }
  }
  function openPanel() {
    var v = V[sel];
    $('panelRef').textContent = suraName(v[0]) + ' · verset ' + v[1];
    var marked = S.bookmarks.indexOf(sel) >= 0;
    $('actMark').querySelector('i').textContent = marked ? '★' : '☆';
    $('actMark').querySelector('span').textContent = marked ? 'Retirer' : 'Marque-page';
    $('actTr').hidden = !(T && T[sel]);
    $('panelTr').hidden = !showTr;
    if (showTr && T) $('panelTr').textContent = T[sel];
    $('panel').hidden = false;
    stopAuto(); applyLook();
  }
  function closePanel() {
    if (sel != null) { sel = null; markSel(); }
    $('panel').hidden = true; showTr = false;
    applyLook();
  }
  $('panelClose').addEventListener('click', closePanel);
  $('actMark').addEventListener('click', function () { toggleBookmark(sel); openPanel(); });
  $('actTr').addEventListener('click', function () { showTr = !showTr; openPanel(); });
  function verseText(i) {
    var v = V[i], s = '﴿ ' + v[2] + ' ﴾\n';
    if (T && T[i]) s += '\n' + T[i] + '\n';
    return s + '\n— ' + suraName(v[0]) + ' (' + v[0] + ':' + v[1] + ')';
  }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 1600);
  }
  function copyText(s) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(s).then(function () { toast('Copié'); }, fallbackCopy);
    }
    fallbackCopy();
    function fallbackCopy() {
      var ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copié'); } catch (e) {}
      document.body.removeChild(ta);
    }
  }
  $('actCopy').addEventListener('click', function () { copyText(verseText(sel)); });
  $('actShare').addEventListener('click', function () {
    var s = verseText(sel);
    if (navigator.share) navigator.share({ text: s }).catch(function () {}); else copyText(s);
  });

  // Glisser horizontalement : la page suivante est à gauche, comme dans un livre arabe.
  var tx = 0, ty = 0;
  wrap.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    stopAuto();
  }, { passive: true });
  wrap.addEventListener('touchend', function (e) {
    var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) goPage(dx > 0 ? cur + 1 : cur - 1);
  }, { passive: true });

  // ---------- Défilement automatique ----------
  function updateControls() {
    $('btnPlay').hidden = !S.auto;
    $('btnPlay').textContent = playing ? '⏸' : '▶';
    $('btnSlower').hidden = $('btnFaster').hidden = !(S.auto && playing);
  }
  function requestWake() {
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wake = l; }, function () {}); } catch (e) {}
  }
  function startAuto() {
    if (!S.auto || playing) return;
    closePanel();
    playing = true; prog = wrap.scrollTop; lastT = 0;
    raf = requestAnimationFrame(tick); requestWake(); updateControls();
  }
  function stopAuto() {
    if (!playing) return;
    playing = false; cancelAnimationFrame(raf);
    try { if (wake) wake.release(); } catch (e) {}
    wake = null; updateControls();
  }
  function tick(t) {
    if (!playing) return;
    if (lastT) {
      var fpx = parseFloat(getComputedStyle(pageEl).fontSize);
      prog += (t - lastT) / 1000 * SPEEDS[S.speed][1] * fpx * LF[S.style];
      var max = wrap.scrollHeight - wrap.clientHeight;
      wrap.scrollTop = Math.floor(Math.min(prog, Math.max(max, 0)));
      // Fin de page : petite pause, puis page suivante.
      if (prog >= Math.max(max, 0) + wrap.clientHeight * 0.5) {
        if (cur + 1 >= pageStart.length) { stopAuto(); return; }
        cancelAnimationFrame(raf);
        goPage(cur + 1, function () { if (playing) { prog = 0; lastT = 0; raf = requestAnimationFrame(tick); } });
        return;
      }
    }
    lastT = t;
    raf = requestAnimationFrame(tick);
  }
  $('btnPlay').addEventListener('click', function () { if (playing) stopAuto(); else startAuto(); });
  $('btnSlower').addEventListener('click', function () { S.speed = Math.max(0, S.speed - 1); savePrefs(); toast(SPEEDS[S.speed][0]); });
  $('btnFaster').addEventListener('click', function () { S.speed = Math.min(SPEEDS.length - 1, S.speed + 1); savePrefs(); toast(SPEEDS[S.speed][0]); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopAuto(); });

  // ---------- Démarrage ----------
  loadPrefs();
  fetch('data.json').then(function (r) { return r.json(); }).then(init).catch(function () {
    $('loading').textContent = 'Texte du Coran introuvable. Rouvre l\'appli avec internet une première fois.';
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
