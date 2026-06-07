// ═══════════════════════════════════════════════════
// renderer.js — D3 v7 + GSAP 3 visualization renderer
// Globals exported: renderStep(svgEl, dsKey, step)
//                   resetRenderer()
// ═══════════════════════════════════════════════════

/* ── Constants ─────────────────────────────────────────────────── */
const R        = 24;    // node radius
const LEVEL_H  = 80;    // vertical spacing between tree levels
const MIN_SEP  = 20;    // minimum horizontal separation between nodes
const DUR      = 0.35;  // GSAP animation duration (seconds) — fallback only

// Speed-aware duration: call getDUR() in all renderers instead of DUR directly
let _animSpeedMs = 500;
function setAnimSpeed(ms) { _animSpeedMs = Math.max(80, +ms || 500); }
function getDUR() { return Math.min(0.55, Math.max(0.06, _animSpeedMs / 1800)); }

const HL_COLORS = {
  visit:  '#f59e0b',
  insert: '#6366f1',
  found:  '#10b981',
  delete: '#ef4444',
  rotate: '#38bdf8',
  color:  '#a78bfa',
};

/* ── Module-level D3 state ─────────────────────────────────────── */
// We keep a reference to the last SVG selection so resetRenderer can clean up.
let _svgSel = null;

/* ── Public API ────────────────────────────────────────────────── */

/**
 * Clear all D3 state and wipe the SVG.
 * Called on Clear / switchDS.
 */
function resetRenderer() {
  if (_svgSel) {
    _svgSel.selectAll('*').interrupt();
    _svgSel.selectAll('*').remove();
  }
  _svgSel = null;
}

/** Clear a specific SVG element — use this in multi-SVG contexts. */
function resetSVG(svgEl) {
  const sel = d3.select(svgEl);
  sel.selectAll('*').interrupt();
  sel.selectAll('*').remove();
  if (_svgSel && _svgSel.node() === svgEl) _svgSel = null;
}

/**
 * Main entry point called by the UI controller.
 * @param {SVGSVGElement} svgEl
 * @param {string}        dsKey  'avl'|'rbt'|'btree'|'bheap'|'binom'|'tbt'|'trie'|'skip'|'suffix'|'rtree'
 * @param {object}        step   snapshot object from the data-structure
 */
function renderStep(svgEl, dsKey, step) {
  if (!step) { resetRenderer(); return; }
  _svgSel = d3.select(svgEl);

  switch (dsKey) {
    case 'avl':    _renderAVL(svgEl, step);    break;
    case 'rbt':    _renderRBT(svgEl, step);    break;
    case 'bheap':  _renderBHeap(svgEl, step);  break;
    case 'binom':  _renderBinom(svgEl, step);  break;
    case 'btree':  _renderBTree(svgEl, step);  break;
    case 'tbt':    _renderTBT(svgEl, step);    break;
    case 'trie':   _renderTrie(svgEl, step);   break;
    case 'skip':   _renderSkip(svgEl, step);   break;
    case 'suffix': _renderSuffix(svgEl, step); break;
    case 'rtree':  _renderRTree(svgEl, step);  break;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SHARED TREE LAYOUT  (Reingold-Tilford style, preserves L/R)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Recursively compute subtree widths, then assign _x / _y.
 * Works on cloned BST nodes with .l / .r children.
 * isNil(n) returns true for null / NIL sentinels.
 */
function _computeWidth(n, isNil) {
  if (!n || isNil(n)) return 0;
  const lw = _computeWidth(n.l, isNil);
  const rw = _computeWidth(n.r, isNil);
  n._lw = lw; n._rw = rw;
  const hasL = n.l && !isNil(n.l);
  const hasR = n.r && !isNil(n.r);
  if (!hasL && !hasR) { n._w = R * 2; return n._w; }
  let w = R * 2;
  if (hasL) w += lw + MIN_SEP;
  if (hasR) w += rw + MIN_SEP;
  n._w = w;
  return w;
}

function _assignXY(n, isNil, cx, depth) {
  if (!n || isNil(n)) return;
  n._x = cx;
  n._y = depth * LEVEL_H + R + 30;
  const hasL = n.l && !isNil(n.l);
  const hasR = n.r && !isNil(n.r);
  if (hasL && hasR) {
    _assignXY(n.l, isNil, cx - (R + MIN_SEP + (n._rw || 0) / 2), depth + 1);
    _assignXY(n.r, isNil, cx + (R + MIN_SEP + (n._lw || 0) / 2), depth + 1);
  } else if (hasL) {
    _assignXY(n.l, isNil, cx - (R + MIN_SEP), depth + 1);
  } else if (hasR) {
    _assignXY(n.r, isNil, cx + (R + MIN_SEP), depth + 1);
  }
}

function _layoutBST(root, isNil, svgW) {
  if (!root || isNil(root)) return;
  _computeWidth(root, isNil);
  let cx = Math.max((svgW || 800) / 2, (root._w || 0) / 2 + 20);
  _assignXY(root, isNil, cx, 0);
  // Shift left if any node goes off-screen
  let minX = Infinity;
  const walk = n => { if (!n || isNil(n)) return; minX = Math.min(minX, n._x); walk(n.l); walk(n.r); };
  walk(root);
  if (minX < R + 10) {
    const sh = R + 10 - minX;
    const shift = n => { if (!n || isNil(n)) return; n._x += sh; shift(n.l); shift(n.r); };
    shift(root);
  }
}

/** Flatten a BST tree into arrays of node-data and edge-data for D3 binding. */
function _flattenBST(root, isNil, nodes, edges) {
  if (!root || isNil(root)) return;
  nodes.push(root);
  if (root.l && !isNil(root.l)) {
    edges.push({ id: `${root.k}-${root.l.k}-l`, x1: root._x, y1: root._y, x2: root.l._x, y2: root.l._y });
    _flattenBST(root.l, isNil, nodes, edges);
  }
  if (root.r && !isNil(root.r)) {
    edges.push({ id: `${root.k}-${root.r.k}-r`, x1: root._x, y1: root._y, x2: root.r._x, y2: root.r._y });
    _flattenBST(root.r, isNil, nodes, edges);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SHARED D3 UPDATE PATTERN  (nodes + edges)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Ensure the SVG has the three standard groups in the right stacking order.
 */
function _ensureGroups(svg) {
  if (svg.select('g.edges').empty())      svg.append('g').attr('class', 'edges');
  if (svg.select('g.nodes').empty())      svg.append('g').attr('class', 'nodes');
  if (svg.select('g.node-labels').empty()) svg.append('g').attr('class', 'node-labels');
}

/**
 * Resize the SVG to fit all nodes.
 * @param {d3.Selection} svg
 * @param {Array}        nodes  — each has ._x and ._y
 * @param {number}       extraH — extra height (for B-tree rect nodes)
 */
function _resizeSVG(svg, nodes, extraH) {
  if (!nodes.length) return;
  const maxX = d3.max(nodes, d => (d._x || 0)) + R + 30;
  const maxY = d3.max(nodes, d => (d._y || 0)) + R + 30 + (extraH || 0);
  svg.attr('width',  Math.max(800, maxX))
     .attr('height', Math.max(400, maxY));
}

/**
 * D3 general-update for <line> edges.
 * @param {d3.Selection} svg
 * @param {Array}        edges  [{id, x1,y1,x2,y2}]
 * @param {string}       stroke colour
 */
function _updateEdges(svg, edges, stroke) {
  stroke = stroke || '#475569';
  const g = svg.select('g.edges');

  const sel = g.selectAll('line').data(edges, d => d.id);

  // EXIT
  sel.exit()
     .each(function() { gsap.to(this, { opacity: 0, duration: DUR, onComplete: () => this.remove() }); });

  // ENTER
  const entered = sel.enter().append('line')
    .attr('stroke', stroke)
    .attr('stroke-width', 2)
    .attr('x1', d => d.x1).attr('y1', d => d.y1)
    .attr('x2', d => d.x2).attr('y2', d => d.y2)
    .each(function(d) {
      const len = Math.sqrt((d.x2-d.x1)**2 + (d.y2-d.y1)**2) || 200;
      d3.select(this).attr('stroke-dasharray', len).attr('stroke-dashoffset', len);
    });

  // Draw-on animation for new edges
  entered.each(function(d) {
    const len = Math.sqrt((d.x2-d.x1)**2 + (d.y2-d.y1)**2) || 200;
    gsap.to(this, { attr: { 'stroke-dashoffset': 0 }, duration: DUR, ease: 'power2.out' });
    // Remove dasharray after animation so it doesn't interfere with updates
    gsap.delayedCall(DUR + 0.05, () => {
      d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
    });
  });

  // UPDATE — animate to new positions
  sel.merge(entered)
     .each(function(d) {
       gsap.to(this, { attr: { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 }, duration: DUR, ease: 'power2.inOut' });
     });
}

/**
 * D3 general-update for circular BST/heap nodes.
 * Each datum needs: _x, _y, _key (string key for D3 binding), _fill, _label, _extra, _isHl, _hlType
 */
function _updateCircleNodes(svg, nodeData) {
  const g = svg.select('g.nodes');

  const sel = g.selectAll('g.node').data(nodeData, d => d._key);

  // EXIT
  sel.exit().each(function() {
    const el = this;
    const d = d3.select(el).datum();
    const tx = d ? d._x : 0, ty = d ? d._y : 0;
    gsap.to(el, {
      opacity: 0, duration: DUR,
      onComplete: () => { if (el.parentNode) el.parentNode.removeChild(el); }
    });
    gsap.to(el, {
      attr: { transform: `translate(${tx},${ty}) scale(0)` },
      duration: DUR, ease: 'power2.in'
    });
  });

  // ENTER — build the <g><circle><text> structure
  const entered = sel.enter().append('g').attr('class', 'node')
    .attr('transform', d => `translate(${d._x},${d._y})`);

  // Outer highlight ring (always present, opacity controlled)
  entered.append('circle')
    .attr('class', 'hl-ring')
    .attr('r', R + 6)
    .attr('fill', 'none')
    .attr('stroke-width', 2.5);

  entered.append('circle')
    .attr('class', 'body')
    .attr('r', R)
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 2);

  entered.append('text')
    .attr('class', 'lbl')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('fill', '#fff')
    .attr('font-size', 13)
    .attr('font-weight', 700)
    .attr('y', 1);

  // Animate enter: pop in from opacity 0 using GSAP (avoid scale conflict with SVG transform attr)
  entered.each(function() {
    gsap.from(this, { opacity: 0, duration: DUR, ease: 'power2.out' });
    // Scale bounce via SVG transform attribute
    const el = this;
    const d = d3.select(el).datum();
    gsap.fromTo(el,
      { attr: { transform: `translate(${d._x},${d._y}) scale(0)` } },
      { attr: { transform: `translate(${d._x},${d._y}) scale(1)` }, duration: DUR, ease: 'back.out(1.7)' }
    );
  });

  // MERGE — update positions, colours, labels
  const merged = sel.merge(entered);

  merged.each(function(d) {
    const gEl = d3.select(this);

    // Animate position change via SVG transform attribute
    gsap.to(this, {
      attr: { transform: `translate(${d._x},${d._y})` },
      duration: DUR, ease: 'power2.inOut'
    });

    // Body fill
    const fill = d._isHl ? (HL_COLORS[d._hlType] || HL_COLORS.visit) : d._fill;
    gEl.select('circle.body').attr('fill', fill);

    // Highlight ring
    if (d._isHl) {
      const ringColor = HL_COLORS[d._hlType] || HL_COLORS.visit;
      gEl.select('circle.hl-ring')
         .attr('stroke', ringColor)
         .attr('opacity', 0.45);
      // Pulse animation on ring radius
      const ring = gEl.select('circle.hl-ring').node();
      gsap.timeline()
        .to(ring, { attr: { r: R + 10 }, duration: DUR / 2, ease: 'power1.out' })
        .to(ring, { attr: { r: R + 6  }, duration: DUR / 2, ease: 'power1.in'  });
      // Scale bounce via SVG transform attribute
      gsap.timeline()
        .to(this, { attr: { transform: `translate(${d._x},${d._y}) scale(1.3)` }, duration: DUR / 2, ease: 'power1.out' })
        .to(this, { attr: { transform: `translate(${d._x},${d._y}) scale(1.0)` }, duration: DUR / 2, ease: 'power1.in'  });
    } else {
      gEl.select('circle.hl-ring').attr('stroke', 'none').attr('opacity', 0);
    }

    // Label
    gEl.select('text.lbl').text(d._label);
  });

  // Extra labels (bf:, [i], etc.) in the node-labels group
  const lg = svg.select('g.node-labels');
  const lsel = lg.selectAll('text.extra').data(nodeData.filter(d => d._extra), d => d._key);

  lsel.exit().remove();

  lsel.enter().append('text')
    .attr('class', 'extra')
    .attr('text-anchor', 'middle')
    .attr('fill', '#94a3b8')
    .attr('font-size', 10)
    .merge(lsel)
    .attr('x', d => d._x)
    .attr('y', d => d._y - R - 7)
    .text(d => d._extra);
}

/* ═══════════════════════════════════════════════════════════════
   AVL TREE RENDERER
   ═══════════════════════════════════════════════════════════════ */

function _renderAVL(svgEl, step) {
  const svg = d3.select(svgEl);
  _ensureGroups(svg);

  const { tree, hl, hlType } = step;
  if (!tree) {
    svg.selectAll('g.edges, g.nodes, g.node-labels').selectAll('*').remove();
    return;
  }

  const isNil = n => !n;
  _layoutBST(tree, isNil, +svgEl.getAttribute('width') || 800);

  const nodes = [], edges = [];
  _flattenBST(tree, isNil, nodes, edges);

  _resizeSVG(svg, nodes);
  _updateEdges(svg, edges, '#475569');

  const nodeData = nodes.map(n => {
    const lh = n.l ? n.l.h : 0;
    const rh = n.r ? n.r.h : 0;
    return {
      _key:   String(n.k),
      _x:     n._x,
      _y:     n._y,
      _fill:  '#10b981',
      _label: String(n.k),
      _extra: `bf:${lh - rh}`,
      _isHl:  n.k === hl,
      _hlType: hlType || 'visit',
    };
  });

  _updateCircleNodes(svg, nodeData);
}

/* ═══════════════════════════════════════════════════════════════
   RED-BLACK TREE RENDERER
   ═══════════════════════════════════════════════════════════════ */

function _renderRBT(svgEl, step) {
  const svg = d3.select(svgEl);
  _ensureGroups(svg);

  const { tree, hl, hlType } = step;
  if (!tree) {
    svg.selectAll('g.edges, g.nodes, g.node-labels').selectAll('*').remove();
    return;
  }

  const isNil = n => !n;
  _layoutBST(tree, isNil, +svgEl.getAttribute('width') || 800);

  const nodes = [], edges = [];
  _flattenBST(tree, isNil, nodes, edges);

  _resizeSVG(svg, nodes);
  _updateEdges(svg, edges, '#475569');

  const nodeData = nodes.map(n => ({
    _key:    String(n.k),
    _x:      n._x,
    _y:      n._y,
    _fill:   n.red ? '#dc2626' : '#1e3a5f',
    _label:  String(n.k),
    _extra:  null,
    _isHl:   n.k === hl,
    _hlType: hlType || 'visit',
  }));

  _updateCircleNodes(svg, nodeData);
}

/* ═══════════════════════════════════════════════════════════════
   BINARY HEAP RENDERER  (complete binary tree from flat array)
   ═══════════════════════════════════════════════════════════════ */

function _renderBHeap(svgEl, step) {
  const svg = d3.select(svgEl);
  _ensureGroups(svg);

  const { heap, hl, hlType } = step;
  if (!heap || !heap.length) {
    svg.selectAll('g.edges, g.nodes, g.node-labels').selectAll('*').remove();
    return;
  }

  const n = heap.length;
  const depth = Math.floor(Math.log2(n)) + 1;
  const W = Math.max(800, Math.pow(2, depth) * (R * 2 + MIN_SEP));
  svg.attr('width', W);

  // Compute positions for each index
  const pos = heap.map((val, i) => {
    const d = Math.floor(Math.log2(i + 1));
    const posInLevel = i - (Math.pow(2, d) - 1);
    const totalInLevel = Math.pow(2, d);
    return {
      x: (posInLevel + 0.5) * (W / totalInLevel),
      y: d * LEVEL_H + R + 30,
    };
  });

  // Build edges
  const edges = [];
  for (let i = 1; i < n; i++) {
    const p = Math.floor((i - 1) / 2);
    edges.push({ id: `bh-${p}-${i}`, x1: pos[p].x, y1: pos[p].y, x2: pos[i].x, y2: pos[i].y });
  }

  _resizeSVG(svg, pos.map((p, i) => ({ _x: p.x, _y: p.y })));
  _updateEdges(svg, edges, '#475569');

  const nodeData = heap.map((val, i) => ({
    _key:    `bh-${i}`,
    _x:      pos[i].x,
    _y:      pos[i].y,
    _fill:   '#0ea5e9',
    _label:  String(val),
    _extra:  `[${i}]`,
    _isHl:   val === hl,
    _hlType: hlType || 'visit',
  }));

  _updateCircleNodes(svg, nodeData);
}

/* ═══════════════════════════════════════════════════════════════
   BINOMIAL HEAP RENDERER  (recursive layout)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Recursively assign _x / _y to binomial tree nodes.
 * Returns the new xOffset after placing this subtree.
 */
function _layoutBinomNode(n, depth, xOff) {
  if (!n) return xOff;
  const xs = [];
  let c = n.child;
  while (c) {
    xOff = _layoutBinomNode(c, depth + 1, xOff);
    xs.push(c._x);
    c = c.sib;
    if (c) xOff += MIN_SEP;
  }
  n._x = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : xOff + R;
  n._y = depth * LEVEL_H + R + 30;
  return xs.length ? xOff : xOff + R * 2;
}

/** Flatten a binomial tree into nodes/edges arrays. */
function _flattenBinom(n, nodes, edges) {
  if (!n) return;
  nodes.push(n);
  let c = n.child;
  while (c) {
    edges.push({ id: `bn-${n.key}-${c.key}-${c.deg}`, x1: n._x, y1: n._y, x2: c._x, y2: c._y });
    _flattenBinom(c, nodes, edges);
    c = c.sib;
  }
}

function _renderBinom(svgEl, step) {
  const svg = d3.select(svgEl);
  _ensureGroups(svg);

  const { heap, hl } = step;
  if (!heap || !heap.length) {
    svg.selectAll('g.edges, g.nodes, g.node-labels').selectAll('*').remove();
    return;
  }

  // Deduplicate roots
  const seen = new Set();
  const roots = heap.filter(r => { if (seen.has(r)) return false; seen.add(r); return true; });

  // Layout pass
  let xOff = R + 10;
  for (const r of roots) {
    xOff = _layoutBinomNode(r, 0, xOff);
    xOff += R * 3 + MIN_SEP * 2;
  }

  // Flatten
  const nodes = [], edges = [];
  for (const r of roots) _flattenBinom(r, nodes, edges);

  _resizeSVG(svg, nodes.map(n => ({ _x: n._x, _y: n._y })));
  _updateEdges(svg, edges, '#7dd3fc');

  const nodeData = nodes.map(n => ({
    _key:    `bn-${n.key}-${n.deg}`,
    _x:      n._x,
    _y:      n._y,
    _fill:   '#0ea5e9',
    _label:  String(n.key),
    _extra:  `B${n.deg}`,
    _isHl:   n.key === hl,
    _hlType: 'visit',
  }));

  _updateCircleNodes(svg, nodeData);
}

/* ═══════════════════════════════════════════════════════════════
   B+ TREE RENDERER  (rectangular nodes, D3 general-update)
   ═══════════════════════════════════════════════════════════════ */

const BT_NODE_H = 32;
const BT_CELL_W = 36;
const BT_PAD    = 12;
const BT_GAP    = 20;

function _btNodeW(keyCount) {
  return Math.max(40, keyCount * BT_CELL_W + BT_PAD);
}

function _renderBTree(svgEl, step) {
  const svg = d3.select(svgEl);

  // B-tree uses a completely different SVG structure (rects, not circles).
  // We clear and redraw imperatively each step — D3 is used for data binding
  // on the rect-based node groups.
  svg.selectAll('*').remove();

  const { tree: root, hl, hlType } = step;
  if (!root || root.n === 0) return;

  // ── BFS layout ──────────────────────────────────
  const layout  = [];
  const byDepth = [];
  const queue   = [{ node: root, depth: 0 }];
  while (queue.length) {
    const { node, depth } = queue.shift();
    if (!byDepth[depth]) byDepth[depth] = [];
    const entry = { node, depth, x: 0, y: depth * (BT_NODE_H + 54) + 30 };
    byDepth[depth].push(entry);
    layout.push(entry);
    if (!node.leaf)
      for (let i = 0; i <= node.n; i++)
        queue.push({ node: node.children[i], depth: depth + 1 });
  }

  // Compute minimum canvas width
  let minW = 800;
  for (const level of byDepth) {
    const totalNodeW = level.reduce((s, e) => s + _btNodeW(e.node.n), 0);
    const needed = totalNodeW + (level.length + 1) * BT_GAP;
    if (needed > minW) minW = needed;
  }
  const svgW = minW;

  // Assign x positions
  for (const level of byDepth) {
    const totalNodeW = level.reduce((s, e) => s + _btNodeW(e.node.n), 0);
    const totalGap   = svgW - totalNodeW;
    const gap        = totalGap / (level.length + 1);
    let cursor = 0;
    for (const e of level) {
      const nw = _btNodeW(e.node.n);
      cursor += gap;
      e.x = cursor + nw / 2;
      cursor += nw;
    }
  }

  // Resize SVG
  let maxY = 0;
  layout.forEach(e => { maxY = Math.max(maxY, e.y + BT_NODE_H / 2 + 20); });
  svg.attr('width', svgW).attr('height', Math.max(400, maxY));

  // ── Draw edges ───────────────────────────────────
  const edgesG = svg.append('g').attr('class', 'edges');
  for (const e of layout) {
    if (!e.node.leaf) {
      const childLevel = byDepth[e.depth + 1] || [];
      let ci = 0;
      for (const pe of byDepth[e.depth]) {
        if (pe === e) break;
        if (!pe.node.leaf) ci += pe.node.n + 1;
      }
      for (let j = 0; j <= e.node.n; j++) {
        const ce = childLevel[ci + j];
        if (!ce) continue;
        const line = edgesG.append('line')
          .attr('x1', e.x).attr('y1', e.y + BT_NODE_H / 2)
          .attr('x2', ce.x).attr('y2', ce.y - BT_NODE_H / 2)
          .attr('stroke', '#475569').attr('stroke-width', 1.5)
          .attr('stroke-dasharray', 200).attr('stroke-dashoffset', 200);
        gsap.to(line.node(), { attr: { 'stroke-dashoffset': 0 }, duration: DUR, ease: 'power2.out',
          onComplete: () => { line.attr('stroke-dasharray', null).attr('stroke-dashoffset', null); } });
      }
    }
  }

  // ── Draw leaf link arrows ────────────────────────
  const leaves = layout.filter(e => e.node.leaf);
  for (let i = 0; i < leaves.length - 1; i++) {
    const a = leaves[i], b = leaves[i + 1];
    const ax = a.x + _btNodeW(a.node.n) / 2;
    const bx = b.x - _btNodeW(b.node.n) / 2;
    edgesG.append('line')
      .attr('x1', ax).attr('y1', a.y)
      .attr('x2', bx).attr('y2', b.y)
      .attr('stroke', '#38bdf8').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3');
  }

  // ── Draw nodes ───────────────────────────────────
  const nodesG = svg.append('g').attr('class', 'nodes');

  for (const e of layout) {
    const { node, x, y } = e;
    const nw = _btNodeW(node.n);
    const rx = x - nw / 2;
    const isLeaf = node.leaf;

    const g = nodesG.append('g')
      .attr('class', 'node bt-node')
      .attr('transform', `translate(${rx},${y - BT_NODE_H / 2})`);

    // Animate node entry
    gsap.from(g.node(), { opacity: 0, duration: DUR, ease: 'power2.out' });

    // Background rect
    g.append('rect')
      .attr('width', nw).attr('height', BT_NODE_H)
      .attr('rx', 6)
      .attr('fill', isLeaf ? '#0f2a1a' : '#1e293b')
      .attr('stroke', isLeaf ? '#10b981' : '#334155')
      .attr('stroke-width', isLeaf ? 2 : 1.5);

    // Key cells
    const cellW = nw / node.n;
    for (let i = 0; i < node.n; i++) {
      const kx = i * cellW + cellW / 2;
      const isHl = node.keys[i] === hl;

      if (isHl) {
        const hlRect = g.append('rect')
          .attr('x', i * cellW).attr('y', 0)
          .attr('width', cellW).attr('height', BT_NODE_H)
          .attr('rx', 4)
          .attr('fill', HL_COLORS[hlType] || HL_COLORS.visit)
          .attr('opacity', 0.75);
        // Pulse the highlight
        gsap.timeline()
          .to(hlRect.node(), { attr: { opacity: 1 }, duration: DUR / 2 })
          .to(hlRect.node(), { attr: { opacity: 0.75 }, duration: DUR / 2 });
      }

      g.append('text')
        .attr('x', kx).attr('y', BT_NODE_H / 2 + 1)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', isLeaf ? '#6ee7b7' : '#fff')
        .attr('font-size', 13).attr('font-weight', 700)
        .text(node.keys[i]);

      // Divider between keys
      if (i < node.n - 1) {
        g.append('line')
          .attr('x1', (i + 1) * cellW).attr('y1', 0)
          .attr('x2', (i + 1) * cellW).attr('y2', BT_NODE_H)
          .attr('stroke', '#334155').attr('stroke-width', 1);
      }
    }

    // Leaf label
    if (isLeaf) {
      g.append('text')
        .attr('x', -4).attr('y', BT_NODE_H / 2 + 1)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .attr('fill', '#10b981').attr('font-size', 9)
        .text('L');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   THREADED BST RENDERER — solid child edges + curved dashed threads
   ═══════════════════════════════════════════════════════════════ */
function _renderTBT(svgEl, step) {
  const svg = d3.select(svgEl);
  _ensureGroups(svg);
  const D = getDUR();
  const { tree, hl, hlType } = step;
  if (!tree) { svg.selectAll('*').remove(); return; }
  const isNil = n => !n;
  _layoutBST(tree, isNil, +svgEl.getAttribute('width') || 800);
  const nodes = [], solidEdges = [];
  const flattenTBT = (n) => {
    if (!n) return;
    nodes.push(n);
    if (n.l && !n.lThread) { solidEdges.push({ id:`tbt-${n.k}-${n.l.k}-l`, x1:n._x, y1:n._y, x2:n.l._x, y2:n.l._y }); flattenTBT(n.l); }
    if (n.r && !n.rThread) { solidEdges.push({ id:`tbt-${n.k}-${n.r.k}-r`, x1:n._x, y1:n._y, x2:n.r._x, y2:n.r._y }); flattenTBT(n.r); }
  };
  flattenTBT(tree);
  _resizeSVG(svg, nodes);
  _updateEdges(svg, solidEdges, '#475569');
  const posMap = {};
  nodes.forEach(n => { posMap[n.k] = { x: n._x, y: n._y }; });
  svg.select('g.threads').remove();
  const tg = svg.insert('g', 'g.nodes').attr('class', 'threads');
  let defs = svg.select('defs');
  if (defs.empty()) defs = svg.insert('defs', ':first-child');
  ['tbt-arr-r','tbt-arr-l'].forEach((id, i) => {
    defs.select('#' + id).remove();
    defs.append('marker').attr('id', id).attr('markerWidth',8).attr('markerHeight',8)
      .attr('refX',6).attr('refY',3).attr('orient','auto')
      .append('path').attr('d','M0,0 L0,6 L8,3 z').attr('fill', i===0 ? '#22d3ee' : '#a78bfa');
  });
  // Use rThreadTarget/lThreadTarget keys stored by _cloneTBT
  const drawThread = (n) => {
    if (!n) return;
    if (n.rThread && n.rThreadTarget != null && posMap[n.rThreadTarget]) {
      const p = posMap[n.rThreadTarget];
      const cy = Math.max(n._y, p.y) + 60;
      tg.append('path')
        .attr('d', `M${n._x},${n._y} Q${(n._x+p.x)/2},${cy} ${p.x},${p.y}`)
        .attr('fill','none').attr('stroke','#22d3ee').attr('stroke-width',2)
        .attr('stroke-dasharray','7 4').attr('marker-end','url(#tbt-arr-r)')
        .attr('opacity', 0.9);
    }
    if (n.lThread && n.lThreadTarget != null && posMap[n.lThreadTarget]) {
      const p = posMap[n.lThreadTarget];
      const cy = Math.max(n._y, p.y) + 60;
      tg.append('path')
        .attr('d', `M${n._x},${n._y} Q${(n._x+p.x)/2},${cy} ${p.x},${p.y}`)
        .attr('fill','none').attr('stroke','#a78bfa').attr('stroke-width',2)
        .attr('stroke-dasharray','5 4').attr('marker-end','url(#tbt-arr-l)')
        .attr('opacity', 0.85);
    }
    if (!n.lThread) drawThread(n.l);
    if (!n.rThread) drawThread(n.r);
  };
  drawThread(tree);
  svg.select('g.tbt-legend').remove();
  const lg = svg.append('g').attr('class','tbt-legend').attr('transform','translate(10,14)');
  lg.append('line').attr('x1',0).attr('y1',0).attr('x2',22).attr('y2',0).attr('stroke','#22d3ee').attr('stroke-width',2).attr('stroke-dasharray','7 4');
  lg.append('text').attr('x',26).attr('y',4).attr('fill','#22d3ee').attr('font-size',10).text('Right thread');
  lg.append('line').attr('x1',0).attr('y1',14).attr('x2',22).attr('y2',14).attr('stroke','#a78bfa').attr('stroke-width',2).attr('stroke-dasharray','5 4');
  lg.append('text').attr('x',26).attr('y',18).attr('fill','#a78bfa').attr('font-size',10).text('Left thread');
  _updateCircleNodes(svg, nodes.map(n => ({
    _key:String(n.k), _x:n._x, _y:n._y, _fill:'#0891b2', _label:String(n.k), _extra:null,
    _isHl:n.k===hl, _hlType:hlType||'visit'
  })));
}

/* ═══════════════════════════════════════════════════════════════
   TRIE RENDERER — D3 tree, edge char labels, word path highlight
   ═══════════════════════════════════════════════════════════════ */
function _renderTrie(svgEl, step) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  const D = getDUR();
  const { tree: root, hl, hlType } = step;
  if (!root) return;
  function toH(n) {
    const ch = Object.entries(n.children||{}).sort((a,b)=>a[0].localeCompare(b[0])).map(([,c])=>toH(c));
    return { id:n.id, ch:n.ch||'\u2205', isEnd:n.isEnd, children:ch };
  }
  const hier = d3.hierarchy(toH(root));
  const nc = hier.descendants().length;
  const W = Math.max(800, nc * 60);
  const H = Math.max(400, (hier.height+1)*110+80);
  svg.attr('width',W).attr('height',H);
  d3.tree().size([W-100, H-100])(hier);
  const g = svg.append('g').attr('transform','translate(50,50)');
  const isHl = d => d.data.id === hl;
  const linkG = g.append('g').attr('class','edges');
  hier.links().forEach(lk => {
    const highlighted = isHl(lk.target);
    const col = highlighted ? (HL_COLORS[hlType]||'#f59e0b') : '#475569';
    linkG.append('path').attr('fill','none').attr('stroke',col)
      .attr('stroke-width', highlighted ? 2.5 : 1.5)
      .attr('d', d3.linkVertical().x(d=>d.x).y(d=>d.y)(lk));
    const mx=(lk.source.x+lk.target.x)/2, my=(lk.source.y+lk.target.y)/2;
    linkG.append('text').attr('x',mx+10).attr('y',my)
      .attr('fill',highlighted?'#f59e0b':'#94a3b8')
      .attr('font-size',11).attr('font-weight',highlighted?700:500)
      .attr('text-anchor','middle').text(lk.target.data.ch);
  });
  const nodeG = g.append('g').attr('class','nodes');
  hier.descendants().forEach(d => {
    const ng = nodeG.append('g').attr('transform',`translate(${d.x},${d.y})`).attr('opacity',0);
    gsap.to(ng.node(),{attr:{opacity:1},duration:D,ease:'power2.out'});
    const highlighted = isHl(d);
    const r = d.depth===0 ? 14 : 18;
    const fill = highlighted ? (HL_COLORS[hlType]||HL_COLORS.visit) : d.data.isEnd ? '#10b981' : d.depth===0 ? '#1e293b' : '#1e3a5f';
    const stroke = highlighted ? (HL_COLORS[hlType]||'#f59e0b') : '#475569';
    if (highlighted) {
      const ring = ng.append('circle').attr('r', r+8).attr('fill','none')
        .attr('stroke', HL_COLORS[hlType]||'#f59e0b').attr('stroke-width',2).attr('opacity',0.4);
      gsap.timeline().to(ring.node(),{attr:{r:r+12},duration:D/2,ease:'power1.out'}).to(ring.node(),{attr:{r:r+8},duration:D/2,ease:'power1.in'});
    }
    ng.append('circle').attr('r', r).attr('fill', fill).attr('stroke', stroke).attr('stroke-width', highlighted?2.5:1.5);
    ng.append('text').attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('fill','#fff').attr('font-size',12).attr('font-weight',700).text(d.data.ch);
    if (d.data.isEnd && d.depth>0) {
      ng.append('circle').attr('cy', r+6).attr('r',3).attr('fill','#10b981');
    }
  });
  if (hl) {
    const hlNode = hier.descendants().find(d=>d.data.id===hl);
    if (hlNode) {
      const word = hlNode.ancestors().reverse().slice(1).map(d=>d.data.ch).join('');
      if (word) {
        const banner = svg.append('text').attr('x',W/2).attr('y',24).attr('text-anchor','middle')
          .attr('fill','#f59e0b').attr('font-size',14).attr('font-weight',700).attr('opacity',0)
          .text('"' + word + '"');
        gsap.to(banner.node(),{attr:{opacity:1},duration:D,ease:'power2.out'});
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SKIP LIST RENDERER — level-colored rows, vertical connectors
   ═══════════════════════════════════════════════════════════════ */
function _renderSkip(svgEl, step) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  const D = getDUR();
  const { structure, hl, hlType } = step;
  if (!structure || !structure.levels) return;
  const { levels, maxLevel } = structure;
  const CELL_W=64, CELL_H=38, PAD_X=60, PAD_Y=30, GAP_Y=22;
  const maxCols = Math.max(...levels.map(l=>l.length), 1);
  const W = Math.max(800, (maxCols+2)*CELL_W + PAD_X*2);
  const H = maxLevel*(CELL_H+GAP_Y) + PAD_Y*2 + 30;
  svg.attr('width',W).attr('height',H);
  const g = svg.append('g').attr('transform',`translate(${PAD_X},${PAD_Y})`);
  const lvlColors = ['#f97316','#f59e0b','#10b981','#38bdf8','#6366f1','#a78bfa'];
  for (let lvl=0; lvl<maxLevel; lvl++) {
    const row = levels[lvl]||[];
    const y = (maxLevel-1-lvl)*(CELL_H+GAP_Y);
    const col = lvlColors[lvl % lvlColors.length];
    const lb = g.append('g').attr('transform',`translate(-44,${y+1})`);
    lb.append('rect').attr('width',36).attr('height',CELL_H-2).attr('rx',6).attr('fill',col+'22').attr('stroke',col).attr('stroke-width',1);
    lb.append('text').attr('x',18).attr('y',CELL_H/2).attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('fill',col).attr('font-size',10).attr('font-weight',700).text('L'+lvl);
    g.append('line').attr('x1',0).attr('y1',y+CELL_H/2).attr('x2',(maxCols+1)*CELL_W).attr('y2',y+CELL_H/2)
      .attr('stroke',col+'33').attr('stroke-width',1.5).attr('stroke-dasharray','4 3');
    row.forEach((k,xi) => {
      const x=(xi+1)*CELL_W;
      const isHlNode = k===hl;
      const ng = g.append('g').attr('transform',`translate(${x},${y})`).attr('opacity',0);
      gsap.to(ng.node(),{attr:{opacity:1},duration:D,ease:'power2.out'});
      ng.append('rect').attr('width',CELL_W-10).attr('height',CELL_H).attr('rx',7)
        .attr('fill',isHlNode?(HL_COLORS[hlType]||HL_COLORS.visit):col+'22')
        .attr('stroke',isHlNode?(HL_COLORS[hlType]||'#f59e0b'):col).attr('stroke-width',isHlNode?2.5:1.5);
      if (isHlNode) {
        const ring = ng.append('rect').attr('x',-4).attr('y',-4).attr('width',CELL_W-2).attr('height',CELL_H+8).attr('rx',10)
          .attr('fill','none').attr('stroke',HL_COLORS[hlType]||'#f59e0b').attr('stroke-width',2).attr('opacity',0.5);
        gsap.timeline().to(ring.node(),{attr:{opacity:1},duration:D/2}).to(ring.node(),{attr:{opacity:0.5},duration:D/2});
      }
      ng.append('text').attr('x',(CELL_W-10)/2).attr('y',CELL_H/2+1)
        .attr('text-anchor','middle').attr('dominant-baseline','middle')
        .attr('fill','#fff').attr('font-size',12).attr('font-weight',700).text(k);
      if (lvl>0 && (levels[lvl-1]||[]).includes(k)) {
        const yBelow=(maxLevel-lvl)*(CELL_H+GAP_Y);
        g.append('line').attr('x1',x+(CELL_W-10)/2).attr('y1',y+CELL_H)
          .attr('x2',x+(CELL_W-10)/2).attr('y2',yBelow)
          .attr('stroke',col).attr('stroke-width',1.5).attr('stroke-dasharray','3 2').attr('opacity',0.7);
      }
    });
    const hg=g.append('g').attr('transform',`translate(0,${y})`);
    hg.append('rect').attr('width',CELL_W-10).attr('height',CELL_H).attr('rx',7)
      .attr('fill','#0f172a').attr('stroke','#475569').attr('stroke-width',1);
    hg.append('text').attr('x',(CELL_W-10)/2).attr('y',CELL_H/2+1)
      .attr('text-anchor','middle').attr('dominant-baseline','middle')
      .attr('fill','#475569').attr('font-size',9).text('HEAD');
  }
}

/* ═══════════════════════════════════════════════════════════════
   SUFFIX TREE RENDERER — curved edges, labeled substrings
   ═══════════════════════════════════════════════════════════════ */
function _renderSuffix(svgEl, step) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  const D = getDUR();
  const { tree: root, hl, hlType } = step;
  if (!root) return;
  function toH(n) {
    const ch = Object.values(n.children||{}).map(c=>toH(c));
    return { id:n.id, label:n.label||'', isLeaf:n.isLeaf, suffixIdx:n.suffixIdx, children:ch };
  }
  const hier = d3.hierarchy(toH(root));
  const nc = hier.descendants().length;
  const W = Math.max(800, nc*64);
  const H = Math.max(400, (hier.height+1)*120+80);
  svg.attr('width',W).attr('height',H);
  d3.tree().size([W-100, H-100])(hier);
  const g = svg.append('g').attr('transform','translate(50,50)');
  const isHl = d => d.data.id===hl;
  const linkGen = d3.linkVertical().x(d=>d.x).y(d=>d.y);
  const linkG = g.append('g').attr('class','edges');
  hier.links().forEach(lk => {
    const highlighted = isHl(lk.target);
    const col = highlighted ? (HL_COLORS[hlType]||'#f59e0b') : '#475569';
    linkG.append('path').attr('fill','none').attr('stroke',col)
      .attr('stroke-width',highlighted?2.5:1.5).attr('d',linkGen(lk));
    const lbl = lk.target.data.label;
    if (lbl) {
      const mx=(lk.source.x+lk.target.x)/2, my=(lk.source.y+lk.target.y)/2;
      const display = lbl.length>8 ? lbl.slice(0,8)+'\u2026' : lbl;
      linkG.append('rect')
        .attr('x',mx-display.length*3.5-2).attr('y',my-8)
        .attr('width',display.length*7+4).attr('height',14).attr('rx',3)
        .attr('fill',highlighted?'rgba(245,158,11,0.15)':'#1e293b')
        .attr('stroke',highlighted?'#f59e0b':'#334155').attr('stroke-width',0.8);
      linkG.append('text').attr('x',mx).attr('y',my+1)
        .attr('fill',highlighted?'#f59e0b':'#94a3b8')
        .attr('font-size',10).attr('font-weight',highlighted?700:400)
        .attr('text-anchor','middle').text(display);
    }
  });
  const nodeG = g.append('g').attr('class','nodes');
  hier.descendants().forEach(d => {
    const ng = nodeG.append('g').attr('transform',`translate(${d.x},${d.y})`).attr('opacity',0);
    gsap.to(ng.node(),{attr:{opacity:1},duration:D,ease:'power2.out'});
    const highlighted = isHl(d);
    const r = d.data.isLeaf ? 13 : 17;
    const fill = highlighted ? (HL_COLORS[hlType]||HL_COLORS.visit) : d.data.isLeaf ? '#7c3aed' : '#1e293b';
    const stroke = highlighted ? (HL_COLORS[hlType]||'#f59e0b') : d.data.isLeaf ? '#a78bfa' : '#475569';
    if (highlighted) {
      const ring = ng.append('circle').attr('r',r+8).attr('fill','none')
        .attr('stroke',HL_COLORS[hlType]||'#f59e0b').attr('stroke-width',2).attr('opacity',0.4);
      gsap.timeline().to(ring.node(),{attr:{r:r+12},duration:D/2}).to(ring.node(),{attr:{r:r+8},duration:D/2});
    }
    ng.append('circle').attr('r',r).attr('fill',fill).attr('stroke',stroke).attr('stroke-width',highlighted?2.5:1.5);
    if (d.data.isLeaf && d.data.suffixIdx >= 0) {
      ng.append('text').attr('y',r+10).attr('text-anchor','middle')
        .attr('fill','#a78bfa').attr('font-size',9).text('['+d.data.suffixIdx+']');
    } else if (!d.data.isLeaf) {
      ng.append('circle').attr('r',4).attr('fill','#94a3b8');
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   R-TREE RENDERER — Canvas, depth-colored MBRs, highlight rect
   ═══════════════════════════════════════════════════════════════ */
function _renderRTree(canvasEl, step) {
  let canvas = document.getElementById('rtree-canvas');
  if (!canvas) {
    const wrap = canvasEl.parentElement;
    canvas = document.createElement('canvas');
    canvas.id = 'rtree-canvas';
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none';
    wrap.style.position = 'relative';
    wrap.appendChild(canvas);
    canvasEl.style.display = 'none';
  }
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth  || 800;
  canvas.height = wrap.clientHeight || 500;
  const W=canvas.width, H=canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  const { structure: root } = step;
  if (!root) return;
  const allRects=[];
  const collect=(n)=>{ if(n.isLeaf)n.rects.forEach(r=>allRects.push(r)); else n.children.forEach(c=>collect(c)); };
  collect(root);
  if (!allRects.length) {
    ctx.fillStyle='#64748b'; ctx.font='14px Segoe UI'; ctx.textAlign='center';
    ctx.fillText('R-Tree empty — insert using "x,y,w,h"',W/2,H/2); return;
  }
  const PAD=50;
  const minX=Math.min(...allRects.map(r=>r.x)), minY=Math.min(...allRects.map(r=>r.y));
  const maxX=Math.max(...allRects.map(r=>r.x+r.w)), maxY=Math.max(...allRects.map(r=>r.y+r.h));
  const scale=Math.min((W-PAD*2)/Math.max(maxX-minX,1),(H-PAD*2)/Math.max(maxY-minY,1));
  const tx=r=>PAD+(r.x-minX)*scale, ty=r=>PAD+(r.y-minY)*scale;
  const tw=r=>Math.max(r.w*scale,4), th=r=>Math.max(r.h*scale,4);
  const DEPTH_COLORS=['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444'];
  const drawNode=(n,depth)=>{
    const col=DEPTH_COLORS[depth%DEPTH_COLORS.length];
    if (n.mbr) {
      ctx.fillStyle=col+'28'; ctx.strokeStyle=col;
      ctx.lineWidth=Math.max(1,2.5-depth*0.4);
      ctx.setLineDash(depth===0?[]:[5,3]);
      ctx.beginPath(); ctx.roundRect(tx(n.mbr),ty(n.mbr),tw(n.mbr),th(n.mbr),4);
      ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
    if (n.isLeaf) {
      n.rects.forEach(r=>{
        const isHlRect = r.label === (step.hl||'');
        ctx.fillStyle=isHlRect?'#f59e0b33':'#0ea5e920';
        ctx.strokeStyle=isHlRect?'#f59e0b':'#38bdf8';
        ctx.lineWidth=isHlRect?2.5:1.5;
        ctx.beginPath(); ctx.roundRect(tx(r),ty(r),tw(r),th(r),3);
        ctx.fill(); ctx.stroke();
        if (r.label) {
          ctx.fillStyle=isHlRect?'#f59e0b':'#e2e8f0';
          ctx.font='bold '+(isHlRect?11:9)+'px monospace';
          ctx.textAlign='center';
          ctx.fillText(r.label,tx(r)+tw(r)/2,ty(r)+th(r)/2+4);
        }
      });
    } else { n.children.forEach(c=>drawNode(c,depth+1)); }
  };
  drawNode(root,0);
  ctx.fillStyle='#64748b'; ctx.font='10px Segoe UI'; ctx.textAlign='left';
  ctx.fillText(allRects.length+' rect(s)',PAD,H-14);
}
