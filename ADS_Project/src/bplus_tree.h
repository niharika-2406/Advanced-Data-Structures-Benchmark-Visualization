#ifndef BPLUS_TREE_H
#define BPLUS_TREE_H
/*
 * B+ Tree (minimum degree T=3)
 * All data keys reside in leaf nodes only.
 * Internal nodes hold separator keys for routing only.
 * Leaf nodes are linked in a singly-linked list (ascending order).
 *
 * Insert:      O(log n)
 * Search:      O(log n)
 * Delete:      O(log n)
 * Find-min:    O(log n)  — follow leftmost path to first leaf
 * Extract-min: O(log n)
 */
#include <stdlib.h>
#include <stddef.h>
#include <string.h>

#define BPT_T 3   /* min degree; max keys per node = 2*BPT_T-1 = 5 */

typedef struct BPTNode {
    int            keys[2*BPT_T - 1];  /* keys (data in leaves, separators in internal) */
    struct BPTNode *children[2*BPT_T]; /* child pointers (internal nodes only)          */
    struct BPTNode *next;              /* next leaf pointer (leaf nodes only)            */
    int            n;                  /* current number of keys                         */
    int            is_leaf;            /* 1 = leaf, 0 = internal                         */
} BPTNode;

typedef struct {
    BPTNode *root;
    size_t   size;  /* number of distinct keys stored */
} BPlusTree;

/* ── Alloc ──────────────────────────────────────────────────────── */
static inline BPTNode *bpt_alloc(int is_leaf) {
    BPTNode *x = (BPTNode *)calloc(1, sizeof(BPTNode));
    x->is_leaf = is_leaf;
    return x;
}

/* ── Lifecycle ──────────────────────────────────────────────────── */
static inline void bpt_init(BPlusTree *t) {
    t->root = bpt_alloc(1); /* start with a single empty leaf */
    t->size = 0;
}

static void bpt_destroy_node(BPTNode *x) {
    if (!x) return;
    if (!x->is_leaf)
        for (int i = 0; i <= x->n; i++)
            bpt_destroy_node(x->children[i]);
    free(x);
}

static inline void bpt_destroy(BPlusTree *t) {
    bpt_destroy_node(t->root);
    t->root = NULL;
    t->size = 0;
}

/* ── Search ─────────────────────────────────────────────────────── */
/* Walk down to the leaf that would contain key, then scan linearly. */
static inline int bpt_contains(const BPlusTree *t, int key) {
    BPTNode *x = t->root;
    while (!x->is_leaf) {
        int i = 0;
        while (i < x->n && key >= x->keys[i]) i++;
        x = x->children[i];
    }
    /* linear scan of leaf */
    for (int i = 0; i < x->n; i++)
        if (x->keys[i] == key) return 1;
    return 0;
}

/* ── Find-min ───────────────────────────────────────────────────── */
static inline int bpt_find_min(const BPlusTree *t, int *out) {
    if (!t->root || t->root->n == 0) return 0;
    BPTNode *x = t->root;
    while (!x->is_leaf) x = x->children[0];
    /* Skip empty leaves (can occur after lazy deletion) */
    while (x && x->n == 0) x = x->next;
    if (!x) return 0;
    *out = x->keys[0];
    return 1;
}

/* ── Split leaf child ───────────────────────────────────────────── */
/*
 * Split x->children[i] (a full leaf) into two leaves.
 * Copy-up rule: the first key of the new right leaf is copied to parent x.
 * The key stays in the right leaf (unlike B-Tree push-up).
 */
static void bpt_split_leaf(BPTNode *x, int i) {
    BPTNode *y = x->children[i];   /* full leaf to split */
    BPTNode *z = bpt_alloc(1);     /* new right leaf     */

    int mid = BPT_T - 1;           /* index of first key going to z */

    /* Copy right half of y into z */
    z->n = y->n - mid;
    for (int j = 0; j < z->n; j++)
        z->keys[j] = y->keys[mid + j];

    /* Truncate y */
    y->n = mid;

    /* Wire z into the leaf linked list after y */
    z->next = y->next;
    y->next = z;

    /* Insert separator (copy of z->keys[0]) into parent x */
    for (int j = x->n; j > i; j--) {
        x->keys[j]         = x->keys[j - 1];
        x->children[j + 1] = x->children[j];
    }
    x->keys[i]         = z->keys[0];  /* copy-up */
    x->children[i + 1] = z;
    x->n++;
}

/* ── Split internal child ───────────────────────────────────────── */
/*
 * Split x->children[i] (a full internal node) into two internal nodes.
 * Push-up rule: the middle key is pushed up to parent x and removed from child.
 */
static void bpt_split_internal(BPTNode *x, int i) {
    BPTNode *y = x->children[i];
    BPTNode *z = bpt_alloc(0);

    int mid = BPT_T - 1;  /* index of key to push up */

    /* Right half of y's keys (after mid) go to z */
    z->n = y->n - mid - 1;
    for (int j = 0; j < z->n; j++)
        z->keys[j] = y->keys[mid + 1 + j];
    for (int j = 0; j <= z->n; j++)
        z->children[j] = y->children[mid + 1 + j];

    /* Truncate y (mid key is pushed up, not kept) */
    int push_key = y->keys[mid];
    y->n = mid;

    /* Insert push_key and z into parent x */
    for (int j = x->n; j > i; j--) {
        x->keys[j]         = x->keys[j - 1];
        x->children[j + 1] = x->children[j];
    }
    x->keys[i]         = push_key;
    x->children[i + 1] = z;
    x->n++;
}

/* ── Insert into non-full node (recursive) ──────────────────────── */
static void bpt_insert_nonfull(BPTNode *x, int key) {
    if (x->is_leaf) {
        /* Insert key in sorted order */
        int i = x->n - 1;
        while (i >= 0 && key < x->keys[i]) {
            x->keys[i + 1] = x->keys[i];
            i--;
        }
        x->keys[i + 1] = key;
        x->n++;
    } else {
        /* Find child to descend into */
        int i = x->n - 1;
        while (i >= 0 && key < x->keys[i]) i--;
        i++;
        BPTNode *child = x->children[i];
        if (child->n == 2*BPT_T - 1) {
            /* Proactive split before descending */
            if (child->is_leaf)
                bpt_split_leaf(x, i);
            else
                bpt_split_internal(x, i);
            /* After split, decide which of the two children to follow */
            if (key >= x->keys[i]) i++;
        }
        bpt_insert_nonfull(x->children[i], key);
    }
}

/* ── Public insert ──────────────────────────────────────────────── */
static inline void bpt_insert(BPlusTree *t, int key) {
    /* Duplicate check */
    if (bpt_contains(t, key)) return;

    BPTNode *r = t->root;
    if (r->n == 2*BPT_T - 1) {
        /* Root is full — grow the tree upward */
        BPTNode *s = bpt_alloc(0);
        s->children[0] = r;
        t->root = s;
        if (r->is_leaf)
            bpt_split_leaf(s, 0);
        else
            bpt_split_internal(s, 0);
        bpt_insert_nonfull(s, key);
    } else {
        bpt_insert_nonfull(r, key);
    }
    t->size++;
}

/* ── Delete with full rebalancing ───────────────────────────────── */
/*
 * Proper B+ Tree delete:
 *   - Remove key from the correct leaf.
 *   - On underflow (n < T-1 keys), try to borrow from a sibling first.
 *   - If borrow is not possible, merge with a sibling and remove the
 *     separator from the parent (which may cascade upward).
 * Returns 1 if removed, 0 if not found.
 */

/*
 * Merge children[i] (left) and children[i+1] (right) of parent x.
 * For leaves  : concatenate keys, fix linked list, remove separator from x.
 * For internal: pull separator down into left child, then concatenate.
 * The right child node is freed.
 */
static void bpt_merge_children(BPTNode *x, int i) {
    BPTNode *left  = x->children[i];
    BPTNode *right = x->children[i + 1];

    if (left->is_leaf) {
        /* Copy all keys from right into left */
        for (int j = 0; j < right->n; j++)
            left->keys[left->n + j] = right->keys[j];
        left->n += right->n;
        left->next = right->next;   /* fix linked list */
    } else {
        /* Pull separator key down into left, then copy right's keys+children */
        left->keys[left->n] = x->keys[i];
        left->n++;
        for (int j = 0; j < right->n; j++)
            left->keys[left->n + j] = right->keys[j];
        for (int j = 0; j <= right->n; j++)
            left->children[left->n + j] = right->children[j];
        left->n += right->n;
    }

    /* Remove separator key[i] and child pointer[i+1] from parent */
    for (int j = i; j < x->n - 1; j++)
        x->keys[j] = x->keys[j + 1];
    for (int j = i + 1; j < x->n; j++)
        x->children[j] = x->children[j + 1];
    x->n--;

    free(right);
}

/*
 * Borrow a key from the left sibling (children[i-1]) into children[i].
 * For leaves  : move last key of left into front of right; update separator.
 * For internal: rotate through parent separator.
 */
static void bpt_borrow_from_left(BPTNode *parent, int i) {
    BPTNode *left  = parent->children[i - 1];
    BPTNode *right = parent->children[i];

    if (right->is_leaf) {
        /* Shift right's keys right by one */
        for (int j = right->n; j > 0; j--)
            right->keys[j] = right->keys[j - 1];
        right->keys[0] = left->keys[left->n - 1];
        right->n++;
        left->n--;
        /* Update separator in parent to new first key of right */
        parent->keys[i - 1] = right->keys[0];
    } else {
        /* Shift right's keys and children right */
        for (int j = right->n; j > 0; j--)
            right->keys[j] = right->keys[j - 1];
        for (int j = right->n + 1; j > 0; j--)
            right->children[j] = right->children[j - 1];
        right->keys[0]     = parent->keys[i - 1];
        right->children[0] = left->children[left->n];
        right->n++;
        parent->keys[i - 1] = left->keys[left->n - 1];
        left->n--;
    }
}

/*
 * Borrow a key from the right sibling (children[i+1]) into children[i].
 */
static void bpt_borrow_from_right(BPTNode *parent, int i) {
    BPTNode *left  = parent->children[i];
    BPTNode *right = parent->children[i + 1];

    if (left->is_leaf) {
        left->keys[left->n] = right->keys[0];
        left->n++;
        /* Shift right's keys left */
        for (int j = 0; j < right->n - 1; j++)
            right->keys[j] = right->keys[j + 1];
        right->n--;
        /* Update separator */
        parent->keys[i] = right->keys[0];
    } else {
        left->keys[left->n]         = parent->keys[i];
        left->children[left->n + 1] = right->children[0];
        left->n++;
        parent->keys[i] = right->keys[0];
        /* Shift right's keys and children left */
        for (int j = 0; j < right->n - 1; j++)
            right->keys[j] = right->keys[j + 1];
        for (int j = 0; j < right->n; j++)
            right->children[j] = right->children[j + 1];
        right->n--;
    }
}

/*
 * Recursive delete. Returns 1 if key was removed, 0 if not found.
 * After returning, caller must check if x underflowed and fix it.
 */
static int bpt_delete_node(BPTNode *x, int key) {
    if (x->is_leaf) {
        for (int i = 0; i < x->n; i++) {
            if (x->keys[i] == key) {
                for (int j = i + 1; j < x->n; j++)
                    x->keys[j - 1] = x->keys[j];
                x->n--;
                return 1;
            }
        }
        return 0;
    }

    /* Find child to descend into */
    int i = 0;
    while (i < x->n && key >= x->keys[i]) i++;
    BPTNode *child = x->children[i];

    int removed = bpt_delete_node(child, key);
    if (!removed) return 0;

    /* Check if child underflowed (needs at least T-1 keys, except root) */
    if (child->n < BPT_T - 1) {
        /* Try borrow from left sibling */
        if (i > 0 && x->children[i - 1]->n > BPT_T - 1) {
            bpt_borrow_from_left(x, i);
        }
        /* Try borrow from right sibling */
        else if (i < x->n && x->children[i + 1]->n > BPT_T - 1) {
            bpt_borrow_from_right(x, i);
        }
        /* Merge: prefer merging with left sibling */
        else if (i > 0) {
            bpt_merge_children(x, i - 1);
        } else {
            bpt_merge_children(x, i);
        }
    }
    return 1;
}

static inline int bpt_remove(BPlusTree *t, int key) {
    if (!t->root || t->root->n == 0) return 0;

    int removed = bpt_delete_node(t->root, key);
    if (!removed) return 0;

    /* If root became empty and has a child, shrink tree height */
    if (t->root->n == 0 && !t->root->is_leaf) {
        BPTNode *old_root = t->root;
        t->root = old_root->children[0];
        free(old_root);
    }

    t->size--;
    return 1;
}

/* ── Extract-min ────────────────────────────────────────────────── */
static inline int bpt_extract_min(BPlusTree *t, int *out) {
    if (!bpt_find_min(t, out)) return 0;
    bpt_remove(t, *out);
    return 1;
}

#endif /* BPLUS_TREE_H */
