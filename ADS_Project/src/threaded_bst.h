#ifndef THREADED_BST_H
#define THREADED_BST_H
/*
 * Threaded Binary Search Tree
 * In-order threading: null right pointers point to in-order successor;
 * null left pointers point to in-order predecessor.
 * isRThread / isLThread flags distinguish real children from threads.
 *
 * Insert:  O(log n) average, O(n) worst
 * Search:  O(log n) average
 * Delete:  O(log n) average
 * Inorder: O(n) without recursion or stack
 */
#include <stdlib.h>
#include <stddef.h>

typedef struct TBTNode {
    int            key;
    struct TBTNode *left;
    struct TBTNode *right;
    int            lThread;   /* 1 = left pointer is a thread */
    int            rThread;   /* 1 = right pointer is a thread */
} TBTNode;

typedef struct {
    TBTNode *root;
    size_t   size;
} ThreadedBST;

/* ── Lifecycle ──────────────────────────────────────────────────── */
static inline void tbt_init(ThreadedBST *t) {
    t->root = NULL;
    t->size = 0;
}

static void tbt_destroy_node(TBTNode *n) {
    if (!n) return;
    if (!n->lThread) tbt_destroy_node(n->left);
    if (!n->rThread) tbt_destroy_node(n->right);
    free(n);
}

static inline void tbt_destroy(ThreadedBST *t) {
    tbt_destroy_node(t->root);
    t->root = NULL;
    t->size = 0;
}

/* ── Insert ─────────────────────────────────────────────────────── */
static inline int tbt_insert(ThreadedBST *t, int key) {
    TBTNode *node = (TBTNode *)malloc(sizeof(TBTNode));
    node->key = key; node->lThread = 0; node->rThread = 0;
    node->left = NULL; node->right = NULL;

    if (!t->root) {
        t->root = node; t->size++;
        return 1;
    }

    TBTNode *cur = t->root, *par = NULL;
    int goLeft = 0;
    while (cur) {
        if (key == cur->key) { free(node); return 0; }
        par = cur;
        if (key < cur->key) {
            goLeft = 1;
            if (cur->lThread || !cur->left) break;
            cur = cur->left;
        } else {
            goLeft = 0;
            if (cur->rThread || !cur->right) break;
            cur = cur->right;
        }
    }

    if (goLeft) {
        node->left    = par->left;  node->lThread = par->lThread;
        node->right   = par;        node->rThread = 1;
        par->left     = node;       par->lThread  = 0;
    } else {
        node->right   = par->right; node->rThread = par->rThread;
        node->left    = par;        node->lThread = 1;
        par->right    = node;       par->rThread  = 0;
    }
    t->size++;
    return 1;
}

/* ── Search ─────────────────────────────────────────────────────── */
static inline int tbt_contains(const ThreadedBST *t, int key) {
    TBTNode *n = t->root;
    while (n) {
        if (key == n->key) return 1;
        if (key < n->key) {
            if (n->lThread || !n->left) return 0;
            n = n->left;
        } else {
            if (n->rThread || !n->right) return 0;
            n = n->right;
        }
    }
    return 0;
}

/* ── In-order traversal (no stack, uses threads) ───────────────── */
static inline TBTNode *tbt_leftmost(TBTNode *n) {
    if (!n) return NULL;
    while (n->left && !n->lThread) n = n->left;
    return n;
}

/* Caller iterates: start = tbt_leftmost(t->root), then tbt_inorder_next */
static inline TBTNode *tbt_inorder_next(TBTNode *n) {
    if (n->rThread) return n->right;
    return tbt_leftmost(n->right);
}

/* ── Find-min ───────────────────────────────────────────────────── */
static inline int tbt_find_min(const ThreadedBST *t, int *out) {
    TBTNode *n = tbt_leftmost(t->root);
    if (!n) return 0;
    *out = n->key;
    return 1;
}

#endif /* THREADED_BST_H */
