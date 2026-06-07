// ═══════════════════════════════════════════════════════════════════
// platform.js  —  Phases 1–6: Replay + Timeline + Compare + Metrics
//                 + Scenarios + UI Enhancement
//
// Integrates with the existing visualizer.html / renderer.js.
// Loaded AFTER renderer.js and the DS class definitions.
// Exposes nothing to global scope except what the HTML needs.
// ═══════════════════════════════════════════════════════════════════

/* ─────────────────────────────────────────────────────────────────
   PHASE 1 — DATASET REPLAY ENGINE
   ───────────────────────────────────────────────────────────────── */

/**
 * Parse dataset.txt text into an array of {type, value} ops.
 * Skips comment lines and blank lines.
 */
function parseDataset(text) {
  const ops = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(INSERT|SEARCH|DELETE)\s+(-?\d+)/i);
    if (m) ops.push({ type: m[1].toUpperCase(), value: parseInt(m[2]) });
  }
  return ops;
}

/**
 * Execute one op on a DS instance and return its steps array.
 * Heaps: DELETE → extractMinSteps (no arbitrary-key delete).
 */
function execOp(dsInst, dsKey, op) {
  switch (op.type) {
    case 'INSERT': return dsInst.insertSteps?.(op.value) ?? [];
    case 'SEARCH': return dsInst.searchSteps?.(op.value) ?? [];
    case 'DELETE':
      if (dsKey === 'bheap' || dsKey === 'binom')
        return dsInst.extractMinSteps?.() ?? [];
      return dsInst.deleteSteps?.(op.value) ?? [];
  }
  return [];
}

/**
 * Build the full replay session: run all ops, concatenate steps,
 * record operation boundaries for the timeline.
 *
 * Returns { steps, boundaries, totalOps }
 *   boundaries[i] = { label, startIdx, endIdx }
 */
function buildSession(ops, dsInst, dsKey) {
  const steps      = [];
  const boundaries = [];

  for (const op of ops) {
    const opSteps = execOp(dsInst, dsKey, op);
    if (!opSteps.length) continue;
    boundaries.push({
      label:    `${op.type} ${op.value}`,
      startIdx: steps.length,
      endIdx:   steps.length + opSteps.length - 1,
    });
    steps.push(...opSteps);
  }

  return { steps, boundaries, totalOps: ops.length };
}

/* ─────────────────────────────────────────────────────────────────
   REPLAY STATE  (shared between Phase 1 controls and Phase 2 slider)
   ───────────────────────────────────────────────────────────────── */

const Replay = {
  steps:      [],
  boundaries: [],
  idx:        0,
  playing:    false,
  speed:      500,   // ms per step
  _timer:     null,
  _svgEl:     null,
  _dsKey:     null,

  load(session, svgEl, dsKey) {
    this.stop();
    this.steps      = session.steps;
    this.boundaries = session.boundaries;
    this.idx        = 0;
    this._svgEl     = svgEl;
    this._dsKey     = dsKey;
    this._notify();
  },

  seek(i) {
    this.idx = Math.max(0, Math.min(i, this.steps.length - 1));
    this._render();
    this._notify();
  },

  stepFwd()  { if (this.idx < this.steps.length - 1) this.seek(this.idx + 1); },
  stepBack() { if (this.idx > 0) this.seek(this.idx - 1); },

  play() {
    if (this.playing || !this.steps.length) return;
    this.playing = true;
    this._notify();
    this._tick();
  },

  pause() {
    this.playing = false;
    clearTimeout(this._timer);
    this._notify();
  },

  stop() {
    this.pause();
    this.idx = 0;
    this._notify();
  },

  setSpeed(ms) { this.speed = ms; },

  currentBoundary() {
    let result = null;
    for (const b of this.boundaries) {
      if (b.startIdx <= this.idx) result = b;
      else break;
    }
    return result;
  },

  _tick() {
    if (!this.playing) return;
    if (this.idx >= this.steps.length - 1) {
      this.playing = false;
      this._notify();
      return;
    }
    this.stepFwd();
    this._timer = setTimeout(() => this._tick(), this.speed);
  },

  _render() {
    if (this._svgEl && this._dsKey && this.steps[this.idx]) {
      renderStep(this._svgEl, this._dsKey, this.steps[this.idx]);
    }
  },

  // Observers — UI components subscribe here
  _observers: [],
  subscribe(fn) { this._observers.push(fn); },
  _notify()    { this._observers.forEach(fn => fn(this)); },
};

/* ─────────────────────────────────────────────────────────────────
   PHASE 4 — METRICS TRACKING
   Wraps DS insertSteps / deleteSteps / searchSteps to count events.
   ───────────────────────────────────────────────────────────────── */

const Metrics = {
  avl:   { comparisons: 0, rotations: 0 },
  rbt:   { comparisons: 0, rotations: 0 },
  bheap: { comparisons: 0, swaps: 0 },
  binom: { comparisons: 0, swaps: 0 },
  btree: { comparisons: 0, splits: 0 },

  reset(dsKey) {
    const m = this[dsKey];
    if (m) Object.keys(m).forEach(k => m[k] = 0);
  },

  resetAll() {
    ['avl','rbt','bheap','binom','btree'].forEach(k => this.reset(k));
  },

  /**
   * Count metrics from a steps array by scanning step messages.
   * This is non-invasive — no changes to DS classes needed.
   */
  countFromSteps(steps, dsKey) {
    this.reset(dsKey);
    const m = this[dsKey];
    if (!m) return;

    for (const s of steps) {
      const msg = s.msg || '';
      if (dsKey === 'avl' || dsKey === 'rbt') {
        if (/Comparing|Visiting|go left|go right/i.test(msg)) m.comparisons++;
        if (/rotat/i.test(msg) && !/After/i.test(msg))        m.rotations++;
      } else if (dsKey === 'bheap') {
        if (/Compare/i.test(msg))  m.comparisons++;
        if (/Swap/i.test(msg))     m.swaps++;
      } else if (dsKey === 'binom') {
        if (/Visit/i.test(msg))    m.comparisons++;
        if (/Swap|Link/i.test(msg)) m.swaps++;
      } else if (dsKey === 'btree') {
        if (/Internal node|Reached leaf/i.test(msg)) m.comparisons++;
        if (/split/i.test(msg) && !/After/i.test(msg)) m.splits++;
      }
    }
  },
};

/* ─────────────────────────────────────────────────────────────────
   PHASE 3 — COMPARISON ENGINE  (AVL vs RBT, extensible)
   ───────────────────────────────────────────────────────────────── */

const Compare = {
  // Each slot: { dsKey, dsInst, steps, idx, svgEl, metrics }
  slots: [],

  init(slotConfigs) {
    // slotConfigs = [{ dsKey, dsInst, svgEl }, ...]
    this.slots = slotConfigs.map(cfg => ({
      dsKey:   cfg.dsKey,
      dsInst:  cfg.dsInst,
      svgEl:   cfg.svgEl,
      steps:   [],
      idx:     0,
      metrics: {},
    }));
  },

  runOp(opType, value) {
    for (const slot of this.slots) {
      slot.dsInst.clear();
      const op = { type: opType, value };
      slot.steps = execOp(slot.dsInst, slot.dsKey, op);
      slot.idx   = 0;
      Metrics.countFromSteps(slot.steps, slot.dsKey);
      slot.metrics = { ...Metrics[slot.dsKey] };
    }
    this.totalSteps = Math.max(...this.slots.map(s => s.steps.length), 1);
    this.seek(0);
    this._notifyMetrics();
  },

  seek(i) {
    this.globalIdx = Math.max(0, Math.min(i, this.totalSteps - 1));
    for (const slot of this.slots) {
      const localIdx = Math.min(this.globalIdx, slot.steps.length - 1);
      if (slot.svgEl && slot.steps[localIdx]) {
        renderStep(slot.svgEl, slot.dsKey, slot.steps[localIdx]);
      }
    }
    this._notifyStep();
  },

  stepFwd()  { if (this.globalIdx < this.totalSteps - 1) this.seek(this.globalIdx + 1); },
  stepBack() { if (this.globalIdx > 0) this.seek(this.globalIdx - 1); },

  playing:    false,
  speed:      500,
  _timer:     null,
  globalIdx:  0,
  totalSteps: 0,

  play() {
    if (this.playing) return;
    this.playing = true;
    this._tick();
  },
  pause() {
    this.playing = false;
    clearTimeout(this._timer);
  },
  _tick() {
    if (!this.playing) return;
    if (this.globalIdx >= this.totalSteps - 1) { this.playing = false; return; }
    this.stepFwd();
    this._timer = setTimeout(() => this._tick(), this.speed);
  },

  _stepObservers:   [],
  _metricsObservers: [],
  onStep(fn)    { this._stepObservers.push(fn); },
  onMetrics(fn) { this._metricsObservers.push(fn); },
  _notifyStep()    { this._stepObservers.forEach(fn => fn(this)); },
  _notifyMetrics() { this._metricsObservers.forEach(fn => fn(this)); },
};

/* ─────────────────────────────────────────────────────────────────
   PHASE 5 — SCENARIO GENERATORS
   ───────────────────────────────────────────────────────────────── */

const Scenarios = {
  /**
   * Generate an ops array for a given scenario.
   * @param {'random'|'sorted'|'reverse'|'skewed'} type
   * @param {number} n  — number of insert operations
   * @returns {Array<{type,value}>}
   */
  generate(type, n = 20) {
    let values;
    switch (type) {
      case 'sorted':
        values = Array.from({ length: n }, (_, i) => i + 1);
        break;
      case 'reverse':
        values = Array.from({ length: n }, (_, i) => n - i);
        break;
      case 'skewed': {
        // 80% of values in the lower 20% of the range — Zipf-like
        values = [];
        for (let i = 0; i < n; i++) {
          values.push(Math.random() < 0.8
            ? Math.floor(Math.random() * Math.ceil(n * 0.2)) + 1
            : Math.floor(Math.random() * n) + 1);
        }
        break;
      }
      case 'random':
      default:
        values = Array.from({ length: n }, () => Math.floor(Math.random() * n * 3) + 1);
        break;
    }

    // Build ops: insert all, then search ~30%, then delete ~20%
    const ops = values.map(v => ({ type: 'INSERT', value: v }));
    const inserted = [...new Set(values)];
    const searchN  = Math.floor(inserted.length * 0.3);
    const deleteN  = Math.floor(inserted.length * 0.2);
    for (let i = 0; i < searchN; i++)
      ops.push({ type: 'SEARCH', value: inserted[Math.floor(Math.random() * inserted.length)] });
    for (let i = 0; i < deleteN; i++)
      ops.push({ type: 'DELETE', value: inserted[i] });

    return ops;
  },

  /** Convert ops array to dataset.txt format string */
  toText(ops) {
    return ops.map(o => `${o.type} ${o.value}`).join('\n');
  },
};
