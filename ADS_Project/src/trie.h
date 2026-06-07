#ifndef TRIE_H
#define TRIE_H
/*
 * Trie (Prefix Tree)
 * Each node stores one character and a fixed-size children array (ASCII).
 * Words are marked with is_end = 1.
 *
 * Insert:  O(m)  where m = word length
 * Search:  O(m)
 * Delete:  O(m)
 * Space:   O(ALPHA * n * m) worst case
 */
#include <stdlib.h>
#include <string.h>
#include <stddef.h>

#define TRIE_ALPHA 128   /* ASCII range */

typedef struct TrieNode {
    struct TrieNode *children[TRIE_ALPHA];
    int              is_end;
} TrieNode;

typedef struct {
    TrieNode *root;
    size_t    size;   /* number of complete words */
} Trie;

/* ── Lifecycle ──────────────────────────────────────────────────── */
static inline TrieNode *trie_alloc_node(void) {
    TrieNode *n = (TrieNode *)calloc(1, sizeof(TrieNode));
    return n;
}

static inline void trie_init(Trie *t) {
    t->root = trie_alloc_node();
    t->size = 0;
}

static void trie_destroy_node(TrieNode *n) {
    if (!n) return;
    for (int i = 0; i < TRIE_ALPHA; i++)
        trie_destroy_node(n->children[i]);
    free(n);
}

static inline void trie_destroy(Trie *t) {
    trie_destroy_node(t->root);
    t->root = NULL;
    t->size = 0;
}

/* ── Insert ─────────────────────────────────────────────────────── */
static inline int trie_insert(Trie *t, const char *word) {
    TrieNode *node = t->root;
    for (int i = 0; word[i]; i++) {
        unsigned char c = (unsigned char)word[i];
        if (!node->children[c])
            node->children[c] = trie_alloc_node();
        node = node->children[c];
    }
    if (node->is_end) return 0;   /* duplicate */
    node->is_end = 1;
    t->size++;
    return 1;
}

/* ── Search ─────────────────────────────────────────────────────── */
static inline int trie_contains(const Trie *t, const char *word) {
    TrieNode *node = t->root;
    for (int i = 0; word[i]; i++) {
        unsigned char c = (unsigned char)word[i];
        if (!node->children[c]) return 0;
        node = node->children[c];
    }
    return node->is_end;
}

/* ── Prefix check ───────────────────────────────────────────────── */
static inline int trie_has_prefix(const Trie *t, const char *prefix) {
    TrieNode *node = t->root;
    for (int i = 0; prefix[i]; i++) {
        unsigned char c = (unsigned char)prefix[i];
        if (!node->children[c]) return 0;
        node = node->children[c];
    }
    return 1;
}

/* ── Delete ─────────────────────────────────────────────────────── */
/* Returns 1 if the node should be deleted by its parent */
static int _trie_delete(TrieNode *node, const char *word, int depth, int *removed) {
    if (!node) return 0;
    if (!word[depth]) {
        if (!node->is_end) return 0;
        node->is_end = 0;
        *removed = 1;
        for (int i = 0; i < TRIE_ALPHA; i++)
            if (node->children[i]) return 0;
        return 1;   /* leaf — safe to free */
    }
    unsigned char c = (unsigned char)word[depth];
    if (_trie_delete(node->children[c], word, depth + 1, removed)) {
        free(node->children[c]);
        node->children[c] = NULL;
        if (!node->is_end) {
            for (int i = 0; i < TRIE_ALPHA; i++)
                if (node->children[i]) return 0;
            return 1;
        }
    }
    return 0;
}

static inline int trie_remove(Trie *t, const char *word) {
    int removed = 0;
    _trie_delete(t->root, word, 0, &removed);
    if (removed) t->size--;
    return removed;
}

#endif /* TRIE_H */
