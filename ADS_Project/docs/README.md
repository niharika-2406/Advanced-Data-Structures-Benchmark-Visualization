# Advanced Data Structures — Performance Benchmark

Five from-scratch C implementations benchmarked with real nanosecond timing on identical datasets.

---

## Project Structure

```
ADS_Project/
├── src/
│   ├── avl_tree.h          — AVL Tree (Adelson-Velsky & Landis, 1962)
│   ├── red_black_tree.h    — Red-Black Tree (CLRS Chapter 13)
│   ├── binary_heap.h       — Array-based min-heap
│   ├── binomial_heap.h     — Binomial Heap (CLRS Chapter 19)
│   └── bplus_tree.h        — B+ Tree, minimum degree T=3
├── benchmarks/
│   ├── benchmark.c         — Multi-size timing harness (n=1k/10k/100k)
│   ├── run_dataset.c       — Single-dataset side-by-side comparison
│   ├── generate_dataset.py — Reproducible dataset generator
│   ├── run_all.py          — Automated pipeline: generate → compile → run → CSV
│   └── Makefile            — Build targets for all executables
├── data/
│   ├── dataset.txt         — Generated operation sequence (INSERT/SEARCH/DELETE)
│   ├── results.csv         — Timing results from run_all.py
│   └── comparison.csv      — Per-DS ns/op breakdown from run_dataset
├── tests/
│   └── test_properties.c   — Property-based correctness tests
├── visualization/
│   ├── visualizer.html     — Step-by-step interactive visualizer
│   ├── dashboard.html      — Benchmark results dashboard
│   └── viz.js              — Shared visualizer logic
└── docs/
    ├── README.md           — This file
    ├── BENCHMARK_SUMMARY.md
    ├── WORK_DISTRIBUTION.md
    └── PROJECT_REPORT.docx
```

---

## Data Structures

| # | Structure | Insert | Search | Delete | Find-Min | Extract-Min |
|---|-----------|--------|--------|--------|----------|-------------|
| 1 | **AVL Tree** | O(log n) | O(log n) | O(log n) | O(log n) | O(log n) |
| 2 | **Red-Black Tree** | O(log n) | O(log n) | O(log n) | O(log n) | O(log n) |
| 3 | **Binary Heap** | O(log n) | O(n) | O(log n) | **O(1)** | O(log n) |
| 4 | **Binomial Heap** | O(log n) | O(n) | O(log n) | O(log n) | O(log n) |
| 5 | **B+ Tree (T=3)** | O(log n) | O(log n) | O(log n) | O(log n) | O(log n) |

> Binary Heap Find-Min is O(1) because the minimum is always at index 0 of the array.
> Binary Heap and Binomial Heap Search is O(n) — no ordering between siblings.

---

## How to Build and Run

### 1. Multi-size benchmark (n = 1,000 / 10,000 / 100,000)

```powershell
# from ADS_Project/benchmarks/
gcc -std=c11 -O2 -Wall -I ../src -o benchmark benchmark.c -lm
.\benchmark.exe
```

Prints a colored ns/op table for all 5 structures at three dataset sizes,
then emits a `BENCH_DATA` JSON block for the visualizer.

### 2. Single-dataset side-by-side comparison

```powershell
# Generate a dataset first
python generate_dataset.py 1000

# Compile and run
gcc -std=c11 -O2 -Wall -I ../src -o run_dataset run_dataset.c -lm
.\run_dataset.exe dataset.txt
```

Produces a console comparison table and writes `comparison.csv`.

### 3. Automated pipeline (all sizes, saves CSV)

```powershell
python run_all.py
# or with custom sizes:
python run_all.py 500 2000 50000
```

### 4. Property-based correctness tests

```powershell
gcc -std=c11 -O2 -Wall -I ../src -o test_properties ..\tests\test_properties.c -lm
.\test_properties.exe
```

### 5. Visualizer (no build needed)

Open directly in any browser:
- `visualization/visualizer.html` — step-by-step operation visualizer + Dataset tab
- `visualization/dashboard.html` — benchmark results charts (load `comparison.csv`)

---

## Dataset Pipeline

```
generate_dataset.py  →  dataset.txt  →  run_dataset.exe  →  comparison.csv  →  dashboard.html
```

See `docs/WORK_DISTRIBUTION.md` — **Dataset & Pipeline** section for full details on
how the dataset is generated, what the file format looks like, how `run_dataset.c`
processes it, and how the visualizer consumes the output.

---

## When to Use Each Structure

| Scenario | Best Choice | Reason |
|----------|-------------|--------|
| Read-heavy, fastest lookup | AVL Tree | Strictest balance, shortest height |
| Balanced read/write mix | Red-Black Tree | Fewer rotations than AVL |
| Simple priority queue | Binary Heap | O(1) find-min, cache-friendly array |
| Mergeable priority queue | Binomial Heap | O(log n) merge operation |
| Range queries / disk storage | B+ Tree | Linked leaves, high fan-out |

---

## Key Results (nanoseconds per operation, n = 10,000)

| Structure | Insert | Search | Delete | Find-Min |
|-----------|--------|--------|--------|----------|
| AVL Tree | 224 | 84 | 213 | 3 |
| Red-Black Tree | 168 | 93 | 131 | 3 |
| Binary Heap | 18 | — | 78 | ~0 |
| Binomial Heap | 84 | 41,655 | 296 | 3 |
| B+ Tree (T=3) | 409 | 91 | 256 | 2 |

Full results and analysis: `docs/BENCHMARK_SUMMARY.md`
