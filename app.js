/* Camera Wall - a barebones Samsung TV (Tizen) camera viewer.
   ES5 only, for old TVs. Reads window.CAMERAS = { base, token, cams:[{id,name}] }.
   Grid of near-live snapshots from Home Assistant; OK enlarges a tile to the
   live MJPEG stream; Back un-enlarges, or exits from the grid. */
(function () {
  'use strict';

  var CFG = window.CAMERAS && typeof window.CAMERAS === 'object' ? window.CAMERAS : null;
  var BASE = CFG ? String(CFG.base || '').replace(/\/+$/, '') : '';
  var TOKEN = CFG ? String(CFG.token || '') : '';
  var CAMS = CFG && CFG.cams && CFG.cams.length ? CFG.cams.slice(0, 4) : [];
  var SNAP_MS = 2000, TOKEN_MS = 180000;

  var gridEl = document.getElementById('grid');
  var statusEl = document.getElementById('status');
  var hintEl = document.getElementById('hint');

  var tokens = {};          // entity id -> rotating access_token
  var sel = 0, big = false, tick = 0;
  var snapTimer = null, tokTimer = null;

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.innerHTML = text || '';
    statusEl.className = text ? 'status' : 'status hidden';
  }
  function haGet(path, onOk, onErr) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', BASE + path, true);
      x.setRequestHeader('Authorization', 'Bearer ' + TOKEN);
      x.timeout = 8000;
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        if (x.status >= 200 && x.status < 300) {
          try { onOk(JSON.parse(x.responseText)); } catch (e) { if (onErr) onErr(e); }
        } else if (onErr) { onErr(x.status); }
      };
      x.ontimeout = function () { if (onErr) onErr('timeout'); };
      x.onerror = function () { if (onErr) onErr('error'); };
      x.send();
    } catch (e) { if (onErr) onErr(e); }
  }
  function refreshTokens(done) {
    var pending = CAMS.length, got = 0;
    if (!pending) { if (done) done(0); return; }
    for (var i = 0; i < CAMS.length; i++) {
      (function (cam) {
        haGet('/api/states/' + encodeURIComponent(cam.id), function (st) {
          var t = st && st.attributes && st.attributes.access_token;
          if (t) { tokens[cam.id] = t; got++; }
          if (--pending === 0 && done) done(got);
        }, function () { if (--pending === 0 && done) done(got); });
      })(CAMS[i]);
    }
  }
  function snapUrl(cam) {
    if (!tokens[cam.id]) return '';
    return BASE + '/api/camera_proxy/' + encodeURIComponent(cam.id) + '?token=' + encodeURIComponent(tokens[cam.id]) + '&_=' + tick;
  }
  function liveUrl(cam) {
    if (!tokens[cam.id]) return '';
    return BASE + '/api/camera_proxy_stream/' + encodeURIComponent(cam.id) + '?token=' + encodeURIComponent(tokens[cam.id]);
  }

  function build() {
    var html = '';
    for (var i = 0; i < CAMS.length; i++) {
      html += '<div class="tile p' + i + '" id="tile' + i + '"><div class="inner is-msg" id="inner' + i + '">'
        + '<img class="cam" id="cam' + i + '" alt="">'
        + '<div class="label">' + esc(CAMS[i].name) + '</div>'
        + '<div class="msg"><span id="msg' + i + '">Connecting&hellip;</span></div>'
        + '</div></div>';
    }
    gridEl.innerHTML = html;
    for (var j = 0; j < CAMS.length; j++) {
      (function (idx, cam) {
        var img = document.getElementById('cam' + idx);
        img.onload = function () { setInnerMsg(idx, null); };
        img.onerror = function () { setInnerMsg(idx, 'Unavailable'); };
      })(j, CAMS[j]);
    }
  }
  function setInnerMsg(i, msg) {
    var inner = document.getElementById('inner' + i);
    var span = document.getElementById('msg' + i);
    if (!inner) return;
    if (msg) { if (span) span.innerHTML = esc(msg); inner.className = 'inner is-msg'; }
    else { inner.className = 'inner'; }
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function paintSnapshots() {
    tick++;
    for (var i = 0; i < CAMS.length; i++) {
      if (big && i === sel) continue;            // enlarged tile streams live
      var u = snapUrl(CAMS[i]), img = document.getElementById('cam' + i);
      if (img && u) { img.src = u; }
      else { setInnerMsg(i, tokens[CAMS[i].id] ? 'Unavailable' : 'Connecting…'); }
    }
  }
  function applyLive() {
    for (var i = 0; i < CAMS.length; i++) {
      var img = document.getElementById('cam' + i);
      if (!img) continue;
      if (big && i === sel) { var u = liveUrl(CAMS[i]); if (u) { img.src = u; } else { setInnerMsg(i, 'Unavailable'); } }
    }
  }

  function render() {
    gridEl.className = big ? 'grid big' : 'grid';
    for (var i = 0; i < CAMS.length; i++) {
      var tile = document.getElementById('tile' + i);
      if (!tile) continue;
      tile.className = 'tile p' + i + (i === sel ? ' focus' : '') + (big && i === sel ? ' sel' : '');
    }
    hintEl.innerHTML = CAMS.length ? (big ? '' : '') : '';
  }

  function move(dCol, dRow) {
    if (big || CAMS.length < 2) return;
    var cols = 2, row = Math.floor(sel / cols), col = sel % cols;
    var nCol = col + dCol, nRow = row + dRow, ni = nRow * cols + nCol;
    if (nCol < 0 || nCol >= cols) return;
    if (nRow < 0) return;
    if (ni < 0 || ni >= CAMS.length) return;
    sel = ni; render();
  }
  function enlarge() { if (!big && CAMS.length) { big = true; applyLive(); render(); } }
  function shrink() { if (big) { big = false; render(); paintSnapshots(); } }
  function exitApp() {
    try { tizen.application.getCurrentApplication().exit(); }
    catch (e) { try { window.close(); } catch (e2) {} }
  }

  function onKey(e) {
    var k = e.keyCode;
    // 37 left, 38 up, 39 right, 40 down, 13 enter/OK, 10009 return/back, 8 backspace
    if (k === 37) { move(-1, 0); }
    else if (k === 39) { move(1, 0); }
    else if (k === 38) { move(0, -1); }
    else if (k === 40) { move(0, 1); }
    else if (k === 13) { if (big) { /* stay */ } else { enlarge(); } }
    else if (k === 10009 || k === 8 || k === 27) { if (big) { shrink(); } else { exitApp(); } }
    else { return; }
    if (e.preventDefault) e.preventDefault();
  }

  function registerKeys() {
    try {
      if (window.tizen && tizen.tvinputdevice && tizen.tvinputdevice.registerKey) {
        tizen.tvinputdevice.registerKey('ArrowLeft');
        tizen.tvinputdevice.registerKey('ArrowRight');
        tizen.tvinputdevice.registerKey('ArrowUp');
        tizen.tvinputdevice.registerKey('ArrowDown');
        tizen.tvinputdevice.registerKey('Enter');
      }
    } catch (e) {}
  }

  function start() {
    if (!CFG || !BASE || !TOKEN || !CAMS.length) {
      setStatus('No cameras configured. Edit config.js.');
      return;
    }
    registerKeys();
    build(); render();
    setStatus('Connecting to cameras…');
    refreshTokens(function (got) {
      setStatus(got ? '' : 'Could not reach Home Assistant.');
      paintSnapshots();
    });
    snapTimer = setInterval(paintSnapshots, SNAP_MS);
    tokTimer = setInterval(function () { refreshTokens(function () {}); }, TOKEN_MS);
    document.addEventListener('keydown', onKey, false);
    // Pause polling while the app is hidden to save the old TV some work.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (snapTimer) { clearInterval(snapTimer); snapTimer = null; } }
      else if (!snapTimer) { paintSnapshots(); snapTimer = setInterval(paintSnapshots, SNAP_MS); }
    }, false);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') { start(); }
  else { window.addEventListener('load', start, false); }
})();
