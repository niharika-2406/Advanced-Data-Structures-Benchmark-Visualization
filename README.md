# Advanced Data Structures Benchmark & Visualizer

A comprehensive implementation, benchmarking, testing, and visualization suite for classical Advanced Data Structures built from scratch in **C** and **JavaScript**.

## Overview

This project implements and evaluates five fundamental data structures:

* AVL Tree
* Red-Black Tree
* Binary Heap
* Binomial Heap
* B+ Tree (T = 3)

The system combines:

* Efficient C implementations
* Empirical performance benchmarking
* Property-based testing
* Interactive visualizations
* Complexity comparison dashboard

The goal is to bridge theoretical analysis with real-world performance through reproducible experiments and educational visualizations.

---

## Features

### Data Structure Implementations

| Data Structure | Insert | Delete | Search | Find Min | Find Max | Extract Min |
| -------------- | ------ | ------ | ------ | -------- | -------- | ----------- |
| AVL Tree       | ✓      | ✓      | ✓      | ✓        | ✓        | ✓           |
| Red-Black Tree | ✓      | ✓      | ✓      | ✓        | ✓        | ✓           |
| Binary Heap    | ✓      | ✓      | ✓      | ✓        | —        | ✓           |
| Binomial Heap  | ✓      | ✓      | ✓      | ✓        | —        | ✓           |
| B+ Tree        | ✓      | ✓      | ✓      | ✓        | ✓        | ✓           |

### Visualization Features

* Step-by-step operation playback
* AVL rotations (LL, RR, LR, RL)
* Red-Black recoloring and balancing
* Heapify-up and heapify-down animations
* Binomial Heap merge and union visualization
* B+ Tree split, merge, and traversal visualization
* Complexity comparison tab
* Dataset benchmarking dashboard

### Benchmarking

Operations benchmarked:

* Insert
* Search
* Delete
* Find Min
* Extract Min

Dataset sizes:

* 1,000 elements
* 10,000 elements
* 100,000 elements

Metrics:

* Nanoseconds per operation (ns/op)
* Comparative performance analysis
* Scalability evaluation

---

## Project Structure

```text
.
├── src/
│   ├── avl_tree.h
│   ├── red_black_tree.h
│   ├── binary_heap.h
│   ├── binomial_heap.h
│   └── bplus_tree.h
│
├── benchmarks/
│   ├── benchmark.c
│   ├── run_dataset.c
│   ├── generate_dataset.py
│   └── run_all.py
│
├── tests/
│   └── test_properties.c
│
├── visualization/
│   ├── visualizer.html
│   ├── dashboard.html
│   └── viz.js
│
├── data/
│   ├── comparison.csv
│   └── results.csv
│
└── docs/
```

---

## Technology Stack

### Backend

* C11
* GCC
* Makefile

### Automation

* Python 3

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript
* SVG-based Visualization

---

## Running the Project

### Compile

```bash
make
```

### Run Benchmarks

```bash
python run_all.py
```

### Run Property Tests

```bash
./test_properties
```

### Open Visualizer

```bash
visualization/visualizer.html
```

---

## Key Highlights

* Implemented entirely from scratch without external data structure libraries.
* Property-based testing for structural correctness.
* Interactive visualizer for educational exploration.
* Real benchmark datasets and performance comparison.
* Modular architecture separating implementation, testing, benchmarking, and visualization.

---

## Benchmark Insights

* Binary Heap delivers the fastest insertion and minimum retrieval.
* B+ Tree performs strongly for balanced workloads and ordered access.
* AVL Tree offers strict balancing and predictable search performance.
* Red-Black Tree reduces balancing overhead compared to AVL.
* Binomial Heap excels at heap merge operations while trading off search efficiency.

---

## Future Enhancements

* Fibonacci Heap implementation
* Memory usage profiling
* Concurrent data structures
* Larger-scale benchmarks (1M+ elements)
* CI/CD integration with GitHub Actions

---

## Author

**Niharika Kalane**
Computer Science & Engineering (AI & ML)

Academic Project — Advanced Data Structures
