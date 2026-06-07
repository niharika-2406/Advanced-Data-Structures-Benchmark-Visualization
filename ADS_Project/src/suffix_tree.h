#ifndef SUFFIX_TREE_H
#define SUFFIX_TREE_H
/*
 * Suffix Tree (simplified / naive construction)
 * Stores all suffixes of a string as a compressed trie.
 * Each edge carries a substring label [start, end).
 * Leaves store the suffix start index.
 *
 * Build:   O(n^2) naive — sufficient for educational use
 * Search:  O(m)   where m = pattern length
 * Space:   O(n^2) worst case
 *
 * For production use, replace build with Ukkonen's O(n) algorithm.
 */
#include <stdlib.h>
#include <string.h>
#include <stddef.h>

#define ST_MAX_CHILDREN 128   /* ASCII */

typedef struct STNode {
    struct STNode *children[ST_MAX_CHILDREN];
    int            start;        /* start index in the text */
    int            end;          /* exclusive end index (-1 = leaf / open) */
    int            suffix_index; /* -1 for internal nodes */
} STNode;

typedef struct {
    STNode *root;
    char   *text;
    size_t  text_len;
} SuffixTree;

/* ── Alloc ──────────────────────────────────────────────────────── */
static inline STNode *st_alloc_node(int start, int end) {
    STNode *n = (STNode *)calloc(1, sizeof(STNode));
    n->start        = start;
    n->end          = end;
    n->suffix_index = -1;
    return n;
}

/* ── Lifecycle ──────────────────────────────────────────────────── */
static void st_destroy_node(STNode *n) {
    if (!n) return;
    for (int i = 0; i < ST_MAX_CHILDREN; i++)
        st_destroy_node(n->children[i]);
    free(n);
}

static inline void st_destroy(SuffixTree *t) {
    st_destroy_node(t->root);
    free(t->text);
    t->root = NULL; t->text = NULL; t->text_len = 0;
}

/* ── Build (naive O(n^2)) ───────────────────────────────────────── */
static inline void st_build(SuffixTree *t, const char *text) {
    st_destroy(t);
    size_t n = strlen(text);
    /* Append sentinel '$' */
    t->text = (char *)malloc(n + 2);
    memcpy(t->text, text, n);
    t->text[n] = '$'; t->text[n+1] = '\0';
    t->text_len = n + 1;
    t->root = st_alloc_node(-1, -1);

    for (int i = 0; i < (int)t->text_len; i++) {
        /* Insert suffix t->text[i..] */
        STNode *cur = t->root;
        int j = i;
        while (j < (int)t->text_len) {
            unsigned char c = (unsigned char)t->text[j];
            if (!cur->children[c]) {
                STNode *leaf = st_alloc_node(j, (int)t->text_len);
                leaf->suffix_index = i;
                cur->children[c] = leaf;
                break;
            }
            STNode *child = cur->children[c];
            int k = child->start;
            /* Walk along the edge */
            while (k < child->end && j < (int)t->text_len &&
                   t->text[k] == t->text[j]) { k++; j++; }
            if (k == child->end) { cur = child; continue; }
            /* Split edge */
            STNode *split = st_alloc_node(child->start, k);
            cur->children[c] = split;
            child->start = k;
            split->children[(unsigned char)t->text[k]] = child;
            if (j < (int)t->text_len) {
                STNode *leaf = st_alloc_node(j, (int)t->text_len);
                leaf->suffix_index = i;
                split->children[(unsigned char)t->text[j]] = leaf;
            } else {
                split->suffix_index = i;
            }
            break;
        }
    }
}

/* ── Search ─────────────────────────────────────────────────────── */
/* Returns 1 if pattern occurs in the text, 0 otherwise */
static inline int st_contains(const SuffixTree *t, const char *pattern) {
    if (!t->root || !t->text) return 0;
    STNode *cur = t->root;
    int i = 0;
    int m = (int)strlen(pattern);
    while (i < m) {
        unsigned char c = (unsigned char)pattern[i];
        if (!cur->children[c]) return 0;
        STNode *child = cur->children[c];
        int k = child->start;
        while (k < child->end && i < m) {
            if (t->text[k] != pattern[i]) return 0;
            k++; i++;
        }
        cur = child;
    }
    return 1;
}

#endif /* SUFFIX_TREE_H */
