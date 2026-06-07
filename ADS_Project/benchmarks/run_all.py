#!/usr/bin/env python3
"""
run_all.py
Generates datasets, compiles run_dataset.c, runs it for each size,
and collects results into results.csv.

Operation mapping (documented in run_dataset.c):
  AVL / RBT / B+Tree : INSERT, SEARCH, DELETE  (all executed)
  BinaryHeap         : INSERT, SEARCH, DELETE→extract-min
  BinomialHeap       : INSERT, SEARCH, DELETE→extract-min

OPERATIONS column = ops actually executed by that DS (skipped ops not counted).

Usage:
    python run_all.py [1000 5000 10000 ...]

Default sizes: 1000, 5000, 10000
"""

import subprocess
import sys
import os
import csv
import re
import locale

# Set console encoding for Windows
if os.name == 'nt':
    try:
        os.system('chcp 65001 >nul')
    except:
        pass

# ── Config ────────────────────────────────────────────────────────
SIZES   = [int(x) for x in sys.argv[1:]] if len(sys.argv) > 1 else [1000, 5000, 10000]
EXE     = "run_dataset.exe" if os.name == "nt" else "./run_dataset"
DATASET = "dataset.txt"
CSV_OUT = "results.csv"
CC      = "gcc"
CFLAGS  = ["-O2", "-Wall", "-I", "../src"]
SRC     = "run_dataset.c"

# ── Compile ───────────────────────────────────────────────────────
def compile_runner():
    out = "run_dataset.exe" if os.name == "nt" else "run_dataset"
    cmd = [CC] + CFLAGS + ["-o", out, SRC, "-lm"]
    print(f"Compiling: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        print("Compile error:\n", result.stderr)
        sys.exit(1)
    print("Compiled OK\n")

# ── Parse output ──────────────────────────────────────────────────
def parse_output(text: str) -> list[dict]:
    """
    Parses benchmark output to extract timing data for each data structure.
    Looks for lines containing data structure names and their timing information.
    """
    records = []
    lines = text.splitlines()
    
    # Map of data structure names to their display names
    ds_names = {
        "AVL Tree": "AVL",
        "Red-Black Tree": "RedBlackTree", 
        "Binary Heap": "BinaryHeap",
        "Binomial Heap": "BinomialHeap",
        "B+ Tree (T=3)": "BPlusTree"
    }
    
    for line in lines:
        # Look for lines with data structure timing data
        for ds_display, ds_name in ds_names.items():
            if ds_display in line and "ns/op" in line:
                # Extract timing data from the line
                parts = line.split()
                # Find the timing values (they're usually the last few columns)
                insert_time = "0.000000"
                search_time = "0.000000" 
                delete_time = "0.000000"
                total_time = "0.000000"
                
                # Try to extract timing values
                for i, part in enumerate(parts):
                    if part.replace('.', '').isdigit() and i > 0:
                        # This looks like a timing value
                        if i >= len(parts) - 4:  # Last few columns are timings
                            if "Insert" in parts[:i] or i == len(parts) - 4:
                                insert_time = part
                            elif "Search" in parts[:i] or i == len(parts) - 3:
                                search_time = part
                            elif "Delete" in parts[:i] or i == len(parts) - 2:
                                delete_time = part
                            elif "time" in parts[:i] or i == len(parts) - 1:
                                total_time = part
                
                # Get operations count from earlier in the output
                ops_count = "0"
                for j, prev_line in enumerate(lines[:lines.index(line)]):
                    if "total" in prev_line.lower() and "operations" in prev_line.lower():
                        # Extract the number before "total"
                        import re
                        match = re.search(r'(\d+)\s+total', prev_line)
                        if match:
                            ops_count = match.group(1)
                        break
                
                records.append({
                    "DS": ds_name,
                    "Time": total_time,
                    "Operations": ops_count
                })
                break
    
    return records

# ── Main ──────────────────────────────────────────────────────────
def main():
    compile_runner()

    all_rows = []

    for size in SIZES:
        print(f"=== n = {size} ===")

        # Generate dataset
        subprocess.run([sys.executable, "generate_dataset.py", str(size)], check=True)

        # Run benchmark
        result = subprocess.run([EXE, DATASET], capture_output=True, text=True, encoding='utf-8')
        if result.returncode != 0:
            print("Runtime error:\n", result.stderr)
            continue

        # Print output safely, handling Unicode
        try:
            print(result.stdout)
        except UnicodeEncodeError:
            # Fallback: strip problematic characters
            safe_output = ''.join(char for char in result.stdout if ord(char) < 128)
            print(safe_output)

        # Read data from comparison.csv instead of parsing complex output
        try:
            with open("comparison.csv", "r") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Map data structure names
                    ds_map = {
                        "AVL Tree": "AVL",
                        "Red-Black Tree": "RedBlackTree",
                        "Binary Heap": "BinaryHeap", 
                        "Binomial Heap": "BinomialHeap",
                        "B+ Tree (T=3)": "BPlusTree"
                    }
                    
                    ds_name = row.get("DataStructure", "")
                    if ds_name in ds_map:
                        all_rows.append({
                            "Size": size,
                            "DS": ds_map[ds_name],
                            "Time": row.get("TotalTimeMs", "0"),
                            "Operations": str(int(row.get("InsertOps", "0")) + 
                                          int(row.get("SearchOps", "0")) + 
                                          int(row.get("DeleteOps", "0")))
                        })
        except Exception as e:
            print(f"Warning: Could not read comparison.csv: {e}")

    # Write CSV
    if all_rows:
        fieldnames = ["Size", "DS", "Time", "Operations"]
        with open(CSV_OUT, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_rows)
        print(f"\nResults saved to {CSV_OUT}")
        print("Note: for heaps, DELETE ops are mapped to extract-min.")
    else:
        print("No results collected.")

if __name__ == "__main__":
    main()
