// platform-ctrl.js � All 6 phases controller
// Depends on: ds-classes.js, renderer.js, platform.js

document.addEventListener('DOMContentLoaded', () => {

// -----------------------------------------------------------------
// SHARED UTILITIES
// -----------------------------------------------------------------

const DS_LABELS = { avl:'AVL Tree', rbt:'Red-Black Tree', bheap:'Binary Heap', binom:'Binomial Heap', btree:'B+ Tree (T=3)',
  tbt:'Threaded BST', trie:'Trie', skip:'Skip List', suffix:'Suffix Tree', rtree:'R-Tree' };
const DS_COLORS = { avl:'#10b981', rbt:'#ef4444', bheap:'#f59e0b', binom:'#38bdf8', btree:'#a78bfa',
  tbt:'#0891b2', trie:'#8b5cf6', skip:'#f97316', suffix:'#ec4899', rtree:'#14b8a6' };
const DS_OPS = {
  avl:    ['Insert','Delete','Search','Find Min','Find Max','Inorder','Extract Min'],
  rbt:    ['Insert','Delete','Search','Find Min','Find Max','Inorder','Extract Min'],
  bheap:  ['Insert','Extract Min','Find Min','Find Max','Delete','Search'],
  binom:  ['Insert','Extract Min','Find Min','Delete','Search'],
  btree:  ['Insert','Delete','Search','Find Min','Find Max','Inorder','Extract Min'],
  tbt:    ['Insert','Delete','Search','Find Min','Find Max','Inorder'],
  trie:   ['Insert','Delete','Search'],
  skip:   ['Insert','Delete','Search','Find Min','Find Max','Inorder'],
  suffix: ['Insert','Search'],
  rtree:  ['Insert','Search'],
};

// Ops that require a numeric value input
const OPS_NEED_VALUE = new Set(['Insert','Delete','Search']);

// All ops in a canonical display order
const ALL_OPS_ORDERED = ['Insert','Delete','Search','Find Min','Find Max','Extract Min','Inorder'];

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// Create a fresh DS instance by key
function makeDSInstance(key) {
  switch(key) {
    case 'avl':    return new AVLTree();
    case 'rbt':    return new RBTree();
    case 'bheap':  return new BinaryHeap();
    case 'binom':  return new BinomHeap();
    case 'btree':  return new BTree();
    case 'tbt':    return new ThreadedBST();
    case 'trie':   return new Trie();
    case 'skip':   return new SkipList();
    case 'suffix': return new SuffixTree();
    case 'rtree':  return new RTree();
  }
}

// Execute one op on a DS instance, return steps[]
function execOp(dsInst, dsKey, opType, value) {
  // Trie, Suffix, RTree accept string values
  const strDS = new Set(['trie','suffix','rtree']);
  const v = strDS.has(dsKey) ? (value !== undefined ? String(value) : '') : value;

  switch(opType) {
    case 'Insert':
    case 'INSERT':      return dsInst.insertSteps?.(v) ?? [];
    case 'Search':
    case 'SEARCH':      return dsInst.searchSteps?.(v) ?? [];
    case 'Delete':
    case 'DELETE':
      if (dsKey === 'bheap' || dsKey === 'binom') return dsInst.extractMinSteps?.() ?? [];
      return dsInst.deleteSteps?.(v) ?? [];
    case 'Find Min': {
      const m = dsInst.findMin?.();
      return m != null ? [makeCurrentSnap(dsInst, dsKey, `Min = ${m}`, m, 'found')] : [];
    }
    case 'Find Max': {
      const m = dsInst.findMax?.();
      return m != null ? [makeCurrentSnap(dsInst, dsKey, `Max = ${m}`, m, 'found')] : [];
    }
    case 'Extract Min': return dsInst.extractMinSteps?.() ?? [];
    case 'Inorder': {
      const arr = dsInst.inorder?.() ?? [];
      return arr.length ? [makeCurrentSnap(dsInst, dsKey, `Inorder: [${arr.join(', ')}]`, null, 'visit')] : [];
    }
  }
  return [];
}

function makeCurrentSnap(dsInst, dsKey, msg, hl, hlType) {
  switch(dsKey) {
    case 'avl':    return { msg, tree: cloneBST(dsInst.root), hl, hlType: hlType||'visit' };
    case 'rbt':    return { msg, tree: cloneRBT(dsInst.root, dsInst.NIL), hl, hlType: hlType||'visit' };
    case 'bheap':  return { msg, heap: dsInst.data.slice(0, dsInst.size), hl, hlType: hlType||'visit' };
    case 'binom':  return { msg, heap: dsInst.roots.map(r => cloneBH(r)), hl, hlType: hlType||'visit' };
    case 'btree':  return { msg, tree: dsInst._clone(dsInst.root), hl, hlType: hlType||'visit' };
    case 'tbt':    return { msg, tree: dsInst._cloneTBT(dsInst.root), hl, hlType: hlType||'visit' };
    case 'trie':   return { msg, tree: dsInst._cloneTrie(dsInst.root), hl, hlType: hlType||'visit' };
    case 'skip':   return { msg, structure: dsInst._cloneSkip(), hl, hlType: hlType||'visit' };
    case 'suffix': return { msg, tree: dsInst._cloneSuffix(dsInst.root), hl, hlType: hlType||'visit' };
    case 'rtree':  return { msg, structure: dsInst._cloneNode(dsInst.root), hl, hlType: hlType||'visit' };
  }
}

// Parse dataset.txt text — robust: handles INSERT/SEARCH/DELETE + bare numbers
function parseDataset(text) {
  const ops = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    // Match: INSERT/SEARCH/DELETE followed by number (case-insensitive)
    const m = line.match(/^(INSERT|SEARCH|DELETE)\s+(-?\d+)/i);
    if (m) { ops.push({ type: m[1].toUpperCase(), value: parseInt(m[2]) }); continue; }
    // Fallback: bare number → treat as INSERT
    const n = line.match(/^-?\d+$/);
    if (n) ops.push({ type: 'INSERT', value: parseInt(n[0]) });
  }
  return ops;
}

// Build replay session from ops array
function buildSession(ops, dsInst, dsKey) {
  const steps = [], boundaries = [];
  for (const op of ops) {
    const s = execOp(dsInst, dsKey, op.type, op.value);
    if (!s.length) continue;
    const startIdx = steps.length;
    const endIdx   = steps.length + s.length - 1;
    // Grab metrics from the last step of this operation (set by ds-classes.js patch)
    const lastStep = s[s.length - 1];
    const metrics  = (lastStep && lastStep.metrics) ? { ...lastStep.metrics } : { comparisons:0, rotations:0, swaps:0, splits:0 };
    boundaries.push({ label: `${op.type} ${op.value}`, type: op.type, value: op.value, startIdx, endIdx, metrics });
    steps.push(...s);
  }
  return { steps, boundaries };
}

// Count metrics from the last step's metrics snapshot (set by ds-classes.js instrumentation)
// Falls back to zero if no metrics snapshot exists on the step.
function countMetrics(steps, dsKey) {
  if (!steps || !steps.length) return { comparisons:0, rotations:0, swaps:0, splits:0 };
  // Use the metrics snapshot attached to the last step by the DS class patch
  const last = steps[steps.length - 1];
  if (last && last.metrics) return last.metrics;
  // Fallback: accumulate from all steps that have metrics
  const acc = { comparisons:0, rotations:0, swaps:0, splits:0 };
  for (const s of steps) {
    if (s.metrics) {
      acc.comparisons = Math.max(acc.comparisons, s.metrics.comparisons || 0);
      acc.rotations   = Math.max(acc.rotations,   s.metrics.rotations   || 0);
      acc.swaps       = Math.max(acc.swaps,        s.metrics.swaps       || 0);
      acc.splits      = Math.max(acc.splits,       s.metrics.splits      || 0);
    }
  }
  return acc;
}

// Render metrics into a container element
function renderMetrics(containerEl, steps, dsKey, color) {
  const m = countMetrics(steps, dsKey);
  const fields = [];
  if (m.comparisons) fields.push({ label: 'Comparisons', val: m.comparisons });
  if (m.rotations)   fields.push({ label: 'Rotations',   val: m.rotations });
  if (m.swaps)       fields.push({ label: 'Swaps',       val: m.swaps });
  if (m.splits)      fields.push({ label: 'Splits',      val: m.splits });
  fields.push({ label: 'Total Steps', val: steps.length });

  const maxVal = Math.max(...fields.map(f => f.val), 1);
  containerEl.innerHTML = fields.map(f => `
    <div class="metric-bar-row" style="margin:6px 10px">
      <div class="metric-bar-label">
        <span>${f.label}</span><span style="color:${color||'var(--cur)'};font-weight:700">${f.val}</span>
      </div>
      <div class="metric-bar-track">
        <div class="metric-bar-fill" style="width:${(f.val/maxVal*100).toFixed(1)}%;background:${color||'var(--cur)'}"></div>
      </div>
    </div>`).join('');
}

// Zoom+pan for any svg-wrap + svg pair
function initZoomPan(wrapEl, svgEl) {
  let scale = 1, px = 0, py = 0, panning = false, sx = 0, sy = 0, ox = 0, oy = 0;
  const apply = () => { svgEl.style.transform = `translate(${px}px,${py}px) scale(${scale})`; };
  wrapEl.addEventListener('wheel', e => {
    e.preventDefault();
    const r = wrapEl.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    const ns = Math.min(5, Math.max(0.2, scale + delta));
    const ratio = ns / scale;
    px = cx - ratio * (cx - px); py = cy - ratio * (cy - py);
    scale = ns; apply();
  }, { passive: false });
  wrapEl.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    panning = true; sx = e.clientX; sy = e.clientY; ox = px; oy = py;
    wrapEl.classList.add('panning');
  });
  window.addEventListener('mousemove', e => {
    if (!panning) return;
    px = ox + (e.clientX - sx); py = oy + (e.clientY - sy); apply();
  });
  window.addEventListener('mouseup', () => { panning = false; wrapEl.classList.remove('panning'); });
  return {
    reset() { scale=1; px=0; py=0; apply(); },
    _zoomBy(delta) {
      const r = wrapEl.getBoundingClientRect();
      const cx = r.width/2, cy = r.height/2;
      const ns = Math.min(5, Math.max(0.2, scale + delta));
      const ratio = ns/scale;
      px = cx - ratio*(cx-px); py = cy - ratio*(cy-py);
      scale = ns; apply();
    }
  };
}

// Build a step log in a list element, with operation boundary separators
function buildLog(listEl, steps, currentIdx, onClickStep, boundaries) {
  listEl.innerHTML = '';
  let bIdx = 0;
  const bounds = boundaries || [];
  steps.forEach((s, i) => {
    // Insert separator at each operation boundary
    while (bIdx < bounds.length && bounds[bIdx].startIdx === i) {
      const sep = document.createElement('div');
      sep.className = 'log-entry op-sep';
      sep.textContent = '-- ' + bounds[bIdx].label + ' --';
      sep.onclick = () => onClickStep(i);
      listEl.appendChild(sep);
      bIdx++;
    }
    const d = document.createElement('div');
    d.className = 'log-entry' + (i === currentIdx ? ' active-step' : '');
    d.textContent = `${i+1}. ${s.msg}`;
    d.onclick = () => onClickStep(i);
    listEl.appendChild(d);
  });
  const active = listEl.querySelector('.active-step');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

// Build timeline markers for operation boundaries
function buildTimelineMarkers(trackEl, boundaries, totalSteps, onClickBoundary) {
  trackEl.querySelectorAll('.tl-marker').forEach(m => m.remove());
  boundaries.forEach((b, i) => {
    const pct = totalSteps > 1 ? (b.startIdx / (totalSteps - 1)) * 100 : 0;
    const marker = document.createElement('div');
    marker.className = 'tl-marker';
    marker.style.left = pct + '%';
    marker.setAttribute('data-label', b.label);
    marker.title = b.label;
    marker.onclick = () => onClickBoundary(i);
    trackEl.appendChild(marker);
  });
}

// -----------------------------------------------------------------
// TOP NAV � panel switching
// -----------------------------------------------------------------
document.querySelectorAll('.nav-tab[data-panel]').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
    if (tab.dataset.panel === 'compare') { requestAnimationFrame(function(){ if (window.rebuildCanvas) window.rebuildCanvas(); }); }
  };
});

// -----------------------------------------------------------------
// PANEL RESIZE � single global drag state, no duplicate listeners
// -----------------------------------------------------------------
let _rz = null;

window.addEventListener('mousemove', e => {
  if (!_rz) return;
  const dx = e.clientX - _rz.startX;
  const newW = _rz.side === 'left' ? _rz.startW + dx : _rz.startW - dx;
  _rz.panel.style.width = Math.max(140, Math.min(520, newW)) + 'px';
});

window.addEventListener('mouseup', () => {
  if (!_rz) return;
  _rz.handle.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  _rz = null;
});

function attachResizer(handleId, panelId, side) {
  const handle = document.getElementById(handleId);
  const panel  = document.getElementById(panelId);
  if (!handle || !panel) return;
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    _rz = { startX: e.clientX, startW: panel.offsetWidth, panel, side, handle };
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
}

// Visualizer Lab resize handles
attachResizer('vl-resize-left',  'vl-sidebar',    'left');
attachResizer('vl-resize-right', 'vl-log-panel',  'right');


// -----------------------------------------------------------------
// PHASE 1+2+4+5 � VISUALIZER LAB
// -----------------------------------------------------------------
(function() {
  let curDS = 'avl', curOp = 'Insert';
  let dsInst = makeDSInstance('avl');
  let steps = [], vlBoundaries = [], stepIdx = 0, playing = false, playTimer = null;

  const svgEl   = document.getElementById('vl-svg');
  const svgWrap = document.getElementById('vl-svg-wrap');
  const logList = document.getElementById('vl-log-list');
  const stepLbl = document.getElementById('step-label');
  const slider  = document.getElementById('vl-slider');
  const tlOp    = document.getElementById('vl-tl-op');
  const tlPos   = document.getElementById('vl-tl-pos');
  const speedIn = document.getElementById('vl-speed');
  const speedLbl= document.getElementById('vl-speed-val');
  const infoBox = document.getElementById('vl-info');
  const metricsCont = document.getElementById('vl-metrics-content');

  const zoom = initZoomPan(svgWrap, svgEl);

  // DS chip selection
  document.querySelectorAll('#vl-ds-chips .ds-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('#vl-ds-chips .ds-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      switchDS(chip.dataset.ds);
    };
  });

  function switchDS(key) {
    curDS = key; curOp = 'Insert';
    dsInst = makeDSInstance(key);
    steps = []; stepIdx = 0;
    resetRenderer();
    clearLog();
    buildOpGrid();
    updateInfoBar();
    zoom.reset();
    document.documentElement.style.setProperty('--cur', DS_COLORS[key] || '#6366f1');
    // BUG 1 FIX: update placeholder for string-based DS
    const valEl = document.getElementById('vl-val');
    if (key === 'trie' || key === 'suffix') {
      valEl.placeholder = 'Word... (Enter)';
      valEl.type = 'text';
    } else if (key === 'rtree') {
      valEl.placeholder = 'x,y,w,h (Enter)';
      valEl.type = 'text';
    } else {
      valEl.placeholder = 'Value (Enter)';
      valEl.type = 'text';
    }
  }

  function buildOpGrid() {
    const grid = document.getElementById('vl-op-grid');
    grid.innerHTML = '';
    (DS_OPS[curDS] || []).forEach(op => {
      const b = document.createElement('button');
      b.className = 'scenario-btn' + (op === curOp ? ' active' : '');
      b.style.fontSize = '10px'; b.style.padding = '5px 4px';
      b.textContent = op;
      b.onclick = () => { curOp = op; buildOpGrid(); if (!['Insert','Delete','Search'].includes(op)) runOp(); };
      grid.appendChild(b);
    });
  }

  function clearLog() { logList.innerHTML = ''; }

  function applyStep(i) {
    if (!steps.length) return;
    stepIdx = Math.max(0, Math.min(i, steps.length - 1));
    renderStep(svgEl, curDS, steps[stepIdx]);
    stepLbl.textContent = `Step ${stepIdx+1}/${steps.length}: ${steps[stepIdx].msg}`;
    slider.value = stepIdx;
    tlPos.textContent = `${stepIdx+1} / ${steps.length}`;
    // Find current boundary
    const boundaries = vlBoundaries;
    let curB = null;
    for (const b of boundaries) { if (b.startIdx <= stepIdx) curB = b; else break; }
    tlOp.textContent = curB ? curB.label : '�';
    buildLog(logList, steps, stepIdx, applyStep, vlBoundaries);
    renderMetrics(metricsCont, steps, curDS, DS_COLORS[curDS]);
  }

  function runOp() {
    const valEl = document.getElementById('vl-val');
    // BUG 1 FIX: Trie/Suffix/RTree need string values, not parseInt
    const strDS = new Set(['trie','suffix','rtree']);
    const rawVal = valEl.value.trim();
    const val = strDS.has(curDS) ? rawVal : parseInt(rawVal);
    let newSteps = [];
    if (['Insert','Delete','Search'].includes(curOp)) {
      if (strDS.has(curDS) && !rawVal) { showToast('Enter a value'); return; }
      if (!strDS.has(curDS) && isNaN(val)) { showToast('Enter a value'); return; }
    }
    // Map display op name → execOp key
    const opMap = { 'Insert':'INSERT', 'Delete':'DELETE', 'Search':'SEARCH',
                    'Find Min':'Find Min', 'Find Max':'Find Max', 'Extract Min':'Extract Min' };
    newSteps = execOp(dsInst, curDS, opMap[curOp] || curOp.toUpperCase(), val);
    if (!newSteps.length) newSteps = execOp(dsInst, curDS, curOp, val);
    if (!newSteps.length) { showToast('No steps generated'); return; }
    if (['Insert','Delete','Search'].includes(curOp)) valEl.value = '';

    // Tag with boundary info
    const prevLen = steps.length;
    steps = steps.concat(newSteps);
    const valLabel = strDS.has(curDS) ? rawVal : (isNaN(val) ? '' : val);
    vlBoundaries.push({ label: `${curOp} ${valLabel}`, startIdx: prevLen, endIdx: steps.length-1 });

    slider.max = steps.length - 1;
    buildTimelineMarkers(document.getElementById('vl-tl-track'), vlBoundaries, steps.length, i => applyStep(vlBoundaries[i].startIdx));
    applyStep(steps.length - 1);
    updateInfoBar();
    // Auto-focus input for next entry
    if (['Insert','Delete','Search'].includes(curOp)) {
      setTimeout(() => document.getElementById('vl-val').focus(), 0);
    }
  }

  function updateInfoBar() {
    // BUG 1 FIX: Trie/Suffix/RTree don't have meaningful min/max
    const strDS = new Set(['trie','suffix','rtree']);
    const mn = strDS.has(curDS) ? null : dsInst.findMin?.();
    const mx = strDS.has(curDS) ? null : dsInst.findMax?.();
    infoBox.innerHTML = `<b>${DS_LABELS[curDS]}</b><br>Size: <span>${dsInst.size ?? '?'}</span>` +
      (mn != null ? `<br>Min: <span>${mn}</span>` : '') +
      (mx != null ? `<br>Max: <span>${mx}</span>` : '');
  }

  // Controls
  document.getElementById('vl-go').onclick = runOp;
  document.getElementById('vl-val').addEventListener('keydown', e => { if (e.key === 'Enter') runOp(); });

  document.getElementById('vl-random').onclick = () => {
    steps = []; vlBoundaries = [];
    for (let i = 0; i < 8; i++) {
      const v = Math.floor(Math.random() * 150) + 1;
      const s = dsInst.insertSteps(v);
      const prevLen = steps.length;
      steps = steps.concat(s);
      vlBoundaries.push({ label: `INSERT ${v}`, startIdx: prevLen, endIdx: steps.length-1 });
    }
    slider.max = steps.length - 1;
    buildTimelineMarkers(document.getElementById('vl-tl-track'), vlBoundaries, steps.length, i => applyStep(vlBoundaries[i].startIdx));
    applyStep(steps.length - 1);
    updateInfoBar();
  };

  document.getElementById('vl-clear').onclick = () => {
    dsInst.clear(); steps = []; vlBoundaries = []; stepIdx = 0;
    resetRenderer(); stepLbl.textContent = '�'; clearLog();
    slider.value = 0; slider.max = 0; tlOp.textContent = '�'; tlPos.textContent = '0 / 0';
    document.getElementById('vl-tl-track').querySelectorAll('.tl-marker').forEach(m => m.remove());
    metricsCont.innerHTML = '';
    updateInfoBar();
    zoom.reset();
  };

  document.getElementById('vl-prev').onclick = () => { stopPlay(); applyStep(stepIdx - 1); };
  document.getElementById('vl-next').onclick = () => { stopPlay(); applyStep(stepIdx + 1); };
  document.getElementById('vl-play').onclick = togglePlay;

  function togglePlay() {
    playing = !playing;
    document.getElementById('vl-play').textContent = playing ? '?' : '?';
    if (playing) playLoop(); else clearTimeout(playTimer);
  }
  function stopPlay() { playing = false; clearTimeout(playTimer); document.getElementById('vl-play').textContent = '?'; }
  function playLoop() {
    if (!playing) return;
    if (stepIdx >= steps.length - 1) { stopPlay(); return; }
    applyStep(stepIdx + 1);
    playTimer = setTimeout(playLoop, +speedIn.value);
  }

  slider.addEventListener('input', () => { stopPlay(); applyStep(+slider.value); });
  speedIn.addEventListener('input', () => { speedLbl.textContent = speedIn.value + 'ms'; if(window.setAnimSpeed) setAnimSpeed(+speedIn.value); });

  // Zoom buttons � zoom is handled by initZoomPan wheel/drag; buttons just reset
  document.getElementById('vl-zin').onclick    = () => { zoom._zoomBy(+0.15); };
  document.getElementById('vl-zout').onclick   = () => { zoom._zoomBy(-0.15); };
  document.getElementById('vl-zreset').onclick = () => zoom.reset();

  // Init
  switchDS('avl');
  buildOpGrid();
})();


// -----------------------------------------------------------------
// TASK 4 � REPLAY SUMMARY
// Builds a per-operation table from session.boundaries (which carry
// metrics snapshots set by the DS class instrumentation).
// -----------------------------------------------------------------
function showReplaySummary(session) {
  const summaryEl = document.getElementById('rp-summary');
  const bodyEl    = document.getElementById('rp-summary-body');
  if (!summaryEl || !bodyEl) return;

  bodyEl.innerHTML = '';

  session.boundaries.forEach(b => {
    const m = b.metrics || {};
    const steps = b.endIdx - b.startIdx + 1;

    const row = document.createElement('div');
    row.className = 'rp-summary-row';

    // Operation label line
    const opLine = document.createElement('div');
    opLine.className = `rp-summary-op ${b.type}`;
    opLine.textContent = `${b.type} ${b.value}`;
    row.appendChild(opLine);

    // Stats line
    const statsLine = document.createElement('div');
    statsLine.className = 'rp-summary-stats';

    const statItems = [
      { label: 'steps', val: steps },
    ];
    if (m.comparisons) statItems.push({ label: 'cmp',  val: m.comparisons });
    if (m.rotations)   statItems.push({ label: 'rot',  val: m.rotations });
    if (m.swaps)       statItems.push({ label: 'swap', val: m.swaps });
    if (m.splits)      statItems.push({ label: 'spl',  val: m.splits });

    statsLine.innerHTML = statItems
      .map(s => `<span>${s.label}: <b>${s.val}</b></span>`)
      .join('');
    row.appendChild(statsLine);
    bodyEl.appendChild(row);
  });

  summaryEl.style.display = 'flex';
  showToast(`Replay complete � ${session.boundaries.length} ops summarized`);
}

// -----------------------------------------------------------------
// PHASE 1+2 � DATASET REPLAY PANEL
// -----------------------------------------------------------------
(function() {
  let curDS = 'avl', dsInst = makeDSInstance('avl');
  let session = null, stepIdx = 0, playing = false, playTimer = null;

  const svgEl   = document.getElementById('rp-svg');
  const svgWrap = document.getElementById('rp-svg-wrap');
  const logList = document.getElementById('rp-log-list');
  const slider  = document.getElementById('rp-slider');
  const tlOp    = document.getElementById('rp-tl-op');
  const tlPos   = document.getElementById('rp-tl-pos');
  const stepLbl = document.getElementById('rp-step-label');
  const speedIn = document.getElementById('rp-speed');
  const speedLbl= document.getElementById('rp-speed-val');
  const metricsCont = document.getElementById('rp-metrics-content');

  initZoomPan(svgWrap, svgEl);

  // DS chip selection
  document.querySelectorAll('#rp-ds-chips .ds-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('#rp-ds-chips .ds-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      curDS = chip.dataset.ds;
      dsInst = makeDSInstance(curDS);
      session = null; stepIdx = 0;
      resetSVG(svgEl);
      logList.innerHTML = '';
      metricsCont.innerHTML = '';
      stepLbl.textContent = '�';
      tlOp.textContent = 'Load a dataset to begin';
      tlPos.textContent = '0 / 0';
    };
  });

  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const ops = parseDataset(e.target.result);
      if (!ops.length) {
        showToast('No valid operations found — expected INSERT/SEARCH/DELETE N or bare numbers');
        return;
      }
      dsInst = makeDSInstance(curDS);
      session = buildSession(ops, dsInst, curDS);
      if (!session.steps.length) { showToast('No steps generated — check DS type'); return; }

      // Update drop zone to show loaded state
      const dropZone = document.getElementById('rp-drop-zone');
      dropZone.querySelector('.drop-label').textContent = '✓ ' + file.name;
      dropZone.querySelector('.drop-sub').textContent = `${ops.length} operations loaded`;
      dropZone.style.borderColor = 'var(--avl)';
      dropZone.style.background = 'rgba(16,185,129,0.06)';

      // Update UI
      slider.max = session.steps.length - 1;
      slider.value = 0;
      document.getElementById('rp-meta').style.display = 'flex';
      document.getElementById('rp-meta-ops').textContent = ops.length;
      document.getElementById('rp-meta-steps').textContent = session.steps.length;
      document.getElementById('rp-meta-ds').textContent = DS_LABELS[curDS];
      document.getElementById('rp-jump-section').style.display = 'flex';

      // Build jump list
      const jumpList = document.getElementById('rp-jump-list');
      jumpList.innerHTML = '';
      session.boundaries.forEach((b, i) => {
        const btn = document.createElement('button');
        btn.className = 'op-jump-btn';
        btn.textContent = `${i+1}. ${b.label}`;
        btn.title = `${b.endIdx - b.startIdx + 1} steps`;
        btn.onclick = () => seek(b.startIdx);
        jumpList.appendChild(btn);
      });

      // Build timeline markers
      buildTimelineMarkers(
        document.getElementById('rp-tl-track'),
        session.boundaries,
        session.steps.length,
        i => seek(session.boundaries[i].startIdx)
      );

      seek(0);
      showToast(`Loaded "${file.name}": ${ops.length} ops → ${session.steps.length} steps`);
      // Hide previous summary
      const sumEl = document.getElementById('rp-summary');
      if (sumEl) sumEl.style.display = 'none';
    };
    reader.readAsText(file);
  }

  function seek(i) {
    if (!session) return;
    stepIdx = Math.max(0, Math.min(i, session.steps.length - 1));
    renderStep(svgEl, curDS, session.steps[stepIdx]);
    slider.value = stepIdx;
    tlPos.textContent = `${stepIdx+1} / ${session.steps.length}`;
    stepLbl.textContent = `Step ${stepIdx+1}/${session.steps.length}: ${session.steps[stepIdx].msg}`;

    // Find current boundary
    let curB = null;
    for (const b of session.boundaries) { if (b.startIdx <= stepIdx) curB = b; else break; }
    tlOp.textContent = curB ? curB.label : '�';

    // Highlight active jump button
    document.querySelectorAll('#rp-jump-list .op-jump-btn').forEach((btn, i) => {
      btn.classList.toggle('active', curB && session.boundaries[i] === curB);
    });

    buildLog(logList, session.steps, stepIdx, seek, session.boundaries);
    renderMetrics(metricsCont, session.steps.slice(0, stepIdx+1), curDS, DS_COLORS[curDS]);
  }

  function stopPlay() { playing = false; clearTimeout(playTimer); document.getElementById('rp-play').textContent = '?'; }
  function playLoop() {
    if (!playing || !session) return;
    if (stepIdx >= session.steps.length - 1) { stopPlay(); showReplaySummary(session); return; }
    seek(stepIdx + 1);
    playTimer = setTimeout(playLoop, +speedIn.value);
  }

  // File drop zone
  const dropZone = document.getElementById('rp-drop-zone');
  const fileInput = document.getElementById('rp-file-input');
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); fileInput.value = ''; });

  // Transport controls
  document.getElementById('rp-first').onclick = () => { stopPlay(); seek(0); };
  document.getElementById('rp-prev').onclick  = () => { stopPlay(); seek(stepIdx - 1); };
  document.getElementById('rp-play').onclick  = () => {
    if (!session) { showToast('Load a dataset first'); return; }
    playing = !playing;
    document.getElementById('rp-play').textContent = playing ? '?' : '?';
    if (playing) playLoop(); else clearTimeout(playTimer);
  };
  document.getElementById('rp-next').onclick  = () => { stopPlay(); seek(stepIdx + 1); };
  document.getElementById('rp-last').onclick  = () => { stopPlay(); if (session) seek(session.steps.length - 1); };

  slider.addEventListener('input', () => { stopPlay(); seek(+slider.value); });
  speedIn.addEventListener('input', () => { speedLbl.textContent = speedIn.value + 'ms'; if(window.setAnimSpeed) setAnimSpeed(+speedIn.value); });
})();


// -----------------------------------------------------------------
// PHASE 3 � COMPARE PANEL (any 2�4 structures, user-selectable)
// -----------------------------------------------------------------
(function() {
  // slots[i] = { dsKey, dsInst, steps, svgEl, zoomObj }
  let slots = [];
  let globalIdx = 0, totalSteps = 0;
  let playing = false, playTimer = null;
  const speedIn   = document.getElementById('cmp-speed');
  const canvasEl  = document.getElementById('cmp-canvases');
  const selectorsEl = document.getElementById('cmp-slot-selectors');

  const ALL_DS = [
    { key:'avl',    label:'AVL Tree' },
    { key:'rbt',    label:'Red-Black Tree' },
    { key:'bheap',  label:'Binary Heap' },
    { key:'binom',  label:'Binomial Heap' },
    { key:'btree',  label:'B+ Tree (T=3)' },
    { key:'tbt',    label:'Threaded BST' },
    { key:'trie',   label:'Trie' },
    { key:'skip',   label:'Skip List' },
    { key:'suffix', label:'Suffix Tree' },
    { key:'rtree',  label:'R-Tree' },
  ];

  // -- Rebuild op dropdown based on intersection of active slot ops --
  function rebuildOpSelect() {
    const sel = document.getElementById('cmp-op-select');
    const curVal = sel.value;

    // Find ops supported by ALL active slots
    const supported = ALL_OPS_ORDERED.filter(op =>
      slots.every(s => (DS_OPS[s.dsKey] || []).includes(op))
    );

    sel.innerHTML = '';
    supported.forEach(op => {
      const opt = document.createElement('option');
      opt.value = op; opt.textContent = op;
      if (op === curVal) opt.selected = true;
      sel.appendChild(opt);
    });

    // If previous selection no longer valid, pick first
    if (!supported.includes(sel.value) && supported.length)
      sel.value = supported[0];

    updateValueVisibility();
  }

  function updateValueVisibility() {
    const op = document.getElementById('cmp-op-select').value;
    const valEl = document.getElementById('cmp-val');
    valEl.style.display = OPS_NEED_VALUE.has(op) ? 'block' : 'none';
  }

  document.getElementById('cmp-op-select').addEventListener('change', updateValueVisibility);

  // -- Build the slot selector row ------------------------------
  function buildSelectors() {
    selectorsEl.innerHTML = '';

    slots.forEach((slot, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'cmp-slot-selector';
      wrap.style.borderColor = DS_COLORS[slot.dsKey] || 'var(--border)';

      const lbl = document.createElement('label');
      lbl.textContent = `Slot ${i+1}:`;
      lbl.style.color = DS_COLORS[slot.dsKey] || 'var(--muted)';

      const sel = document.createElement('select');
      ALL_DS.forEach(ds => {
        const opt = document.createElement('option');
        opt.value = ds.key;
        opt.textContent = ds.label;
        if (ds.key === slot.dsKey) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        slots[i].dsKey  = sel.value;
        slots[i].dsInst = makeDSInstance(sel.value);
        slots[i].steps  = [];
        lbl.style.color = DS_COLORS[sel.value] || 'var(--muted)';
        wrap.style.borderColor = DS_COLORS[sel.value] || 'var(--border)';
        rebuildCanvas();
        rebuildOpSelect();
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'cmp-remove-slot';
      removeBtn.textContent = '?';
      removeBtn.title = 'Remove slot';
      removeBtn.onclick = () => {
        if (slots.length <= 2) { showToast('Minimum 2 slots'); return; }
        slots.splice(i, 1);
        buildSelectors();
        rebuildCanvas();
        rebuildOpSelect();
      };

      wrap.appendChild(lbl);
      wrap.appendChild(sel);
      if (slots.length > 2) wrap.appendChild(removeBtn);
      selectorsEl.appendChild(wrap);
    });

    // Add slot button (max 4)
    if (slots.length < 4) {
      const addBtn = document.createElement('button');
      addBtn.className = 'cmp-add-slot';
      addBtn.textContent = '+ Add';
      addBtn.onclick = () => {
        const used = slots.map(s => s.dsKey);
        const next = ALL_DS.find(d => !used.includes(d.key)) || ALL_DS[0];
        slots.push({ dsKey: next.key, dsInst: makeDSInstance(next.key), steps: [], svgEl: null, zoomObj: null });
        buildSelectors();
        rebuildCanvas();
        rebuildOpSelect();
      };
      selectorsEl.appendChild(addBtn);
    }
  }

  // -- Build the canvas grid ------------------------------------
  function rebuildCanvas() {
    canvasEl.innerHTML = '';
    const cols = slots.length <= 2 ? 2 : slots.length === 3 ? 3 : 2;
    canvasEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    slots.forEach((slot, i) => {
      const color = DS_COLORS[slot.dsKey] || '#6366f1';
      const label = ALL_DS.find(d => d.key === slot.dsKey)?.label || slot.dsKey;

      const card = document.createElement('div');
      card.className = 'cmp-slot';
      card.style.borderTop = `3px solid ${color}`;
      card.innerHTML = `
        <div class="cmp-slot-header">
          <span class="cmp-slot-title" style="color:${color}">${label}</span>
          <span id="cmp-steps-${i}" style="font-size:10px;color:var(--muted)">Steps: 0</span>
        </div>
        <div class="cmp-slot-svg-wrap" id="cmp-wrap-${i}">
          <svg id="cmp-svg-${i}" xmlns="http://www.w3.org/2000/svg" width="600" height="400"></svg>
        </div>
        <div style="padding:6px 10px;background:var(--surface);border-top:1px solid var(--border);
                    display:flex;gap:10px;font-size:10px;color:var(--muted);flex-wrap:wrap">
          <span>Comparisons: <b id="cmp-cmp-${i}" style="color:${color}">0</b></span>
          <span>Rotations: <b id="cmp-rot-${i}" style="color:${color}">0</b></span>
          <span>Swaps: <b id="cmp-swp-${i}" style="color:${color}">0</b></span>
        </div>`;
      canvasEl.appendChild(card);

      slot.svgEl  = document.getElementById(`cmp-svg-${i}`);
      slot.zoomObj = initZoomPan(document.getElementById(`cmp-wrap-${i}`), slot.svgEl);
    });
  }

  // -- Run operation on all slots -------------------------------
  function runAll() {
    const opType = document.getElementById('cmp-op-select').value;
    const needsVal = OPS_NEED_VALUE.has(opType);
    const val = parseInt(document.getElementById('cmp-val').value);
    if (needsVal && isNaN(val)) { showToast('Enter a value'); return; }

    slots.forEach((slot, i) => {
      slot.dsInst.clear();
      slot.steps = execOp(slot.dsInst, slot.dsKey, opType, needsVal ? val : undefined);
      document.getElementById(`cmp-steps-${i}`).textContent = `Steps: ${slot.steps.length}`;
      const m = countMetrics(slot.steps, slot.dsKey);
      document.getElementById(`cmp-cmp-${i}`).textContent = m.comparisons;
      document.getElementById(`cmp-rot-${i}`).textContent = m.rotations;
      document.getElementById(`cmp-swp-${i}`).textContent = m.swaps;
    });

    totalSteps = Math.max(...slots.map(s => s.steps.length), 1);
    globalIdx  = 0;
    seek(0);
  }

  // -- Seek to global step --------------------------------------
  function seek(i) {
    globalIdx = Math.max(0, Math.min(i, totalSteps - 1));
    slots.forEach(slot => {
      const localIdx = Math.min(globalIdx, slot.steps.length - 1);
      if (slot.svgEl && slot.steps[localIdx])
        renderStep(slot.svgEl, slot.dsKey, slot.steps[localIdx]);
    });
    const parts = slots.map((s, i) => `${ALL_DS.find(d=>d.key===s.dsKey)?.label.split(' ')[0]}: ${Math.min(globalIdx,s.steps.length-1)+1}/${s.steps.length}`);
    document.getElementById('cmp-step-label').textContent =
      `Step ${globalIdx+1}/${totalSteps}  |  ${parts.join('  ')}`;
  }

  function stopPlay() {
    playing = false; clearTimeout(playTimer);
    document.getElementById('cmp-play').textContent = '?';
  }
  function playLoop() {
    if (!playing) return;
    if (globalIdx >= totalSteps - 1) { stopPlay(); return; }
    seek(globalIdx + 1);
    playTimer = setTimeout(playLoop, +speedIn.value);
  }

  // -- Wire controls --------------------------------------------
  document.getElementById('cmp-run').onclick = runAll;
  document.getElementById('cmp-val').addEventListener('keydown', e => { if (e.key === 'Enter') runAll(); });

  document.getElementById('cmp-clear').onclick = () => {
    stopPlay();
    slots.forEach((slot, i) => {
      slot.dsInst.clear(); slot.steps = [];
      if (slot.svgEl) resetSVG(slot.svgEl);
      const stepsEl = document.getElementById(`cmp-steps-${i}`);
      if (stepsEl) stepsEl.textContent = 'Steps: 0';
      ['cmp-cmp-','cmp-rot-','cmp-swp-'].forEach(p => {
        const el = document.getElementById(p + i);
        if (el) el.textContent = '0';
      });
    });
    globalIdx = 0; totalSteps = 0;
    document.getElementById('cmp-step-label').textContent = '�';
  };

  document.getElementById('cmp-prev').onclick = () => { stopPlay(); seek(globalIdx - 1); };
  document.getElementById('cmp-play').onclick = () => {
    if (!slots.some(s => s.steps.length)) { showToast('Run an operation first'); return; }
    playing = !playing;
    document.getElementById('cmp-play').textContent = playing ? '?' : '?';
    if (playing) playLoop(); else clearTimeout(playTimer);
  };
  document.getElementById('cmp-next').onclick = () => { stopPlay(); seek(globalIdx + 1); };

  // -- Init with AVL + RBT as defaults -------------------------
  slots = [
    { dsKey:'avl',   dsInst: makeDSInstance('avl'),   steps:[], svgEl:null, zoomObj:null },
    { dsKey:'rbt',   dsInst: makeDSInstance('rbt'),   steps:[], svgEl:null, zoomObj:null },
  ];
  buildSelectors();
  rebuildCanvas();
  rebuildOpSelect();
  window.rebuildCanvas = rebuildCanvas;

  // -- Compare All DS feature -----------------------------------

  // ── Theoretical complexity + metadata ──────────────────────
  const COMPLEXITY = {
    avl:   { insert:'O(log n)', search:'O(log n)', delete:'O(log n)', space:'O(n)', notes:'Strict balance, ≤2 rotations/insert', dtype:'numeric' },
    rbt:   { insert:'O(log n)', search:'O(log n)', delete:'O(log n)', space:'O(n)', notes:'Relaxed balance, ≤3 rotations/delete', dtype:'numeric' },
    bheap: { insert:'O(log n)', search:'O(n)',     delete:'O(log n)', space:'O(n)', notes:'O(1) find-min, array-based', dtype:'numeric' },
    binom: { insert:'O(log n)', search:'O(n)',     delete:'O(log n)', space:'O(n)', notes:'O(log n) merge, forest of Bk trees', dtype:'numeric' },
    btree: { insert:'O(log n)', search:'O(log n)', delete:'O(log n)', space:'O(n)', notes:'High fan-out, range queries O(log n+k)', dtype:'numeric' },
    tbt:   { insert:'O(log n)', search:'O(log n)', delete:'O(log n)', space:'O(n)', notes:'In-order traversal without stack', dtype:'numeric' },
    skip:  { insert:'O(log n)', search:'O(log n)', delete:'O(log n)', space:'O(n log n)', notes:'Probabilistic, simple implementation', dtype:'numeric' },
    trie:  { insert:'O(L)',     search:'O(L)',     delete:'O(L)',     space:'O(ALPHABET×N×L)', notes:'L = key length, prefix queries O(L)', dtype:'string' },
    suffix:{ insert:'O(m²)',    search:'O(m)',     delete:'O(m²)',    space:'O(m²)', notes:'m = string length, substring search', dtype:'string' },
    rtree: { insert:'O(log n)', search:'O(log n)', delete:'O(log n)', space:'O(n)', notes:'Spatial indexing, MBR-based', dtype:'spatial' },
  };

  const USE_CASES = {
    avl:   { icon:'🌳', cases:['Database indexing','Balanced search systems','In-memory sorted maps','Compiler symbol tables'] },
    rbt:   { icon:'🔴', cases:['std::map / TreeMap (Java)','Linux kernel scheduler','Balanced BST with fewer rotations','General-purpose ordered sets'] },
    bheap: { icon:'⛰️', cases:['Priority queues','Heapsort','Dijkstra (simple)','OS task scheduling'] },
    binom: { icon:'🔗', cases:["Dijkstra's algorithm","Prim's MST",'Mergeable priority queues','Network routing'] },
    btree: { icon:'📚', cases:['Database storage engines (MySQL, PostgreSQL)','File system indexing','Range queries','Disk-based data'] },
    tbt:   { icon:'🧵', cases:['In-order traversal without recursion','Memory-constrained systems','Embedded systems BST','Compiler parse trees'] },
    skip:  { icon:'⏭️', cases:['Redis sorted sets','Concurrent data structures','Probabilistic indexing','In-memory databases'] },
    trie:  { icon:'🔤', cases:['Autocomplete / typeahead','Spell checking','IP routing tables','Dictionary lookups'] },
    suffix:{ icon:'🧬', cases:['DNA sequence matching','Text search engines','Bioinformatics','Longest common substring'] },
    rtree: { icon:'🗺️', cases:['Google Maps / GIS systems','Spatial databases (PostGIS)','Collision detection','Nearest-neighbor search'] },
  };

  // ── Dataset generators ──────────────────────────────────────
  function genNumeric(n) {
    const vals = new Set();
    while (vals.size < n) vals.add(Math.floor(Math.random()*n*5)+1);
    return [...vals];
  }
  function genStrings(n) {
    const base = ['cat','car','card','care','bat','bar','bare','cap','cup','cut',
      'dog','dot','doe','fog','fig','fit','hat','has','had','hip','hop','hot',
      'jam','jar','jaw','jet','joy','key','kid','kit','lab','lag','lap','law',
      'map','mat','max','may','mob','mod','mop','nap','net','new','nod','nor',
      'oak','oar','odd','oil','old','one','opt','orb','ore','our','out','own'];
    return Array.from({length:n}, (_,i) => base[i % base.length] + (i >= base.length ? Math.floor(i/base.length) : ''));
  }
  function genSpatial(n) {
    return Array.from({length:n}, () => {
      const x=Math.floor(Math.random()*80)+1, y=Math.floor(Math.random()*80)+1;
      const w=Math.floor(Math.random()*15)+3, h=Math.floor(Math.random()*15)+3;
      return x+','+y+','+w+','+h;
    });
  }

  // ── Space estimator ─────────────────────────────────────────
  function estimateSpace(key, size) {
    const NODE_BYTES = { avl:48, rbt:56, bheap:8, binom:48, btree:64, tbt:56, skip:40, trie:80, suffix:64, rtree:72 };
    const bytes = (NODE_BYTES[key]||48) * size;
    return bytes < 1024 ? bytes+'B' : bytes < 1048576 ? (bytes/1024).toFixed(1)+'KB' : (bytes/1048576).toFixed(2)+'MB';
  }

  // ── Mode state ──────────────────────────────────────────────
  let cmpAllMode = 'numeric';
  let cmpAllCharts = {};
  let lastResults = [];

  // Mode buttons
  document.querySelectorAll('.cmp-mode-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cmp-mode-btn').forEach(b => {
        b.style.background = 'transparent'; b.style.color = 'var(--muted)';
      });
      btn.style.background = 'rgba(99,102,241,.2)'; btn.style.color = '#fff';
      cmpAllMode = btn.dataset.mode;
      // Delete only valid for numeric
      const delLbl = document.getElementById('op-delete-lbl');
      if (delLbl) delLbl.style.opacity = cmpAllMode === 'numeric' ? '1' : '0.3';
    };
  });

  // Tab switching
  document.querySelectorAll('.cmp-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cmp-tab-btn').forEach(b => {
        b.style.color = 'var(--muted)'; b.style.borderBottomColor = 'transparent';
      });
      btn.style.color = '#fff'; btn.style.borderBottomColor = 'var(--cur)';
      document.querySelectorAll('.cmp-tab-content').forEach(t => t.style.display = 'none');
      const tab = document.getElementById('cmp-tab-' + btn.dataset.tab);
      if (tab) tab.style.display = 'block';
    };
  });

  // ── Execution engine ────────────────────────────────────────
  function runBenchmark() {
    const n = Math.min(300, Math.max(5, parseInt(document.getElementById('cmp-all-n').value)||30));
    const doInsert = document.getElementById('op-insert').checked;
    const doSearch = document.getElementById('op-search').checked;
    const doDelete = document.getElementById('op-delete').checked && cmpAllMode === 'numeric';
    const statusEl = document.getElementById('cmp-all-status');
    statusEl.textContent = 'Running...';

    const numVals = genNumeric(n);
    const strVals = genStrings(n);
    const sptVals = genSpatial(n);

    const ALL_DS = [
      {key:'avl',dtype:'numeric'},{key:'rbt',dtype:'numeric'},{key:'bheap',dtype:'numeric'},
      {key:'binom',dtype:'numeric'},{key:'btree',dtype:'numeric'},{key:'tbt',dtype:'numeric'},
      {key:'skip',dtype:'numeric'},{key:'trie',dtype:'string'},{key:'suffix',dtype:'string'},
      {key:'rtree',dtype:'spatial'},
    ];

    const results = [];
    for (const def of ALL_DS) {
      const compatible = def.dtype === cmpAllMode;
      if (!compatible) {
        results.push({key:def.key,label:DS_LABELS[def.key],dtype:def.dtype,skipped:true,
          insTime:null,srchTime:null,delTime:null,comparisons:0,rotations:0,steps:0,size:0});
        continue;
      }
      const vals = def.dtype==='string' ? strVals : def.dtype==='spatial' ? sptVals : numVals;
      const inst = makeDSInstance(def.key);
      let totalCmp=0, totalRot=0, totalSteps=0;
      let insTime=0, srchTime=0, delTime=0;

      // INSERT
      if (doInsert) {
        const t0 = performance.now();
        for (const v of vals) {
          const stps = execOp(inst, def.key, 'Insert', v);
          totalSteps += stps.length;
          const last = stps[stps.length-1];
          if (last && last.metrics) { totalCmp += last.metrics.comparisons||0; totalRot += last.metrics.rotations||0; }
        }
        insTime = +(performance.now()-t0).toFixed(3);
      } else {
        // Still need to populate for search/delete
        for (const v of vals) execOp(inst, def.key, 'Insert', v);
      }

      // SEARCH (sample 30% of inserted values)
      if (doSearch) {
        const searchVals = vals.slice(0, Math.max(1, Math.floor(vals.length*0.3)));
        const t0 = performance.now();
        for (const v of searchVals) {
          const stps = execOp(inst, def.key, 'Search', v);
          totalSteps += stps.length;
          const last = stps[stps.length-1];
          if (last && last.metrics) totalCmp += last.metrics.comparisons||0;
        }
        srchTime = +(performance.now()-t0).toFixed(3);
      }

      // DELETE (20% of inserted, numeric only)
      if (doDelete && def.dtype === 'numeric') {
        const delVals = vals.slice(0, Math.max(1, Math.floor(vals.length*0.2)));
        const t0 = performance.now();
        for (const v of delVals) {
          const stps = execOp(inst, def.key, 'Delete', v);
          totalSteps += stps.length;
          const last = stps[stps.length-1];
          if (last && last.metrics) totalCmp += last.metrics.comparisons||0;
        }
        delTime = +(performance.now()-t0).toFixed(3);
      }

      results.push({key:def.key, label:DS_LABELS[def.key], dtype:def.dtype, skipped:false,
        insTime, srchTime, delTime, comparisons:totalCmp, rotations:totalRot,
        steps:totalSteps, size:inst.size||0});
    }

    lastResults = results;
    renderResults(results, n);
    renderComplexityTab();
    renderUseCasesTab();
    renderInsightsTab(results);
    statusEl.textContent = 'Done \u2014 ' + results.filter(r=>!r.skipped).length + ' DS on ' + n + ' values';
  }

  // ── Chart helper ────────────────────────────────────────────
  function mkChart(id, labels, data, colors, unitLabel) {
    if (cmpAllCharts[id]) { try{cmpAllCharts[id].destroy();}catch(e){} delete cmpAllCharts[id]; }
    const el = document.getElementById(id);
    if (!el || !window.Chart) return;
    cmpAllCharts[id] = new Chart(el, {
      type:'bar',
      data:{ labels, datasets:[{ data, backgroundColor:colors.map(c=>c+'bb'),
        borderColor:colors, borderWidth:1.5, borderRadius:4, hoverBackgroundColor:colors }] },
      options:{
        responsive:true, maintainAspectRatio:false,
        animation:{duration:500, easing:'easeOutQuart'},
        plugins:{
          legend:{display:false},
          tooltip:{
            backgroundColor:'#1e293b', borderColor:'#334155', borderWidth:1,
            titleColor:'#e2e8f0', bodyColor:'#94a3b8',
            callbacks:{ label: ctx => ' '+ctx.parsed.y.toLocaleString()+' '+unitLabel }
          }
        },
        scales:{
          x:{ticks:{color:'#94a3b8',font:{size:8}},grid:{color:'#1e2d45'}},
          y:{ticks:{color:'#94a3b8',font:{size:8}},grid:{color:'#1e2d45'},beginAtZero:true}
        }
      }
    });
  }

  // ── Render results tab ──────────────────────────────────────
  function renderResults(results, n) {
    const active = results.filter(r=>!r.skipped);
    const colors = active.map(r=>DS_COLORS[r.key]||'#6366f1');
    const labels = active.map(r=>r.label.replace(' Tree','').replace(' Heap','').replace(' List','').replace('B+ (T=3)','B+'));

    mkChart('cmp-all-ins-time',  labels, active.map(r=>r.insTime||0),  colors, 'ms');
    mkChart('cmp-all-srch-time', labels, active.map(r=>r.srchTime||0), colors, 'ms');
    mkChart('cmp-all-cmp',       labels, active.map(r=>r.comparisons),  colors, 'cmp');
    mkChart('cmp-all-steps',     labels, active.map(r=>r.steps),        colors, 'steps');

    // Best values
    const bestIns  = Math.min(...active.map(r=>r.insTime||Infinity));
    const bestSrch = Math.min(...active.map(r=>r.srchTime||Infinity));
    const bestCmp  = Math.min(...active.map(r=>r.comparisons));

    const tbody = document.getElementById('cmp-all-tbody');
    tbody.innerHTML = results.map(r => {
      const col = DS_COLORS[r.key]||'#6366f1';
      if (r.skipped) return '<tr style="border-bottom:1px solid var(--border);opacity:0.35"><td style="padding:6px 10px;font-weight:600;color:'+col+'"><span style="width:7px;height:7px;border-radius:50%;background:'+col+';display:inline-block;margin-right:5px"></span>'+r.label+'</td><td colspan="9" style="padding:6px 10px;color:var(--muted);font-size:10px;text-align:center">N/A \u2014 requires '+r.dtype+' dataset</td></tr>';
      const star = v => v ? ' \u2605' : '';
      const hi = (v, best) => v===best ? 'color:#10b981;font-weight:700' : 'color:var(--text)';
      return '<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:6px 10px;font-weight:600;color:'+col+'"><span style="width:7px;height:7px;border-radius:50%;background:'+col+';display:inline-block;margin-right:5px"></span>'+r.label+'</td>'
        +'<td style="padding:6px 10px;text-align:right;font-family:monospace;'+hi(r.insTime,bestIns)+'">'+(r.insTime!=null?r.insTime.toFixed(3)+star(r.insTime===bestIns):'—')+'</td>'
        +'<td style="padding:6px 10px;text-align:right;font-family:monospace;'+hi(r.srchTime,bestSrch)+'">'+(r.srchTime!=null?r.srchTime.toFixed(3)+star(r.srchTime===bestSrch):'—')+'</td>'
        +'<td style="padding:6px 10px;text-align:right;font-family:monospace;color:var(--muted)">'+(r.delTime!=null?r.delTime.toFixed(3):'—')+'</td>'
        +'<td style="padding:6px 10px;text-align:right;font-family:monospace;'+hi(r.comparisons,bestCmp)+'">'+r.comparisons.toLocaleString()+star(r.comparisons===bestCmp)+'</td>'
        +'<td style="padding:6px 10px;text-align:right;font-family:monospace;color:var(--muted)">'+r.rotations.toLocaleString()+'</td>'
        +'<td style="padding:6px 10px;text-align:right;font-family:monospace;color:var(--muted)">'+r.steps.toLocaleString()+'</td>'
        +'<td style="padding:6px 10px;text-align:right;font-family:monospace;color:var(--muted)">'+r.size+'</td>'
        +'<td style="padding:6px 10px;text-align:right;font-family:monospace;color:var(--muted)">'+estimateSpace(r.key,r.size)+'</td>'
        +'<td style="padding:6px 10px;text-align:center"><span style="font-size:9px;padding:2px 5px;border-radius:4px;background:'+col+'22;color:'+col+';font-weight:600">'+r.dtype+'</span></td>'
        +'</tr>';
    }).join('');
  }

  // ── Complexity tab ──────────────────────────────────────────
  function renderComplexityTab() {
    const tbody = document.getElementById('cmp-complexity-tbody');
    if (!tbody) return;
    tbody.innerHTML = Object.entries(COMPLEXITY).map(([key, c]) => {
      const col = DS_COLORS[key]||'#6366f1';
      return '<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:7px 10px;font-weight:600;color:'+col+'"><span style="width:7px;height:7px;border-radius:50%;background:'+col+';display:inline-block;margin-right:5px"></span>'+DS_LABELS[key]+'</td>'
        +'<td style="padding:7px 10px;text-align:center;font-family:monospace;color:#38bdf8">'+c.insert+'</td>'
        +'<td style="padding:7px 10px;text-align:center;font-family:monospace;color:#10b981">'+c.search+'</td>'
        +'<td style="padding:7px 10px;text-align:center;font-family:monospace;color:#ef4444">'+c.delete+'</td>'
        +'<td style="padding:7px 10px;text-align:center;font-family:monospace;color:#a78bfa">'+c.space+'</td>'
        +'<td style="padding:7px 10px;color:var(--muted);font-size:10px">'+c.notes+'</td>'
        +'</tr>';
    }).join('');
  }

  // ── Use Cases tab ───────────────────────────────────────────
  function renderUseCasesTab() {
    const grid = document.getElementById('cmp-usecases-grid');
    if (!grid) return;
    grid.innerHTML = Object.entries(USE_CASES).map(([key, u]) => {
      const col = DS_COLORS[key]||'#6366f1';
      return '<div style="background:var(--surface);border:1px solid var(--border);border-top:3px solid '+col+';border-radius:8px;padding:12px">'
        +'<div style="font-size:13px;font-weight:700;color:'+col+';margin-bottom:8px">'+u.icon+' '+DS_LABELS[key]+'</div>'
        +'<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px">'
        +u.cases.map(c=>'<li style="font-size:11px;color:var(--muted);padding:3px 0;border-bottom:1px solid var(--border)">&#10003; '+c+'</li>').join('')
        +'</ul></div>';
    }).join('');
  }

  // ── Insights tab ────────────────────────────────────────────
  function renderInsightsTab(results) {
    const list = document.getElementById('cmp-insights-list');
    if (!list) return;
    const active = results.filter(r=>!r.skipped && r.insTime!=null);
    if (!active.length) { list.innerHTML = '<div style="color:var(--muted);font-size:12px">Run the benchmark first to see insights.</div>'; return; }

    const insights = [];
    const byInsTime  = [...active].sort((a,b)=>a.insTime-b.insTime);
    const bySrchTime = [...active].filter(r=>r.srchTime!=null).sort((a,b)=>a.srchTime-b.srchTime);
    const byCmp      = [...active].sort((a,b)=>a.comparisons-b.comparisons);
    const byRot      = [...active].filter(r=>r.rotations>0).sort((a,b)=>a.rotations-b.rotations);

    if (byInsTime.length) insights.push({ icon:'⚡', color:'#10b981', text: byInsTime[0].label+' had the fastest insert time ('+byInsTime[0].insTime.toFixed(3)+'ms), '+byInsTime[byInsTime.length-1].label+' was slowest ('+byInsTime[byInsTime.length-1].insTime.toFixed(3)+'ms).' });
    if (bySrchTime.length) insights.push({ icon:'🔍', color:'#38bdf8', text: bySrchTime[0].label+' had the fastest search time ('+bySrchTime[0].srchTime.toFixed(3)+'ms). '+( bySrchTime[0].key==='avl'||bySrchTime[0].key==='rbt' ? 'Strict balancing ensures O(log n) search.' : '' ) });
    if (byCmp.length) insights.push({ icon:'📊', color:'#a78bfa', text: byCmp[0].label+' made the fewest comparisons ('+byCmp[0].comparisons.toLocaleString()+'), indicating efficient traversal.' });
    if (byRot.length) insights.push({ icon:'🔄', color:'#f59e0b', text: 'AVL performed '+( active.find(r=>r.key==='avl') ? active.find(r=>r.key==='avl').rotations : '?' )+' rotations vs Red-Black\'s '+( active.find(r=>r.key==='rbt') ? active.find(r=>r.key==='rbt').rotations : '?' )+'. AVL is stricter, RBT does fewer rotations on delete.' });

    // Mode-specific insights
    if (cmpAllMode === 'string') insights.push({ icon:'🔤', color:'#ec4899', text: 'Trie excels at prefix queries (O(L) per lookup). Suffix Tree is better for substring search but has O(m\u00b2) build time.' });
    if (cmpAllMode === 'spatial') insights.push({ icon:'🗺️', color:'#14b8a6', text: 'R-Tree is the only DS supporting spatial queries. MBR-based indexing enables efficient range and nearest-neighbor search.' });
    if (cmpAllMode === 'numeric') insights.push({ icon:'🌳', color:'#10b981', text: 'For ordered data, AVL and Red-Black trees provide O(log n) for all operations. Binary Heap is fastest for priority queue use (O(1) find-min).' });

    list.innerHTML = insights.map(i =>
      '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-left:3px solid '+i.color+';border-radius:6px">'
      +'<span style="font-size:16px;flex-shrink:0">'+i.icon+'</span>'
      +'<span style="font-size:12px;color:var(--text);line-height:1.6">'+i.text+'</span>'
      +'</div>'
    ).join('');
  }

  document.getElementById('cmp-all-btn').onclick = () => {
    document.getElementById('cmp-all-section').style.display = 'flex';
    document.getElementById('cmp-canvases').style.display = 'none';
    renderComplexityTab();
    renderUseCasesTab();
  };
  document.getElementById('cmp-all-close').onclick = () => {
    document.getElementById('cmp-all-section').style.display = 'none';
    document.getElementById('cmp-canvases').style.display = 'grid';
  };
  document.getElementById('cmp-all-run').onclick = runBenchmark;
})();



// -----------------------------------------------------------------
// PHASE 5 — SCENARIOS PANEL
// -----------------------------------------------------------------
(function() {
  let curDS = 'avl', curScenario = 'random';
  let dsInst = makeDSInstance('avl');
  let session = null, stepIdx = 0, playing = false, playTimer = null;

  const svgEl   = document.getElementById('sc-svg');
  const svgWrap = document.getElementById('sc-svg-wrap');
  const logList = document.getElementById('sc-log-list');
  const slider  = document.getElementById('sc-slider');
  const tlOp    = document.getElementById('sc-tl-op');
  const tlPos   = document.getElementById('sc-tl-pos');
  const stepLbl = document.getElementById('sc-step-label');
  const speedIn = document.getElementById('sc-speed');
  const speedLbl= document.getElementById('sc-speed-val');
  const metricsCont = document.getElementById('sc-metrics-content');

  initZoomPan(svgWrap, svgEl);

  // Scenario type buttons
  document.querySelectorAll('#sc-type-grid .scenario-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#sc-type-grid .scenario-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      curScenario = btn.dataset.sc;
    };
  });

  // DS chips
  document.querySelectorAll('#sc-ds-chips .ds-chip').forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll('#sc-ds-chips .ds-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      curDS = chip.dataset.ds;
    };
  });

  function generateScenario(type, n) {
    let values;
    switch(type) {
      case 'sorted':  values = Array.from({length:n}, (_,i) => i+1); break;
      case 'reverse': values = Array.from({length:n}, (_,i) => n-i); break;
      case 'skewed':
        values = [];
        for (let i=0;i<n;i++) values.push(Math.random()<0.8 ? Math.floor(Math.random()*Math.ceil(n*0.2))+1 : Math.floor(Math.random()*n)+1);
        break;
      default: values = Array.from({length:n}, () => Math.floor(Math.random()*n*3)+1); break;
    }
    const ops = values.map(v => ({type:'INSERT',value:v}));
    const inserted = [...new Set(values)];
    const sN = Math.floor(inserted.length*0.3), dN = Math.floor(inserted.length*0.2);
    for (let i=0;i<sN;i++) ops.push({type:'SEARCH',value:inserted[Math.floor(Math.random()*inserted.length)]});
    for (let i=0;i<dN;i++) ops.push({type:'DELETE',value:inserted[i]});
    return ops;
  }

  function runScenario() {
    const n = Math.max(5, Math.min(100, parseInt(document.getElementById('sc-n').value) || 20));
    const ops = generateScenario(curScenario, n);
    dsInst = makeDSInstance(curDS);
    session = buildSession(ops, dsInst, curDS);
    if (!session.steps.length) { showToast('No steps generated'); return; }

    slider.max = session.steps.length - 1;
    slider.value = 0;
    buildTimelineMarkers(
      document.getElementById('sc-tl-track'),
      session.boundaries,
      session.steps.length,
      i => seek(session.boundaries[i].startIdx)
    );
    seek(0);
    showToast(curScenario + ' scenario: ' + ops.length + ' ops \u2192 ' + session.steps.length + ' steps');
  }

  function seek(i) {
    if (!session) return;
    stepIdx = Math.max(0, Math.min(i, session.steps.length - 1));
    renderStep(svgEl, curDS, session.steps[stepIdx]);
    slider.value = stepIdx;
    tlPos.textContent = (stepIdx+1) + ' / ' + session.steps.length;
    stepLbl.textContent = 'Step ' + (stepIdx+1) + '/' + session.steps.length + ': ' + session.steps[stepIdx].msg;
    let curB = null;
    for (const b of session.boundaries) { if (b.startIdx <= stepIdx) curB = b; else break; }
    tlOp.textContent = curB ? curB.label : '\u2014';
    buildLog(logList, session.steps, stepIdx, seek, session.boundaries);
    renderMetrics(metricsCont, session.steps.slice(0, stepIdx+1), curDS, DS_COLORS[curDS]);
  }

  function stopPlay() { playing = false; clearTimeout(playTimer); document.getElementById('sc-play').textContent = '\u25b6'; }
  function playLoop() {
    if (!playing || !session) return;
    if (stepIdx >= session.steps.length - 1) { stopPlay(); return; }
    seek(stepIdx + 1);
    playTimer = setTimeout(playLoop, +speedIn.value);
  }

  document.getElementById('sc-run').onclick  = runScenario;
  document.getElementById('sc-prev').onclick = () => { stopPlay(); seek(stepIdx - 1); };
  document.getElementById('sc-play').onclick = () => {
    if (!session) { showToast('Generate a scenario first'); return; }
    playing = !playing;
    document.getElementById('sc-play').textContent = playing ? '\u23f8' : '\u25b6';
    if (playing) playLoop(); else clearTimeout(playTimer);
  };
  document.getElementById('sc-next').onclick = () => { stopPlay(); seek(stepIdx + 1); };
  slider.addEventListener('input', () => { stopPlay(); seek(+slider.value); });
  speedIn.addEventListener('input', () => {
    speedLbl.textContent = speedIn.value + 'ms';
    if (window.setAnimSpeed) setAnimSpeed(+speedIn.value);
  });

  document.getElementById('sc-download').onclick = () => {
    if (!session) { showToast('Generate a scenario first'); return; }
    const ops = generateScenario(curScenario, parseInt(document.getElementById('sc-n').value)||20);
    const text = '# Scenario: ' + curScenario + '  n=' + ops.filter(o=>o.type==='INSERT').length + '\n' +
                 ops.map(o => o.type + ' ' + o.value).join('\n');
    const blob = new Blob([text], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dataset_' + curScenario + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };
})();

}); // end DOMContentLoaded
