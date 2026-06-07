/*
 * run_dataset.c
 * Runs a SINGLE shared dataset against all 5 data structures and prints
 * a side-by-side comparison table with per-operation timing.
 *
 * Operation mapping:
 *   AVL / Red-Black / B+ Tree  — INSERT, SEARCH, DELETE  (native)
 *   Binary Heap / Binomial Heap:
 *     INSERT → insert
 *     SEARCH → linear contains scan  (O(n) by design)
 *     DELETE → extract-min           (canonical heap delete)
 *
 * Output:
 *   - Console: formatted comparison table
 *   - comparison.csv: machine-readable results
 *
 * Usage:
 *   run_dataset [dataset.txt]
 *
 * Compile:
 *   gcc -O2 -Wall -o run_dataset run_dataset.c -lm
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#if defined(_WIN32)
#  include <windows.h>
#endif

#include "avl_tree.h"
#include "red_black_tree.h"
#include "binary_heap.h"
#include "binomial_heap.h"
#include "bplus_tree.h"

/* ── High-resolution timer (nanoseconds) ───────────────────────── */
static double now_ns(void) {
#if defined(_WIN32)
    LARGE_INTEGER freq, cnt;
    QueryPerformanceFrequency(&freq);
    QueryPerformanceCounter(&cnt);
    return (double)cnt.QuadPart * 1e9 / (double)freq.QuadPart;
#else
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec * 1e9 + (double)ts.tv_nsec;
#endif
}

/* ── Operation types ────────────────────────────────────────────── */
#define OP_INSERT 0
#define OP_SEARCH 1
#define OP_DELETE 2

typedef struct { int type; int value; } Op;

/* ── Per-DS result ──────────────────────────────────────────────── */
typedef struct {
    const char *name;
    long   n_insert;
    long   n_search;
    long   n_delete;
    double t_insert_ns;   /* total ns for all inserts */
    double t_search_ns;
    double t_delete_ns;
    double t_total_ns;
} DSResult;

/* ── Load dataset ───────────────────────────────────────────────── */
static Op *load_ops(const char *path, int *count) {
    FILE *f = fopen(path, "r");
    if (!f) { fprintf(stderr, "ERROR: cannot open '%s'\n", path); exit(1); }

    int cap = 256, n = 0;
    Op *ops = (Op *)malloc(cap * sizeof(Op));
    char line[128];

    while (fgets(line, sizeof(line), f)) {
        if (line[0] == '#' || line[0] == '\n') continue;
        char tok[16]; int val;
        if (sscanf(line, "%15s %d", tok, &val) != 2) continue;

        int type;
        if      (strcmp(tok, "INSERT") == 0) type = OP_INSERT;
        else if (strcmp(tok, "SEARCH") == 0) type = OP_SEARCH;
        else if (strcmp(tok, "DELETE") == 0) type = OP_DELETE;
        else continue;

        if (n == cap) { cap *= 2; ops = (Op *)realloc(ops, cap * sizeof(Op)); }
        ops[n].type  = type;
        ops[n].value = val;
        n++;
    }
    fclose(f);
    *count = n;
    return ops;
}

/* ═══════════════════════════════════════════════════════════════════
   Per-DS runners — each returns a filled DSResult
═══════════════════════════════════════════════════════════════════ */

static DSResult run_avl(const Op *ops, int n) {
    DSResult r = {"AVL Tree", 0, 0, 0, 0, 0, 0, 0};
    AVLTree t; avl_init(&t);
    double t0, t1, total = now_ns();

    for (int i = 0; i < n; i++) {
        switch (ops[i].type) {
            case OP_INSERT:
                t0 = now_ns(); avl_insert(&t, ops[i].value);   t1 = now_ns();
                r.t_insert_ns += t1 - t0; r.n_insert++; break;
            case OP_SEARCH:
                t0 = now_ns(); avl_contains(&t, ops[i].value); t1 = now_ns();
                r.t_search_ns += t1 - t0; r.n_search++; break;
            case OP_DELETE:
                t0 = now_ns(); avl_remove(&t, ops[i].value);   t1 = now_ns();
                r.t_delete_ns += t1 - t0; r.n_delete++; break;
        }
    }
    r.t_total_ns = now_ns() - total;
    avl_destroy(&t);
    return r;
}

static DSResult run_rbt(const Op *ops, int n) {
    DSResult r = {"Red-Black Tree", 0, 0, 0, 0, 0, 0, 0};
    RedBlackTree t; rbt_init(&t);
    double t0, t1, total = now_ns();

    for (int i = 0; i < n; i++) {
        switch (ops[i].type) {
            case OP_INSERT:
                t0 = now_ns(); rbt_insert(&t, ops[i].value);   t1 = now_ns();
                r.t_insert_ns += t1 - t0; r.n_insert++; break;
            case OP_SEARCH:
                t0 = now_ns(); rbt_contains(&t, ops[i].value); t1 = now_ns();
                r.t_search_ns += t1 - t0; r.n_search++; break;
            case OP_DELETE:
                t0 = now_ns(); rbt_remove(&t, ops[i].value);   t1 = now_ns();
                r.t_delete_ns += t1 - t0; r.n_delete++; break;
        }
    }
    r.t_total_ns = now_ns() - total;
    rbt_destroy(&t);
    return r;
}

static DSResult run_bheap(const Op *ops, int n) {
    DSResult r = {"Binary Heap", 0, 0, 0, 0, 0, 0, 0};
    BinaryHeap h; bheap_init(&h);
    double t0, t1, total = now_ns();
    int dummy;

    for (int i = 0; i < n; i++) {
        switch (ops[i].type) {
            case OP_INSERT:
                t0 = now_ns(); bheap_insert(&h, ops[i].value); t1 = now_ns();
                r.t_insert_ns += t1 - t0; r.n_insert++; break;
            case OP_SEARCH:
                t0 = now_ns(); bheap_contains(&h, ops[i].value); t1 = now_ns();
                r.t_search_ns += t1 - t0; r.n_search++; break;
            case OP_DELETE:
                if (h.size > 0) {
                    t0 = now_ns(); bheap_extract_min(&h, &dummy); t1 = now_ns();
                    r.t_delete_ns += t1 - t0; r.n_delete++;
                }
                break;
        }
    }
    r.t_total_ns = now_ns() - total;
    bheap_destroy(&h);
    return r;
}

static DSResult run_binomial(const Op *ops, int n) {
    DSResult r = {"Binomial Heap", 0, 0, 0, 0, 0, 0, 0};
    BinomialHeap h; bh_init(&h);
    double t0, t1, total = now_ns();
    int dummy;

    for (int i = 0; i < n; i++) {
        switch (ops[i].type) {
            case OP_INSERT:
                t0 = now_ns(); bh_insert(&h, ops[i].value); t1 = now_ns();
                r.t_insert_ns += t1 - t0; r.n_insert++; break;
            case OP_SEARCH:
                t0 = now_ns(); bh_contains(&h, ops[i].value); t1 = now_ns();
                r.t_search_ns += t1 - t0; r.n_search++; break;
            case OP_DELETE:
                if (h.size > 0) {
                    t0 = now_ns(); bh_extract_min(&h, &dummy); t1 = now_ns();
                    r.t_delete_ns += t1 - t0; r.n_delete++;
                }
                break;
        }
    }
    r.t_total_ns = now_ns() - total;
    bh_destroy(&h);
    return r;
}

static DSResult run_bplus(const Op *ops, int n) {
    DSResult r = {"B+ Tree (T=3)", 0, 0, 0, 0, 0, 0, 0};
    BPlusTree t; bpt_init(&t);
    double t0, t1, total = now_ns();

    for (int i = 0; i < n; i++) {
        switch (ops[i].type) {
            case OP_INSERT:
                t0 = now_ns(); bpt_insert(&t, ops[i].value);   t1 = now_ns();
                r.t_insert_ns += t1 - t0; r.n_insert++; break;
            case OP_SEARCH:
                t0 = now_ns(); bpt_contains(&t, ops[i].value); t1 = now_ns();
                r.t_search_ns += t1 - t0; r.n_search++; break;
            case OP_DELETE:
                t0 = now_ns(); bpt_remove(&t, ops[i].value);   t1 = now_ns();
                r.t_delete_ns += t1 - t0; r.n_delete++; break;
        }
    }
    r.t_total_ns = now_ns() - total;
    bpt_destroy(&t);
    return r;
}

/* ── ns/op helper (avoid div-by-zero) ──────────────────────────── */
static double ns_per_op(double total_ns, long count) {
    return count > 0 ? total_ns / (double)count : 0.0;
}

/* ── ANSI colours ───────────────────────────────────────────────── */
#define C_RESET  "\033[0m"
#define C_BOLD   "\033[1m"
#define C_DIM    "\033[2m"
#define C_CYAN   "\033[36m"
#define C_GREEN  "\033[32m"
#define C_YELLOW "\033[33m"
#define C_MAG    "\033[35m"
#define C_BLUE   "\033[34m"
#define C_WHITE  "\033[97m"

static const char *DS_COLORS[] = {C_CYAN, C_GREEN, C_YELLOW, C_MAG, C_BLUE};

/* ── Print comparison table ─────────────────────────────────────── */
static void print_table(DSResult *res, int count, int total_ops,
                         int n_insert, int n_search, int n_delete,
                         const char *dataset_path) {
    printf("\n" C_BOLD C_WHITE
           " ╔══════════════════════════════════════════════════════════════════════╗\n"
           " ║        DATA STRUCTURE COMPARISON — Single Dataset Benchmark         ║\n"
           " ╚══════════════════════════════════════════════════════════════════════╝\n"
           C_RESET);

    printf(C_DIM " Dataset : %s\n", dataset_path);
    printf(" Ops     : %d total  (%d inserts  %d searches  %d deletes)\n" C_RESET,
           total_ops, n_insert, n_search, n_delete);

    /* ── Per-operation ns/op table ── */
    printf("\n" C_BOLD C_WHITE
           "  %-18s  %12s  %12s  %12s  %14s\n" C_RESET,
           "  Data Structure", "Insert ns/op", "Search ns/op",
           "Delete ns/op", "Total time (ms)");
    printf("  ");
    for (int i = 0; i < 74; i++) putchar('-');
    putchar('\n');

    for (int i = 0; i < count; i++) {
        DSResult *r = &res[i];
        double ins = ns_per_op(r->t_insert_ns, r->n_insert);
        double srch = ns_per_op(r->t_search_ns, r->n_search);
        double del  = ns_per_op(r->t_delete_ns, r->n_delete);
        double total_ms = r->t_total_ns / 1e6;

        printf("  %s" C_BOLD "%-18s" C_RESET "  %12.1f  %12.1f  %12.1f  %14.3f\n",
               DS_COLORS[i], r->name, ins, srch, del, total_ms);
    }

    /* ── Op count sanity row ── */
    printf(C_DIM "\n  Ops executed per DS:\n");
    printf("  %-18s  %12s  %12s  %12s\n", "  Data Structure",
           "Inserts", "Searches", "Deletes");
    printf("  ");
    for (int i = 0; i < 50; i++) putchar('-');
    putchar('\n');
    for (int i = 0; i < count; i++) {
        DSResult *r = &res[i];
        printf("  %-18s  %12ld  %12ld  %12ld\n",
               r->name, r->n_insert, r->n_search, r->n_delete);
    }
    printf(C_RESET);

    /* ── Winner per category ── */
    printf("\n" C_BOLD C_WHITE "  Best per operation:\n" C_RESET);
    const char *cats[] = {"Insert", "Search", "Delete", "Total"};
    for (int cat = 0; cat < 4; cat++) {
        int best = 0;
        double best_val = 1e18;
        for (int i = 0; i < count; i++) {
            double v;
            switch (cat) {
                case 0: v = ns_per_op(res[i].t_insert_ns, res[i].n_insert); break;
                case 1: v = ns_per_op(res[i].t_search_ns, res[i].n_search); break;
                case 2: v = ns_per_op(res[i].t_delete_ns, res[i].n_delete); break;
                default: v = res[i].t_total_ns; break;
            }
            if (v > 0 && v < best_val) { best_val = v; best = i; }
        }
        printf("  %s%-8s%s → %s%s%s\n",
               C_DIM, cats[cat], C_RESET,
               DS_COLORS[best], res[best].name, C_RESET);
    }
    printf("\n");
}

/* ── Write CSV ──────────────────────────────────────────────────── */
static void write_csv(DSResult *res, int count, const char *path) {
    FILE *f = fopen(path, "w");
    if (!f) { fprintf(stderr, "WARNING: could not write %s\n", path); return; }

    fprintf(f, "DataStructure,InsertOps,InsertNsPerOp,"
               "SearchOps,SearchNsPerOp,"
               "DeleteOps,DeleteNsPerOp,"
               "TotalTimeMs\n");

    for (int i = 0; i < count; i++) {
        DSResult *r = &res[i];
        fprintf(f, "%s,%ld,%.2f,%ld,%.2f,%ld,%.2f,%.4f\n",
                r->name,
                r->n_insert, ns_per_op(r->t_insert_ns, r->n_insert),
                r->n_search, ns_per_op(r->t_search_ns, r->n_search),
                r->n_delete, ns_per_op(r->t_delete_ns, r->n_delete),
                r->t_total_ns / 1e6);
    }
    fclose(f);
    printf(C_DIM "  Results saved to %s\n" C_RESET, path);
}

/* ═══════════════════════════════════════════════════════════════════
   main
═══════════════════════════════════════════════════════════════════ */
int main(int argc, char *argv[]) {
    const char *dataset_path = (argc > 1) ? argv[1] : "dataset.txt";
    const char *csv_path     = (argc > 2) ? argv[2] : "comparison.csv";

    int n_ops;
    Op *ops = load_ops(dataset_path, &n_ops);

    if (n_ops == 0) {
        fprintf(stderr, "ERROR: no valid operations in '%s'\n", dataset_path);
        free(ops);
        return 1;
    }

    /* Count op types for the header */
    int n_insert = 0, n_search = 0, n_delete = 0;
    for (int i = 0; i < n_ops; i++) {
        if      (ops[i].type == OP_INSERT) n_insert++;
        else if (ops[i].type == OP_SEARCH) n_search++;
        else                               n_delete++;
    }

    printf(C_DIM "\n  Running all 5 data structures on the same dataset...\n" C_RESET);

    DSResult results[5];
    results[0] = run_avl     (ops, n_ops);
    results[1] = run_rbt     (ops, n_ops);
    results[2] = run_bheap   (ops, n_ops);
    results[3] = run_binomial(ops, n_ops);
    results[4] = run_bplus   (ops, n_ops);

    print_table(results, 5, n_ops, n_insert, n_search, n_delete, dataset_path);
    write_csv(results, 5, csv_path);

    free(ops);
    return 0;
}
