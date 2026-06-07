#ifndef BINARY_HEAP_H
#define BINARY_HEAP_H
/*
 * Binary Heap (Min-Heap) — array-based
 * A complete binary tree stored in a flat array where
 * parent(i) = (i-1)/2, left(i) = 2i+1, right(i) = 2i+2.
 *
 * Insert:       O(log n)  — sift up
 * Find-min:     O(1)      — heap[0]
 * Extract-min:  O(log n)  — sift down
 * Delete:       O(log n)  — decrease-key + extract
 * Search:       O(n)      — linear scan
 */
#include <stdlib.h>
#include <stddef.h>
#include <string.h>

#define BH_INIT_CAP 16

typedef struct {
    int    *data;
    size_t  size;
    size_t  cap;
} BinaryHeap;

/* ── Lifecycle ──────────────────────────────────────────────────── */
static inline void bheap_init(BinaryHeap *h) {
    h->data = (int *)malloc(BH_INIT_CAP * sizeof(int));
    h->size = 0;
    h->cap  = BH_INIT_CAP;
}

static inline void bheap_destroy(BinaryHeap *h) {
    free(h->data);
    h->data = NULL;
    h->size = h->cap = 0;
}

/* ── Internal helpers ───────────────────────────────────────────── */
static inline void bheap_swap(BinaryHeap *h, size_t i, size_t j) {
    int tmp = h->data[i]; h->data[i] = h->data[j]; h->data[j] = tmp;
}

static void bheap_sift_up(BinaryHeap *h, size_t i) {
    while (i > 0) {
        size_t p = (i - 1) / 2;
        if (h->data[p] <= h->data[i]) break;
        bheap_swap(h, p, i);
        i = p;
    }
}

static void bheap_sift_down(BinaryHeap *h, size_t i) {
    size_t n = h->size;
    for (;;) {
        size_t smallest = i;
        size_t l = 2*i + 1, r = 2*i + 2;
        if (l < n && h->data[l] < h->data[smallest]) smallest = l;
        if (r < n && h->data[r] < h->data[smallest]) smallest = r;
        if (smallest == i) break;
        bheap_swap(h, i, smallest);
        i = smallest;
    }
}

static inline void bheap_grow(BinaryHeap *h) {
    h->cap *= 2;
    h->data = (int *)realloc(h->data, h->cap * sizeof(int));
}

/* ── Insert ─────────────────────────────────────────────────────── */
static inline void bheap_insert(BinaryHeap *h, int key) {
    if (h->size == h->cap) bheap_grow(h);
    h->data[h->size++] = key;
    bheap_sift_up(h, h->size - 1);
}

/* ── Find-min ───────────────────────────────────────────────────── */
static inline int bheap_find_min(const BinaryHeap *h, int *out) {
    if (!h->size) return 0;
    *out = h->data[0];
    return 1;
}

/* ── Extract-min ────────────────────────────────────────────────── */
static inline int bheap_extract_min(BinaryHeap *h, int *out) {
    if (!h->size) return 0;
    *out = h->data[0];
    h->data[0] = h->data[--h->size];
    if (h->size) bheap_sift_down(h, 0);
    return 1;
}

/* ── Search (O(n)) ──────────────────────────────────────────────── */
static inline int bheap_contains(const BinaryHeap *h, int key) {
    for (size_t i = 0; i < h->size; i++)
        if (h->data[i] == key) return 1;
    return 0;
}

/* ── Delete arbitrary key ───────────────────────────────────────── */
static inline int bheap_remove(BinaryHeap *h, int key) {
    size_t i;
    for (i = 0; i < h->size; i++)
        if (h->data[i] == key) break;
    if (i == h->size) return 0;
    /* Replace with last element, then restore heap */
    h->data[i] = h->data[--h->size];
    if (i < h->size) {
        bheap_sift_up(h, i);
        bheap_sift_down(h, i);
    }
    return 1;
}

#endif /* BINARY_HEAP_H */
