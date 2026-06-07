// ---------------------------------------------------
// STEP-RECORDING DATA STRUCTURES
// Each operation records snapshots: {msg, tree, highlight, state}
// tree = deep-cloned node tree at that moment
// highlight = {node: key, type: 'visit'|'insert'|'rotate'|'found'|'delete'|'color'}
// ---------------------------------------------------

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

// ---------------------------------------------------
// AVL TREE with step recording
// ---------------------------------------------------
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

// ---------------------------------------------------
// RED-BLACK TREE with step recording
// ---------------------------------------------------
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

// ---------------------------------------------------
// BINARY HEAP (min-heap, array-based) with step recording
// ---------------------------------------------------
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
      if (this.data[p] <= this.data[i]) { snap(`Parent = child — heap property satisfied`, this.data[i], 'found'); break; }
      this._swap(p, i);
      snap(`Swap: ${this.data[p]} ? ${this.data[i]}`, this.data[p], 'rotate');
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

// ---------------------------------------------------
// BINOMIAL HEAP with step recording
// ---------------------------------------------------
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
        if (snap) snap(`Link B${nx.deg-1}(${nx.key}) under B${x.deg-1}(${x.key}) ? B${x.deg}(${x.key})`, x.key, h);
      } else {
        this._link(x, nx);
        h.splice(i, 1);
        if (snap) snap(`Link B${x.deg-1}(${x.key}) under B${nx.deg-1}(${nx.key}) ? B${nx.deg}(${nx.key})`, nx.key, h);
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

// ---------------------------------------------------
// B+ TREE (order T=3) with step recording
// Data only in leaves; internal nodes hold separator keys.
// Leaf split: copy-up (key stays in right leaf).
// Internal split: push-up (middle key removed from child).
// Leaves are linked via .next for in-order traversal.
// ---------------------------------------------------
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

// ---------------------------------------------------

// ---------------------------------------------------
// METRICS INSTRUMENTATION (prototype patches)
// ---------------------------------------------------
function _mkMetrics() { return { comparisons:0, rotations:0, swaps:0, splits:0 }; }

(function patchAVL() {
  const p = AVLTree.prototype;
  const oL=p._rotL, oR=p._rotR;
  p._rotL = function(x){ this.metrics&&this.metrics.rotations++; return oL.call(this,x); };
  p._rotR = function(y){ this.metrics&&this.metrics.rotations++; return oR.call(this,y); };
  ['insertSteps','deleteSteps','searchSteps'].forEach(m=>{
    const o=p[m]; p[m]=function(k){ this.metrics=_mkMetrics(); const s=o.call(this,k);
      s.forEach(x=>{ if(/Comparing|Visiting|go left|go right/i.test(x.msg))this.metrics.comparisons++; });
      if(s.length)s[s.length-1].metrics={...this.metrics}; return s; };
  });
})();

(function patchRBT() {
  const p = RBTree.prototype;
  const oL=p._rotL, oR=p._rotR;
  p._rotL = function(x){ this.metrics&&this.metrics.rotations++; return oL.call(this,x); };
  p._rotR = function(y){ this.metrics&&this.metrics.rotations++; return oR.call(this,y); };
  ['insertSteps','deleteSteps','searchSteps'].forEach(m=>{
    const o=p[m]; if(!o)return; p[m]=function(k){ this.metrics=_mkMetrics(); const s=o.call(this,k);
      s.forEach(x=>{ if(/Visiting/i.test(x.msg))this.metrics.comparisons++; });
      if(s.length)s[s.length-1].metrics={...this.metrics}; return s; };
  });
})();

(function patchBHeap() {
  const p = BinaryHeap.prototype;
  const oSw=p._swap;
  p._swap = function(i,j){ this.metrics&&this.metrics.swaps++; oSw.call(this,i,j); };
  ['insertSteps','extractMinSteps','deleteSteps','searchSteps'].forEach(m=>{
    const o=p[m]; if(!o)return; p[m]=function(k){ this.metrics=_mkMetrics(); const s=o.call(this,k);
      s.forEach(x=>{ if(/Compare/i.test(x.msg))this.metrics.comparisons++; });
      if(s.length)s[s.length-1].metrics={...this.metrics}; return s; };
  });
})();

(function patchBinom() {
  const p = BinomHeap.prototype;
  ['insertSteps','extractMinSteps','deleteSteps','searchSteps'].forEach(m=>{
    const o=p[m]; if(!o)return; p[m]=function(k){ this.metrics=_mkMetrics(); const s=o.call(this,k);
      s.forEach(x=>{ if(/Link|Visit/i.test(x.msg))this.metrics.comparisons++; });
      if(s.length)s[s.length-1].metrics={...this.metrics}; return s; };
  });
})();

(function patchBTree() {
  const p = BTree.prototype;
  ['insertSteps','deleteSteps','searchSteps'].forEach(m=>{
    const o=p[m]; if(!o)return; p[m]=function(k){ this.metrics=_mkMetrics(); const s=o.call(this,k);
      s.forEach(x=>{
        if(/Internal node|Reached leaf/i.test(x.msg))this.metrics.comparisons++;
        if(/split/i.test(x.msg)&&!/After/i.test(x.msg))this.metrics.splits++;
      });
      if(s.length)s[s.length-1].metrics={...this.metrics}; return s; };
  });
})();

// ---------------------------------------------------
// THREADED BINARY TREE
// ---------------------------------------------------
class ThreadedBST {
  constructor(){ this.root=null; this.size=0; this.metrics=_mkMetrics(); }
  _cloneTBT(n){ if(!n)return null; return {k:n.k,lThread:n.lThread,rThread:n.rThread,lThreadTarget:n.lThread&&n.l?n.l.k:null,rThreadTarget:n.rThread&&n.r?n.r.k:null,l:n.lThread?null:this._cloneTBT(n.l),r:n.rThread?null:this._cloneTBT(n.r)}; }
  insertSteps(k){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,tree:this._cloneTBT(this.root),hl,hlType:hlType||'visit'});
    snap(`Insert ${k}`,null,'visit');
    if(!this.root){this.root={k,l:null,r:null,lThread:false,rThread:false};this.size++;snap(`${k} is root`,k,'insert');steps[steps.length-1].metrics={...this.metrics};return steps;}
    let cur=this.root,par=null,goLeft=false;
    while(cur){this.metrics.comparisons++;snap(`Compare ${k} with ${cur.k}`,cur.k,'visit');
      if(k===cur.k){snap(`${k} exists`,cur.k,'found');return steps;}
      par=cur;
      if(k<cur.k){goLeft=true;if(cur.lThread||!cur.l)break;cur=cur.l;}
      else{goLeft=false;if(cur.rThread||!cur.r)break;cur=cur.r;}
    }
    const node={k,l:null,r:null,lThread:false,rThread:false};
    if(goLeft){node.l=par.l;node.lThread=par.lThread;node.r=par;node.rThread=true;par.l=node;par.lThread=false;snap(`${k} left of ${par.k}, thread?${par.k}`,k,'insert');}
    else{node.r=par.r;node.rThread=par.rThread;node.l=par;node.lThread=true;par.r=node;par.rThread=false;snap(`${k} right of ${par.k}, thread?${par.k}`,k,'insert');}
    this.size++;snap(`Done. Size=${this.size}`,k,'insert');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  searchSteps(k){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,tree:this._cloneTBT(this.root),hl,hlType:hlType||'visit'});
    snap(`Search ${k}`,null,'visit');let n=this.root;
    while(n){this.metrics.comparisons++;snap(`Visit ${n.k}`,n.k,'visit');
      if(k===n.k){snap(`Found ${k}!`,n.k,'found');steps[steps.length-1].metrics={...this.metrics};return steps;}
      if(k<n.k){if(n.lThread||!n.l)break;n=n.l;}else{if(n.rThread||!n.r)break;n=n.r;}
    }
    snap(`${k} not found`,null,'visit');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  deleteSteps(k){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,tree:this._cloneTBT(this.root),hl,hlType:hlType||'visit'});
    const vals=this._inorder().filter(v=>v!==k);
    if(vals.length===this._inorder().length){snap(`${k} not found`,null,'visit');return steps;}
    snap(`Delete ${k} — rebuild`,k,'delete');this.root=null;this.size=0;
    for(const v of vals)this.insertSteps(v);
    snap(`Done. Size=${this.size}`,null,'visit');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  _inorder(){const out=[];let n=this.root;if(!n)return out;while(n.l&&!n.lThread)n=n.l;while(n){out.push(n.k);if(n.rThread)n=n.r;else{n=n.r;if(!n)break;while(n.l&&!n.lThread)n=n.l;}}return out;}
  findMin(){if(!this.root)return null;let n=this.root;while(n.l&&!n.lThread)n=n.l;return n.k;}
  findMax(){if(!this.root)return null;let n=this.root;while(n.r&&!n.rThread)n=n.r;return n.k;}
  inorder(){return this._inorder();}
  clear(){this.root=null;this.size=0;}
  isEmpty(){return!this.root;}
  insert(k){this.insertSteps(k);}
  remove(k){this.deleteSteps(k);}
}

// ---------------------------------------------------
// TRIE
// ---------------------------------------------------
class Trie {
  constructor(){this.root={ch:'',children:{},isEnd:false,id:'root'};this.size=0;this._id=0;this.metrics=_mkMetrics();}
  _cloneTrie(n){if(!n)return null;return{ch:n.ch,isEnd:n.isEnd,id:n.id,children:Object.fromEntries(Object.entries(n.children).map(([c,ch])=>[c,this._cloneTrie(ch)]))};}
  insertSteps(word){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,tree:this._cloneTrie(this.root),hl,hlType:hlType||'visit'});
    word=String(word);snap(`Insert "${word}"`,null,'visit');
    let node=this.root;
    for(let i=0;i<word.length;i++){const ch=word[i];this.metrics.comparisons++;
      if(!node.children[ch]){node.children[ch]={ch,children:{},isEnd:false,id:`n${++this._id}`};snap(`Create '${ch}' depth ${i+1}`,node.children[ch].id,'insert');}
      else snap(`'${ch}' exists depth ${i+1}`,node.children[ch].id,'visit');
      node=node.children[ch];
    }
    if(!node.isEnd){node.isEnd=true;this.size++;}
    snap(`End of "${word}". Size=${this.size}`,node.id,'found');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  searchSteps(word){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,tree:this._cloneTrie(this.root),hl,hlType:hlType||'visit'});
    word=String(word);snap(`Search "${word}"`,null,'visit');let node=this.root;
    for(let i=0;i<word.length;i++){const ch=word[i];this.metrics.comparisons++;
      if(!node.children[ch]){snap(`'${ch}' not found`,null,'delete');steps[steps.length-1].metrics={...this.metrics};return steps;}
      snap(`Follow '${ch}' depth ${i+1}`,node.children[ch].id,'visit');node=node.children[ch];
    }
    snap(node.isEnd?`Found "${word}"!`:`Prefix only`,node.id,node.isEnd?'found':'visit');
    steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  deleteSteps(word){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,tree:this._cloneTrie(this.root),hl,hlType:hlType||'visit'});
    word=String(word);snap(`Delete "${word}"`,null,'visit');
    const del=(node,w,d)=>{if(!node)return false;if(d===w.length){if(!node.isEnd){snap(`Not found`,null,'visit');return false;}node.isEnd=false;this.size--;snap(`Unmarked "${w}"`,node.id,'delete');return Object.keys(node.children).length===0;}
      const ch=w[d];if(!node.children[ch]){snap(`'${ch}' not found`,null,'visit');return false;}
      snap(`Descend '${ch}'`,node.children[ch].id,'visit');const sd=del(node.children[ch],w,d+1);
      if(sd){delete node.children[ch];snap(`Pruned '${ch}'`,node.id,'delete');return!node.isEnd&&Object.keys(node.children).length===0;}return false;};
    del(this.root,word,0);snap(`Done. Size=${this.size}`,null,'visit');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  findMin(){return null;}findMax(){return null;}
  inorder(){const out=[];const dfs=(n,p)=>{if(n.isEnd)out.push(p);Object.entries(n.children).sort().forEach(([c,ch])=>dfs(ch,p+c));};dfs(this.root,'');return out;}
  clear(){this.root={ch:'',children:{},isEnd:false,id:'root'};this.size=0;this._id=0;}
  isEmpty(){return this.size===0;}
  insert(w){this.insertSteps(w);}remove(w){this.deleteSteps(w);}
}

// ---------------------------------------------------
// SKIP LIST
// ---------------------------------------------------
class SkipList {
  constructor(){this.MAX=6;this.p=0.5;this.level=1;this.size=0;this.metrics=_mkMetrics();this.head=this._node(-Infinity,this.MAX);}
  _node(k,l){return{k,next:new Array(l).fill(null)};}
  _randLevel(){let l=1;while(Math.random()<this.p&&l<this.MAX)l++;return l;}
  _cloneSkip(){const levels=[];for(let i=0;i<this.level;i++){const row=[];let c=this.head.next[i];while(c){row.push(c.k);c=c.next[i];}levels.push(row);}return{levels,maxLevel:this.level};}
  insertSteps(k){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,structure:this._cloneSkip(),hl,hlType:hlType||'visit'});
    snap(`Insert ${k}`,null,'visit');const upd=new Array(this.MAX).fill(this.head);let cur=this.head;
    for(let i=this.level-1;i>=0;i--){while(cur.next[i]&&cur.next[i].k<k){this.metrics.comparisons++;snap(`L${i}: ${cur.next[i].k}<${k} advance`,cur.next[i].k,'visit');cur=cur.next[i];}upd[i]=cur;}
    if(cur.next[0]&&cur.next[0].k===k){snap(`${k} exists`,k,'found');steps[steps.length-1].metrics={...this.metrics};return steps;}
    const nl=this._randLevel();if(nl>this.level){for(let i=this.level;i<nl;i++)upd[i]=this.head;this.level=nl;}
    const node=this._node(k,nl);for(let i=0;i<nl;i++){node.next[i]=upd[i].next[i];upd[i].next[i]=node;}
    this.size++;snap(`Inserted ${k} at ${nl} levels. Size=${this.size}`,k,'insert');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  searchSteps(k){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,structure:this._cloneSkip(),hl,hlType:hlType||'visit'});
    snap(`Search ${k}`,null,'visit');let cur=this.head;
    for(let i=this.level-1;i>=0;i--){while(cur.next[i]&&cur.next[i].k<k){this.metrics.comparisons++;snap(`L${i}: ${cur.next[i].k}<${k}`,cur.next[i].k,'visit');cur=cur.next[i];}
      if(cur.next[i]&&cur.next[i].k===k){snap(`Found ${k} at L${i}!`,k,'found');steps[steps.length-1].metrics={...this.metrics};return steps;}}
    snap(`${k} not found`,null,'visit');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  deleteSteps(k){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,structure:this._cloneSkip(),hl,hlType:hlType||'visit'});
    snap(`Delete ${k}`,null,'visit');const upd=new Array(this.MAX).fill(this.head);let cur=this.head;
    for(let i=this.level-1;i>=0;i--){while(cur.next[i]&&cur.next[i].k<k)cur=cur.next[i];upd[i]=cur;}
    const t=cur.next[0];if(!t||t.k!==k){snap(`${k} not found`,null,'visit');return steps;}
    snap(`Unlink ${k}`,k,'delete');for(let i=0;i<this.level;i++){if(upd[i].next[i]!==t)break;upd[i].next[i]=t.next[i];}
    while(this.level>1&&!this.head.next[this.level-1])this.level--;
    this.size--;snap(`Done. Size=${this.size}`,null,'visit');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  findMin(){return this.head.next[0]?this.head.next[0].k:null;}
  findMax(){let n=this.head;while(n.next[0])n=n.next[0];return n===this.head?null:n.k;}
  inorder(){const out=[];let n=this.head.next[0];while(n){out.push(n.k);n=n.next[0];}return out;}
  clear(){this.head=this._node(-Infinity,this.MAX);this.level=1;this.size=0;}
  isEmpty(){return this.size===0;}
  insert(k){this.insertSteps(k);}remove(k){this.deleteSteps(k);}
}

// ---------------------------------------------------
// SUFFIX TREE (simplified)
// ---------------------------------------------------
class SuffixTree {
  constructor(){this.text='';this.root=null;this.size=0;this._id=0;this.metrics=_mkMetrics();}
  _node(label){return{id:`sn${++this._id}`,label:label||'',children:{},isLeaf:false,suffixIdx:-1};}
  _cloneSuffix(n){if(!n)return null;return{id:n.id,label:n.label,isLeaf:n.isLeaf,suffixIdx:n.suffixIdx,children:Object.fromEntries(Object.entries(n.children).map(([c,ch])=>[c,this._cloneSuffix(ch)]))};}
  _build(text){
    this._id=0;const root=this._node('');
    for(let i=0;i<text.length;i++){const suf=text.slice(i)+'$';let node=root,j=0;
      while(j<suf.length){const ch=suf[j];if(!node.children[ch]){const lf=this._node(suf.slice(j));lf.isLeaf=true;lf.suffixIdx=i;node.children[ch]=lf;break;}
        let child=node.children[ch],k=0;while(k<child.label.length&&j<suf.length&&child.label[k]===suf[j]){k++;j++;}
        if(k===child.label.length){node=child;continue;}
        const sp=this._node(child.label.slice(0,k));child.label=child.label.slice(k);sp.children[child.label[0]]=child;node.children[ch]=sp;
        if(j<suf.length){const nl=this._node(suf.slice(j));nl.isLeaf=true;nl.suffixIdx=i;sp.children[suf[j]]=nl;}else{sp.isLeaf=true;sp.suffixIdx=i;}break;}}
    return root;
  }
  insertSteps(text){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,tree:this._cloneSuffix(this.root),hl,hlType:hlType||'visit'});
    text=String(text);snap(`Build suffix tree for "${text}"`,null,'visit');
    this.text=text;this.root=this._build(text);this.size=text.length;
    for(let i=0;i<text.length;i++)snap(`Suffix[${i}]: "${text.slice(i)}$"`,null,'insert');
    snap(`Built — ${text.length} suffixes`,null,'found');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  searchSteps(pattern){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,tree:this._cloneSuffix(this.root),hl,hlType:hlType||'visit'});
    pattern=String(pattern);snap(`Search "${pattern}"`,null,'visit');
    if(!this.root){snap('Empty',null,'visit');return steps;}
    let node=this.root,i=0;
    while(i<pattern.length){const ch=pattern[i];this.metrics.comparisons++;
      if(!node.children[ch]){snap(`'${ch}' not found`,null,'delete');steps[steps.length-1].metrics={...this.metrics};return steps;}
      const child=node.children[ch];snap(`Follow "${child.label}"`,child.id,'visit');
      let k=0;while(k<child.label.length&&i<pattern.length){if(child.label[k]!==pattern[i]){snap(`Mismatch`,child.id,'delete');steps[steps.length-1].metrics={...this.metrics};return steps;}k++;i++;}
      node=child;}
    snap(`Found "${pattern}"!`,node.id,'found');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  deleteSteps(k){return[{msg:'Suffix tree rebuilt on insert',tree:this._cloneSuffix(this.root),hl:null,hlType:'visit'}];}
  findMin(){return null;}findMax(){return null;}inorder(){return[];}
  clear(){this.root=null;this.text='';this.size=0;this._id=0;}
  isEmpty(){return!this.root;}
  insert(t){this.insertSteps(t);}remove(k){this.deleteSteps(k);}
}

// ---------------------------------------------------
// R-TREE (basic 2D)
// ---------------------------------------------------
class RTree {
  constructor(){this.MAX=4;this.root={rects:[],children:[],isLeaf:true,mbr:null};this.size=0;this.metrics=_mkMetrics();}
  _mbr(rects){if(!rects.length)return null;let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;for(const r of rects){x1=Math.min(x1,r.x);y1=Math.min(y1,r.y);x2=Math.max(x2,r.x+r.w);y2=Math.max(y2,r.y+r.h);}return{x:x1,y:y1,w:x2-x1,h:y2-y1};}
  _area(r){return r?r.w*r.h:0;}
  _enl(mbr,rect){if(!mbr)return rect.w*rect.h;const nm=this._mbr([mbr,rect]);return this._area(nm)-this._area(mbr);}
  _cloneNode(n){if(!n)return null;return{rects:n.rects.map(r=>({...r})),children:n.children.map(c=>this._cloneNode(c)),isLeaf:n.isLeaf,mbr:n.mbr?{...n.mbr}:null};}
  _parse(val){if(typeof val==='string'){const p=val.split(',').map(Number);if(p.length>=4&&p.every(n=>!isNaN(n)))return{x:p[0],y:p[1],w:p[2],h:p[3],label:`R${this.size+1}`};}const v=parseInt(val)||(this.size+1);return{x:(v*30)%300,y:(v*20)%200,w:40,h:30,label:`R${v}`};}
  insertSteps(val){
    this.metrics=_mkMetrics(); const steps=[];
    const snap=(msg,hl,hlType)=>steps.push({msg,structure:this._cloneNode(this.root),hl,hlType:hlType||'visit'});
    const rect=this._parse(val);snap(`Insert ${rect.label}`,null,'visit');
    this._ins(this.root,rect,snap);this.size++;
    snap(`Done. Size=${this.size}`,null,'insert');steps[steps.length-1].metrics={...this.metrics};return steps;
  }
  _ins(node,rect,snap){
    if(node.isLeaf){node.rects.push(rect);node.mbr=this._mbr(node.rects);snap(`Added to leaf (${node.rects.length})`,null,'insert');
      if(node.rects.length>this.MAX){snap(`Overflow — split`,null,'rotate');node.rects.sort((a,b)=>a.x-b.x);node.rects=node.rects.slice(0,this.MAX);node.mbr=this._mbr(node.rects);}}
    else{let best=0,bestE=Infinity;for(let i=0;i<node.children.length;i++){this.metrics.comparisons++;const e=this._enl(node.children[i].mbr,rect);if(e<bestE){bestE=e;best=i;}}
      snap(`Choose child ${best}`,null,'visit');this._ins(node.children[best],rect,snap);node.mbr=this._mbr(node.children.map(c=>c.mbr).filter(Boolean));}
  }
  searchSteps(k){this.metrics=_mkMetrics();return[{msg:`R-Tree: ${this.size} rect(s)`,structure:this._cloneNode(this.root),hl:null,hlType:'visit',metrics:{...this.metrics}}];}
  deleteSteps(k){return[{msg:'Delete not implemented',structure:this._cloneNode(this.root),hl:null,hlType:'visit'}];}
  findMin(){return null;}findMax(){return null;}inorder(){return[];}
  clear(){this.root={rects:[],children:[],isLeaf:true,mbr:null};this.size=0;}
  isEmpty(){return this.size===0;}
  insert(k){this.insertSteps(k);}remove(k){this.deleteSteps(k);}
}
