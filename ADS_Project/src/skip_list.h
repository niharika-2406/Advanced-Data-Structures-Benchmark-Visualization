#ifndef SKIP_LIST_H
#define SKIP_LIST_H
/*
 * Skip List  (probabilistic multi-level linked list)
 * MAX_LEVEL = 16, p = 0.5
 *
 * Insert:  O(log n) expected
 * Search:  O(log n) expected
 * Delete:  O(log n) expected
 * Space:   O(n log n) expected
 */
#include <stdlib.h>
#include <stddef.h>
#include <time.h>

#define SL_MAX_LEVEL 16
#define SL_P         0.5

typedef struct SLNode {
    int            key;
    struct SLNode *forward[SL_MAX_LEVEL];
} SLNode;

typedef struct {
    SLNode *head;
    int     level;   /* current highest level in use (1-indexed) */
    size_t  size;
} SkipList;

/* ── Helpers ────────────────────────────────────────────────────── */
static inline SLNode *sl_alloc_node(int key, int level) {
    SLNode *n = (SLNode *)calloc(1, sizeof(SLNode));
    n->key = key;
    return n;
}

static inline int sl_random_level(void) {
    int lvl = 1;
    while ((double)rand() / RAND_MAX < SL_P && lvl < SL_MAX_LEVEL)
        lvl++;
    return lvl;
}

/* ── Lifecycle ──────────────────────────────────────────────────── */
static inline void sl_init(SkipList *sl) {
    sl->head  = sl_alloc_node(0, SL_MAX_LEVEL);
    sl->level = 1;
    sl->size  = 0;
    srand((unsigned)time(NULL));
}

static inline void sl_destroy(SkipList *sl) {
    SLNode *cur = sl->head;
    while (cur) {
        SLNode *nxt = cur->forward[0];
        free(cur);
        cur = nxt;
    }
    sl->head = NULL;
    sl->size = 0;
}

/* ── Insert ─────────────────────────────────────────────────────── */
static inline int sl_insert(SkipList *sl, int key) {
    SLNode *update[SL_MAX_LEVEL];
    SLNode *cur = sl->head;

    for (int i = sl->level - 1; i >= 0; i--) {
        while (cur->forward[i] && cur->forward[i]->key < key)
            cur = cur->forward[i];
        update[i] = cur;
    }

    cur = cur->forward[0];
    if (cur && cur->key == key) return 0;   /* duplicate */

    int new_level = sl_random_level();
    if (new_level > sl->level) {
        for (int i = sl->level; i < new_level; i++)
            update[i] = sl->head;
        sl->level = new_level;
    }

    SLNode *node = sl_alloc_node(key, new_level);
    for (int i = 0; i < new_level; i++) {
        node->forward[i]    = update[i]->forward[i];
        update[i]->forward[i] = node;
    }
    sl->size++;
    return 1;
}

/* ── Search ─────────────────────────────────────────────────────── */
static inline int sl_contains(const SkipList *sl, int key) {
    SLNode *cur = sl->head;
    for (int i = sl->level - 1; i >= 0; i--)
        while (cur->forward[i] && cur->forward[i]->key < key)
            cur = cur->forward[i];
    cur = cur->forward[0];
    return cur && cur->key == key;
}

/* ── Delete ─────────────────────────────────────────────────────── */
static inline int sl_remove(SkipList *sl, int key) {
    SLNode *update[SL_MAX_LEVEL];
    SLNode *cur = sl->head;

    for (int i = sl->level - 1; i >= 0; i--) {
        while (cur->forward[i] && cur->forward[i]->key < key)
            cur = cur->forward[i];
        update[i] = cur;
    }

    cur = cur->forward[0];
    if (!cur || cur->key != key) return 0;

    for (int i = 0; i < sl->level; i++) {
        if (update[i]->forward[i] != cur) break;
        update[i]->forward[i] = cur->forward[i];
    }
    free(cur);

    while (sl->level > 1 && !sl->head->forward[sl->level - 1])
        sl->level--;

    sl->size--;
    return 1;
}

/* ── Find-min ───────────────────────────────────────────────────── */
static inline int sl_find_min(const SkipList *sl, int *out) {
    if (!sl->head->forward[0]) return 0;
    *out = sl->head->forward[0]->key;
    return 1;
}

#endif /* SKIP_LIST_H */
