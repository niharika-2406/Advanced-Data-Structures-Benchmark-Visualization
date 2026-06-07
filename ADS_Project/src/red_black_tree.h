#ifndef RED_BLACK_TREE_H
#define RED_BLACK_TREE_H
/*
 * Red-Black Tree  (Cormen et al. CLRS, Chapter 13)
 * Properties:
 *   1. Every node is RED or BLACK
 *   2. Root is BLACK
 *   3. Every leaf (NIL sentinel) is BLACK
 *   4. RED node -> both children BLACK
 *   5. All root->leaf paths have equal black-height
 * Guarantees: Insert O(log n) | Delete O(log n) | Search O(log n)
 *             Height <= 2*log2(n+1)
 */
#include <stdlib.h>
#include <stddef.h>

typedef enum { RBT_RED = 0, RBT_BLACK = 1 } RBTColor;

typedef struct RBTNode {
    int             key;
    RBTColor        color;
    struct RBTNode *parent;
    struct RBTNode *left;
    struct RBTNode *right;
} RBTNode;

typedef struct {
    RBTNode *nil;   /* sentinel */
    RBTNode *root;
    size_t   size;
} RedBlackTree;

/* ── Lifecycle ──────────────────────────────────────────────────── */
static inline RBTNode *rbt_alloc_node(int key) {
    RBTNode *n = (RBTNode *)malloc(sizeof(RBTNode));
    n->key    = key;
    n->color  = RBT_RED;
    n->parent = n->left = n->right = NULL;
    return n;
}

static inline void rbt_init(RedBlackTree *t) {
    t->nil         = rbt_alloc_node(0);
    t->nil->color  = RBT_BLACK;
    t->nil->left   = t->nil->right = t->nil->parent = t->nil;
    t->root        = t->nil;
    t->size        = 0;
}

static void rbt_destroy_subtree(RedBlackTree *t, RBTNode *x) {
    if (x == t->nil) return;
    rbt_destroy_subtree(t, x->left);
    rbt_destroy_subtree(t, x->right);
    free(x);
}

static inline void rbt_destroy(RedBlackTree *t) {
    rbt_destroy_subtree(t, t->root);
    free(t->nil);
    t->root = t->nil = NULL;
    t->size = 0;
}

/* ── Rotations ──────────────────────────────────────────────────── */
static void rbt_rotate_left(RedBlackTree *t, RBTNode *x) {
    RBTNode *y = x->right;
    x->right   = y->left;
    if (y->left != t->nil) y->left->parent = x;
    y->parent  = x->parent;
    if      (x->parent == t->nil)       t->root        = y;
    else if (x == x->parent->left)  x->parent->left  = y;
    else                             x->parent->right = y;
    y->left    = x;
    x->parent  = y;
}

static void rbt_rotate_right(RedBlackTree *t, RBTNode *y) {
    RBTNode *x = y->left;
    y->left    = x->right;
    if (x->right != t->nil) x->right->parent = y;
    x->parent  = y->parent;
    if      (y->parent == t->nil)       t->root        = x;
    else if (y == y->parent->right) y->parent->right = x;
    else                             y->parent->left  = x;
    x->right   = y;
    y->parent  = x;
}

/* ── Insert fixup ───────────────────────────────────────────────── */
/*
 * After BST insertion the new node z is colored RED.
 * If z's parent is also RED, property 4 is violated.
 * We fix it by walking up the tree. At each step z's parent is RED
 * (loop invariant). There are 6 symmetric cases (3 left, 3 right).
 *
 * ── Parent is the LEFT child of grandparent ──────────────────────
 *
 *  Case 1 (Recolor): Uncle y is RED.
 *    Color parent and uncle BLACK, grandparent RED.
 *    Move z up to grandparent and continue.
 *
 *         G(B)              G(R)  ← z moves here
 *        / \               / \
 *      P(R) y(R)  =>    P(B) y(B)
 *      /
 *    z(R)
 *
 *  Case 2 (Left-Right → reduce to Case 3): Uncle y is BLACK, z is RIGHT child.
 *    Left-rotate on parent P to convert to Case 3.
 *
 *         G(B)              G(B)
 *        / \               / \
 *      P(R) y(B)  =>    z(R) y(B)
 *        \              /
 *        z(R)         P(R)
 *
 *  Case 3 (Left-Left): Uncle y is BLACK, z is LEFT child.
 *    Color parent BLACK, grandparent RED, right-rotate on grandparent.
 *    Loop terminates (parent is now BLACK).
 *
 *         G(B)              P(B)
 *        / \               / \
 *      P(R) y(B)  =>    z(R) G(R)
 *      /                      \
 *    z(R)                     y(B)
 *
 * ── Parent is the RIGHT child of grandparent (mirror) ────────────
 *
 *  Case 4 (Recolor): Uncle y is RED.  [mirror of Case 1]
 *    Color parent and uncle BLACK, grandparent RED, move z up.
 *
 *  Case 5 (Right-Left → reduce to Case 6): Uncle y is BLACK, z is LEFT child.
 *    Right-rotate on parent P to convert to Case 6.  [mirror of Case 2]
 *
 *  Case 6 (Right-Right): Uncle y is BLACK, z is RIGHT child.
 *    Color parent BLACK, grandparent RED, left-rotate on grandparent.
 *    Loop terminates.  [mirror of Case 3]
 *
 * Finally, always color the root BLACK (handles Case 1 propagating to root).
 */
static void rbt_insert_fixup(RedBlackTree *t, RBTNode *z) {
    while (z->parent->color == RBT_RED) {
        if (z->parent == z->parent->parent->left) {
            /* Parent is LEFT child of grandparent */
            RBTNode *y = z->parent->parent->right;  /* uncle */
            if (y->color == RBT_RED) {
                /* Case 1: Uncle RED — recolor and move up */
                z->parent->color         = RBT_BLACK;
                y->color                 = RBT_BLACK;
                z->parent->parent->color = RBT_RED;
                z = z->parent->parent;
            } else {
                /* Uncle is BLACK */
                if (z == z->parent->right) {
                    /* Case 2: z is RIGHT child — left-rotate to get Case 3 */
                    z = z->parent;
                    rbt_rotate_left(t, z);
                }
                /* Case 3: z is LEFT child — recolor + right-rotate */
                z->parent->color         = RBT_BLACK;
                z->parent->parent->color = RBT_RED;
                rbt_rotate_right(t, z->parent->parent);
            }
        } else {
            /* Parent is RIGHT child of grandparent (mirror cases) */
            RBTNode *y = z->parent->parent->left;   /* uncle */
            if (y->color == RBT_RED) {
                /* Case 4: Uncle RED — recolor and move up */
                z->parent->color         = RBT_BLACK;
                y->color                 = RBT_BLACK;
                z->parent->parent->color = RBT_RED;
                z = z->parent->parent;
            } else {
                /* Uncle is BLACK */
                if (z == z->parent->left) {
                    /* Case 5: z is LEFT child — right-rotate to get Case 6 */
                    z = z->parent;
                    rbt_rotate_right(t, z);
                }
                /* Case 6: z is RIGHT child — recolor + left-rotate */
                z->parent->color         = RBT_BLACK;
                z->parent->parent->color = RBT_RED;
                rbt_rotate_left(t, z->parent->parent);
            }
        }
    }
    t->root->color = RBT_BLACK;  /* Ensure root is always BLACK */
}

/* ── Insert ─────────────────────────────────────────────────────── */
static inline void rbt_insert(RedBlackTree *t, int key) {
    /* Duplicate check: walk to insertion point, bail if key exists */
    RBTNode *y = t->nil, *x = t->root;
    while (x != t->nil) {
        if (key == x->key) return;   /* duplicate — do nothing */
        y = x;
        x = (key < x->key) ? x->left : x->right;
    }
    RBTNode *z = rbt_alloc_node(key);
    z->left = z->right = z->parent = t->nil;
    z->parent = y;
    if      (y == t->nil)      t->root   = z;
    else if (key < y->key) y->left   = z;
    else                    y->right  = z;
    t->size++;
    rbt_insert_fixup(t, z);
}

/* ── Transplant ─────────────────────────────────────────────────── */
static void rbt_transplant(RedBlackTree *t, RBTNode *u, RBTNode *v) {
    if      (u->parent == t->nil)       t->root          = v;
    else if (u == u->parent->left)  u->parent->left  = v;
    else                             u->parent->right = v;
    v->parent = u->parent;
}

static RBTNode *rbt_minimum(RedBlackTree *t, RBTNode *x) {
    while (x->left != t->nil) x = x->left;
    return x;
}

/* ── Delete fixup ───────────────────────────────────────────────── */
/*
 * After splicing out a BLACK node, the path through x is short by one
 * black node, violating property 5.  We conceptually give x an "extra"
 * black and push it up the tree until it can be absorbed.
 *
 * Loop invariant: x is "doubly black" (or "black-and-red").
 * There are 8 cases (4 left, 4 right mirror).
 *
 * ── x is LEFT child of its parent ───────────────────────────────
 *
 *  Case 1: Sibling w is RED.
 *    Recolor w BLACK, parent RED, left-rotate on parent.
 *    New sibling of x is BLACK → falls into Case 2, 3, or 4.
 *
 *         P(B)                  w(B)
 *        / \                   / \
 *      x(DB) w(R)   =>       P(R)  D(B)
 *            / \             / \
 *          C(B) D(B)       x(DB) C(B)   ← new sibling is C
 *
 *  Case 2: Sibling w is BLACK, BOTH of w's children are BLACK.
 *    Remove one black from both x and w (w becomes RED), push the
 *    extra black up to parent. If parent was RED it absorbs it (done);
 *    otherwise parent becomes doubly black and loop continues.
 *
 *         P(?)                P(DB or B)
 *        / \                 / \
 *      x(DB) w(B)   =>    x(B) w(R)
 *            / \
 *          C(B) D(B)
 *
 *  Case 3: Sibling w is BLACK, w's LEFT child RED, RIGHT child BLACK.
 *    Recolor w RED, w->left BLACK, right-rotate on w.
 *    Converts to Case 4 (w's right child is now RED).
 *
 *         P(?)                P(?)
 *        / \                 / \
 *      x(DB) w(B)   =>    x(DB) C(B)
 *            / \                  \
 *          C(R) D(B)              w(R)
 *                                   \
 *                                   D(B)
 *
 *  Case 4: Sibling w is BLACK, w's RIGHT child is RED.
 *    Set w's color to parent's color, parent BLACK, w->right BLACK,
 *    left-rotate on parent. x loses its extra black. Loop ends.
 *
 *         P(c)                w(c)
 *        / \                 / \
 *      x(DB) w(B)   =>    P(B)  D(B)
 *            / \          /
 *          C(?) D(R)    x(B)
 *
 * ── x is RIGHT child of its parent (mirror cases 5–8) ───────────
 *
 *  Case 5: Sibling w is RED.              [mirror of Case 1]
 *    Right-rotate on parent, recolor.
 *
 *  Case 6: Sibling w BLACK, both children BLACK.  [mirror of Case 2]
 *    w becomes RED, push extra black up.
 *
 *  Case 7: Sibling w BLACK, w->right RED, w->left BLACK. [mirror of Case 3]
 *    Left-rotate on w, recolor → Case 8.
 *
 *  Case 8: Sibling w BLACK, w->left RED.  [mirror of Case 4]
 *    Right-rotate on parent, recolor. Loop ends.
 */
static void rbt_delete_fixup(RedBlackTree *t, RBTNode *x) {
    while (x != t->root && x->color == RBT_BLACK) {
        if (x == x->parent->left) {
            /* ── x is LEFT child ── */
            RBTNode *w = x->parent->right;  /* sibling */

            /* Case 1: Sibling w is RED */
            if (w->color == RBT_RED) {
                w->color           = RBT_BLACK;
                x->parent->color   = RBT_RED;
                rbt_rotate_left(t, x->parent);
                w = x->parent->right;   /* new sibling (BLACK) */
            }

            /* Cases 2–4: Sibling w is BLACK */
            if (w->left->color == RBT_BLACK && w->right->color == RBT_BLACK) {
                /* Case 2: Both of w's children BLACK — push black up */
                w->color = RBT_RED;
                x = x->parent;
            } else {
                if (w->right->color == RBT_BLACK) {
                    /* Case 3: w's right child BLACK, left child RED → rotate to Case 4 */
                    w->left->color = RBT_BLACK;
                    w->color       = RBT_RED;
                    rbt_rotate_right(t, w);
                    w = x->parent->right;
                }
                /* Case 4: w's right child RED — absorb extra black, done */
                w->color           = x->parent->color;
                x->parent->color   = RBT_BLACK;
                w->right->color    = RBT_BLACK;
                rbt_rotate_left(t, x->parent);
                x = t->root;    /* terminate loop */
            }
        } else {
            /* ── x is RIGHT child (mirror cases 5–8) ── */
            RBTNode *w = x->parent->left;   /* sibling */

            /* Case 5: Sibling w is RED */
            if (w->color == RBT_RED) {
                w->color           = RBT_BLACK;
                x->parent->color   = RBT_RED;
                rbt_rotate_right(t, x->parent);
                w = x->parent->left;    /* new sibling (BLACK) */
            }

            /* Cases 6–8: Sibling w is BLACK */
            if (w->right->color == RBT_BLACK && w->left->color == RBT_BLACK) {
                /* Case 6: Both of w's children BLACK — push black up */
                w->color = RBT_RED;
                x = x->parent;
            } else {
                if (w->left->color == RBT_BLACK) {
                    /* Case 7: w's left child BLACK, right child RED → rotate to Case 8 */
                    w->right->color = RBT_BLACK;
                    w->color        = RBT_RED;
                    rbt_rotate_left(t, w);
                    w = x->parent->left;
                }
                /* Case 8: w's left child RED — absorb extra black, done */
                w->color           = x->parent->color;
                x->parent->color   = RBT_BLACK;
                w->left->color     = RBT_BLACK;
                rbt_rotate_right(t, x->parent);
                x = t->root;    /* terminate loop */
            }
        }
    }
    x->color = RBT_BLACK;   /* absorb extra black if x is red-and-black */
}

/* ── Remove ─────────────────────────────────────────────────────── */
/*
 * RBT Deletion — three structural cases (same as plain BST), then
 * rbt_delete_fixup() if a BLACK node was removed.
 *
 *  Case A — Node z has NO left child:
 *    Transplant z's right child (possibly NIL) in place of z.
 *
 *  Case B — Node z has NO right child (but has a left child):
 *    Transplant z's left child in place of z.
 *
 *  Case C — Node z has TWO children:
 *    Find in-order successor y (minimum of right subtree).
 *    y has no left child (by definition of minimum).
 *    Sub-case C1: y is z's direct right child.
 *      Transplant y over z; attach z's left subtree to y.
 *    Sub-case C2: y is deeper in z's right subtree.
 *      Transplant y's right child over y, then transplant y over z.
 *    y inherits z's color; if y was BLACK, fixup is needed on x
 *    (y's former right child) because a black node was removed.
 *
 * rbt_delete_fixup() is called only when the removed/moved node's
 * original color was BLACK (removing a RED node never violates
 * black-height or any other RBT property).
 */
static inline int rbt_remove(RedBlackTree *t, int key) {
    /* Find the node to delete */
    RBTNode *z = t->root;
    while (z != t->nil) {
        if      (key == z->key) break;
        else if (key <  z->key) z = z->left;
        else                    z = z->right;
    }
    if (z == t->nil) return 0;  /* key not found */

    RBTNode *y = z, *x;
    RBTColor orig = y->color;   /* remember original color of node being removed */

    if (z->left == t->nil) {
        /* Case A: no left child — splice in right child */
        x = z->right;
        rbt_transplant(t, z, z->right);
    } else if (z->right == t->nil) {
        /* Case B: no right child — splice in left child */
        x = z->left;
        rbt_transplant(t, z, z->left);
    } else {
        /* Case C: two children — replace with in-order successor */
        y    = rbt_minimum(t, z->right);   /* successor (no left child) */
        orig = y->color;
        x    = y->right;                   /* x will replace y's position */

        if (y->parent == z) {
            /* Case C1: successor is z's direct right child */
            x->parent = y;
        } else {
            /* Case C2: successor is deeper — detach y first */
            rbt_transplant(t, y, y->right);
            y->right         = z->right;
            y->right->parent = y;
        }
        rbt_transplant(t, z, y);
        y->left         = z->left;
        y->left->parent = y;
        y->color        = z->color;  /* y takes z's color to preserve black-height */
    }
    free(z);
    t->size--;
    /* Fix RBT properties only if a BLACK node was removed */
    if (orig == RBT_BLACK) rbt_delete_fixup(t, x);
    return 1;
}

/* ── Search ─────────────────────────────────────────────────────── */
static inline int rbt_contains(const RedBlackTree *t, int key) {
    RBTNode *x = t->root;
    while (x != t->nil) {
        if      (key == x->key) return 1;
        else if (key <  x->key) x = x->left;
        else                    x = x->right;
    }
    return 0;
}

/* ── Priority ops ───────────────────────────────────────────────── */
/* Returns 1 and sets *out on success, 0 if empty */
static inline int rbt_find_min(const RedBlackTree *t, int *out) {
    if (t->root == t->nil) return 0;
    *out = rbt_minimum((RedBlackTree *)t, t->root)->key;
    return 1;
}

static inline int rbt_extract_min(RedBlackTree *t, int *out) {
    if (t->root == t->nil) return 0;
    RBTNode *m = rbt_minimum(t, t->root);
    *out = m->key;
    rbt_remove(t, m->key);
    return 1;
}

#endif /* RED_BLACK_TREE_H */
