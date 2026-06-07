#ifndef AVL_TREE_H
#define AVL_TREE_H
/*
 * AVL Tree  (Adelson-Velsky & Landis, 1962)
 * Self-balancing BST where |balance_factor| <= 1 for every node.
 * Stricter than Red-Black Tree -> shorter height -> faster lookups.
 *
 * Insert:      O(log n)  — at most 2 rotations
 * Delete:      O(log n)  — at most O(log n) rotations
 * Search:      O(log n)
 * Find-Min:    O(log n)
 * Extract-Min: O(log n)
 */
#include <stdlib.h>
#include <stddef.h>

typedef struct AVLNode {
    int            key;
    int            height;
    struct AVLNode *left;
    struct AVLNode *right;
} AVLNode;

typedef struct {
    AVLNode *root;
    size_t   size;
} AVLTree;

/* ── Helpers ────────────────────────────────────────────────────── */
static inline int avl_height(const AVLNode *n) {
    return n ? n->height : 0;
}

static inline int avl_max(int a, int b) {
    return a > b ? a : b;
}

static inline void avl_update_height(AVLNode *n) {
    if (n) n->height = 1 + avl_max(avl_height(n->left), avl_height(n->right));
}

static inline int avl_bf(const AVLNode *n) {
    return n ? avl_height(n->left) - avl_height(n->right) : 0;
}

static inline AVLNode *avl_alloc(int key) {
    AVLNode *n  = (AVLNode *)malloc(sizeof(AVLNode));
    n->key      = key;
    n->height   = 1;
    n->left     = n->right = NULL;
    return n;
}

/* ── Rotations ──────────────────────────────────────────────────── */
static AVLNode *avl_rotate_right(AVLNode *y) {
    AVLNode *x = y->left;
    AVLNode *T = x->right;
    x->right   = y;
    y->left    = T;
    avl_update_height(y);
    avl_update_height(x);
    return x;
}

static AVLNode *avl_rotate_left(AVLNode *x) {
    AVLNode *y = x->right;
    AVLNode *T = y->left;
    y->left    = x;
    x->right   = T;
    avl_update_height(x);
    avl_update_height(y);
    return y;
}

/* ── Balance ────────────────────────────────────────────────────── */
/*
 * AVL Rotation Cases (triggered when |bf| > 1 after insert or delete):
 *
 *  Case 1 — Left-Left (LL):
 *    Inserted/deleted in the LEFT subtree of the LEFT child.
 *    bf(n) > 1  AND  bf(n->left) >= 0
 *    Fix: single right rotation on n.
 *
 *        n (bf=+2)            x
 *       /                    / \
 *      x (bf=+1)    =>      z   n
 *     /
 *    z
 *
 *  Case 2 — Left-Right (LR):
 *    Inserted/deleted in the RIGHT subtree of the LEFT child.
 *    bf(n) > 1  AND  bf(n->left) < 0
 *    Fix: left rotation on n->left, then right rotation on n.
 *
 *        n (bf=+2)            z
 *       /                    / \
 *      x (bf=-1)    =>      x   n
 *       \
 *        z
 *
 *  Case 3 — Right-Right (RR):
 *    Inserted/deleted in the RIGHT subtree of the RIGHT child.
 *    bf(n) < -1  AND  bf(n->right) <= 0
 *    Fix: single left rotation on n.
 *
 *    n (bf=-2)                y
 *     \                      / \
 *      y (bf=-1)    =>      n   z
 *       \
 *        z
 *
 *  Case 4 — Right-Left (RL):
 *    Inserted/deleted in the LEFT subtree of the RIGHT child.
 *    bf(n) < -1  AND  bf(n->right) > 0
 *    Fix: right rotation on n->right, then left rotation on n.
 *
 *    n (bf=-2)                z
 *     \                      / \
 *      y (bf=+1)    =>      n   y
 *     /
 *    z
 */
static AVLNode *avl_balance(AVLNode *n) {
    avl_update_height(n);
    int bf = avl_bf(n);

    /* Left-heavy */
    if (bf > 1) {
        if (avl_bf(n->left) < 0)          /* Case 2: Left-Right (LR) */
            n->left = avl_rotate_left(n->left);
        return avl_rotate_right(n);        /* Case 1: Left-Left  (LL) */
    }
    /* Right-heavy */
    if (bf < -1) {
        if (avl_bf(n->right) > 0)          /* Case 4: Right-Left  (RL) */
            n->right = avl_rotate_right(n->right);
        return avl_rotate_left(n);         /* Case 3: Right-Right (RR) */
    }
    return n;  /* Already balanced — no rotation needed */
}

/* ── Lifecycle ──────────────────────────────────────────────────── */
static inline void avl_init(AVLTree *t) {
    t->root = NULL;
    t->size = 0;
}

static void avl_destroy_node(AVLNode *n) {
    if (!n) return;
    avl_destroy_node(n->left);
    avl_destroy_node(n->right);
    free(n);
}

static inline void avl_destroy(AVLTree *t) {
    avl_destroy_node(t->root);
    t->root = NULL;
    t->size = 0;
}

/* ── Insert ─────────────────────────────────────────────────────── */
/*
 * AVL Insertion — recursive BST insert followed by avl_balance() on
 * the way back up the call stack.
 *
 * Cases handled by avl_balance() after each recursive return:
 *   LL / LR — new key landed in left subtree  (bf becomes +2)
 *   RR / RL — new key landed in right subtree (bf becomes -2)
 *
 * At most 1 rotation (single or double) is needed after an insert
 * because only one node on the path becomes unbalanced.
 *
 * Duplicate keys are silently ignored (BST set semantics).
 */
static AVLNode *avl_insert_node(AVLNode *n, int key, int *inserted) {
    /* Base case: found the correct empty slot — create new leaf */
    if (!n) { *inserted = 1; return avl_alloc(key); }

    if      (key < n->key) n->left  = avl_insert_node(n->left,  key, inserted); /* go left  */
    else if (key > n->key) n->right = avl_insert_node(n->right, key, inserted); /* go right */
    /* else: duplicate key — do nothing, *inserted stays 0 */

    /* Rebalance on the way back up (handles LL, LR, RR, RL) */
    return avl_balance(n);
}

static inline void avl_insert(AVLTree *t, int key) {
    int inserted = 0;
    t->root = avl_insert_node(t->root, key, &inserted);
    if (inserted) t->size++;
}

/* ── Search ─────────────────────────────────────────────────────── */
static inline int avl_contains(const AVLTree *t, int key) {
    AVLNode *n = t->root;
    while (n) {
        if      (key == n->key) return 1;
        else if (key <  n->key) n = n->left;
        else                    n = n->right;
    }
    return 0;
}

/* ── Min node ───────────────────────────────────────────────────── */
static inline AVLNode *avl_min_node(AVLNode *n) {
    while (n->left) n = n->left;
    return n;
}

/* ── Delete ─────────────────────────────────────────────────────── */
/*
 * AVL Deletion — three structural cases, then avl_balance() on every
 * ancestor back to the root (up to O(log n) rotations may be needed).
 *
 *  Case 1 — Node has NO children (leaf):
 *    Simply free the node and return NULL.
 *
 *  Case 2 — Node has ONE child (left or right):
 *    Splice out the node: return its only child to the parent.
 *    The child takes the deleted node's position.
 *
 *  Case 3 — Node has TWO children:
 *    Cannot remove directly. Replace the node's key with its
 *    in-order successor (smallest key in the right subtree), then
 *    recursively delete that successor from the right subtree.
 *    The successor always falls into Case 1 or Case 2.
 *
 * After any structural change, avl_balance() is called on every node
 * on the path back to the root, fixing any LL/LR/RR/RL violations
 * that the height change may have introduced.
 */
static AVLNode *avl_remove_node(AVLNode *n, int key, int *removed) {
    if (!n) return NULL;  /* key not found */

    if      (key < n->key) n->left  = avl_remove_node(n->left,  key, removed); /* search left  */
    else if (key > n->key) n->right = avl_remove_node(n->right, key, removed); /* search right */
    else {
        /* Found the node to delete */
        *removed = 1;

        if (!n->left || !n->right) {
            /* Case 1 (leaf) or Case 2 (one child):
               Replace node with its only child (or NULL if leaf). */
            AVLNode *child = n->left ? n->left : n->right;
            free(n);
            return child;   /* child (or NULL) takes this node's place */
        }

        /* Case 3 (two children):
           Find in-order successor — leftmost node in right subtree. */
        AVLNode *succ = avl_min_node(n->right);
        n->key        = succ->key;   /* overwrite key with successor's key */
        /* Delete the successor from the right subtree (it has at most
           one child — a right child — so this is Case 1 or Case 2). */
        n->right = avl_remove_node(n->right, succ->key, &(int){0});
    }

    /* Rebalance on the way back up (handles LL, LR, RR, RL) */
    return avl_balance(n);
}

static inline int avl_remove(AVLTree *t, int key) {
    int removed = 0;
    t->root = avl_remove_node(t->root, key, &removed);
    if (removed) t->size--;
    return removed;
}

/* ── Priority ops ───────────────────────────────────────────────── */
static inline int avl_find_min(const AVLTree *t, int *out) {
    if (!t->root) return 0;
    *out = avl_min_node(t->root)->key;
    return 1;
}

static inline int avl_extract_min(AVLTree *t, int *out) {
    if (!avl_find_min(t, out)) return 0;
    avl_remove(t, *out);
    return 1;
}

#endif /* AVL_TREE_H */
