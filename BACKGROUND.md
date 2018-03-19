This is a draft of what should probably become a blog post.

Abstract Syntax Trees
=====================

For ABTs to make sense, you want to start with how functional and logic programming langauges represent tree
structured data (like Abstract Syntax Trees for programming langauges, or ASTs).

```
      node
     /    \
   node   leaf
  /    \
leaf   node
      /    \
    leaf  leaf
```

Would be described in a Prolog-like language, or in an ML-like language, as
`node(node(leaf(),node(leaf(),leaf())),leaf())`. (More or less: in an ML-like language you'd probably writeh
`Node` and `Leaf` instead of `node` and `leaf`. You'd also probably write `leaf` instead of `leaf()` in both
Prolog and ML, but we're _not_ going to do that here, and that's an important difference.)

In Haskell, you'd write `Node (Node Leaf (Node Leaf Leaf)) Leaf)`. Totally the same idea, and you can 100%
think about Abstract Syntax trees and Abstract Binding Trees using this
[curried](https://en.wikipedia.org/wiki/Currying) style to think about abstract binding trees, but we're not
going to do that.

Holey Abstract Syntax Trees
===========================

In many algorithms, we want to think about tree-structured data with some bits missing:

```
      node
     /    \
   node   leaf
  /    \
[ x ]  [ y ]
```

These holes are given names so that there can be more than one hole. The fundamental interesting thing we do
with trees-that-have-bits-missing is we plug things into the holes:

```
      node                                              node
     /    \               node                         /    \
   node   leaf     plug   /  \   in for x            node   leaf
  /    \               leaf  leaf                   /    \
[ x ]  [ y ]       ------------------------->    node    [ y ]
                                                 /  \
                                              leaf  leaf
```

We can also have new named holes in the thigns we plug in for other holes!

```
      node                                              node
     /    \               node                         /    \
   node   leaf     plug   /  \  in for x             node   leaf
  /    \              [ z ]  leaf                   /    \
[ x ]  [ y ]       ------------------------->    node   [ y ]
                                                 /  \
                                             [ z ]  leaf
```

We'd represent our first "before" tree as `node(node(x, y), leaf())`. That's why we left the
parentheses on `leaf()` before: we wanted leaf to be a concrete thing, a tree leaf, not a hole with a name.

Terminology
-----------

We'll now start calling the holes-with-names (`x`, `y`, ...) _variables_, the names-of-concrete-things
(`node`, `leaf`, ...) _operators_.

Plugging in a tree for a variable is called _substitution_. Substitution
always plugs in _all_ the holes with a given name:

```
      node                                              node
     /    \                                            /    \
   node   leaf     plug   leaf   in for x            node   leaf
  /    \           ------------------------->       /    \
[ x ]  [ x ]                                     leaf    leaf
```

Substituting `[leaf() / x] node(node(x,x),leaf())` results in `node(node(leaf(),leaf()),leaf())`.

Abstract Binding Trees
======================

TODO

Alpha-Equivalence
=================

TODO