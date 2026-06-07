# Work Distribution — Advanced Data Structures Project

## Team Overview

The project implements 5 data structures from scratch in C, with a complete pipeline
covering benchmarking, dataset generation, testing, visualization, and documentation.
Work is divided so each member owns one data structure end-to-end, plus a set of
shared project responsibilities matched to their strengths.

---

## Member Assignments

---

### Member 1 — AVL Tree
**Primary Data Structure:** `src/avl_tree.h`

**What is an AVL Tree?**
An AVL Tree (Adelson-Velsky & Landis, 1962) is a self-balancing binary search tree
where the height difference between the left and right subtrees of every node is at
most 1. This strict balance guarantee keeps the tree height at ≤ 1.44 log₂ n,
making it the shortest of all balanced BSTs and therefore the fastest for lookups.

**Implementation responsibilities:**
- `avl_insert` — recursive BST insert followed by `avl_balance()` on the way back up
- `avl_remove` — 3 structural cases (leaf, one child, two children via in-order successor)
- `avl_contains` — iterative BST search
- `avl_find_min` / `avl_extract_min` — leftmost node traversal
- Rotation primitives: `avl_rotate_left`, `avl_rotate_right`
- Balance function: handles all 4 cases — LL, LR, RL, RR

**Correctness invariants to maintain:**
- Balance factor = height(left) − height(right) ∈ {−1, 0, +1} at every node
- BST ordering: left subtree keys < node key < right subtree keys
- Height field updated correctly after every rotation

**Tests to write** (in `tests/test_properties.c`):
- Insert n random values, verify balance factor at every node
- Delete all values, verify tree is empty
- Insert duplicates, verify size does not change
- Verify in-order traversal produces sorted output

**Extra role — Project Lead:**
- Coordinates integration between all members
- Resolves merge conflicts in shared files
- Maintains `docs/README.md` and `docs/PROJECT_REPORT.docx` structure
- Final assembly of the project report

---

### Member 2 — Red-Black Tree
**Primary Data Structure:** `src/red_black_tree.h`

**What is a Red-Black Tree?**
A Red-Black Tree (CLRS Chapter 13) is a self-balancing BST where each node carries
a color bit (RED or BLACK). Five invariants — including equal black-height on all
root-to-leaf paths — guarantee the tree height stays ≤ 2 log₂(n+1). It allows at
most 2 rotations per insert and 3 per delete, making writes faster than AVL.

**Implementation responsibilities:**
- `rbt_insert` — BST insert + `rbt_insert_fixup` (6 cases: 3 left, 3 right mirror)
- `rbt_remove` — 3 structural cases (A, B, C with sub-cases C1/C2) + `rbt_delete_fixup` (8 cases)
- `rbt_contains` — iterative BST search
- `rbt_find_min` / `rbt_extract_min`
- Rotation primitives: `rbt_rotate_left`, `rbt_rotate_right`
- NIL sentinel node management

**Correctness invariants to maintain:**
1. Every node is RED or BLACK
2. Root is BLACK
3. Every NIL leaf is BLACK
4. RED node → both children are BLACK
5. All root-to-leaf paths have equal black-height

**Tests to write:**
- Verify black-height is equal on all paths after every insert
- Verify no two consecutive RED nodes exist
- Verify root is always BLACK
- Verify BST ordering is preserved

**Extra role — Benchmarking Lead:**
- Owns `benchmarks/benchmark.c` — the multi-size timing harness
- Implements the `now_ns()` high-resolution timer (Windows + Linux)
- Defines the `BenchResult` struct and per-DS runner functions
- Produces the `BENCH_DATA` JSON block consumed by `dashboard.html`
- Runs benchmarks at n = 1,000 / 10,000 / 100,000 and records results

---

### Member 3 — Binary Heap
**Primary Data Structure:** `src/binary_heap.h`

**What is a Binary Heap?**
A Binary Heap is a complete binary tree stored as a flat array. The min-heap property
requires every parent to be ≤ both its children. Because the tree is complete, parent
and child indices are computed arithmetically (no pointers needed), making it extremely
cache-friendly. Find-Min is O(1) — the minimum is always at index 0.

**Implementation responsibilities:**
- `bheap_insert` — append to end, sift-up until heap property restored
- `bheap_extract_min` — swap root with last element, shrink, sift-down
- `bheap_find_min` — return `data[0]`
- `bheap_contains` — linear scan O(n)
- `bheap_remove` — find by value, replace with last, sift-up then sift-down
- Dynamic array resizing (doubling strategy)

**Correctness invariants to maintain:**
- `data[parent(i)] ≤ data[i]` for all i > 0
- `parent(i) = (i−1)/2`, `left(i) = 2i+1`, `right(i) = 2i+2`
- Size field tracks number of valid elements (not array capacity)

**Tests to write:**
- Insert n values, verify `find_min()` always returns the global minimum
- Extract all values, verify they come out in sorted (ascending) order
- Verify heap property holds at every index after random inserts/deletes

**Extra role — Dataset & Build Lead:**
- Owns `benchmarks/generate_dataset.py` — the dataset generator
- Owns `benchmarks/run_dataset.c` — the single-dataset comparison runner
- Owns `benchmarks/Makefile` — build targets for all executables
- Maintains `data/dataset.txt` format specification
- See the **Dataset & Pipeline** section below for full details

---

### Member 4 — Binomial Heap
**Primary Data Structure:** `src/binomial_heap.h`

**What is a Binomial Heap?**
A Binomial Heap (CLRS Chapter 19) is a forest of binomial trees Bₖ, where Bₖ has
2ᵏ nodes and height k. The forest contains at most ⌊log₂ n⌋ + 1 trees — one per
set bit in the binary representation of n. Its key advantage over Binary Heap is
O(log n) merge, which enables efficient implementations of Dijkstra's algorithm
and Prim's MST.

**Implementation responsibilities:**
- `bh_insert` — create a B₀ tree, union with existing forest
- `bh_extract_min` — find minimum root, remove it, union its children back
- `bh_find_min` — scan all root nodes
- `bh_contains` — DFS across all trees (O(n))
- `bh_remove` — decrease key to −∞, then extract-min
- `bh_merge` / `_union` — the core O(log n) merge operation
- `_link` — link two Bₖ trees into one Bₖ₊₁

**Correctness invariants to maintain:**
- Each Bₖ tree satisfies min-heap ordering
- At most one tree of each degree in the forest
- Bₖ has exactly 2ᵏ nodes and height k
- Root list is sorted by degree

**Tests to write:**
- Insert n values, verify `find_min()` is correct after each insert
- Merge two heaps, verify combined min is correct
- Extract all values, verify sorted order
- Verify degree uniqueness in root list after every operation

**Extra role — Results & Analysis Lead:**
- Owns `benchmarks/run_all.py` — automated pipeline script
- Owns `data/results.csv` and `data/comparison.csv`
- Writes the analysis narrative in `docs/BENCHMARK_SUMMARY.md`
- Interprets benchmark results and identifies performance patterns
- Produces the final performance comparison tables

---

### Member 5 — B+ Tree
**Primary Data Structure:** `src/bplus_tree.h`

**What is a B+ Tree?**
A B+ Tree with minimum degree T=3 stores all data exclusively in leaf nodes, which
are linked in a sorted doubly-linked list. Internal nodes hold only separator keys
to guide search. Each non-root node holds between T−1=2 and 2T−1=5 keys. All leaves
are at the same depth. This structure is designed for disk-based storage (high fan-out
reduces I/O) but also performs well in memory.

**Implementation responsibilities:**
- `bpt_insert` — descend to leaf, insert in sorted order, split if overflow
  - Leaf split: copy-up (key stays in right leaf)
  - Internal split: push-up (middle key removed from child)
- `bpt_remove` — find in leaf, delete, merge/redistribute if underflow
- `bpt_contains` — descend internal nodes, linear scan in leaf
- `bpt_find_min` — traverse to leftmost leaf, return first key
- `bpt_extract_min` — find-min then remove
- Leaf linked-list maintenance (`next` pointer on every leaf)

**Correctness invariants to maintain:**
- All data in leaves; internal nodes hold separator keys only
- Every non-root node has ≥ T−1 = 2 keys
- Every node has ≤ 2T−1 = 5 keys
- All leaves at the same depth
- Leaf linked list is sorted and complete

**Tests to write:**
- Insert n values, verify leaf linked list is sorted
- Verify all leaves are at the same depth
- Verify every non-root node has ≥ T−1 keys after deletions
- Verify range query returns correct sorted subset

**Extra role — Visualization Lead:**
- Owns `visualization/visualizer.html` — step-by-step interactive visualizer
- Owns `visualization/dashboard.html` — benchmark results dashboard
- Owns `visualization/viz.js` — shared data structure logic for the visualizer
- Implements the SVG rendering engine for all 5 structures
- Implements the Dataset tab (load `dataset.txt`, animate operations)
- Implements the Compare tab (theoretical complexity reference)

---

## Shared Responsibilities

| Area | Owner | Notes |
|------|-------|-------|
| `docs/README.md` | Member 1 | Project overview and quick-start |
| `docs/AVL_BINOMIAL_EXPLANATION.md` | Members 1 & 4 | Joint authorship |
| `docs/BENCHMARK_SUMMARY.md` | Members 2, 3, 4, 5 | Each writes their DS section |
| `docs/WORK_DISTRIBUTION.md` | Member 1 | This file |
| `benchmarks/benchmark.c` | Member 2 | Multi-size timing harness |
| `benchmarks/run_dataset.c` | Member 3 | Single-dataset comparison |
| `benchmarks/generate_dataset.py` | Member 3 | Dataset generator |
| `benchmarks/Makefile` | Member 3 | Build system |
| `benchmarks/run_all.py` | Member 4 | Automated pipeline |
| `data/results.csv` | Member 4 | Multi-size results |
| `data/comparison.csv` | Member 3 | Single-run results |
| `visualization/` | Member 5 | All visualization files |
| `tests/test_properties.c` | All members | Each adds tests for their DS |
| `docs/PROJECT_REPORT.docx` | All members | Each writes their section; Member 1 compiles |

---

## Dataset & Pipeline

This section documents the complete data flow from dataset generation to visualization.

### What is the Dataset?

The dataset is a plain-text file (`data/dataset.txt`) containing a sequence of
operations to be executed against each data structure. Each line is one operation:

```
# Dataset: n=1000  insert=1000  search=200  delete=150
INSERT 4821
INSERT 391
SEARCH 4821
INSERT 7203
DELETE 391
SEARCH 7203
...
```

**Format rules:**
- Lines starting with `#` are comments (ignored by the runner)
- Each operation line: `<TYPE> <VALUE>` where TYPE is `INSERT`, `SEARCH`, or `DELETE`
- Values are positive integers
- All 5 data structures execute the exact same sequence

### How the Dataset is Generated — `generate_dataset.py`

**File:** `benchmarks/generate_dataset.py`
**Owner:** Member 3

The generator uses a fixed random seed (42) for reproducibility. It does not generate
random operations blindly — it enforces validity:

- **SEARCH** only targets values that have already been inserted (no guaranteed misses
  that would skew heap search counts)
- **DELETE** only targets values currently in the set (no no-op deletes)
- Operations are interleaved in batches to simulate a realistic workload:
  1. Insert a batch of values
  2. Search ~20% of currently inserted values
  3. Delete ~15% of currently inserted values
  4. Repeat until all values are processed
  5. Final pass: search remaining inserted values

**Usage:**
```powershell
python generate_dataset.py          # default n=1000
python generate_dataset.py 5000     # custom size
```

**Output:** `dataset.txt` in the current directory (copy to `data/` as needed)

**Typical composition for n=1000:**
- ~1,000 INSERT operations
- ~200 SEARCH operations
- ~150 DELETE operations

### How the Dataset is Processed — `run_dataset.c`

**File:** `benchmarks/run_dataset.c`
**Owner:** Member 3

`run_dataset.c` loads the dataset once and runs all 5 data structures against the
same operation sequence. Each operation is timed individually using the nanosecond
timer. Results are accumulated per operation type.

**Operation mapping for heaps:**
Since heaps do not support arbitrary-key search or delete efficiently, the following
mapping is used:
- `SEARCH` → `contains()` — linear O(n) scan (intentional, reflects heap limitation)
- `DELETE` → `extract_min()` — canonical heap delete (removes the minimum)

**Compile and run:**
```powershell
gcc -std=c11 -O2 -Wall -I ../src -o run_dataset run_dataset.c -lm
.\run_dataset.exe dataset.txt
# or with custom CSV output path:
.\run_dataset.exe dataset.txt comparison.csv
```

**Console output:** A formatted comparison table showing ns/op per operation type
and total time in milliseconds for each structure.

**CSV output (`comparison.csv`):**
```
DataStructure,InsertOps,InsertNsPerOp,SearchOps,SearchNsPerOp,DeleteOps,DeleteNsPerOp,TotalTimeMs
AVL Tree,1000,224.10,200,83.70,150,213.00,0.5210
Red-Black Tree,1000,167.60,200,93.00,150,130.60,0.3912
...
```

### How the Automated Pipeline Works — `run_all.py`

**File:** `benchmarks/run_all.py`
**Owner:** Member 4

`run_all.py` automates the full pipeline for multiple dataset sizes:

1. Compiles `run_dataset.c` with `-I ../src`
2. For each size in the list:
   a. Calls `generate_dataset.py <size>` to create `dataset.txt`
   b. Runs `run_dataset.exe dataset.txt`
   c. Reads the generated `comparison.csv`
   d. Appends rows to `results.csv` with the size column added
3. Writes the final `results.csv`

**Usage:**
```powershell
python run_all.py                        # default sizes: 1000, 5000, 10000
python run_all.py 500 2000 50000         # custom sizes
```

**Output:** `data/results.csv` with columns:
`Size, DS, Time, Operations`

### How the Visualizer Uses the Dataset — `visualizer.html`

**File:** `visualization/visualizer.html`
**Owner:** Member 5

The visualizer has two ways to interact with the dataset:

#### Dataset Tab (📊 Dataset)
The Dataset tab in the visualizer allows loading `dataset.txt` directly in the browser:

1. Click **📊 Dataset** tab in the navigation bar
2. Click **Load comparison.csv** to load benchmark results
3. The tab displays:
   - Winner cards (best insert / search / delete / overall)
   - Per-structure stat cards (total ms, ns/op breakdown)
   - 4 bar charts: Insert, Search, Delete, Total time
   - Full comparison table with green/red best/worst highlighting
   - Hover tooltips on chart bars showing exact values

#### Step-by-Step Visualizer (AVL / RBT / etc. tabs)
Each of the 5 structure tabs has a sidebar with manual controls:
- **Operations panel:** Insert, Delete, Search, Find-Min, Extract-Min buttons
- **Value input:** type a value and press Go or Enter
- **Random:** inserts 8 random values to populate the tree
- **Clear:** resets the structure

The visualizer renders the data structure as an SVG diagram and records every
intermediate step (comparisons, rotations, recolorings) in a step log. Use
Prev / Next / Play to walk through the animation.

#### Dashboard (`dashboard.html`)
The standalone dashboard loads `comparison.csv` and renders the same charts
as the Dataset tab. It can be opened directly in a browser or served from
the project directory (auto-loads `comparison.csv` via `fetch`).

### Complete Data Flow Diagram

```
generate_dataset.py
        │
        ▼
  dataset.txt          ← plain text: INSERT/SEARCH/DELETE lines
        │
        ├──────────────────────────────────────────────────────┐
        │                                                      │
        ▼                                                      ▼
run_dataset.exe                                    visualizer.html
(runs all 5 DS on                                  (Dataset tab: load
 same sequence)                                     dataset.txt, animate
        │                                           operations step-by-step)
        ▼
comparison.csv         ← ns/op per DS per operation type
        │
        ├──────────────────────────────────────────────────────┐
        │                                                      │
        ▼                                                      ▼
run_all.py                                         dashboard.html
(multi-size loop)                                  (load comparison.csv,
        │                                           render bar charts)
        ▼
  results.csv          ← multi-size timing data
```

---

## Timeline

| Phase | Tasks | Who |
|-------|-------|-----|
| Week 1 | Implement data structures | All (individually) |
| Week 2 | Write unit tests, verify correctness | All (individually) |
| Week 3 | Dataset generation, run_dataset.c, benchmark.c | Members 2, 3 |
| Week 4 | run_all.py, CSV analysis, BENCHMARK_SUMMARY | Members 3, 4 |
| Week 5 | Visualization, dashboard, compare tab | Member 5 |
| Week 6 | Integration, final report, review | All |

---

## Notes

- Each member is the **sole owner** of their data structure header file.
  No one else edits it without coordination.
- All members contribute test cases to `tests/test_properties.c` for their own structure.
- The dataset format (`INSERT/SEARCH/DELETE <value>`) is fixed — do not change it
  without coordinating with Members 3, 4, and 5 (all depend on it).
- The `comparison.csv` column names are fixed — the visualizer and dashboard parse
  them by name. Do not rename columns without updating the HTML files.
- The final report sections are written individually and assembled by Member 1.
