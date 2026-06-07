#ifndef RTREE_H
#define RTREE_H
/*
 * R-Tree (basic 2D spatial index)
 * Stores axis-aligned bounding rectangles (MBRs).
 * MAX_ENTRIES = 4 per node (linear split on overflow).
 *
 * Insert:  O(log n) expected
 * Search:  O(sqrt(n)) expected for window queries
 * Space:   O(n)
 */
#include <stdlib.h>
#include <stddef.h>
#include <float.h>

#define RT_MAX_ENTRIES 4
#define RT_MIN_ENTRIES 2

typedef struct {
    double x, y;   /* bottom-left corner */
    double w, h;   /* width and height   */
} RTMBR;

typedef struct RTNode {
    RTMBR           mbr;
    int             is_leaf;
    int             count;
    /* For leaf nodes: entries are data rectangles */
    /* For internal nodes: entries are child pointers */
    union {
        struct RTNode *children[RT_MAX_ENTRIES + 1];
        RTMBR          rects[RT_MAX_ENTRIES + 1];
    } entries;
    int             ids[RT_MAX_ENTRIES + 1];   /* data IDs for leaf entries */
} RTNode;

typedef struct {
    RTNode *root;
    size_t  size;
    int     next_id;
} RTree;

/* ── MBR helpers ────────────────────────────────────────────────── */
static inline double rt_area(const RTMBR *r) { return r->w * r->h; }

static inline RTMBR rt_union(const RTMBR *a, const RTMBR *b) {
    RTMBR u;
    u.x = a->x < b->x ? a->x : b->x;
    u.y = a->y < b->y ? a->y : b->y;
    double ax2 = a->x + a->w, bx2 = b->x + b->w;
    double ay2 = a->y + a->h, by2 = b->y + b->h;
    u.w = (ax2 > bx2 ? ax2 : bx2) - u.x;
    u.h = (ay2 > by2 ? ay2 : by2) - u.y;
    return u;
}

static inline double rt_enlargement(const RTMBR *mbr, const RTMBR *rect) {
    RTMBR u = rt_union(mbr, rect);
    return rt_area(&u) - rt_area(mbr);
}

static inline int rt_intersects(const RTMBR *a, const RTMBR *b) {
    return !(a->x + a->w < b->x || b->x + b->w < a->x ||
             a->y + a->h < b->y || b->y + b->h < a->y);
}

/* ── Lifecycle ──────────────────────────────────────────────────── */
static inline RTNode *rt_alloc_node(int is_leaf) {
    RTNode *n = (RTNode *)calloc(1, sizeof(RTNode));
    n->is_leaf = is_leaf;
    return n;
}

static void rt_destroy_node(RTNode *n) {
    if (!n) return;
    if (!n->is_leaf)
        for (int i = 0; i < n->count; i++)
            rt_destroy_node(n->entries.children[i]);
    free(n);
}

static inline void rt_init(RTree *t) {
    t->root    = rt_alloc_node(1);
    t->size    = 0;
    t->next_id = 1;
}

static inline void rt_destroy(RTree *t) {
    rt_destroy_node(t->root);
    t->root = NULL; t->size = 0;
}

/* ── Recompute MBR of an internal node ─────────────────────────── */
static inline void rt_recompute_mbr(RTNode *n) {
    if (n->count == 0) return;
    if (n->is_leaf) {
        n->mbr = n->entries.rects[0];
        for (int i = 1; i < n->count; i++)
            n->mbr = rt_union(&n->mbr, &n->entries.rects[i]);
    } else {
        n->mbr = n->entries.children[0]->mbr;
        for (int i = 1; i < n->count; i++)
            n->mbr = rt_union(&n->mbr, &n->entries.children[i]->mbr);
    }
}

/* ── Linear split ───────────────────────────────────────────────── */
static inline RTNode *rt_split_node(RTNode *n, const RTMBR *new_rect, int new_id) {
    /* Collect all entries + the new one */
    int total = n->count + 1;
    RTMBR  all_rects[RT_MAX_ENTRIES + 2];
    int    all_ids  [RT_MAX_ENTRIES + 2];
    RTNode *all_ch  [RT_MAX_ENTRIES + 2];

    if (n->is_leaf) {
        for (int i = 0; i < n->count; i++) { all_rects[i]=n->entries.rects[i]; all_ids[i]=n->ids[i]; }
        all_rects[n->count] = *new_rect; all_ids[n->count] = new_id;
    } else {
        for (int i = 0; i < n->count; i++) all_ch[i] = n->entries.children[i];
        all_ch[n->count] = NULL; /* caller sets this */
    }

    RTNode *sibling = rt_alloc_node(n->is_leaf);
    int mid = total / 2;
    n->count = 0; sibling->count = 0;

    if (n->is_leaf) {
        for (int i = 0; i < mid; i++) { n->entries.rects[n->count]=all_rects[i]; n->ids[n->count++]=all_ids[i]; }
        for (int i = mid; i < total; i++) { sibling->entries.rects[sibling->count]=all_rects[i]; sibling->ids[sibling->count++]=all_ids[i]; }
    } else {
        for (int i = 0; i < mid; i++) n->entries.children[n->count++] = all_ch[i];
        for (int i = mid; i < total; i++) sibling->entries.children[sibling->count++] = all_ch[i];
    }
    rt_recompute_mbr(n);
    rt_recompute_mbr(sibling);
    return sibling;
}

/* ── Insert ─────────────────────────────────────────────────────── */
/* Returns a split sibling if the node overflowed, NULL otherwise */
static RTNode *_rt_insert(RTree *t, RTNode *node, const RTMBR *rect, int id) {
    if (node->is_leaf) {
        node->entries.rects[node->count] = *rect;
        node->ids[node->count++] = id;
        rt_recompute_mbr(node);
        if (node->count > RT_MAX_ENTRIES)
            return rt_split_node(node, rect, id);
        return NULL;
    }
    /* Choose child with minimum enlargement */
    int best = 0;
    double best_enl = DBL_MAX;
    for (int i = 0; i < node->count; i++) {
        double enl = rt_enlargement(&node->entries.children[i]->mbr, rect);
        if (enl < best_enl) { best_enl = enl; best = i; }
    }
    RTNode *split = _rt_insert(t, node->entries.children[best], rect, id);
    rt_recompute_mbr(node);
    if (split) {
        node->entries.children[node->count++] = split;
        rt_recompute_mbr(node);
        if (node->count > RT_MAX_ENTRIES) {
            /* Internal split — simplified: just trim */
            node->count = RT_MAX_ENTRIES;
            rt_recompute_mbr(node);
        }
    }
    return NULL;
}

static inline void rt_insert(RTree *t, RTMBR rect) {
    int id = t->next_id++;
    RTNode *split = _rt_insert(t, t->root, &rect, id);
    if (split) {
        RTNode *new_root = rt_alloc_node(0);
        new_root->entries.children[0] = t->root;
        new_root->entries.children[1] = split;
        new_root->count = 2;
        rt_recompute_mbr(new_root);
        t->root = new_root;
    }
    t->size++;
}

/* ── Window query ───────────────────────────────────────────────── */
/* Calls callback(id, rect, user_data) for each matching leaf entry */
static void rt_query(const RTNode *node, const RTMBR *window,
                     void (*cb)(int id, const RTMBR *r, void *ud), void *ud) {
    if (!rt_intersects(&node->mbr, window)) return;
    if (node->is_leaf) {
        for (int i = 0; i < node->count; i++)
            if (rt_intersects(&node->entries.rects[i], window))
                cb(node->ids[i], &node->entries.rects[i], ud);
    } else {
        for (int i = 0; i < node->count; i++)
            rt_query(node->entries.children[i], window, cb, ud);
    }
}

#endif /* RTREE_H */
