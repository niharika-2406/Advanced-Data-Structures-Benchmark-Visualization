// ═══════════════════════════════════════════════════
// STEP-RECORDING DATA STRUCTURES
// Each operation records snapshots: {msg, tree, highlight, state}
// tree = deep-cloned node tree at that moment
// highlight = {node: key, type: 'visit'|'insert'|'rotate'|'found'|'delete'|'color'}
// ═══════════════════════════════════════════════════

// Deep clone a BST-style node tree (l/r children)
function cloneBST(n) {
  if (!n) return null;
  return { k: n.k, h: n.h||0, l: cloneBST(n.l), r: cloneBST(n.r) };
}

// Deep clone RBT node tree (l/r, red flag, skip NIL sentinel)
function cloneRBT(n, NIL) {
  if (!n || n === NIL) return null;
  return { k: n.k, red: n.red, l: cloneRBT(n.l, NIL), r: cloneRBT(n.r, NIL) };
}

// Deep clone binomial heap roots (child/sib linked list) — does NOT follow sib (roots stored in array)
function cloneBH(n) {
  if (!n) return null;
  return { key: n.key, deg: n.deg, child: cloneBHChildren(n.child), sib: null };
}

function cloneBHChildren(n) {
  if (!n) return null;
  return { key: n.key, deg: n.deg, child: cloneBHChildren(n.child), sib: cloneBHChildren(n.sib) };
}

// Deep clone binary heap array snapshot
function cloneBinaryHeap(arr) {
  return arr ? arr.slice() : [];
}

// Deep clone B-Tree node
function cloneBTNode(n) {
  if (!n) return null;
  return {
    keys: n.keys.slice(),
    n: n.n,
    leaf: n.leaf,
    children: n.leaf ? [] : n.children.map(cloneBTNode)
  };
}

// ═══════════════════════════════════════════════════
// AVL TREE with step recording
// ═══════════════════════════════════════════════════
class AVLTree {
  constructor() { this.root = null; this.size = 0; }
  _h(n) { return n ? n.h : 0; }
  _upd(n) { if (n) n.h = 1 + Math.max(this._h(n.l), this._h(n.r)); }
  _bf(n) { return n ? this._h(n.l) - this._h(n.r) : 0; }
  _rotR(y) { let x=y.l,T=x.r; x.r=y; y.l=T; this._upd(y); this._upd(x); return x; }
  _rotL(x) { let y=x.r,T=y.l; y.l=x; x.r=T; this._upd(x); this._upd(y); return y; }

  insertSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: cloneBST(this.root), hl, hlType: hlType||'visit' });
    const ins = (n, k) => {
      if (!n) { this.size++; let nn={k,h:1,l:null,r:null}; return nn; }
      snap(`Comparing ${k} with node ${n.k}`, n.k, 'visit');
      if (k < n.k) { snap(`${k} < ${n.k}, go left`, n.k, 'visit'); n.l = ins(n.l, k); }
      else if (k > n.k) { snap(`${k} > ${n.k}, go right`, n.k, 'visit'); n.r = ins(n.r, k); }
      else { snap(`${k} already exists`, n.k, 'found'); return n; }
      this._upd(n);
      let bf = this._bf(n);
      if (bf > 1 && k < n.l.k) {
        snap(`bf=${bf} at ${n.k} — Left-Left: rotate right`, n.k, 'rotate');
        n = this._rotR(n); snap(`After rotation, new root: ${n.k}`, n.k, 'rotate');
      } else if (bf < -1 && k > n.r.k) {
        snap(`bf=${bf} at ${n.k} — Right-Right: rotate left`, n.k, 'rotate');
        n = this._rotL(n); snap(`After rotation, new root: ${n.k}`, n.k, 'rotate');
      } else if (bf > 1 && k > n.l.k) {
        snap(`bf=${bf} at ${n.k} — Left-Right: rotate left on left child`, n.l.k, 'rotate');
        n.l = this._rotL(n.l); n = this._rotR(n); snap(`After LR rotation, new root: ${n.k}`, n.k, 'rotate');
      } else if (bf < -1 && k < n.r.k) {
        snap(`bf=${bf} at ${n.k} — Right-Left: rotate right on right child`, n.r.k, 'rotate');
        n.r = this._rotR(n.r); n = this._rotL(n); snap(`After RL rotation, new root: ${n.k}`, n.k, 'rotate');
      }
      return n;
    };
    snap(`Start: insert ${k}`, null, 'visit');
    this.root = ins(this.root, k);
    snap(`Done: ${k} inserted. Size=${this.size}`, k, 'insert');
    return steps;
  }

  deleteSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: cloneBST(this.root), hl, hlType: hlType||'visit' });
    const minN = n => { while(n.l) n=n.l; return n; };
    const bal = n => {
      this._upd(n); let bf=this._bf(n);
      if(bf>1){ if(this._bf(n.l)<0)n.l=this._rotL(n.l); return this._rotR(n); }
      if(bf<-1){ if(this._bf(n.r)>0)n.r=this._rotR(n.r); return this._rotL(n); }
      return n;
    };
    const del = (n, k) => {
      if (!n) { snap(`${k} not found`, null, 'visit'); return null; }
      snap(`Visiting node ${n.k}`, n.k, 'visit');
      if (k < n.k) { snap(`${k} < ${n.k}, go left`, n.k, 'visit'); n.l = del(n.l, k); }
      else if (k > n.k) { snap(`${k} > ${n.k}, go right`, n.k, 'visit'); n.r = del(n.r, k); }
      else {
        snap(`Found ${k}, deleting`, n.k, 'delete');
        this.size--;
        if (!n.l || !n.r) { return n.l || n.r; }
        let s = minN(n.r);
        snap(`Two children — inorder successor is ${s.k}`, s.k, 'visit');
        n.k = s.k; n.r = del(n.r, s.k); this.size++;
      }
      return bal(n);
    };
    snap(`Start: delete ${k}`, null, 'visit');
    this.root = del(this.root, k);
    snap(`Done: delete complete. Size=${this.size}`, null, 'visit');
    return steps;
  }

  searchSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: cloneBST(this.root), hl, hlType: hlType||'visit' });
    snap(`Start: search ${k}`, null, 'visit');
    let n = this.root;
    while (n) {
      snap(`Visiting ${n.k}`, n.k, 'visit');
      if (k === n.k) { snap(`Found ${k}!`, n.k, 'found'); return steps; }
      if (k < n.k) { snap(`${k} < ${n.k}, go left`, n.k, 'visit'); n = n.l; }
      else { snap(`${k} > ${n.k}, go right`, n.k, 'visit'); n = n.r; }
    }
    snap(`${k} not found`, null, 'visit');
    return steps;
  }

  insert(k) { this.insertSteps(k); }
  remove(k) { this.deleteSteps(k); }
  contains(k) { let n=this.root; while(n){if(k===n.k)return true;n=k<n.k?n.l:n.r;} return false; }
  findMin() { let n=this.root; if(!n)return null; while(n.l)n=n.l; return n.k; }
  findMax() { let n=this.root; if(!n)return null; while(n.r)n=n.r; return n.k; }
  inorder() { let r=[]; const go=n=>{if(!n)return;go(n.l);r.push(n.k);go(n.r);}; go(this.root); return r; }
  clear() { this.root=null; this.size=0; }
  isEmpty() { return !this.root; }
}

// ═══════════════════════════════════════════════════
// RED-BLACK TREE with step recording
// ═══════════════════════════════════════════════════
class RBTree {
  constructor() {
    this.NIL = { k: null, red: false, l: null, r: null, p: null };
    this.NIL.l = this.NIL.r = this.NIL.p = this.NIL;
    this.root = this.NIL; this.size = 0;
  }
  _rotL(x) { let y=x.r;x.r=y.l;if(y.l!==this.NIL)y.l.p=x;y.p=x.p;if(x.p===this.NIL)this.root=y;else if(x===x.p.l)x.p.l=y;else x.p.r=y;y.l=x;x.p=y; }
  _rotR(y) { let x=y.l;y.l=x.r;if(x.r!==this.NIL)x.r.p=y;x.p=y.p;if(y.p===this.NIL)this.root=x;else if(y===y.p.r)y.p.r=x;else y.p.l=x;x.r=y;y.p=x; }
  _min(x) { while(x.l!==this.NIL)x=x.l; return x; }
  _trans(u,v) { if(u.p===this.NIL)this.root=v;else if(u===u.p.l)u.p.l=v;else u.p.r=v;v.p=u.p; }

  insertSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: cloneRBT(this.root, this.NIL), hl, hlType: hlType||'visit' });
    let z = { k, red: true, l: this.NIL, r: this.NIL, p: this.NIL };
    let y = this.NIL, x = this.root;
    snap(`Start: insert ${k}`, null, 'visit');
    while (x !== this.NIL) {
      snap(`Visiting ${x.k} (${x.red?'RED':'BLACK'})`, x.k, 'visit');
      y = x; x = k < x.k ? x.l : x.r;
    }
    z.p = y;
    if (y === this.NIL) this.root = z;
    else if (k < y.k) y.l = z;
    else y.r = z;
    this.size++;
    snap(`Inserted ${k} as RED node`, k, 'insert');
    // fixup
    let cur = z;
    while (cur.p.red) {
      if (cur.p === cur.p.p.l) {
        let uncle = cur.p.p.r;
        if (uncle.red) {
          snap(`Uncle ${uncle.k} is RED — color flip at ${cur.p.p.k}`, cur.p.p.k, 'color');
          cur.p.red = false; uncle.red = false; cur.p.p.red = true; cur = cur.p.p;
          snap(`After flip: ${cur.k} is RED`, cur.k, 'color');
        } else {
          if (cur === cur.p.r) {
            cur = cur.p;
            snap(`Left-Right case: rotate left at ${cur.k}`, cur.k, 'rotate');
            this._rotL(cur);
          }
          snap(`Left-Left case: rotate right at ${cur.p.p.k}`, cur.p.p.k, 'rotate');
          cur.p.red = false; cur.p.p.red = true; this._rotR(cur.p.p);
          snap(`After rotation`, cur.k, 'rotate');
        }
      } else {
        let uncle = cur.p.p.l;
        if (uncle.red) {
          snap(`Uncle ${uncle.k} is RED — color flip at ${cur.p.p.k}`, cur.p.p.k, 'color');
          cur.p.red = false; uncle.red = false; cur.p.p.red = true; cur = cur.p.p;
          snap(`After flip: ${cur.k} is RED`, cur.k, 'color');
        } else {
          if (cur === cur.p.l) {
            cur = cur.p;
            snap(`Right-Left case: rotate right at ${cur.k}`, cur.k, 'rotate');
            this._rotR(cur);
          }
          snap(`Right-Right case: rotate left at ${cur.p.p.k}`, cur.p.p.k, 'rotate');
          cur.p.red = false; cur.p.p.red = true; this._rotL(cur.p.p);
          snap(`After rotation`, cur.k, 'rotate');
        }
      }
    }
    this.root.red = false;
    snap(`Done: root is BLACK. Size=${this.size}`, k, 'insert');
    return steps;
  }

  deleteSteps(k) {
    let steps = [];
    const NIL = this.NIL;
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: cloneRBT(this.root, NIL), hl, hlType: hlType||'visit' });
    snap(`Start: delete ${k}`, null, 'visit');

    // Find node
    let z = this.root;
    while (z !== NIL) {
      snap(`Visiting ${z.k}`, z.k, 'visit');
      if (k === z.k) break;
      z = k < z.k ? z.l : z.r;
    }
    if (z === NIL) { snap(`${k} not found`, null, 'visit'); return steps; }
    snap(`Found ${k}, removing`, z.k, 'delete');

    let y = z;
    let yOrigColor = y.red;
    let x;

    if (z.l === NIL) {
      x = z.r;
      this._trans(z, z.r);
    } else if (z.r === NIL) {
      x = z.l;
      this._trans(z, z.l);
    } else {
      y = this._min(z.r);
      yOrigColor = y.red;
      x = y.r;
      snap(`Inorder successor: ${y.k}`, y.k, 'visit');
      if (y.p !== z) {
        this._trans(y, y.r);
        y.r = z.r;
        y.r.p = y;
      } else {
        x.p = y; // x may be NIL — set its parent for fixup
      }
      this._trans(z, y);
      y.l = z.l;
      y.l.p = y;
      y.red = z.red;
    }
    this.size--;

    if (!yOrigColor) {
      snap(`Deleted node was BLACK — fix double-black`, null, 'color');
      let cur = x;
      while (cur !== this.root && !cur.red) {
        if (cur === cur.p.l) {
          let w = cur.p.r;
          if (w.red) {
            w.red = false; cur.p.red = true;
            this._rotL(cur.p); w = cur.p.r;
            snap(`Case 1: rotate left at ${cur.p.k}`, cur.p.k, 'rotate');
          }
          if (!w.l.red && !w.r.red) {
            w.red = true; cur = cur.p;
            snap(`Case 2: recolor sibling ${w.k} RED`, w.k, 'color');
          } else {
            if (!w.r.red) {
              w.l.red = false; w.red = true;
              this._rotR(w); w = cur.p.r;
              snap(`Case 3: rotate right at ${w.k}`, w.k, 'rotate');
            }
            w.red = cur.p.red; cur.p.red = false; w.r.red = false;
            this._rotL(cur.p); cur = this.root;
            snap(`Case 4: rotate left at ${cur.k}`, cur.k, 'rotate');
          }
        } else {
          let w = cur.p.l;
          if (w.red) {
            w.red = false; cur.p.red = true;
            this._rotR(cur.p); w = cur.p.l;
            snap(`Case 1: rotate right at ${cur.p.k}`, cur.p.k, 'rotate');
          }
          if (!w.r.red && !w.l.red) {
            w.red = true; cur = cur.p;
            snap(`Case 2: recolor sibling ${w.k} RED`, w.k, 'color');
          } else {
            if (!w.l.red) {
              w.r.red = false; w.red = true;
              this._rotL(w); w = cur.p.l;
              snap(`Case 3: rotate left at ${w.k}`, w.k, 'rotate');
            }
            w.red = cur.p.red; cur.p.red = false; w.l.red = false;
            this._rotR(cur.p); cur = this.root;
            snap(`Case 4: rotate right at ${cur.k}`, cur.k, 'rotate');
          }
        }
      }
      cur.red = false;
    }
    snap(`Done: delete complete. Size=${this.size}`, null, 'visit');
    return steps;
  }

  searchSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: cloneRBT(this.root, this.NIL), hl, hlType: hlType||'visit' });
    snap(`Start: search ${k}`, null, 'visit');
    let x = this.root;
    while (x !== this.NIL) {
      snap(`Visiting ${x.k} (${x.red?'RED':'BLACK'})`, x.k, 'visit');
      if (k === x.k) { snap(`Found ${k}!`, x.k, 'found'); return steps; }
      x = k < x.k ? x.l : x.r;
    }
    snap(`${k} not found`, null, 'visit');
    return steps;
  }

  insert(k) { this.insertSteps(k); }
  remove(k) { this.deleteSteps(k); }
  contains(k) { let x=this.root; while(x!==this.NIL){if(k===x.k)return true;x=k<x.k?x.l:x.r;} return false; }
  findMin() { if(this.root===this.NIL)return null; return this._min(this.root).k; }
  findMax() { let x=this.root; if(x===this.NIL)return null; while(x.r!==this.NIL)x=x.r; return x.k; }
  inorder() { let r=[]; const go=n=>{if(n===this.NIL)return;go(n.l);r.push(n.k);go(n.r);}; go(this.root); return r; }
  clear() { this.NIL.l=this.NIL.r=this.NIL.p=this.NIL; this.root=this.NIL; this.size=0; }
  isEmpty() { return this.root===this.NIL; }
}

// ═══════════════════════════════════════════════════
// BINARY HEAP (min-heap, array-based) with step recording
// ═══════════════════════════════════════════════════
class BinaryHeap {
  constructor() { this.data = []; this.size = 0; }
  _swap(i,j) { let t=this.data[i]; this.data[i]=this.data[j]; this.data[j]=t; }
  _siftUp(i) {
    while (i>0) { let p=(i-1)>>1; if(this.data[p]<=this.data[i])break; this._swap(p,i); i=p; }
  }
  _siftDown(i) {
    let n=this.size;
    for(;;){ let s=i,l=2*i+1,r=2*i+2;
      if(l<n&&this.data[l]<this.data[s])s=l;
      if(r<n&&this.data[r]<this.data[s])s=r;
      if(s===i)break; this._swap(i,s); i=s; }
  }

  insertSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, heap: this.data.slice(0,this.size), hl, hlType: hlType||'visit' });
    snap(`Start: insert ${k} at end (index ${this.size})`, k, 'insert');
    this.data[this.size++] = k;
    let i = this.size - 1;
    snap(`Sift up from index ${i}`, k, 'visit');
    while (i > 0) {
      let p = (i-1)>>1;
      snap(`Compare ${this.data[i]} with parent ${this.data[p]} at index ${p}`, this.data[i], 'visit');
      if (this.data[p] <= this.data[i]) { snap(`Parent ≤ child — heap property satisfied`, this.data[i], 'found'); break; }
      this._swap(p, i);
      snap(`Swap: ${this.data[p]} ↔ ${this.data[i]}`, this.data[p], 'rotate');
      i = p;
    }
    snap(`Done: ${k} inserted. Size=${this.size}`, k, 'insert');
    return steps;
  }

  extractMinSteps() {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, heap: this.data.slice(0,this.size), hl, hlType: hlType||'visit' });
    if (!this.size) { steps.push({ msg:'Heap is empty', heap:[], hl:null, hlType:'visit' }); return steps; }
    snap(`Extract min = ${this.data[0]} (root)`, this.data[0], 'delete');
    let min = this.data[0];
    this.data[0] = this.data[--this.size];
    snap(`Move last element ${this.data[0]} to root, sift down`, this.data[0], 'visit');
    let i = 0, n = this.size;
    for(;;) {
      let s=i, l=2*i+1, r=2*i+2;
      if(l<n&&this.data[l]<this.data[s])s=l;
      if(r<n&&this.data[r]<this.data[s])s=r;
      if(s===i){ snap(`Heap property satisfied at index ${i}`, this.data[i], 'found'); break; }
      snap(`Swap ${this.data[i]} with smaller child ${this.data[s]}`, this.data[i], 'rotate');
      this._swap(i,s); i=s;
    }
    snap(`Done: extracted ${min}. Size=${this.size}`, null, 'visit');
    return steps;
  }

  deleteSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, heap: this.data.slice(0,this.size), hl, hlType: hlType||'visit' });
    let idx = this.data.indexOf(k);
    if (idx === -1 || idx >= this.size) { snap(`${k} not found`, null, 'visit'); return steps; }
    snap(`Found ${k} at index ${idx}. Replace with last element`, k, 'delete');
    this.data[idx] = this.data[--this.size];
    snap(`Restore heap: sift up then down at index ${idx}`, this.data[idx], 'visit');
    this._siftUp(idx); this._siftDown(idx);
    snap(`Done. Size=${this.size}`, null, 'visit');
    return steps;
  }

  searchSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, heap: this.data.slice(0,this.size), hl, hlType: hlType||'visit' });
    snap(`Search ${k} — linear scan (O(n))`, null, 'visit');
    for (let i = 0; i < this.size; i++) {
      snap(`Check index ${i}: ${this.data[i]}`, this.data[i], 'visit');
      if (this.data[i] === k) { snap(`Found ${k} at index ${i}`, k, 'found'); return steps; }
    }
    snap(`${k} not found`, null, 'visit');
    return steps;
  }

  insert(k) { this.insertSteps(k); }
  remove(k) { this.deleteSteps(k); }
  findMin() { return this.size ? this.data[0] : null; }
  findMax() { let m=null; for(let i=0;i<this.size;i++)if(m===null||this.data[i]>m)m=this.data[i]; return m; }
  contains(k) { return this.data.indexOf(k) !== -1; }
  extractMin() { if(!this.size)return null; let m=this.data[0]; this.data[0]=this.data[--this.size]; if(this.size)this._siftDown(0); return m; }
  clear() { this.data=[]; this.size=0; }
  isEmpty() { return this.size===0; }
}

// ═══════════════════════════════════════════════════
// BINOMIAL HEAP with step recording
// ═══════════════════════════════════════════════════
class BinomHeap {
  constructor() { this.roots = []; this.size = 0; }
  _link(y,z){y.p=z;y.sib=z.child;z.child=y;z.deg++;}
  _merge(a,b){let res=[],i=0,j=0;while(i<a.length&&j<b.length){if(a[i].deg<=b[j].deg)res.push(a[i++]);else res.push(b[j++]);}while(i<a.length)res.push(a[i++]);while(j<b.length)res.push(b[j++]);return res;}
  // snap is optional — when provided, records each link step during consolidation
  _union(a, b, snap) {
    let h = this._merge(a, b);
    if (!h.length) return [];
    let i = 0;
    while (i + 1 < h.length) {
      let x = h[i], nx = h[i + 1];
      // Case 1: different degrees — advance
      if (x.deg !== nx.deg) { i++; continue; }
      // Case 3: three consecutive same degree — skip (carry handled next iteration)
      if (i + 2 < h.length && h[i + 2].deg === x.deg) { i++; continue; }
      // Case 2: link the two same-degree trees
      if (x.key <= nx.key) {
        this._link(nx, x);
        h.splice(i + 1, 1);
        if (snap) snap(`Link B${nx.deg-1}(${nx.key}) under B${x.deg-1}(${x.key}) → B${x.deg}(${x.key})`, x.key, h);
      } else {
        this._link(x, nx);
        h.splice(i, 1);
        if (snap) snap(`Link B${x.deg-1}(${x.key}) under B${nx.deg-1}(${nx.key}) → B${nx.deg}(${nx.key})`, nx.key, h);
      }
    }
    h.forEach(r => r.sib = null);
    return h;
  }

  insertSteps(k) {
    let steps = [];
    const snapH = (msg, hl, h) => steps.push({ msg, heap: (h || this.roots).map(r => cloneBH(r)), hl, hlType: 'visit' });
    snapH(`Start: insert ${k} as single B0 tree`, k);
    let n = { key: k, deg: 0, child: null, sib: null, p: null };
    const merged = this._merge(this.roots, [n]);
    if (merged.length > 1) snapH(`Merged root list (before consolidation): degrees [${merged.map(r=>r.deg).join(',')}]`, k, merged);
    this.roots = this._union(this.roots, [n], (msg, hl, h) => snapH(msg, hl, h));
    this.size++;
    snapH(`After consolidation — ${this.roots.length} root(s): degrees [${this.roots.map(r=>r.deg).join(',')}]`, k);
    snapH(`Done: ${k} inserted. Size=${this.size}`, k);
    return steps;
  }

  extractMinSteps() {
    let steps = [];
    const snapH = (msg, hl, h) => steps.push({ msg, heap: (h || this.roots).map(r => cloneBH(r)), hl, hlType: 'visit' });
    if (!this.roots.length) { steps.push({ msg: 'Heap is empty', heap: [], hl: null, hlType: 'visit' }); return steps; }
    let mi = 0;
    for (let i = 1; i < this.roots.length; i++) if (this.roots[i].key < this.roots[mi].key) mi = i;
    let mn = this.roots[mi];
    snapH(`Find minimum root: ${mn.key} (B${mn.deg} tree)`, mn.key);
    this.roots.splice(mi, 1);
    let ch = [], c = mn.child;
    while (c) { let nx = c.sib; c.sib = null; c.p = null; ch.unshift(c); c = nx; }
    snapH(`Remove ${mn.key}, promote its ${ch.length} children: degrees [${ch.map(r=>r.deg).join(',')||'none'}]`, mn.key);
    if (ch.length) {
      const merged = this._merge(this.roots, ch);
      if (merged.length > 1) snapH(`Merged root list before consolidation: degrees [${merged.map(r=>r.deg).join(',')}]`, null, merged);
    }
    this.roots = this._union(this.roots, ch, (msg, hl, h) => snapH(msg, hl, h));
    this.size--;
    snapH(`After consolidation. Size=${this.size}`, null);
    return steps;
  }

  deleteSteps(k) {
    let steps = [];
    const snapH = (msg, hl, h) => steps.push({ msg, heap: (h || this.roots).map(r => cloneBH(r)), hl, hlType: 'visit' });
    const find = n => { for (let x = n; x; x = x.sib) { if (x.key === k) return x; let r = x.child ? find(x.child) : null; if (r) return r; } return null; };
    let t = null; for (let r of this.roots) { let f = find(r); if (f) { t = f; break; } }
    if (!t) { snapH(`${k} not found`, null); return steps; }
    snapH(`Found ${k}, bubble up to root`, k);
    while (t.p) { let tmp = t.key; t.key = t.p.key; t.p.key = tmp; t = t.p; snapH(`Swap ${t.key} with parent`, t.key); }
    snapH(`${k} is now a root — extract it as minimum`, k);
    let mi = 0;
    for (let i = 1; i < this.roots.length; i++) if (this.roots[i].key < this.roots[mi].key) mi = i;
    let mn = this.roots[mi];
    this.roots.splice(mi, 1);
    let ch = [], c = mn.child;
    while (c) { let nx = c.sib; c.sib = null; c.p = null; ch.unshift(c); c = nx; }
    if (ch.length) {
      const merged = this._merge(this.roots, ch);
      if (merged.length > 1) snapH(`Merged root list before consolidation: degrees [${merged.map(r=>r.deg).join(',')}]`, null, merged);
    }
    this.roots = this._union(this.roots, ch, (msg, hl, h) => snapH(msg, hl, h));
    this.size--;
    snapH(`Done: ${k} deleted. Size=${this.size}`, null);
    return steps;
  }

  searchSteps(k) {
    let steps = [];
    const snap = (msg, hl) => steps.push({ msg, heap: this.roots.map(r=>cloneBH(r)), hl, hlType: 'visit' });
    snap(`Search ${k} — DFS across all binomial trees`, null);
    const dfs = n => {
      if (!n) return false;
      snap(`Visit node ${n.key} (B${n.deg})`, n.key);
      if (n.key === k) { snap(`Found ${k}!`, k); return true; }
      // Only descend if k could be in subtree (heap property: children >= parent)
      if (k >= n.key) {
        let c = n.child;
        while (c) { if (dfs(c)) return true; c = c.sib; }
      }
      return false;
    };
    let found = false;
    for (let r of this.roots) { if (dfs(r)) { found = true; break; } }
    if (!found) snap(`${k} not found`, null);
    return steps;
  }

  insert(k) { this.insertSteps(k); }
  findMin() { if(!this.roots.length)return null; return this.roots.reduce((m,r)=>r.key<m?r.key:m,this.roots[0].key); }
  extractMin() { if(!this.roots.length)return null; let mi=0; for(let i=1;i<this.roots.length;i++)if(this.roots[i].key<this.roots[mi].key)mi=i; let mn=this.roots[mi]; this.roots.splice(mi,1); let ch=[],c=mn.child; while(c){let nx=c.sib;c.sib=null;c.p=null;ch.unshift(c);c=nx;} this.roots=this._union(this.roots,ch); this.size--; return mn.key; }
  contains(k) { const sc=n=>{for(let x=n;x;x=x.sib){if(x.key===k)return true;if(x.child&&sc(x.child))return true;}return false;}; for(let r of this.roots)if(sc(r))return true; return false; }
  remove(k) { this.deleteSteps(k); }
  clear() { this.roots=[]; this.size=0; }
  isEmpty() { return this.roots.length===0; }

  decreaseKeySteps(oldKey, newKey) {
    let steps = [];
    const snap = (msg, hl) => steps.push({ msg, heap: this.roots.map(r=>cloneBH(r)), hl, hlType: 'visit' });
    if (newKey >= oldKey) { snap(`New key ${newKey} must be less than current key ${oldKey}`, null); return steps; }
    // Find the node
    const find = n => { for(let x=n;x;x=x.sib){if(x.key===oldKey)return x;let r=x.child?find(x.child):null;if(r)return r;} return null; };
    let t = null; for(let r of this.roots){let f=find(r);if(f){t=f;break;}}
    if (!t) { snap(`Key ${oldKey} not found`, null); return steps; }
    snap(`Found ${oldKey} — decrease to ${newKey}`, oldKey);
    t.key = newKey;
    snap(`Set key to ${newKey}, bubble up to restore heap order`, newKey);
    // Bubble up: swap with parent while parent > child
    while (t.p && t.key < t.p.key) {
      let tmp = t.key; t.key = t.p.key; t.p.key = tmp;
      snap(`Swap ${t.key} with parent ${t.p ? t.p.key : '?'}`, t.key);
      t = t.p;
    }
    snap(`Done: decrease key complete`, t.key);
    return steps;
  }
}

// ═══════════════════════════════════════════════════
// B+ TREE (order T=3) with step recording
// Data only in leaves; internal nodes hold separator keys.
// Leaf split: copy-up (key stays in right leaf).
// Internal split: push-up (middle key removed from child).
// Leaves are linked via .next for in-order traversal.
// ═══════════════════════════════════════════════════
class BTree {
  constructor() {
    this.T = 3;
    this.root = { keys:[], n:0, leaf:true, children:[], next:null };
    this.size = 0;
  }

  _clone(x) {
    if (!x) return null;
    return {
      keys: x.keys.slice(),
      n: x.n,
      leaf: x.leaf,
      next: null,
      children: x.leaf ? [] : x.children.map(c => this._clone(c))
    };
  }

  _contains(x, k) {
    if (x.leaf) {
      for (let i = 0; i < x.n; i++) if (x.keys[i] === k) return true;
      return false;
    }
    let i = 0;
    while (i < x.n && k >= x.keys[i]) i++;
    return this._contains(x.children[i], k);
  }

  _splitLeaf(x, i) {
    const T = this.T, y = x.children[i];
    const z = { keys:[], n:0, leaf:true, children:[], next: y.next };
    const mid = T - 1;
    z.keys = y.keys.slice(mid);
    z.n = z.keys.length;
    y.keys = y.keys.slice(0, mid);
    y.n = y.keys.length;
    y.next = z;
    x.keys.splice(i, 0, z.keys[0]);
    x.children.splice(i + 1, 0, z);
    x.n++;
  }

  _splitInternal(x, i) {
    const T = this.T, y = x.children[i];
    const mid = T - 1;
    const pushKey = y.keys[mid];
    const z = { keys: y.keys.slice(mid + 1), n: 0, leaf: false, children: y.children.slice(mid + 1), next: null };
    z.n = z.keys.length;
    y.keys = y.keys.slice(0, mid);
    y.n = y.keys.length;
    y.children = y.children.slice(0, mid + 1);
    x.keys.splice(i, 0, pushKey);
    x.children.splice(i + 1, 0, z);
    x.n++;
  }

  _insertNonFull(x, k) {
    if (x.leaf) {
      let i = x.n - 1;
      x.keys.push(0); x.n++;
      while (i >= 0 && k < x.keys[i]) { x.keys[i+1] = x.keys[i]; i--; }
      x.keys[i+1] = k;
    } else {
      let i = 0;
      while (i < x.n && k >= x.keys[i]) i++;
      const child = x.children[i];
      if (child.n === 2*this.T - 1) {
        if (child.leaf) this._splitLeaf(x, i);
        else this._splitInternal(x, i);
        if (k >= x.keys[i]) i++;
      }
      this._insertNonFull(x.children[i], k);
    }
  }

  _removeFromLeaf(x, k) {
    if (x.leaf) {
      const i = x.keys.indexOf(k);
      if (i === -1) return false;
      x.keys.splice(i, 1); x.n--;
      return true;
    }
    let i = 0;
    while (i < x.n && k >= x.keys[i]) i++;
    return this._removeFromLeaf(x.children[i], k);
  }

  _findMinLeaf() {
    let x = this.root;
    while (!x.leaf) x = x.children[0];
    return x.n > 0 ? x.keys[0] : null;
  }
  _findMaxLeaf() {
    let x = this.root;
    while (!x.leaf) x = x.children[x.n];
    return x.n > 0 ? x.keys[x.n - 1] : null;
  }
  _inorderLeaves() {
    let x = this.root;
    while (!x.leaf) x = x.children[0];
    const out = [];
    while (x) { for (let i = 0; i < x.n; i++) out.push(x.keys[i]); x = x.next; }
    return out;
  }

  insertSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: this._clone(this.root), hl, hlType: hlType||'visit' });
    if (this._contains(this.root, k)) { snap(`${k} already exists`, k, 'found'); return steps; }
    snap(`Insert ${k} — B+ Tree (T=${this.T}, max keys per node: ${2*this.T-1})`, null, 'visit');

    // Root overflow check before descent
    if (this.root.n === 2*this.T - 1) {
      snap(`Root overflow! Root has ${this.root.n} keys (max ${2*this.T-1}) — must split before inserting`, null, 'rotate');
      const s = { keys:[], n:0, leaf:false, children:[this.root], next:null };
      const oldRootKeys = this.root.keys.slice();
      if (this.root.leaf) {
        this._splitLeaf(s, 0);
        snap(`Leaf root split: left=[${s.children[0].keys.join(',')}], right=[${s.children[1].keys.join(',')}], copy-up key=${s.keys[0]}`, s.keys[0], 'rotate');
      } else {
        this._splitInternal(s, 0);
        snap(`Internal root split: left=[${s.children[0].keys.join(',')}], right=[${s.children[1].keys.join(',')}], push-up key=${s.keys[0]}`, s.keys[0], 'rotate');
      }
      this.root = s;
      snap(`New root created with separator [${s.keys.join(',')}] — tree height increased`, s.keys[0], 'insert');
    }

    // Instrumented descent — mirrors _insertNonFull but records each decision
    const descend = (x, k) => {
      if (x.leaf) {
        snap(`Reached leaf [${x.keys.join(',')}] — inserting ${k} in sorted position`, k, 'visit');
        let i = x.n - 1;
        x.keys.push(0); x.n++;
        while (i >= 0 && k < x.keys[i]) { x.keys[i+1] = x.keys[i]; i--; }
        x.keys[i+1] = k;
        snap(`Leaf after insert: [${x.keys.join(',')}]`, k, 'insert');
      } else {
        let i = 0;
        while (i < x.n && k >= x.keys[i]) i++;
        snap(`Internal node [${x.keys.join(',')}] — ${k} goes to child ${i}`, x.keys[Math.min(i, x.n-1)], 'visit');
        const child = x.children[i];
        if (child.n === 2*this.T - 1) {
          snap(`Child overflow! Child [${child.keys.join(',')}] has ${child.n} keys — split before descending`, child.keys[0], 'rotate');
          if (child.leaf) {
            const mid = this.T - 1;
            const splitKey = child.keys[mid];
            this._splitLeaf(x, i);
            snap(`Leaf split: left=[${x.children[i].keys.join(',')}], right=[${x.children[i+1].keys.join(',')}], copy-up key=${x.keys[i]}`, x.keys[i], 'rotate');
          } else {
            const mid = this.T - 1;
            const pushKey = child.keys[mid];
            this._splitInternal(x, i);
            snap(`Internal split: left=[${x.children[i].keys.join(',')}], right=[${x.children[i+1].keys.join(',')}], push-up key=${x.keys[i]}`, x.keys[i], 'rotate');
          }
          snap(`Parent [${x.keys.join(',')}] received promoted key — re-check which child to follow`, x.keys[i], 'color');
          if (k >= x.keys[i]) i++;
        }
        descend(x.children[i], k);
      }
    };
    descend(this.root, k);
    this.size++;
    snap(`Done: ${k} inserted. Tree size=${this.size}`, k, 'insert');
    return steps;
  }

  deleteSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: this._clone(this.root), hl, hlType: hlType||'visit' });
    if (!this._contains(this.root, k)) { snap(`${k} not found`, null, 'visit'); return steps; }
    snap(`Start: delete ${k} from leaf`, k, 'delete');
    this._removeFromLeaf(this.root, k);
    this.size--;
    snap(`Done: ${k} deleted. Size=${this.size}`, null, 'visit');
    return steps;
  }

  searchSteps(k) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: this._clone(this.root), hl, hlType: hlType||'visit' });
    snap(`Start: search ${k}`, null, 'visit');
    let x = this.root;
    while (!x.leaf) {
      let i = 0;
      while (i < x.n && k >= x.keys[i]) i++;
      snap(`Internal node [${x.keys.join(',')}] — descend child ${i}`, i > 0 ? x.keys[i-1] : x.keys[0], 'visit');
      x = x.children[i];
    }
    snap(`Reached leaf [${x.keys.join(',')}] — scanning`, null, 'visit');
    const found = x.keys.indexOf(k) !== -1;
    snap(found ? `Found ${k} in leaf` : `${k} not found`, found ? k : null, found ? 'found' : 'visit');
    return steps;
  }

  insert(k) { this.insertSteps(k); }
  remove(k) { this.deleteSteps(k); }
  contains(k) { return this._contains(this.root, k); }
  findMin() { return this._findMinLeaf(); }
  findMax() { return this._findMaxLeaf(); }
  inorder() { return this._inorderLeaves(); }
  clear() { this.root = { keys:[], n:0, leaf:true, children:[], next:null }; this.size = 0; }
  isEmpty() { return this.size === 0; }

  rangeQuerySteps(lo, hi) {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: this._clone(this.root), hl, hlType: hlType||'visit' });
    snap(`Range query [${lo}, ${hi}] — descend to first leaf`, null, 'visit');
    // Descend to the leaf where lo would be
    let x = this.root;
    while (!x.leaf) {
      let i = 0;
      while (i < x.n && lo >= x.keys[i]) i++;
      snap(`Internal [${x.keys.join(',')}] — go child ${i}`, i > 0 ? x.keys[i-1] : x.keys[0], 'visit');
      x = x.children[i];
    }
    snap(`Reached leaf [${x.keys.join(',')}] — scan for keys in [${lo},${hi}]`, null, 'visit');
    const result = [];
    // Walk leaf chain
    while (x) {
      for (let i = 0; i < x.n; i++) {
        const k = x.keys[i];
        if (k > hi) { snap(`Key ${k} > ${hi} — stop`, k, 'found'); x = null; break; }
        if (k >= lo) {
          result.push(k);
          snap(`Key ${k} in range — collect`, k, 'found');
        } else {
          snap(`Key ${k} < ${lo} — skip`, k, 'visit');
        }
      }
      if (x) x = x.next;
    }
    snap(`Range query done. Result: [${result.join(', ')}]`, null, 'visit');
    return steps;
  }

  sequentialSteps() {
    let steps = [];
    const snap = (msg, hl, hlType) => steps.push({ msg, tree: this._clone(this.root), hl, hlType: hlType||'visit' });
    snap(`Sequential traversal — follow leaf linked list`, null, 'visit');
    let x = this.root;
    while (!x.leaf) x = x.children[0];
    let leafNum = 0;
    while (x) {
      snap(`Leaf ${leafNum}: [${x.keys.join(',')}]`, x.keys[0] ?? null, 'visit');
      for (let i = 0; i < x.n; i++) snap(`  Key: ${x.keys[i]}`, x.keys[i], 'found');
      x = x.next; leafNum++;
    }
    snap(`Sequential traversal complete`, null, 'visit');
    return steps;
  }
}

// ═══════════════════════════════════════════════════
// RENDERER
// ═══════════════════════════════════════════════════
const NS = 'http://www.w3.org/2000/svg';
const R = 24;
const LEVEL_H = 72;
const MIN_SEP = 16;

const HL_COLORS = {
  visit:  '#f59e0b',
  insert: '#6366f1',
  found:  '#6366f1',
  delete: '#ef4444',
  rotate: '#38bdf8',
  color:  '#a78bfa',
};

function svgEl(tag, a) {
  let e = document.createElementNS(NS, tag);
  for (let [k, v] of Object.entries(a)) e.setAttribute(k, v);
  return e;
}

function drawNode(svg, cx, cy, label, baseFill, hlType, extra, keepFill) {
  let fill = (hlType && !keepFill) ? HL_COLORS[hlType] : baseFill;
  let g = document.createElementNS(NS, 'g');
  if (hlType) {
    let ringColor = HL_COLORS[hlType] || baseFill;
    g.appendChild(svgEl('circle', { cx, cy, r: R + 6, fill: 'none', stroke: ringColor, 'stroke-width': '2.5', opacity: '0.45' }));
  }
  g.appendChild(svgEl('circle', { cx, cy, r: R, fill, stroke: '#0f172a', 'stroke-width': '2' }));
  let t = svgEl('text', { x: cx, y: cy + 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: '#fff', 'font-size': '13', 'font-weight': '700' });
  t.textContent = label;
  g.appendChild(t);
  if (extra) {
    let e = svgEl('text', { x: cx, y: cy - R - 7, 'text-anchor': 'middle', fill: '#94a3b8', 'font-size': '10' });
    e.textContent = extra;
    g.appendChild(e);
  }
  svg.appendChild(g);
}

function drawEdge(svg, x1, y1, x2, y2, col) {
  let dx = x2-x1, dy = y2-y1, len = Math.sqrt(dx*dx+dy*dy);
  if (!len) return;
  let ux = dx/len, uy = dy/len;
  svg.insertBefore(svgEl('line', {
    x1: x1+ux*R, y1: y1+uy*R, x2: x2-ux*R, y2: y2-uy*R,
    stroke: col||'#475569', 'stroke-width': '2'
  }), svg.firstChild);
}

function computeWidth(n, isNil) {
  if (!n || isNil(n)) return 0;
  let lw = computeWidth(n.l, isNil);
  let rw = computeWidth(n.r, isNil);
  n._lw = lw; n._rw = rw;
  let hasL = n.l && !isNil(n.l), hasR = n.r && !isNil(n.r);
  if (!hasL && !hasR) { n._w = R*2; return n._w; }
  let w = R*2;
  if (hasL) w += lw + MIN_SEP;
  if (hasR) w += rw + MIN_SEP;
  n._w = w;
  return w;
}

function assignXY(n, isNil, cx, depth) {
  if (!n || isNil(n)) return;
  n._x = cx;
  n._y = depth * LEVEL_H + R + 30;
  let hasL = n.l && !isNil(n.l), hasR = n.r && !isNil(n.r);
  if (hasL && hasR) {
    assignXY(n.l, isNil, cx - (R + MIN_SEP + n._rw/2), depth+1);
    assignXY(n.r, isNil, cx + (R + MIN_SEP + n._lw/2), depth+1);
  } else if (hasL) {
    assignXY(n.l, isNil, cx - (R + MIN_SEP), depth+1);
  } else if (hasR) {
    assignXY(n.r, isNil, cx + (R + MIN_SEP), depth+1);
  }
}

function layoutTree(root, isNil, svgW) {
  if (!root || isNil(root)) return;
  computeWidth(root, isNil);
  let cx = Math.max((svgW||800)/2, root._w/2 + 20);
  assignXY(root, isNil, cx, 0);
  let minX = Infinity;
  const walk = n => { if (!n||isNil(n)) return; minX=Math.min(minX,n._x); walk(n.l); walk(n.r); };
  walk(root);
  if (minX < R+10) {
    let sh = R+10-minX;
    const shift = n => { if (!n||isNil(n)) return; n._x+=sh; shift(n.l); shift(n.r); };
    shift(root);
  }
}

function drawBSTTree(svg, root, isNil, baseFillFn, hlKey, hlType, extraFn, keepFill) {
  if (!root || isNil(root)) return;
  layoutTree(root, isNil, +svg.getAttribute('width')||800);
  const drawE = n => {
    if (!n||isNil(n)) return;
    if (n.l&&!isNil(n.l)) { drawEdge(svg,n._x,n._y,n.l._x,n.l._y); drawE(n.l); }
    if (n.r&&!isNil(n.r)) { drawEdge(svg,n._x,n._y,n.r._x,n.r._y); drawE(n.r); }
  };
  drawE(root);
  const drawN = n => {
    if (!n||isNil(n)) return;
    drawN(n.l); drawN(n.r);
    drawNode(svg, n._x, n._y, n.k, baseFillFn(n), n.k===hlKey?hlType:null, extraFn?extraFn(n):null, keepFill);
  };
  drawN(root);
}

function fitSVG(svg) {
  let cs = svg.querySelectorAll('circle');
  let mx = 500, my = 250;
  cs.forEach(c => { mx=Math.max(mx,+c.getAttribute('cx')+R+30); my=Math.max(my,+c.getAttribute('cy')+R+30); });
  svg.setAttribute('width', mx); svg.setAttribute('height', my);
}

function renderAVLSnap(svg, tree, hl, hlType) {
  svg.innerHTML = '';
  if (!tree) return;
  drawBSTTree(svg, tree, n=>!n, ()=>'#10b981', hl, hlType,
    n=>{ let lh=n.l?n.l.h:0, rh=n.r?n.r.h:0; return 'bf:'+(lh-rh); });
  fitSVG(svg);
}

function renderRBTSnap(svg, tree, hl, hlType) {
  svg.innerHTML = '';
  if (!tree) return;
  drawBSTTree(svg, tree, n=>!n, n=>n.red?'#dc2626':'#1a1a2e', hl, hlType, null, true);
  fitSVG(svg);
}

function renderBinaryHeapSnap(svg, heap, hl, hlType) {
  svg.innerHTML = '';
  if (!heap || !heap.length) return;
  // Draw as a complete binary tree from the array
  const n = heap.length;
  const depth = Math.floor(Math.log2(n)) + 1;
  const W = Math.max(800, Math.pow(2, depth) * (R*2 + MIN_SEP));
  svg.setAttribute('width', W);
  // Assign positions
  const pos = [];
  for (let i = 0; i < n; i++) {
    const d = Math.floor(Math.log2(i+1));
    const posInLevel = i - (Math.pow(2,d) - 1);
    const totalInLevel = Math.pow(2, d);
    const x = (posInLevel + 0.5) * (W / totalInLevel);
    const y = d * LEVEL_H + R + 30;
    pos.push({ x, y });
  }
  // Draw edges first
  for (let i = 1; i < n; i++) {
    const p = Math.floor((i-1)/2);
    drawEdge(svg, pos[p].x, pos[p].y, pos[i].x, pos[i].y);
  }
  // Draw nodes
  for (let i = 0; i < n; i++) {
    const isHl = heap[i] === hl;
    drawNode(svg, pos[i].x, pos[i].y, heap[i], '#0ea5e9', isHl ? hlType : null, `[${i}]`);
  }
  fitSVG(svg);
}

// B+ Tree renderer — draws each node as a multi-key rectangle
// Leaves are styled differently (lighter border); internal nodes show separator keys.
// Edges use index-based child lookup (not reference equality on cloned nodes).
function renderBTreeSnap(svg, root, hl, hlType) {
  svg.innerHTML = '';
  if (!root || root.n === 0) return;

  const NODE_H  = 32;
  const CELL_W  = 36;   // px per key cell
  const PAD     = 12;   // horizontal padding inside node
  const GAP     = 20;   // minimum gap between sibling nodes
  const NODE_W  = k => Math.max(40, k * CELL_W + PAD);

  // BFS — build layout entries
  const layout  = [];
  const byDepth = [];
  const queue   = [{ node: root, depth: 0 }];
  while (queue.length) {
    const { node, depth } = queue.shift();
    if (!byDepth[depth]) byDepth[depth] = [];
    const entry = { node, depth, x: 0, y: depth * (NODE_H + 54) + 30 };
    byDepth[depth].push(entry);
    layout.push(entry);
    if (!node.leaf)
      for (let i = 0; i <= node.n; i++)
        queue.push({ node: node.children[i], depth: depth + 1 });
  }

  // Compute the minimum canvas width needed by the widest level
  // Each level needs: sum(node widths) + (count+1)*GAP
  let minW = 800;
  for (const level of byDepth) {
    const totalNodeW = level.reduce((s, e) => s + NODE_W(e.node.n), 0);
    const needed = totalNodeW + (level.length + 1) * GAP;
    if (needed > minW) minW = needed;
  }
  const svgW = minW;

  // Assign x positions level by level, spacing nodes by their actual widths
  for (const level of byDepth) {
    const totalNodeW = level.reduce((s, e) => s + NODE_W(e.node.n), 0);
    const totalGap   = svgW - totalNodeW;
    const gap        = totalGap / (level.length + 1);
    let cursor = 0;
    for (const e of level) {
      const nw = NODE_W(e.node.n);
      cursor += gap;
      e.x = cursor + nw / 2;   // centre of this node
      cursor += nw;
    }
  }

  // Draw edges using index-based child tracking
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
        if (ce) drawEdge(svg, e.x, e.y + NODE_H/2, ce.x, ce.y - NODE_H/2, '#475569');
      }
    }
  }

  // Leaf link arrows (→ between adjacent leaves)
  const leaves = layout.filter(e => e.node.leaf);
  for (let i = 0; i < leaves.length - 1; i++) {
    const a = leaves[i], b = leaves[i + 1];
    const arr = document.createElementNS(NS, 'line');
    arr.setAttribute('x1', a.x + NODE_W(a.node.n) / 2); arr.setAttribute('y1', a.y);
    arr.setAttribute('x2', b.x - NODE_W(b.node.n) / 2); arr.setAttribute('y2', b.y);
    arr.setAttribute('stroke', '#38bdf8'); arr.setAttribute('stroke-width', '1.5');
    arr.setAttribute('stroke-dasharray', '4 3');
    svg.appendChild(arr);
  }

  // Draw nodes
  for (const e of layout) {
    const { node, x, y } = e;
    const nw = NODE_W(node.n);
    const rx = x - nw / 2;
    const isLeaf = node.leaf;

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', rx); rect.setAttribute('y', y - NODE_H/2);
    rect.setAttribute('width', nw); rect.setAttribute('height', NODE_H);
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', isLeaf ? '#0f2a1a' : '#1e293b');
    rect.setAttribute('stroke', isLeaf ? '#10b981' : '#334155');
    rect.setAttribute('stroke-width', isLeaf ? '2' : '1.5');
    svg.appendChild(rect);

    const cellW = nw / node.n;
    for (let i = 0; i < node.n; i++) {
      const kx = rx + i * cellW + cellW / 2;
      const isHl = node.keys[i] === hl;
      if (isHl) {
        const hr = document.createElementNS(NS, 'rect');
        hr.setAttribute('x', rx + i * cellW); hr.setAttribute('y', y - NODE_H/2);
        hr.setAttribute('width', cellW); hr.setAttribute('height', NODE_H);
        hr.setAttribute('rx', '4');
        hr.setAttribute('fill', HL_COLORS[hlType] || HL_COLORS.visit);
        hr.setAttribute('opacity', '0.75');
        svg.appendChild(hr);
      }
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', kx); t.setAttribute('y', y + 1);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('fill', isLeaf ? '#6ee7b7' : '#fff');
      t.setAttribute('font-size', '13'); t.setAttribute('font-weight', '700');
      t.textContent = node.keys[i];
      svg.appendChild(t);
      if (i < node.n - 1) {
        const div = document.createElementNS(NS, 'line');
        div.setAttribute('x1', rx + (i+1)*cellW); div.setAttribute('y1', y - NODE_H/2);
        div.setAttribute('x2', rx + (i+1)*cellW); div.setAttribute('y2', y + NODE_H/2);
        div.setAttribute('stroke', '#334155'); div.setAttribute('stroke-width', '1');
        svg.appendChild(div);
      }
    }
    if (isLeaf) {
      const lbl = document.createElementNS(NS, 'text');
      lbl.setAttribute('x', rx - 4); lbl.setAttribute('y', y + 1);
      lbl.setAttribute('text-anchor', 'end'); lbl.setAttribute('dominant-baseline', 'middle');
      lbl.setAttribute('fill', '#10b981'); lbl.setAttribute('font-size', '9');
      lbl.textContent = 'L';
      svg.appendChild(lbl);
    }
  }

  let maxY = 0;
  layout.forEach(e => { maxY = Math.max(maxY, e.y + NODE_H/2 + 20); });
  svg.setAttribute('width', svgW); svg.setAttribute('height', maxY);
}

function layoutBinomNode(n, depth, xOff) {
  if (!n) return xOff;
  let c = n.child, xs = [];
  while (c) {
    xOff = layoutBinomNode(c, depth+1, xOff);
    xs.push(c._x);
    c = c.sib;
    if (c) xOff += MIN_SEP;
  }
  n._x = xs.length ? (xs[0]+xs[xs.length-1])/2 : (xOff+R);
  n._y = depth*LEVEL_H + R + 30;
  return xs.length ? xOff : xOff + R*2;
}

function drawBinomTree(svg, n, hl, isRoot) {
  if (!n) return;
  let c = n.child;
  while (c) { drawEdge(svg,n._x,n._y,c._x,c._y,'#7dd3fc'); drawBinomTree(svg,c,hl,false); c=c.sib; }
  // Degree label: offset to the right to avoid overlapping the parent edge
  let g = document.createElementNS(NS, 'g');
  let fill = (n.key===hl) ? HL_COLORS['visit'] : '#0ea5e9';
  if (n.key===hl) {
    g.appendChild(svgEl('circle', { cx:n._x, cy:n._y, r:R+6, fill:'none', stroke:HL_COLORS['visit'], 'stroke-width':'2.5', opacity:'0.45' }));
  }
  g.appendChild(svgEl('circle', { cx:n._x, cy:n._y, r:R, fill, stroke:'#0f172a', 'stroke-width':'2' }));
  let t = svgEl('text', { x:n._x, y:n._y+1, 'text-anchor':'middle', 'dominant-baseline':'middle', fill:'#fff', 'font-size':'13', 'font-weight':'700' });
  t.textContent = n.key;
  g.appendChild(t);
  let lbl = svgEl('text', { x:n._x+R+6, y:n._y-R+4, 'text-anchor':'start', fill:'#7dd3fc', 'font-size':'9', 'font-weight':'600' });
  lbl.textContent = 'B'+n.deg;
  g.appendChild(lbl);
  svg.appendChild(g);
}

function renderBinomSnap(svg, heap, hl) {
  svg.innerHTML = '';
  if (!heap||!heap.length) return;
  // Deduplicate roots by reference to guard against any structural anomalies
  const seen = new Set();
  const roots = heap.filter(r => { if (seen.has(r)) return false; seen.add(r); return true; });
  let xOff = R+10;
  // Two-pass: layout first, then draw, so all _x/_y are set before edges are drawn
  for (let r of roots) { xOff = layoutBinomNode(r,0,xOff); xOff += R*3 + MIN_SEP*2; }
  for (let r of roots) { drawBinomTree(svg,r,hl,true); }
  fitSVG(svg);
}

function layoutFibNode(n, depth, xOff) {
  if (!n) return xOff;
  let xs = [];
  if (n.children) for (let c of n.children) { xOff = layoutFibNode(c,depth+1,xOff); xs.push(c._x); xOff += MIN_SEP; }
  n._x = xs.length ? (xs[0]+xs[xs.length-1])/2 : (xOff+R);
  n._y = depth*LEVEL_H + R + 30;
  return xs.length ? xOff : xOff + R*2;
}

function drawFibNode(svg, n, hl) {
  if (!n) return;
  if (n.children) for (let c of n.children) { drawEdge(svg,n._x,n._y,c._x,c._y,'#c4b5fd'); drawFibNode(svg,c,hl); }
  drawNode(svg, n._x, n._y, n.key, '#7c3aed', n.key===hl?'visit':null, n.isMin?'min':null);
}

function renderFibSnap(svg, roots, hl) {
  svg.innerHTML = '';
  if (!roots||!roots.length) return;
  let xOff = R+10;
  for (let r of roots) { xOff = layoutFibNode(r,0,xOff); drawFibNode(svg,r,hl); xOff += MIN_SEP*3; }
  fitSVG(svg);
}

function renderStep(svg, dsKey, step) {
  if (!step) { svg.innerHTML = ''; return; }
  switch (dsKey) {
    case 'avl':   renderAVLSnap(svg, step.tree, step.hl, step.hlType); break;
    case 'rbt':   renderRBTSnap(svg, step.tree, step.hl, step.hlType); break;
    case 'bheap': renderBinaryHeapSnap(svg, step.heap, step.hl, step.hlType); break;
    case 'binom': renderBinomSnap(svg, step.heap, step.hl); break;
    case 'btree': renderBTreeSnap(svg, step.tree, step.hl, step.hlType); break;
  }
}

// ═══════════════════════════════════════════════════
// UI CONTROLLER
// ═══════════════════════════════════════════════════
const COLORS = { avl:'#10b981', rbt:'#ef4444', bheap:'#0ea5e9', binom:'#38bdf8', btree:'#a78bfa' };
const CFG = {
  avl:   { label:'AVL Tree',       ops:['Insert','Delete','Search','Find Min','Find Max','Inorder'] },
  rbt:   { label:'Red-Black Tree', ops:['Insert','Delete','Search','Find Min','Find Max','Inorder'] },
  bheap: { label:'Binary Heap',    ops:['Insert','Extract Min','Find Min','Find Max','Delete','Search'] },
  binom: { label:'Binomial Heap',  ops:['Insert','Extract Min','Find Min','Delete','Search','Decrease Key','Merge'] },
  btree: { label:'B+ Tree (T=3)',  ops:['Insert','Delete','Search','Find Min','Find Max','Inorder','Range Query','Sequential'] },
};
const DS = { avl: new AVLTree(), rbt: new RBTree(), bheap: new BinaryHeap(), binom: new BinomHeap(), btree: new BTree() };

let curDS = 'avl', curOp = 'Insert';
let steps = [], stepIdx = 0, playing = false, playTimer = null;

// DOM refs — assigned inside DOMContentLoaded
let svg, opGrid, valInput, valInput2, goBtn, infoBox, logList, stepLabel, speedRange, speedVal, toastEl;

function showToast(m) { toastEl.textContent=m; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'),2000); }
function clearLog() { logList.innerHTML=''; }
function pushLog(msg, cls) {
  let d = document.createElement('div');
  d.className = 'log-entry' + (cls ? ' ' + cls : '');
  d.textContent = msg;
  logList.appendChild(d);
  logList.scrollTop = logList.scrollHeight;
}

// Rebuild the log panel to show all steps, highlighting the current one
function rebuildLog() {
  logList.innerHTML = '';
  steps.forEach((s, i) => {
    let d = document.createElement('div');
    d.className = 'log-entry' + (i === stepIdx ? ' active-step' : '');
    d.textContent = `${i+1}. ${s.msg}`;
    d.onclick = () => applyStep(i);
    logList.appendChild(d);
  });
  let active = logList.querySelector('.active-step');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function applyStep(i) {
  if (!steps.length) return;
  stepIdx = Math.max(0, Math.min(i, steps.length - 1));
  let s = steps[stepIdx];
  renderStep(svg, curDS, s);
  stepLabel.textContent = `Step ${stepIdx+1}/${steps.length}: ${s.msg}`;
  rebuildLog();
}

function stepPrev() { if (stepIdx > 0) applyStep(stepIdx - 1); }
function stepNext() { if (stepIdx < steps.length - 1) applyStep(stepIdx + 1); }

function togglePlay() {
  playing = !playing;
  document.getElementById('play-btn').textContent = playing ? '⏸ Pause' : '▶ Play';
  if (playing) playLoop(); else clearTimeout(playTimer);
}
function playLoop() {
  if (!playing) return;
  if (stepIdx >= steps.length - 1) { playing=false; document.getElementById('play-btn').textContent='▶ Play'; return; }
  stepNext();
  playTimer = setTimeout(playLoop, +speedRange.value);
}

function setCur(id) { document.documentElement.style.setProperty('--cur', COLORS[id] || '#6366f1'); }

function switchDS(id) {
  if (DS[curDS]) DS[curDS].clear();
  curDS = id; curOp = 'Insert'; steps = []; stepIdx = 0;
  if (svg) svg.innerHTML = '';
  clearLog();
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.ds === id));
  const isCmp = id === 'cmp';
  document.getElementById('cmp-panel').style.display    = isCmp ? 'block' : 'none';
  document.getElementById('sidebar').style.display      = isCmp ? 'none'  : 'flex';
  document.getElementById('canvas-area').style.display  = isCmp ? 'none'  : 'flex';
  document.getElementById('log-panel').style.display    = isCmp ? 'none'  : 'flex';
  if (isCmp) return;
  setCur(id);
  buildOps();
  let snap = makeCurrentSnap();
  if (snap) { steps = [snap]; applyStep(0); } else { svg.innerHTML = ''; stepLabel.textContent = '-'; }
  updateInfoBar();
}

function makeCurrentSnap() {
  const ds = DS[curDS];
  switch (curDS) {
    case 'avl':   return ds.root ? { msg:'Current state', tree: cloneBST(ds.root), hl:null, hlType:null } : null;
    case 'rbt':   return ds.root!==ds.NIL ? { msg:'Current state', tree: cloneRBT(ds.root,ds.NIL), hl:null, hlType:null } : null;
    case 'bheap': return ds.size ? { msg:'Current state', heap: ds.data.slice(0,ds.size), hl:null, hlType:null } : null;
    case 'binom': return ds.roots.length ? { msg:'Current state', heap: ds.roots.map(r=>cloneBH(r)), hl:null } : null;
    case 'btree': return ds.root && ds.root.n > 0 ? { msg:'Current state', tree: ds._clone(ds.root), hl:null, hlType:null } : null;
  }
  return null;
}

function buildOps() {
  opGrid.innerHTML = '';
  CFG[curDS].ops.forEach(op => {
    let b = document.createElement('button');
    b.className = 'op-btn' + (op === curOp ? ' active' : '');
    b.textContent = op;
    b.onclick = () => setOp(op);
    opGrid.appendChild(b);
  });
}

function setOp(op) {
  curOp = op;
  document.querySelectorAll('.op-btn').forEach(b => b.classList.toggle('active', b.textContent === op));
  const needsVal  = ['Insert','Delete','Search','Merge','Decrease Key','Range Query'].includes(op);
  const needsVal2 = ['Decrease Key','Range Query'].includes(op);
  valInput.style.visibility  = needsVal  ? 'visible' : 'hidden';
  goBtn.style.visibility     = needsVal  ? 'visible' : 'hidden';
  valInput2.style.display    = needsVal2 ? 'inline-block' : 'none';
  valInput.placeholder = op === 'Range Query' ? 'From...' : op === 'Decrease Key' ? 'Old key...' : 'Value... (Enter)';
  if (!needsVal) primaryAction();
}

function primaryAction() {
  const ds = DS[curDS];
  const val = parseInt(valInput.value);
  const isBinom = curDS === 'binom';
  const isAccum = curDS === 'binom' || curDS === 'btree';
  if (!isAccum) { steps = []; stepIdx = 0; }
  let newSteps = [];

  switch (curOp) {
    case 'Insert':
      if (isNaN(val)) { showToast('Enter a value'); return; }
      newSteps = ds.insertSteps(val);
      valInput.value = '';
      break;
    case 'Delete':
      if (isNaN(val)) { showToast('Enter a value'); return; }
      newSteps = ds.deleteSteps ? ds.deleteSteps(val) : [];
      if (!newSteps.length) { let s=makeCurrentSnap(); newSteps=s?[s]:[]; }
      valInput.value = '';
      break;
    case 'Search':
      if (isNaN(val)) { showToast('Enter a value'); return; }
      newSteps = ds.searchSteps ? ds.searchSteps(val) : [];
      break;
    case 'Find Min': {
      let m = ds.findMin();
      let s = makeCurrentSnap();
      newSteps = s ? [{ ...s, msg: m!=null?`Min = ${m}`:'Empty', hl: m, hlType:'found' }] : [{ msg: m!=null?`Min = ${m}`:'Empty', heap:null, hl:null }];
      break;
    }
    case 'Find Max': {
      let m = ds.findMax ? ds.findMax() : null;
      let s = makeCurrentSnap();
      newSteps = s ? [{ ...s, msg: m!=null?`Max = ${m}`:'Empty', hl: m, hlType:'found' }] : [{ msg: 'Empty', heap:null, hl:null }];
      break;
    }
    case 'Inorder': {
      let arr = ds.inorder ? ds.inorder() : [];
      let s = makeCurrentSnap();
      newSteps = s ? [{ ...s, msg:`Inorder: [${arr.join(', ')}]` }] : [{ msg:'Empty', heap:null, hl:null }];
      break;
    }
    case 'Extract Min':
      newSteps = ds.extractMinSteps ? ds.extractMinSteps() : [];
      if (!newSteps.length) { let s=makeCurrentSnap(); newSteps=s?[s]:[{ msg:'Empty', heap:null, hl:null }]; }
      break;
    case 'Merge': {
      const rawVals = valInput.value.trim();
      const mergeVals = rawVals
        ? rawVals.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        : [10, 20, 30];
      let mergeSteps = [];
      const snapM = (msg, hl, h) => mergeSteps.push({ msg, heap: (h || DS.binom.roots).map(r => cloneBH(r)), hl, hlType: 'visit' });
      let tmp = new BinomHeap();
      mergeVals.forEach(x => tmp.insert(x));
      snapM(`Built second heap [${mergeVals.join(',')}] — ${tmp.roots.length} root(s)`, null, tmp.roots);
      snapM(`Before merge — main heap has ${DS.binom.roots.length} root(s)`, null);
      const preMerge = DS.binom._merge(DS.binom.roots, tmp.roots);
      if (preMerge.length) snapM(`Merged root list (before consolidation): degrees [${preMerge.map(r=>r.deg).join(',')}]`, null, preMerge);
      DS.binom.roots = DS.binom._union(DS.binom.roots, tmp.roots, (msg, hl, h) => snapM(msg, hl, h));
      DS.binom.size += tmp.size;
      snapM(`After consolidation — ${DS.binom.roots.length} root(s). Size=${DS.binom.size}`, null);
      newSteps = mergeSteps;
      valInput.value = '';
      break;
    }
    case 'Range Query': {
      const lo = parseInt(valInput.value), hi = parseInt(valInput2.value);
      if (isNaN(lo) || isNaN(hi)) { showToast('Enter From and To values'); return; }
      newSteps = DS.btree.rangeQuerySteps(Math.min(lo,hi), Math.max(lo,hi));
      valInput.value = ''; valInput2.value = '';
      break;
    }
    case 'Sequential':
      newSteps = DS.btree.sequentialSteps();
      break;
    case 'Decrease Key': {
      const oldK = parseInt(valInput.value), newK = parseInt(valInput2.value);
      if (isNaN(oldK) || isNaN(newK)) { showToast('Enter old key and new key'); return; }
      newSteps = DS.binom.decreaseKeySteps(oldK, newK);
      valInput.value = ''; valInput2.value = '';
      break;
    }
  }

  if (isAccum && newSteps.length) {
    steps = steps.concat(newSteps);
    stepIdx = steps.length - 1;
    applyStep(stepIdx);
  } else if (!isAccum && newSteps.length) {
    steps = newSteps;
    applyStep(steps.length - 1);
  }
  updateInfoBar();
}
  const ds = DS[curDS]; const cfg = CFG[curDS];
  let mn = null, mx = null;
  try { mn = ds.findMin(); } catch(e) {}
  try { mx = ds.findMax ? ds.findMax() : null; } catch(e) {}
  infoBox.innerHTML = `<b>${cfg.label}</b><br>Size: <span>${ds.size}</span>` +
    (mn!=null?`<br>Min: <span>${mn}</span>`:'') + (mx!=null?`<br>Max: <span>${mx}</span>`:'');
}

// ═══════════════════════════════════════════════════
// DATASET RUNNER
// ═══════════════════════════════════════════════════
let dsOps = [];
let dsRunning = false;
let dsTimer   = null;
let dsOpIdx   = 0;
let dsAllSteps = [];
let dsOpBoundaries = [];

function parseDsFile(text) {
  const ops = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(INSERT|SEARCH|DELETE)\s+(-?\d+)/i);
    if (m) ops.push({ type: m[1].toUpperCase(), value: parseInt(m[2]) });
  }
  return ops;
}

function dsMapOp(ds, type, value) {
  switch (type) {
    case 'INSERT': return ds.insertSteps ? ds.insertSteps(value) : [];
    case 'SEARCH': return ds.searchSteps ? ds.searchSteps(value) : [];
    case 'DELETE':
      if (curDS === 'bheap' || curDS === 'binom')
        return ds.extractMinSteps ? ds.extractMinSteps() : [];
      return ds.deleteSteps ? ds.deleteSteps(value) : [];
  }
  return [];
}

function dsReset() {
  dsRunning = false;
  clearTimeout(dsTimer);
  dsTimer = null;
  dsOpIdx = 0;
  dsAllSteps = [];
  dsOpBoundaries = [];
}

function dsStop() {
  dsReset();
  document.getElementById('ds-run-btn').disabled   = dsOps.length === 0;
  document.getElementById('ds-run-btn').textContent = '▶ Run Dataset';
  document.getElementById('ds-stop-btn').style.display = 'none';
  document.getElementById('ds-progress').textContent = 'Stopped.';
}

function dsRun() {
  if (!dsOps.length) return;
  DS[curDS].clear();
  steps = []; stepIdx = 0;
  dsReset();
  dsRunning = true;

  document.getElementById('ds-run-btn').textContent  = 'Running…';
  document.getElementById('ds-run-btn').disabled     = true;
  document.getElementById('ds-stop-btn').style.display = 'inline-block';

  const ds = DS[curDS];
  for (let i = 0; i < dsOps.length; i++) {
    const { type, value } = dsOps[i];
    const opSteps = dsMapOp(ds, type, value);
    if (opSteps.length) {
      dsOpBoundaries.push({ label: `${type} ${value}`, startIdx: dsAllSteps.length });
      dsAllSteps = dsAllSteps.concat(opSteps);
    }
  }

  if (!dsAllSteps.length) {
    document.getElementById('ds-progress').textContent = 'No executable operations.';
    dsStop();
    return;
  }

  steps = dsAllSteps;
  stepIdx = 0;
  applyStep(0);
  updateInfoBar();

  function tick() {
    if (!dsRunning) return;
    if (stepIdx >= steps.length - 1) {
      document.getElementById('ds-progress').textContent =
        `Done — ${dsOps.length} ops, ${steps.length} steps`;
      dsStop();
      document.getElementById('ds-run-btn').disabled = false;
      document.getElementById('ds-run-btn').textContent = '▶ Run Dataset';
      updateInfoBar();
      return;
    }
    stepNext();
    let curBound = dsOpBoundaries[0];
    for (const b of dsOpBoundaries) {
      if (b.startIdx <= stepIdx) curBound = b;
      else break;
    }
    const opNum = dsOpBoundaries.indexOf(curBound) + 1;
    document.getElementById('ds-progress').textContent =
      `Op ${opNum}/${dsOpBoundaries.length}: ${curBound.label} — step ${stepIdx+1}/${steps.length}`;
    dsTimer = setTimeout(tick, +speedRange.value);
  }
  tick();
}

document.addEventListener('DOMContentLoaded', () => {
  // Assign all DOM refs here — after DOM is ready
  svg        = document.getElementById('main-svg');
  opGrid     = document.getElementById('op-grid');
  valInput   = document.getElementById('val-input');
  valInput2  = document.getElementById('val-input2');
  goBtn      = document.getElementById('go-btn');
  infoBox    = document.getElementById('info-box');
  logList    = document.getElementById('log-list');
  stepLabel  = document.getElementById('step-label');
  speedRange = document.getElementById('speed-range');
  speedVal   = document.getElementById('speed-val');
  toastEl    = document.getElementById('toast');

  // Wire up all event listeners
  goBtn.onclick = primaryAction;
  valInput.addEventListener('keydown', e => { if (e.key === 'Enter') primaryAction(); });
  valInput2.addEventListener('keydown', e => { if (e.key === 'Enter') primaryAction(); });
  speedRange.addEventListener('input', () => { speedVal.textContent = speedRange.value + 'ms'; });

  document.getElementById('random-btn').onclick = () => {
    const ds = DS[curDS];
    steps = []; stepIdx = 0;
    let allSteps = [];
    for (let i = 0; i < 8; i++) {
      let v = Math.floor(Math.random()*150)+1;
      let s = ds.insertSteps(v);
      allSteps = allSteps.concat(s);
    }
    steps = allSteps;
    if (steps.length) applyStep(steps.length - 1);
    updateInfoBar();
  };

  document.getElementById('clear-btn').onclick = () => {
    DS[curDS].clear(); steps = []; stepIdx = 0;
    svg.innerHTML = ''; stepLabel.textContent = '-';
    clearLog(); updateInfoBar();
    pushLog('Cleared', 'ok');
  };

  document.getElementById('prev-btn').onclick = stepPrev;
  document.getElementById('next-btn').onclick = stepNext;
  document.getElementById('play-btn').onclick = togglePlay;
  document.querySelectorAll('.tab').forEach(t => { t.onclick = () => switchDS(t.dataset.ds); });

  switchDS('avl');

  // ── Dataset runner wiring ──────────────────────────────────────
  const dsFileInput  = document.getElementById('ds-file-input');
  const dsFileLabel  = document.getElementById('ds-file-label');
  const dsFileName   = document.getElementById('ds-file-name');
  const dsStatus     = document.getElementById('ds-status');
  const dsRunBtn     = document.getElementById('ds-run-btn');
  const dsStopBtn    = document.getElementById('ds-stop-btn');

  dsFileLabel.onclick = () => dsFileInput.click();

  dsFileInput.addEventListener('change', () => {
    const file = dsFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      dsOps = parseDsFile(e.target.result);
      dsFileName.textContent = file.name;
      if (dsOps.length) {
        const ins = dsOps.filter(o=>o.type==='INSERT').length;
        const srch = dsOps.filter(o=>o.type==='SEARCH').length;
        const del  = dsOps.filter(o=>o.type==='DELETE').length;
        dsStatus.textContent = `${dsOps.length} ops: ${ins}I ${srch}S ${del}D`;
        dsFileLabel.classList.add('loaded');
        dsRunBtn.disabled = false;
      } else {
        dsStatus.textContent = 'No valid operations found.';
        dsFileLabel.classList.remove('loaded');
        dsRunBtn.disabled = true;
      }
      document.getElementById('ds-progress').textContent = '';
    };
    reader.readAsText(file);
    dsFileInput.value = '';
  });

  dsRunBtn.onclick  = dsRun;
  dsStopBtn.onclick = dsStop;
});
