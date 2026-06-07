#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <math.h>
#include <time.h>

#if defined(_WIN32)
#  include <windows.h>
#endif

#include "avl_tree.h"
#include "red_black_tree.h"
#include "binary_heap.h"
#include "binomial_heap.h"
#include "bplus_tree.h"

/* ── Timing ─────────────────────────────────────────────────────── */
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

/* ── Data generation (xorshift32) ───────────────────────────────── */
static uint32_t g_rng;
static uint32_t xrand(void) {
    g_rng ^= g_rng << 13;
    g_rng ^= g_rng >> 17;
    g_rng ^= g_rng << 5;
    return g_rng;
}

static int *random_data(int n, uint32_t seed) {
    g_rng = seed;
    int *v = (int *)malloc((size_t)n * sizeof(int));
    for (int i = 0; i < n; i++)
        v[i] = (int)(xrand() % (unsigned)(n * 10)) + 1;
    return v;
}

/* ── ANSI colours ───────────────────────────────────────────────── */
#define COL_C   "\033[36m"
#define COL_G   "\033[32m"
#define COL_Y   "\033[33m"
#define COL_M   "\033[35m"
#define COL_B   "\033[34m"
#define COL_W   "\033[97m"
#define DIM     "\033[2m"
#define BO      "\033[1m"
#define RST     "\033[0m"

/* ── Result record ──────────────────────────────────────────────── */
typedef struct {
    const char *name;
    double      insert_ns;
    double      search_ns;
    double      delete_ns;
    double      findmin_ns;
    double      extractmin_ns;
    int         n;
} BenchResult;

/* ═══════════════════════════════════════════════════════════════════
   Benchmark runners
═══════════════════════════════════════════════════════════════════ */

static BenchResult bench_avl(int n) {
    int *data  = random_data(n, 1);
    int *qdata = random_data(n, 2);
    BenchResult r; r.name = "AVL Tree"; r.n = n;
    double t0, t1;

    { AVLTree t; avl_init(&t);
      t0 = now_ns();
      for (int i = 0; i < n; i++) avl_insert(&t, data[i]);
      t1 = now_ns(); r.insert_ns = (t1 - t0) / n;
      avl_destroy(&t); }

    { AVLTree t; avl_init(&t);
      for (int i = 0; i < n; i++) avl_insert(&t, data[i]);
      t0 = now_ns();
      for (int i = 0; i < n; i++) avl_contains(&t, qdata[i]);
      t1 = now_ns(); r.search_ns = (t1 - t0) / n;
      avl_destroy(&t); }

    { AVLTree t; avl_init(&t);
      for (int i = 0; i < n; i++) avl_insert(&t, data[i]);
      t0 = now_ns();
      for (int i = 0; i < n; i++) avl_remove(&t, data[i]);
      t1 = now_ns(); r.delete_ns = (t1 - t0) / n;
      avl_destroy(&t); }

    { AVLTree t; avl_init(&t);
      for (int i = 0; i < n; i++) avl_insert(&t, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n; i++) avl_find_min(&t, &dummy);
      t1 = now_ns(); r.findmin_ns = (t1 - t0) / n;
      avl_destroy(&t); }

    { AVLTree t; avl_init(&t);
      for (int i = 0; i < n; i++) avl_insert(&t, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n && t.size > 0; i++) avl_extract_min(&t, &dummy);
      t1 = now_ns(); r.extractmin_ns = (t1 - t0) / n;
      avl_destroy(&t); }

    free(data); free(qdata);
    return r;
}

static BenchResult bench_rbt(int n) {
    int *data  = random_data(n, 1);
    int *qdata = random_data(n, 2);
    BenchResult r; r.name = "Red-Black Tree"; r.n = n;
    double t0, t1;

    { RedBlackTree t; rbt_init(&t);
      t0 = now_ns();
      for (int i = 0; i < n; i++) rbt_insert(&t, data[i]);
      t1 = now_ns(); r.insert_ns = (t1 - t0) / n;
      rbt_destroy(&t); }

    { RedBlackTree t; rbt_init(&t);
      for (int i = 0; i < n; i++) rbt_insert(&t, data[i]);
      t0 = now_ns();
      for (int i = 0; i < n; i++) rbt_contains(&t, qdata[i]);
      t1 = now_ns(); r.search_ns = (t1 - t0) / n;
      rbt_destroy(&t); }

    { RedBlackTree t; rbt_init(&t);
      for (int i = 0; i < n; i++) rbt_insert(&t, data[i]);
      t0 = now_ns();
      for (int i = 0; i < n; i++) rbt_remove(&t, data[i]);
      t1 = now_ns(); r.delete_ns = (t1 - t0) / n;
      rbt_destroy(&t); }

    { RedBlackTree t; rbt_init(&t);
      for (int i = 0; i < n; i++) rbt_insert(&t, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n; i++) rbt_find_min(&t, &dummy);
      t1 = now_ns(); r.findmin_ns = (t1 - t0) / n;
      rbt_destroy(&t); }

    { RedBlackTree t; rbt_init(&t);
      for (int i = 0; i < n; i++) rbt_insert(&t, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n; i++) rbt_extract_min(&t, &dummy);
      t1 = now_ns(); r.extractmin_ns = (t1 - t0) / n;
      rbt_destroy(&t); }

    free(data); free(qdata);
    return r;
}

static BenchResult bench_bheap(int n) {
    int *data  = random_data(n, 1);
    int *qdata = random_data(n, 2);
    BenchResult r; r.name = "Binary Heap"; r.n = n;
    double t0, t1;

    { BinaryHeap h; bheap_init(&h);
      t0 = now_ns();
      for (int i = 0; i < n; i++) bheap_insert(&h, data[i]);
      t1 = now_ns(); r.insert_ns = (t1 - t0) / n;
      bheap_destroy(&h); }

    { BinaryHeap h; bheap_init(&h);
      for (int i = 0; i < n; i++) bheap_insert(&h, data[i]);
      t0 = now_ns();
      for (int i = 0; i < n; i++) bheap_contains(&h, qdata[i]);
      t1 = now_ns(); r.search_ns = (t1 - t0) / n;
      bheap_destroy(&h); }

    { BinaryHeap h; bheap_init(&h);
      for (int i = 0; i < n; i++) bheap_insert(&h, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n && h.size > 0; i++) bheap_extract_min(&h, &dummy);
      t1 = now_ns(); r.delete_ns = (t1 - t0) / n;
      bheap_destroy(&h); }

    { BinaryHeap h; bheap_init(&h);
      for (int i = 0; i < n; i++) bheap_insert(&h, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n; i++) bheap_find_min(&h, &dummy);
      t1 = now_ns(); r.findmin_ns = (t1 - t0) / n;
      bheap_destroy(&h); }

    { BinaryHeap h; bheap_init(&h);
      for (int i = 0; i < n; i++) bheap_insert(&h, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n && h.size > 0; i++) bheap_extract_min(&h, &dummy);
      t1 = now_ns(); r.extractmin_ns = (t1 - t0) / n;
      bheap_destroy(&h); }

    free(data); free(qdata);
    return r;
}

static BenchResult bench_binomial(int n) {
    int *data  = random_data(n, 1);
    int *qdata = random_data(n, 2);
    BenchResult r; r.name = "Binomial Heap"; r.n = n;
    double t0, t1;

    { BinomialHeap h; bh_init(&h);
      t0 = now_ns();
      for (int i = 0; i < n; i++) bh_insert(&h, data[i]);
      t1 = now_ns(); r.insert_ns = (t1 - t0) / n;
      bh_destroy(&h); }

    { BinomialHeap h; bh_init(&h);
      for (int i = 0; i < n; i++) bh_insert(&h, data[i]);
      t0 = now_ns();
      for (int i = 0; i < n; i++) bh_contains(&h, qdata[i]);
      t1 = now_ns(); r.search_ns = (t1 - t0) / n;
      bh_destroy(&h); }

    { BinomialHeap h; bh_init(&h);
      for (int i = 0; i < n; i++) bh_insert(&h, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n && h.size > 0; i++) bh_extract_min(&h, &dummy);
      t1 = now_ns(); r.delete_ns = (t1 - t0) / n;
      bh_destroy(&h); }

    { BinomialHeap h; bh_init(&h);
      for (int i = 0; i < n; i++) bh_insert(&h, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n; i++) bh_find_min(&h, &dummy);
      t1 = now_ns(); r.findmin_ns = (t1 - t0) / n;
      bh_destroy(&h); }

    { BinomialHeap h; bh_init(&h);
      for (int i = 0; i < n; i++) bh_insert(&h, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n && h.size > 0; i++) bh_extract_min(&h, &dummy);
      t1 = now_ns(); r.extractmin_ns = (t1 - t0) / n;
      bh_destroy(&h); }

    free(data); free(qdata);
    return r;
}

static BenchResult bench_bplus(int n) {
    int *data  = random_data(n, 1);
    int *qdata = random_data(n, 2);
    BenchResult r; r.name = "B+ Tree (T=3)"; r.n = n;
    double t0, t1;

    { BPlusTree t; bpt_init(&t);
      t0 = now_ns();
      for (int i = 0; i < n; i++) bpt_insert(&t, data[i]);
      t1 = now_ns(); r.insert_ns = (t1 - t0) / n;
      bpt_destroy(&t); }

    { BPlusTree t; bpt_init(&t);
      for (int i = 0; i < n; i++) bpt_insert(&t, data[i]);
      t0 = now_ns();
      for (int i = 0; i < n; i++) bpt_contains(&t, qdata[i]);
      t1 = now_ns(); r.search_ns = (t1 - t0) / n;
      bpt_destroy(&t); }

    { BPlusTree t; bpt_init(&t);
      for (int i = 0; i < n; i++) bpt_insert(&t, data[i]);
      t0 = now_ns();
      for (int i = 0; i < n; i++) bpt_remove(&t, data[i]);
      t1 = now_ns(); r.delete_ns = (t1 - t0) / n;
      bpt_destroy(&t); }

    { BPlusTree t; bpt_init(&t);
      for (int i = 0; i < n; i++) bpt_insert(&t, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n; i++) bpt_find_min(&t, &dummy);
      t1 = now_ns(); r.findmin_ns = (t1 - t0) / n;
      bpt_destroy(&t); }

    { BPlusTree t; bpt_init(&t);
      for (int i = 0; i < n; i++) bpt_insert(&t, data[i]);
      int dummy;
      t0 = now_ns();
      for (int i = 0; i < n && t.size > 0; i++) bpt_extract_min(&t, &dummy);
      t1 = now_ns(); r.extractmin_ns = (t1 - t0) / n;
      bpt_destroy(&t); }

    free(data); free(qdata);
    return r;
}

/* ═══════════════════════════════════════════════════════════════════
   Pretty printer
═══════════════════════════════════════════════════════════════════ */
static const char *COLOURS[] = { COL_C, COL_G, COL_Y, COL_M, COL_B };

static void print_header(void) {
    printf(BO COL_W
        "\n +------------------------------------------------------------------+\n"
        " |   ADVANCED DATA STRUCTURES -- Real Performance Benchmark (ns/op) |\n"
        " +------------------------------------------------------------------+\n"
        RST);
}

static void print_table(BenchResult *results, int count) {
    printf("\n  " BO COL_W "%-22s%9s%9s%9s%9s%12s" RST "\n",
           "  Structure", "Insert", "Search", "Delete", "FindMin", "ExtractMin");
    printf("  ");
    for (int i = 0; i < 68; i++) putchar('-');
    putchar('\n');
    for (int i = 0; i < count; i++) {
        const BenchResult *r = &results[i];
        printf("  %s" BO "%-22s" RST
               "%9.1f%9.1f%9.1f%9.1f%12.1f\n",
               COLOURS[i % 5], r->name,
               r->insert_ns, r->search_ns, r->delete_ns,
               r->findmin_ns, r->extractmin_ns);
    }
}

/* ── JSON output for the visualizer ────────────────────────────── */
#define MAX_SIZES   8
#define MAX_STRUCTS 5

static void print_json(BenchResult all[MAX_SIZES][MAX_STRUCTS],
                       int *sizes, int nsizes)
{
    printf("\n\n// -- BENCHMARK_DATA_JSON -----------------------------------\n");
    printf("const BENCH_DATA = {\n  \"sizes\": [");
    for (int i = 0; i < nsizes; i++)
        printf("%d%s", sizes[i], i + 1 < nsizes ? "," : "");
    printf("],\n  \"structures\": [");

    const char *names[] = {
        "AVL Tree", "Red-Black Tree", "Binary Heap",
        "Binomial Heap", "B+ Tree (T=3)"
    };
    for (int s = 0; s < MAX_STRUCTS; s++) {
        printf("\n    {\n      \"name\": \"%s\",\n", names[s]);
        const char *ops[] = {"insert","search","delete","findmin","extractmin"};
        for (int op = 0; op < 5; op++) {
            printf("      \"%s\": [", ops[op]);
            for (int sz = 0; sz < nsizes; sz++) {
                double v = 0;
                switch (op) {
                    case 0: v = all[sz][s].insert_ns;     break;
                    case 1: v = all[sz][s].search_ns;     break;
                    case 2: v = all[sz][s].delete_ns;     break;
                    case 3: v = all[sz][s].findmin_ns;    break;
                    case 4: v = all[sz][s].extractmin_ns; break;
                }
                printf("%.2f%s", v, sz + 1 < nsizes ? "," : "");
            }
            printf("]%s\n", op < 4 ? "," : "");
        }
        printf("    }%s\n", s < MAX_STRUCTS - 1 ? "," : "");
    }
    printf("  ]\n};\n");
    printf("// -- END BENCHMARK_DATA_JSON --------------------------------\n");
}

/* ═══════════════════════════════════════════════════════════════════
   main
═══════════════════════════════════════════════════════════════════ */
int main(void) {
    print_header();

    int sizes[]  = {1000, 10000, 100000};
    int nsizes   = (int)(sizeof(sizes) / sizeof(sizes[0]));

    BenchResult all[MAX_SIZES][MAX_STRUCTS];

    for (int si = 0; si < nsizes; si++) {
        int n = sizes[si];
        printf("\n" BO COL_Y " -- n = %d --" RST "\n", n);

        printf(DIM "  Benchmarking AVL Tree..." RST); fflush(stdout);
        all[si][0] = bench_avl(n);       printf(" done\n");

        printf(DIM "  Benchmarking Red-Black Tree..." RST); fflush(stdout);
        all[si][1] = bench_rbt(n);       printf(" done\n");

        printf(DIM "  Benchmarking Binary Heap..." RST); fflush(stdout);
        all[si][2] = bench_bheap(n);     printf(" done\n");

        printf(DIM "  Benchmarking Binomial Heap..." RST); fflush(stdout);
        all[si][3] = bench_binomial(n);  printf(" done\n");

        printf(DIM "  Benchmarking B+ Tree..." RST); fflush(stdout);
        all[si][4] = bench_bplus(n);     printf(" done\n");

        print_table(all[si], MAX_STRUCTS);
    }

    /* Theoretical complexity summary */
    printf("\n" BO COL_W "\n  Theoretical Complexities:\n" RST);
    printf("  "); for (int i = 0; i < 68; i++) putchar('-'); putchar('\n');
    printf("  " BO COL_W "%-22s%9s%9s%9s%9s%12s\n" RST,
           "  Structure", "Insert", "Search", "Delete", "FindMin", "ExtractMin");
    printf("  "); for (int i = 0; i < 68; i++) putchar('-'); putchar('\n');

    #define ROW(col, name, ins, srch, del, fmin, emin) \
        printf("  %s" BO "%-22s" RST "%9s%9s%9s%9s%12s\n", \
               col, name, ins, srch, del, fmin, emin)

    ROW(COL_C, "AVL Tree",       "O(log n)", "O(log n)", "O(log n)", "O(log n)", "O(log n)");
    ROW(COL_G, "Red-Black Tree", "O(log n)", "O(log n)", "O(log n)", "O(log n)", "O(log n)");
    ROW(COL_Y, "Binary Heap",    "O(log n)", "O(n)",     "O(log n)", "O(1)",     "O(log n)");
    ROW(COL_M, "Binomial Heap",  "O(log n)", "O(n)",     "O(log n)", "O(log n)", "O(log n)");
    ROW(COL_B, "B+ Tree (T=3)",  "O(log n)", "O(log n)", "O(log n)", "O(log n)", "O(log n)");
    printf(DIM "\n  * Binary Heap find-min is O(1); search is O(n) linear scan\n" RST);

    print_json(all, sizes, nsizes);
    return 0;
}
