#ifndef BINOMIAL_HEAP_H
#define BINOMIAL_HEAP_H
/*
 * Binomial Heap  (Cormen et al. CLRS, Chapter 19)
 * A collection of Binomial Trees satisfying the min-heap property.
 * B_k has 2^k nodes; a heap with n nodes is the binary representation of n.
 *
 * Insert:       O(1) amortized, O(log n) worst
 * Find-min:     O(log n)   [O(1) with cached min pointer]
 * Extract-min:  O(log n)
 * Merge:        O(log n)
 */
#include <stdlib.h>
#include <stddef.h>

typedef struct BHNode {
    int            key;
    int            degree;
    struct BHNode *parent;
    struct BHNode *child;    /* leftmost child */
    struct BHNode *sibling;  /* next sibling   */
} BHNode;

typedef struct {
    BHNode *head;
    size_t  size;
} BinomialHeap;

/* ── Lifecycle ──────────────────────────────────────────────────── */
static inline BHNode *bh_alloc_node(int key) {
    BHNode *n  = (BHNode *)calloc(1, sizeof(BHNode));
    n->key     = key;
    return n;
}

static inline void bh_init(BinomialHeap *h) {
    h->head = NULL;
    h->size = 0;
}

static void bh_destroy_list(BHNode *x) {
    while (x) {
        bh_destroy_list(x->child);
        BHNode *nxt = x->sibling;
        free(x);
        x = nxt;
    }
}

static inline void bh_destroy(BinomialHeap *h) {
    bh_destroy_list(h->head);
    h->head = NULL;
    h->size = 0;
}

/* ── Link two Bk trees of same degree ──────────────────────────── */
static void bh_link(BHNode *y, BHNode *z) {
    /* Make y a child of z (z has smaller key) */
    y->parent  = z;
    y->sibling = z->child;
    z->child   = y;
    z->degree++;
}

/* ── Merge root lists (sorted by degree) ───────────────────────── */
static BHNode *bh_merge_root_lists(BHNode *h1, BHNode *h2) {
    if (!h1) return h2;
    if (!h2) return h1;
    BHNode *head, *tail;
    if (h1->degree <= h2->degree) { head = tail = h1; h1 = h1->sibling; }
    else                          { head = tail = h2; h2 = h2->sibling; }
    while (h1 && h2) {
        if (h1->degree <= h2->degree) { tail->sibling = h1; h1 = h1->sibling; }
        else                          { tail->sibling = h2; h2 = h2->sibling; }
        tail = tail->sibling;
    }
    tail->sibling = h1 ? h1 : h2;
    return head;
}

/* ── Union (merge + consolidate) ───────────────────────────────── */
static BHNode *bh_union(BHNode *h1, BHNode *h2) {
    BHNode *h = bh_merge_root_lists(h1, h2);
    if (!h) return NULL;

    BHNode *prev = NULL, *x = h, *next = x->sibling;
    while (next) {
        if (x->degree != next->degree ||
            (next->sibling && next->sibling->degree == x->degree)) {
            prev = x; x = next;
        } else {
            if (next->key >= x->key) {
                x->sibling = next->sibling;
                bh_link(next, x);
            } else {
                if (!prev) h             = next;
                else       prev->sibling = next;
                bh_link(x, next);
                x = next;
            }
        }
        next = x->sibling;
    }
    return h;
}

/* ── Insert ─────────────────────────────────────────────────────── */
static inline void bh_insert(BinomialHeap *h, int key) {
    BHNode *node = bh_alloc_node(key);
    h->head = bh_union(h->head, node);
    h->size++;
}

/* ── Find-min ───────────────────────────────────────────────────── */
static inline int bh_find_min(const BinomialHeap *h, int *out) {
    if (!h->head) return 0;
    BHNode *cur = h->head;
    int best = cur->key;
    while ((cur = cur->sibling))
        if (cur->key < best) best = cur->key;
    *out = best;
    return 1;
}

/* ── Extract-min ────────────────────────────────────────────────── */
static inline int bh_extract_min(BinomialHeap *h, int *out) {
    if (!h->head) return 0;

    /* Find tree with minimum root */
    BHNode *prev_min = NULL, *min_node = h->head;
    BHNode *cur = h->head;
    int best = cur->key;
    while (cur->sibling) {
        if (cur->sibling->key < best) {
            best      = cur->sibling->key;
            prev_min  = cur;
            min_node  = cur->sibling;
        }
        cur = cur->sibling;
    }
    *out = min_node->key;

    /* Remove min_node from root list */
    if (prev_min) prev_min->sibling = min_node->sibling;
    else          h->head           = min_node->sibling;

    /* Build child heap (reverse children) */
    BHNode *child_head = NULL;
    BHNode *child = min_node->child;
    while (child) {
        BHNode *nxt    = child->sibling;
        child->sibling = child_head;
        child->parent  = NULL;
        child_head     = child;
        child = nxt;
    }
    min_node->child = NULL;
    free(min_node);
    h->size--;

    h->head = bh_union(h->head, child_head);
    return 1;
}

/* ── Contains (O(n) linear scan) ───────────────────────────────── */
static BHNode *bh_find_node(BHNode *list, int key) {
    for (BHNode *cur = list; cur; cur = cur->sibling) {
        if (cur->key == key) return cur;
        BHNode *r = bh_find_node(cur->child, key);
        if (r) return r;
    }
    return NULL;
}

static inline int bh_contains(const BinomialHeap *h, int key) {
    return bh_find_node(h->head, key) != NULL;
}

/* ── Remove (bubble up + extract-min) ──────────────────────────── */
static void bh_bubble_up(BHNode *x) {
    while (x->parent) {
        int tmp    = x->key;
        x->key     = x->parent->key;
        x->parent->key = tmp;
        x = x->parent;
    }
}

static inline int bh_remove(BinomialHeap *h, int key) {
    BHNode *target = bh_find_node(h->head, key);
    if (!target) return 0;
    bh_bubble_up(target);
    int dummy;
    bh_extract_min(h, &dummy);
    return 1;
}

#endif /* BINOMIAL_HEAP_H */
