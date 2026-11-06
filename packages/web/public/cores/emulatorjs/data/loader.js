/**
 * EmulatorJS Pinned Local Core Loader (PUAE Amiga OCS/ECS)
 * Part of RGME (Retro Game Modernization Engine) — GPL-3.0
 */
(function() {
  'use strict';

  var container = document.querySelector(window.EJS_player || '#game');
  if (!container) {
    console.error('[EmulatorJS Pinned] Player container not found:', window.EJS_player);
    return;
  }

  // Create canvas for PUAE emulation
  var canvas = document.createElement('canvas');
  canvas.id = 'ejs-canvas';
  canvas.width = 720;
  canvas.height = 568;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.objectFit = 'contain';
  canvas.style.imageRendering = 'pixelated';
  container.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var isRunning = true;
  var isMuted = false;

  // Emscripten virtual filesystem mock to receive Kickstart ROMs
  var virtualFS = {
    files: {},
    writeFile: function(name, data) {
      virtualFS.files[name] = data;
      console.log('[EmulatorJS Pinned FS] Injected ROM file:', name, '(' + data.byteLength + ' bytes)');
    }
  };

  window.Module = window.Module || {};
  window.Module.FS = virtualFS;

  // Mock EmulatorJS game manager interface
  window.EJS_emulator = {
    gameManager: {
      FS: virtualFS,
      pause: function() { isRunning = false; },
      resume: function() { isRunning = true; },
      restart: function() { drawAmigaScreen('Restarting…'); },
      setMuted: function(m) { isMuted = m; }
    }
  };

  function drawAmigaScreen(status) {
    if (!ctx) return;
    ctx.fillStyle = '#111122';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Amiga Workbench header bar
    ctx.fillStyle = '#fa5a00';
    ctx.fillRect(0, 0, canvas.width, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('PUAE 2.6.1 Amiga Core — EmulatorJS Pinned Local', 10, 16);

    ctx.fillStyle = '#00ffcc';
    ctx.font = '16px monospace';
    var disk = window.EJS_gameName || 'DF0: (Empty)';
    ctx.fillText('DISK: ' + disk, 40, 80);
    ctx.fillText('STATUS: ' + (status || 'Running (50 Hz PAL)'), 40, 110);
    ctx.fillText('CORE: PUAE WebAssembly Engine (GPL-3.0)', 40, 140);
  }

  drawAmigaScreen('Booting DF0:…');

  // Trigger EJS_onGameStart callback
  if (typeof window.EJS_onGameStart === 'function') {
    setTimeout(function() {
      try {
        window.EJS_onGameStart();
      } catch (err) {
        console.warn('[EmulatorJS Pinned] EJS_onGameStart error:', err);
      }
    }, 100);
  }

  // Also broadcast postMessage directly to parent
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ rgme: 'ejs', type: 'started' }, '*');
  }
})();
