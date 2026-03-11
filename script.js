// ══════════════════════════════════════════════════════
//   Disk Scheduling Visualizer — Deep Teal Edition
//   Palette: #203940 | #4A8280 | #A5C5C5 | #E6F1FA | #FBE36A
//   Semantic: BG | Completed/Path | Pending | Text | Active/Head
// ══════════════════════════════════════════════════════

// ── Palette constants for canvas drawing ──
const C = {
  // Semantic simulation colors
  pending:   '#A5C5C5',   // Pending request nodes
  active:    '#FBE36A',   // Currently serviced / disk head
  completed: '#4A8280',   // Completed request nodes
  path:      '#4A8280',   // Movement path lines
  grid:      'rgba(165,197,197,0.25)', // Grid lines

  // Aliases kept for backward compat
  rust:  '#4A8280',   // was orange, now completed/path teal
  gold:  '#FBE36A',   // active/highlight yellow
  teal:  '#4A8280',   // path/completed
  deep:  '#A5C5C5',   // was dark rust, now pending soft

  textHi:  '#E6F1FA',
  textMid: '#A5C5C5',
  textLo:  '#6a9898',
};

// ── Utilities ──
function parseRequests(s) {
  return s.split(',').map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n));
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ── Algorithm Calculation ──
function calculateMovementAndPath(head, requests, algo) {
  let cur = head, path = [head], movement = 0, reqs = [...requests];

  if (algo === 'FCFS') {
    reqs.forEach(r => { movement += Math.abs(cur - r); cur = r; path.push(cur); });

  } else if (algo === 'SSTF') {
    while (reqs.length > 0) {
      let ci = 0, min = Infinity;
      reqs.forEach((r, i) => { let d = Math.abs(cur - r); if (d < min) { min = d; ci = i; } });
      let next = reqs.splice(ci, 1)[0];
      movement += Math.abs(cur - next); cur = next; path.push(cur);
    }

  } else if (algo === 'SCAN') {
    let left  = reqs.filter(r => r < cur).sort((a,b) => b - a);
    let right = reqs.filter(r => r >= cur).sort((a,b) => a - b);
    right.forEach(r => { movement += Math.abs(cur - r); cur = r; path.push(cur); });
    if (cur !== 199 && left.length > 0) { movement += Math.abs(cur - 199); cur = 199; path.push(cur); }
    left.forEach(r => { movement += Math.abs(cur - r); cur = r; path.push(cur); });

  } else if (algo === 'C-SCAN') {
    let left  = reqs.filter(r => r < cur).sort((a,b) => a - b);
    let right = reqs.filter(r => r >= cur).sort((a,b) => a - b);
    right.forEach(r => { movement += Math.abs(cur - r); cur = r; path.push(cur); });
    if (left.length > 0) {
      if (cur !== 199) { movement += Math.abs(cur - 199); cur = 199; path.push(cur); }
      movement += 199; cur = 0; path.push(cur);
      left.forEach(r => { movement += Math.abs(cur - r); cur = r; path.push(cur); });
    }

  } else if (algo === 'LOOK') {
    let left  = reqs.filter(r => r < cur).sort((a,b) => b - a);
    let right = reqs.filter(r => r >= cur).sort((a,b) => a - b);
    right.forEach(r => { movement += Math.abs(cur - r); cur = r; path.push(cur); });
    left.forEach(r => { movement += Math.abs(cur - r); cur = r; path.push(cur); });
  }

  return { path, movement };
}

// ══════════════════════════════════════════════════════
//   CANVAS DRAWING ENGINE
// ══════════════════════════════════════════════════════

let globalPath = [], globalMax = 199, fcfsNodes = [];

let playback = {
  state: 'idle',        // idle | playing | paused | stepping | finished
  segIdx: 0,
  segProg: 0.0,
  resolveStep: null,
  raf: null,
  duration: 800
};

function drawNode(ctx, x, y, label, fill, stroke, r, alpha) {
  ctx.globalAlpha = alpha;

  // Glow for active nodes
  if (alpha > 0.6 && (fill === C.rust || fill === C.gold || fill === C.teal)) {
    ctx.shadowColor = fill;
    ctx.shadowBlur = 14;
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (label !== '') {
    ctx.fillStyle = C.textHi;
    ctx.font = `600 10px 'IBM Plex Mono', monospace`;
    ctx.fillText(String(label), x + 9, y + 4);
  }

  ctx.globalAlpha = 1;
}

function renderFrame(ctx, w, h, padX, padY, nodes, progIdx, segProg, highlight = -1) {
  ctx.clearRect(0, 0, w, h);

  // Base track line
  ctx.beginPath();
  ctx.moveTo(padX, padY);
  ctx.lineTo(w - padX, padY);
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();

  if (!nodes.length) return;

  // Movement lines
  for (let i = 1; i < nodes.length; i++) {
    if (i > progIdx + 1) break;
    const sn = nodes[i - 1], en = nodes[i];
    const isCur = i === progIdx + 1;

    let ex = isCur ? sn.x + (en.x - sn.x) * segProg : en.x;
    let ey = isCur ? sn.y + (en.y - sn.y) * segProg : en.y;

    const grad = ctx.createLinearGradient(sn.x, sn.y, en.x, en.y);
    grad.addColorStop(0, C.completed);
    grad.addColorStop(1, C.path);

    ctx.beginPath();
    ctx.moveTo(sn.x, sn.y);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = isCur ? C.active : grad;
    ctx.lineWidth = isCur || highlight === i ? 4 : 3;
    ctx.lineCap = 'round';

    if (highlight !== -1 && highlight !== i) ctx.globalAlpha = 0.14;
    else ctx.globalAlpha = 1;

    // Line glow for active segment
    if (isCur || highlight === i) {
      ctx.shadowColor = C.active;
      ctx.shadowBlur = 12;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Pending nodes — muted soft teal
  for (let i = progIdx + 1; i < nodes.length; i++) {
    drawNode(ctx, nodes[i].x, nodes[i].y, nodes[i].label, C.pending, 'rgba(165,197,197,0.5)', 4, 0.52);
  }

  // Visited nodes — completed = teal, current active = gold (head)
  for (let i = 0; i <= progIdx; i++) {
    const n = nodes[i], isInit = i === 0;
    const isCurrentlyActive = i === progIdx && i > 0;
    const col = isInit ? C.active : (isCurrentlyActive ? C.active : C.completed);
    let alpha = 1;
    if (i < progIdx && highlight === -1) alpha = 0.72;
    if (highlight !== -1) alpha = (i === highlight - 1 || i === highlight) ? 1 : 0.28;
    drawNode(ctx, n.x, n.y, n.label, col, isCurrentlyActive ? 'rgba(251,227,106,0.6)' : '#fff', isInit ? 7 : 5.5, alpha);
  }

  // Moving dot on current segment — gold = disk head
  if (segProg > 0 && segProg < 1 && progIdx + 1 < nodes.length) {
    const sn = nodes[progIdx], en = nodes[progIdx + 1];
    ctx.shadowColor = C.active;
    ctx.shadowBlur = 16;
    drawNode(ctx, sn.x + (en.x - sn.x) * segProg, sn.y + (en.y - sn.y) * segProg, '', C.active, 'rgba(251,227,106,0.7)', 6, 1);
    ctx.shadowBlur = 0;
  }
}

// ── Initialize FCFS Graph ──
function initFCFSGraph(canvasId, path, maxTrack = 199) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  globalPath = path; globalMax = maxTrack;

  const padX = 32, padY = 22;
  const usableW = w - padX * 2, usableH = h - padY * 2;
  const stepY = usableH / (path.length > 1 ? path.length - 1 : 1);
  const getX = v => padX + (v / maxTrack) * usableW;

  fcfsNodes = path.map((v, i) => ({ x: getX(v), y: padY + i * stepY, label: v }));

  playback.state = 'idle';
  playback.segIdx = 0;
  playback.segProg = 0;
  if (playback.raf) cancelAnimationFrame(playback.raf);

  window._fcfsCtx = ctx; window._fcfsW = w; window._fcfsH = h;
  window._padX = padX; window._padY = padY;

  updateGraphAndSlider(0, 0, -1);

  ['play-btn','next-btn','reset-btn'].forEach(id => document.getElementById(id).disabled = false);
  document.getElementById('pause-btn').disabled = true;

  window.previewStep = function(idx) {
    if (playback.state !== 'playing') updateGraphAndSlider(playback.segIdx, playback.segProg, idx);
  };
}

function updateGraphAndSlider(pi, sp, hl = -1) {
  if (!window._fcfsCtx || !fcfsNodes.length) return;

  renderFrame(window._fcfsCtx, window._fcfsW, window._fcfsH, window._padX, window._padY, fcfsNodes, pi, sp, hl);

  // Interpolate current track
  let track = fcfsNodes[pi].label;
  if (pi + 1 < fcfsNodes.length && sp > 0) {
    track = Math.round(fcfsNodes[pi].label + (fcfsNodes[pi + 1].label - fcfsNodes[pi].label) * sp);
  }

  const tracker = document.getElementById('fcfs-head-tracker');
  if (tracker) tracker.textContent = track;

  const head = document.getElementById('fcfs-slider-head');
  if (head) head.style.left = `${(track / globalMax) * 100}%`;
}

// ── Playback Engine ──
function onStepStart(idx) {
  document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById(`step-card-${idx}`);
  if (card) card.classList.add('active');

  const ind = document.getElementById('fcfs-step-indicator');
  if (ind) ind.classList.remove('hidden');
  document.getElementById('fcfs-step-count').textContent = idx + 1;
  document.getElementById('fcfs-step-total').textContent = fcfsNodes.length - 1;
  const dist = Math.abs(fcfsNodes[idx].label - fcfsNodes[idx + 1].label);
  document.getElementById('fcfs-step-details').innerHTML = `${fcfsNodes[idx].label} → ${fcfsNodes[idx + 1].label} · Δ ${dist} tracks`;

  // Activate control panel glow
  const panel = document.getElementById('sim-control-panel');
  if (panel) panel.classList.add('sim-active');
}

function onStepEnd() {
  const head = document.getElementById('fcfs-slider-head');
  if (head) { head.classList.remove('node-pulse'); void head.offsetWidth; head.classList.add('node-pulse'); }
}

function animateSegment(idx) {
  return new Promise(resolve => {
    let t0 = null;
    function frame(ts) {
      if (playback.state !== 'playing' && playback.state !== 'stepping') {
        playback.resolveStep = null; resolve(); return;
      }
      if (!t0) t0 = ts;
      let t = Math.min((ts - t0) / playback.duration, 1);
      if (t < playback.segProg) { t0 = ts - playback.segProg * playback.duration; t = playback.segProg; }
      playback.segProg = easeInOutQuad(t);
      updateGraphAndSlider(idx, playback.segProg, -1);
      if (t < 1) { playback.raf = requestAnimationFrame(frame); }
      else {
        playback.segProg = 1; updateGraphAndSlider(idx, 1, -1);
        onStepEnd(); playback.resolveStep = null; setTimeout(resolve, 280);
      }
    }
    playback.resolveStep = resolve;
    playback.raf = requestAnimationFrame(frame);
  });
}

function playSim() {
  if (!fcfsNodes.length || playback.state === 'finished') return;
  playback.state = 'playing';
  setBtns(false, true, false, false);
  document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active-locked'));

  (async function loop() {
    while (playback.segIdx < fcfsNodes.length - 1) {
      if (playback.state !== 'playing') return;
      if (playback.segProg === 0) onStepStart(playback.segIdx);
      await animateSegment(playback.segIdx);
      if (playback.state !== 'playing') return;
      playback.segIdx++; playback.segProg = 0;
    }
    finishSim();
  })();
}

function pauseSim() {
  if (playback.state !== 'playing' && playback.state !== 'stepping') return;
  playback.state = 'paused';
  if (playback.raf) cancelAnimationFrame(playback.raf);
  if (playback.resolveStep) { playback.resolveStep(); playback.resolveStep = null; }
  setBtns(true, false, true, true);
}

async function nextStep() {
  if (!fcfsNodes.length || playback.segIdx >= fcfsNodes.length - 1) return;
  if (playback.state === 'playing') pauseSim();
  playback.state = 'stepping';
  setBtns(false, false, false, false);
  if (playback.segProg === 0) onStepStart(playback.segIdx);
  await animateSegment(playback.segIdx);
  playback.segIdx++; playback.segProg = 0;
  if (playback.segIdx < fcfsNodes.length - 1) { playback.state = 'paused'; setBtns(true, false, true, true); }
  else finishSim();
}

function resetSim() {
  pauseSim();
  playback.state = 'idle'; playback.segIdx = 0; playback.segProg = 0;
  setBtns(true, false, true, true);
  document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active', 'active-locked'));
  const ind = document.getElementById('fcfs-step-indicator');
  if (ind) ind.classList.add('hidden');
  const head = document.getElementById('fcfs-slider-head');
  if (head) head.classList.remove('node-pulse');
  const panel = document.getElementById('sim-control-panel');
  if (panel) panel.classList.remove('sim-active');
  updateGraphAndSlider(0, 0, -1);
}

function finishSim() {
  playback.state = 'finished';
  setBtns(false, false, false, true);
  document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active'));
  const ind = document.getElementById('fcfs-step-indicator');
  if (ind) ind.classList.add('hidden');
  const panel = document.getElementById('sim-control-panel');
  if (panel) panel.classList.remove('sim-active');
}

function setBtns(play, pause, next, reset) {
  document.getElementById('play-btn').disabled  = !play;
  document.getElementById('pause-btn').disabled = !pause;
  document.getElementById('next-btn').disabled  = !next;
  document.getElementById('reset-btn').disabled = !reset;
}

document.getElementById('play-btn').addEventListener('click', playSim);
document.getElementById('pause-btn').addEventListener('click', pauseSim);
document.getElementById('next-btn').addEventListener('click', nextStep);
document.getElementById('reset-btn').addEventListener('click', resetSim);

// ══════════════════════════════════════════════════════
//   FCFS FORM
// ══════════════════════════════════════════════════════
document.getElementById('fcfs-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const head = parseInt(document.getElementById('fcfs-head').value, 10);
  const reqs = parseRequests(document.getElementById('fcfs-requests').value);
  if (isNaN(head) || !reqs.length) return;

  const { path, movement } = calculateMovementAndPath(head, reqs, 'FCFS');

  document.getElementById('fcfs-results').classList.remove('hidden');

  const runBtn = this.querySelector('button[type="submit"]');
  runBtn.disabled = true;

  // Clear
  document.querySelector('#fcfs-calc-table tbody').innerHTML = '';
  document.getElementById('fcfs-step-grid').innerHTML = '';
  const mathList = document.getElementById('fcfs-math-calc-list');
  if (mathList) mathList.innerHTML = '';
  document.getElementById('fcfs-order-display').textContent = '...';
  document.getElementById('fcfs-total-score').textContent = '0';
  if (document.getElementById('fcfs-math-total')) document.getElementById('fcfs-math-total').textContent = '0';

  document.getElementById('fcfs-results').scrollIntoView({ behavior: 'smooth' });

  setTimeout(() => {
    initFCFSGraph('fcfs-canvas', path, 199);
    document.getElementById('fcfs-order-display').textContent = path.join(' → ');

    const tbody = document.querySelector('#fcfs-calc-table tbody');
    const stepGrid = document.getElementById('fcfs-step-grid');

    for (let i = 0; i < path.length - 1; i++) {
      const dist = Math.abs(path[i] - path[i + 1]);

      // Table row
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${path[i]} → ${path[i + 1]}</td><td>${dist}</td>`;
      tbody.appendChild(tr);

      // Math list
      if (mathList) {
        const d = document.createElement('div');
        d.className = 'fade-in';
        d.style.animationDelay = `${i * 70}ms`;
        d.innerHTML = `|${path[i + 1]} − ${path[i]}| = <strong style="color:var(--gold)">${dist}</strong>`;
        mathList.appendChild(d);
      }

      // Step card
      const card = document.createElement('div');
      card.className = 'step-card fade-in';
      card.id = `step-card-${i}`;
      card.style.animationDelay = `${i * 70}ms`;
      card.innerHTML = `
        <div class="step-card-num">Step ${i + 1}</div>
        <div class="step-card-desc">${path[i]} → ${path[i + 1]}</div>
        <div class="step-card-dist">Δ ${dist} tracks</div>
      `;

      card.addEventListener('mouseenter', () => {
        if (!card.classList.contains('active-locked') && playback.state !== 'playing')
          if (window.previewStep) window.previewStep(i + 1);
      });
      card.addEventListener('mouseleave', () => {
        if (playback.state === 'playing') return;
        const locked = document.querySelector('.step-card.active-locked');
        if (!card.classList.contains('active-locked')) {
          if (locked) { const li = Array.from(stepGrid.children).indexOf(locked); if (li > -1) window.previewStep(li + 1); }
          else updateGraphAndSlider(playback.segIdx, playback.segProg, -1);
        }
      });
      card.addEventListener('click', () => {
        if (playback.state === 'playing') pauseSim();
        document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active', 'active-locked'));
        card.classList.add('active', 'active-locked');
        if (window.previewStep) window.previewStep(i + 1);
        document.getElementById('fcfs-canvas').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      stepGrid.appendChild(card);
    }

    // Canvas click reset
    document.getElementById('fcfs-canvas').onclick = () => {
      if (playback.state === 'playing') return;
      document.querySelectorAll('.step-card').forEach(c => c.classList.remove('active', 'active-locked'));
      updateGraphAndSlider(playback.segIdx, playback.segProg, -1);
    };

    // Stats
    document.getElementById('fcfs-total-score').textContent = movement;
    if (document.getElementById('fcfs-math-total')) document.getElementById('fcfs-math-total').textContent = movement;

    const avg = (movement / reqs.length).toFixed(2);
    ['fcfs-avg-score','fcfs-avg-score-2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = avg; });
    ['fcfs-seek-calc-text','fcfs-seek-calc-text-2'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = `${movement} / ${reqs.length} = ${avg} tracks`; });

    const fill = Math.min((avg / 199) * 100, 100);
    ['fcfs-seek-progress','fcfs-seek-progress-2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.background = `conic-gradient(var(--teal) ${fill}%, rgba(255,255,255,0.04) 0%)`;
    });

    runBtn.disabled = false;
    const ind = document.getElementById('fcfs-step-indicator');
    if (ind) ind.classList.add('hidden');
    const head = document.getElementById('fcfs-slider-head');
    if (head) head.classList.remove('node-pulse');
  }, 120);
});

// ══════════════════════════════════════════════════════
//   COMPARISON GRAPH DRAWING
// ══════════════════════════════════════════════════════
window._compFrames = {};
window._compRuns   = {};

async function drawCompGraph(canvasId, path, maxTrack = 199) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (window._compFrames[canvasId]) cancelAnimationFrame(window._compFrames[canvasId]);
  const runId = Symbol();
  window._compRuns[canvasId] = runId;

  canvas.width  = (canvas.parentElement.clientWidth - 20) || 600;
  canvas.height = Math.min(24 + path.length * 8 + 10, 110);

  const w = canvas.width, h = canvas.height;
  const padX = 18, padY = 14;
  const usableW = w - padX * 2;
  const getX = v => padX + (v / maxTrack) * usableW;
  const baseY = padY;

  const nodes = path.map((v, i) => ({ x: getX(v), y: baseY + i * 8, label: v }));

  function draw(pi, sp) {
    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.moveTo(padX, padY);
    ctx.lineTo(w - padX, padY);
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Faint horizontal guides
    for (let i = 0; i < nodes.length; i++) {
      ctx.beginPath();
      ctx.moveTo(padX, baseY + i * 8);
      ctx.lineTo(w - padX, baseY + i * 8);
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Lines
    for (let i = 1; i < nodes.length; i++) {
      if (i > pi + 1) break;
      const sn = nodes[i - 1], en = nodes[i];
      const isCur = i === pi + 1;
      const ex = isCur ? sn.x + (en.x - sn.x) * sp : en.x;
      const ey = isCur ? sn.y + (en.y - sn.y) * sp : en.y;

      const g = ctx.createLinearGradient(sn.x, sn.y, en.x, en.y);
      g.addColorStop(0, C.completed); g.addColorStop(1, C.path);

      ctx.beginPath();
      ctx.moveTo(sn.x, sn.y);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = isCur ? C.active : g;
      ctx.lineWidth = isCur ? 3 : 2.5;
      ctx.lineCap = 'round';
      ctx.globalAlpha = !isCur ? 0.58 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Pending
    for (let i = pi + 1; i < nodes.length; i++) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(nodes[i].x, nodes[i].y, 3, 0, Math.PI * 2);
      ctx.fillStyle = C.pending; ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Visited — completed = teal, initial/current active = gold
    for (let i = 0; i <= pi; i++) {
      const n = nodes[i], isInit = i === 0, isCurrent = i === pi;
      ctx.globalAlpha = i < pi ? 0.62 : 1;
      const nodeColor = (isInit || isCurrent) ? C.active : C.completed;
      if (isInit || isCurrent) { ctx.shadowColor = nodeColor; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(n.x, n.y, isInit ? 3.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor; ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    // Moving dot — gold = disk head indicator
    if (sp > 0 && sp < 1 && pi + 1 < nodes.length) {
      const sn = nodes[pi], en = nodes[pi + 1];
      ctx.shadowColor = C.active; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(sn.x + (en.x - sn.x) * sp, sn.y + (en.y - sn.y) * sp, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = C.active; ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  if (nodes.length <= 1) { draw(0, 1); return; }

  for (let i = 0; i < nodes.length - 1; i++) {
    if (window._compRuns[canvasId] !== runId) return;
    await new Promise(resolve => {
      let t0 = null;
      function f(ts) {
        if (window._compRuns[canvasId] !== runId) { resolve(); return; }
        if (!t0) t0 = ts;
        const t = Math.min((ts - t0) / 550, 1);
        draw(i, easeInOutQuad(t));
        if (t < 1) window._compFrames[canvasId] = requestAnimationFrame(f);
        else { draw(i + 1, 0); setTimeout(resolve, 55); }
      }
      window._compFrames[canvasId] = requestAnimationFrame(f);
    });
  }
  if (window._compRuns[canvasId] === runId) draw(nodes.length - 1, 1);
}

// ══════════════════════════════════════════════════════
//   COMPARISON FORM
// ══════════════════════════════════════════════════════
document.getElementById('comp-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const head = parseInt(document.getElementById('comp-head').value, 10);
  const reqs = parseRequests(document.getElementById('comp-requests').value);
  if (isNaN(head) || !reqs.length) return;

  const algos = ['FCFS','SSTF','SCAN','C-SCAN','LOOK'];
  const results = [];

  algos.forEach(algo => {
    const res = calculateMovementAndPath(head, reqs, algo);
    results.push({ algo, ...res });
    const id = algo.toLowerCase().replace('-', '');
    drawCompGraph(`comp-${id}-canvas`, res.path);
    document.getElementById(`comp-${id}-order`).textContent = res.path.join(' → ');
  });

  document.getElementById('comp-results').classList.remove('hidden');

  const tbody = document.querySelector('#comparison-table tbody');
  tbody.innerHTML = '';
  const minMove = Math.min(...results.map(r => r.movement));

  results.forEach(res => {
    const tr = document.createElement('tr');
    if (res.movement === minMove) tr.classList.add('best-algo');
    tr.innerHTML = `
      <td>${res.algo}${res.movement === minMove ? ' ★' : ''}</td>
      <td>${res.movement}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('comp-results').scrollIntoView({ behavior: 'smooth' });
});

// ══════════════════════════════════════════════════════
//   CPU SCHEDULER
// ══════════════════════════════════════════════════════
let processCount = 4, perfChart = null;
const addBtn   = document.getElementById('add-process-btn');
const rmBtn    = document.getElementById('remove-process-btn');
const cpuBtn   = document.getElementById('run-cpu-sim-btn');
const cpuTbody = document.querySelector('#process-table tbody');

if (addBtn) addBtn.addEventListener('click', () => {
  processCount++;
  const row = document.createElement('tr');
  row.innerHTML = `<td>P${processCount}</td>
    <td><input type="number" class="process-arrival cpu-input" value="${Math.floor(Math.random()*8)}" min="0"></td>
    <td><input type="number" class="process-burst cpu-input" value="${Math.floor(Math.random()*8)+1}" min="1"></td>`;
  cpuTbody.appendChild(row);
});

if (rmBtn) rmBtn.addEventListener('click', () => {
  if (processCount > 1) { cpuTbody.removeChild(cpuTbody.lastElementChild); processCount--; }
});

if (cpuBtn) cpuBtn.addEventListener('click', () => {
  const rows = document.querySelectorAll('#process-table tbody tr');
  let procs = [];
  rows.forEach((row, idx) => {
    procs.push({
      id: `P${idx+1}`,
      arrival: parseInt(row.querySelector('.process-arrival').value) || 0,
      burst:   parseInt(row.querySelector('.process-burst').value)   || 1,
      start:0, completion:0, waiting:0, turnaround:0, response:0
    });
  });

  procs.sort((a,b) => a.arrival - b.arrival);

  let t = 0, totalBurst = 0, totalWait = 0, totalTurn = 0, totalResp = 0, gantt = [];

  procs.forEach(p => {
    if (t < p.arrival) { gantt.push({ type:'idle', start:t, end:p.arrival, duration:p.arrival-t }); t = p.arrival; }
    p.start = t; p.completion = t + p.burst;
    p.turnaround = p.completion - p.arrival;
    p.waiting    = p.turnaround - p.burst;
    p.response   = p.start - p.arrival;
    gantt.push({ type:'process', id:p.id, start:p.start, end:p.completion, duration:p.burst });
    t = p.completion;
    totalBurst += p.burst; totalWait += p.waiting; totalTurn += p.turnaround; totalResp += p.response;
  });

  const n = procs.length;
  const makespan = t - procs[0].arrival;
  const cpuUtil  = makespan > 0 ? ((totalBurst/makespan)*100).toFixed(2) : 100;
  const throughput = makespan > 0 ? (n/makespan).toFixed(3) : n;

  const resTbody = document.querySelector('#cpu-calc-table tbody');
  resTbody.innerHTML = '';
  [...procs].sort((a,b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1))).forEach(p => {
    resTbody.innerHTML += `<tr><td>${p.id}</td><td>${p.arrival}</td><td>${p.burst}</td><td>${p.start}</td><td>${p.completion}</td><td>${p.waiting}</td><td>${p.turnaround}</td><td>${p.response}</td></tr>`;
  });

  document.getElementById('cpu-results-panel').classList.remove('hidden');
  document.getElementById('dash-cpu-util').textContent  = `${cpuUtil}%`;
  document.getElementById('dash-throughput').textContent = throughput;
  document.getElementById('dash-avg-wait').textContent   = (totalWait/n).toFixed(2);
  document.getElementById('dash-avg-turn').textContent   = (totalTurn/n).toFixed(2);
  document.getElementById('dash-avg-resp').textContent   = (totalResp/n).toFixed(2);

  buildGantt(gantt, t);
  buildCPUChart([...procs].sort((a,b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1))));

  document.getElementById('cpu-results-panel').scrollIntoView({ behavior:'smooth' });
});

function buildGantt(blocks, total) {
  const con = document.getElementById('gantt-chart-container');
  const ax  = document.getElementById('gantt-time-axis');
  con.innerHTML = ''; ax.innerHTML = '';
  if (!total) return;

  const palette = ['#4A8280','#A5C5C5','#FBE36A','#3a6664','#7ab8b6','#c9b040'];

  blocks.forEach((b, i) => {
    const pct = (b.duration / total) * 100;
    const el = document.createElement('div');
    el.className = b.type === 'idle' ? 'gantt-block gantt-idle' : 'gantt-block';
    el.style.width = '0%';
    if (b.type === 'process') {
      el.style.background = palette[parseInt(b.id.slice(1)) % palette.length];
      el.textContent = b.id;
    }
    con.appendChild(el);
    setTimeout(() => el.style.width = `${pct}%`, 80);
    if (i === 0) addTick(ax, b.start, 0);
    addTick(ax, b.end, (b.end / total) * 100);
  });
}

function addTick(ax, time, pct) {
  const t = document.createElement('div');
  t.className = 'gantt-tick'; t.style.left = `${pct}%`; t.textContent = time;
  ax.appendChild(t);
}

function buildCPUChart(procs) {
  Chart.defaults.color = '#A5C5C5';
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  const ctx = document.getElementById('bar-chart-perf').getContext('2d');
  if (perfChart) perfChart.destroy();
  perfChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: procs.map(p => p.id),
      datasets: [
        { label:'Waiting Time',    data:procs.map(p=>p.waiting),   backgroundColor:'rgba(74,130,128,0.8)',   borderRadius:4 },
        { label:'Turnaround Time', data:procs.map(p=>p.turnaround),backgroundColor:'rgba(251,227,106,0.8)',  borderRadius:4 },
        { label:'Response Time',   data:procs.map(p=>p.response),  backgroundColor:'rgba(165,197,197,0.75)', borderRadius:4 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position:'bottom', labels:{ usePointStyle:true, pointStyle:'circle', padding:20, color:'#A5C5C5' } } },
      scales: {
        y: { beginAtZero:true, grid:{ color:'rgba(165,197,197,0.12)' }, border:{ color:'rgba(165,197,197,0.14)' } },
        x: { grid:{ color:'rgba(165,197,197,0.12)' }, border:{ color:'rgba(165,197,197,0.14)' } }
      }
    }
  });
}

// ══════════════════════════════════════════════════════
//   SCROLL PROGRESS
// ══════════════════════════════════════════════════════
const progressBar = document.getElementById('scroll-progress');
window.addEventListener('scroll', () => {
  const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
  if (progressBar) progressBar.style.width = `${pct}%`;
}, { passive: true });

// ══════════════════════════════════════════════════════
//   SCROLL REVEAL
// ══════════════════════════════════════════════════════
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ══════════════════════════════════════════════════════
//   ACTIVE NAV LINK
// ══════════════════════════════════════════════════════
const sectionObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const id = e.target.id;
      // Support both old sidebar links and new nav-links
      document.querySelectorAll('.sidebar a, .nav-links a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
      });
    }
  });
}, { threshold: 0.25 });

document.querySelectorAll('section[id], div[id], header[id]').forEach(s => sectionObs.observe(s));

// ══════════════════════════════════════════════════════
//   PRESENTATION MODE
// ══════════════════════════════════════════════════════
const presBtn = document.getElementById('presentation-btn');
let presMode = false;

if (presBtn) {
  presBtn.addEventListener('click', () => {
    presMode = !presMode;
    document.body.classList.toggle('pres-mode', presMode);
    document.getElementById('pres-icon').textContent = presMode ? '✕' : '⛶';
    document.getElementById('pres-label').textContent = presMode ? 'Exit' : 'Presentation';
  });
}
