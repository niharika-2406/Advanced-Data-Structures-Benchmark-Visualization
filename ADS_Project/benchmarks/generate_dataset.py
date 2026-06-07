#!/usr/bin/env python3
"""
generate_dataset.py
Generates a dataset.txt file with INSERT / SEARCH / DELETE operations
for benchmarking all 5 data structures.

Rules:
  - SEARCH only targets values that have been inserted (no guaranteed misses
    that would skew heap search counts).
  - DELETE only targets values that are currently in the set (no no-op deletes).
  - Operations are interleaved: insert a batch, then search/delete within it,
    then insert more — realistic workload, no invalid ops.

Usage:
    python generate_dataset.py [size]
    python generate_dataset.py 5000

Default size: 1000
"""

import random
import sys


def generate(n: int, out: str = "dataset.txt") -> None:
    rng = random.Random(42)          # fixed seed → reproducible

    # Draw a pool of unique values
    pool = rng.sample(range(1, n * 10 + 1), n)

    ops = []
    inserted = []   # values currently in the DS
    inserted_set = set()

    # Split pool into batches so we interleave insert/search/delete
    batch = max(1, n // 5)
    idx = 0

    while idx < len(pool):
        # --- INSERT batch ---
        chunk = pool[idx: idx + batch]
        idx += batch
        for v in chunk:
            ops.append(f"INSERT {v}")
            inserted.append(v)
            inserted_set.add(v)

        if not inserted:
            continue

        # --- SEARCH ~20 % of currently inserted ---
        n_search = max(1, len(inserted) * 2 // 10)
        for v in rng.sample(inserted, min(n_search, len(inserted))):
            ops.append(f"SEARCH {v}")

        # --- DELETE ~15 % of currently inserted ---
        n_delete = max(1, len(inserted) * 15 // 100)
        to_delete = rng.sample(inserted, min(n_delete, len(inserted)))
        for v in to_delete:
            ops.append(f"DELETE {v}")
            inserted.remove(v)
            inserted_set.discard(v)

    # Final pass: search remaining inserted values
    if inserted:
        n_final_search = max(1, len(inserted) // 5)
        for v in rng.sample(inserted, min(n_final_search, len(inserted))):
            ops.append(f"SEARCH {v}")

    n_insert = sum(1 for o in ops if o.startswith("INSERT"))
    n_search = sum(1 for o in ops if o.startswith("SEARCH"))
    n_delete = sum(1 for o in ops if o.startswith("DELETE"))

    with open(out, "w") as f:
        f.write(
            f"# Dataset: n={n}  insert={n_insert}  "
            f"search={n_search}  delete={n_delete}\n"
        )
        for op in ops:
            f.write(op + "\n")

    print(
        f"Generated {out}: {len(ops)} operations "
        f"({n_insert} inserts, {n_search} searches, {n_delete} deletes)"
    )


if __name__ == "__main__":
    size = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    generate(size)
