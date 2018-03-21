A Typescript library for Abstract Binding Trees
===============================================

[![npm version](https://badge.fury.io/js/%40calculemus%2Fabt.svg)](https://badge.fury.io/js/%40calculemus%2Fabt)
[![Build Status](https://travis-ci.org/calculemuscode/abt-js.svg?branch=master)](https://travis-ci.org/calculemuscode/abt-js)
[![Dependency Status](https://david-dm.org/calculemuscode/abt-js.svg)](https://david-dm.org/calculemuscode/abt-js)
[![Dev Dependency Status](https://david-dm.org/calculemuscode/abt-js/dev-status.svg)](https://david-dm.org/calculemuscode/abt-js?type=dev)
[![Coverage Status](https://coveralls.io/repos/github/calculemuscode/abt-js/badge.svg?branch=master)](https://coveralls.io/github/calculemuscode/abt-js?branch=master)

This ABT library is based on Prof. Robert Harpers's book, Practical Foundations of Programming Languages, and
on course infrastructure used at Carnegie Mellon's Foundations of Programming Languages course. Compared to
the ABT library that was historically used in CMU's course, this ABT library:

 * Results in nicer looking output. The CMU course takes an approach to ABTs that has a failure mode: after
   you do some computation, the perfectly reasonable return-the-identity-function function that you wrote as
   `fn x => fn x => x` gets pretty-printed as the jibberish `fn x1251 => fn x1245 => x1245`. This ABT library
   (in default configuration) will print this out as the IMO much more reasonable `fn x => fn x1 => x1`.

 * Harder to use without screwing up. This is a direct consequence of printing nicer looking output. Most
   functions require an `immutable.Set<string>` of all free-or-potentially-free variables as an input, and if
   you get this wrong the behavior of the library is undefined. (The CMU-style ABT construction assumes that
   any variable ever exposed outside the library is free-or-potentially-free, which is why you end up with
   overly-renumbered variables floating around.)

 * More complicated in its implementation. Substitution and ABT equality are implemented "under the hood," and
   when students try to implement substitution and ABT equality under the hood in Foundations of Programming
   Langauges we tell them to not do that, and for good reasons: it's hard to get it right, even if it's a bit
   faster.

For an introduction to what Abstract Binding Trees are, see (XXX a blogpost I have yet to write), or [Chapter
1 in PFPL](http://www.cs.cmu.edu/~rwh/pfpl.html) for a mathematically rigorous introduction. For an
introduction to implementing and programming with ABTs in a functional programming langauge, see [this
post](http://semantic-domain.blogspot.com/2015/03/abstract-binding-trees.html) and [this
followup](http://semantic-domain.blogspot.com/2015/03/abstract-binding-trees-addendum.html) by Neel
Krishnaswami. In particular, I would point anyone interested in _implementing_ abstract binding trees to
Neel's code over my own.

Interface
=========

An Abstract Binding Tree has this Typescript type:

```typescript
type ABT = string | { tag: string, ... }`
```

To respect this library's interface, _do not access any fields of a non-string ABT_ aside from `tag`.

``` typescript
import { ABT, abt } from "@calculemus/abt";

function abtBoolToBool(syn: ABT): boolean {
    if (typeof syn === "string") throw new Error(`Expected true() or false(), got variable ${x}`);
    switch(x.tag) {
    case "true": return true;
    case "false": return false;
    default: throw new Error(`Expected true() or false(), got unexpected operator ${x.tag}`);
    }
}
```

ABTs are built and inspected by the methods of an `AbstractBindingTree` class; the default instantiation of
this class is provided in the library and called `abt`, which you can see imported in the example
above.

Objects of type `ABT` don't have any methods, they're only data objects.

Creating Abstract Binding Trees
-------------------------------

The introduction form for Abstract Binding Trees is the `oper` method.

``` typescript
abt.oper(tag: string, ...args: (ABT | [string[], ABT])[]): ABT
```

Let's unpack that a little bit. The first argument is the operator, or tag, and the remainder of the arguments
_can_ just be abstract binding trees:

``` typescript
import { ABT, abt } from "@calculemus/abt";

const twp: ABT = abt.oper("succ", abt.oper("succ", abt.oper("zero")));
const bintree: ABT = abt.oper("node", abt.oper("leaf"), abt.oper("leaf"));
```

This style doesn't give us any way to bind variables, though. It's a shorthand for the full syntax, where
every sub-ABT is a tuple `[xs, subsyn]`, where `xs` is the (possibly empty) list of bound variables and
`subsyn` is the ABT sub-expression.

``` typescript
// ABT syntax lam(x.x)
// PL syntax: x => x
const id: ABT = abt.oper("lam", [["x"], "x"]);

// ABT syntax: letrec(f.x.ap(f,x),ap(f,y))
// PL syntax: letrec f(x) = f(x) in f(y)
const loop: ABT = abt.oper(
    "letrec",
    [["f", "x"], abt.oper("ap", "f", "x")],
    [["f"], abt.oper("ap", "f", "y")]);

// succ(succ(zero)), same as before
const two: ABT = abt.oper("succ", [[], abt.oper("succ", [[], abt.oper("zero")])]);
```

Traversing Abstract Binding Trees
---------------------------------

In order to get the subterms of a non-variable ABT, it is necessary to call the `args` method.

```typescript
abt.args(fv: Set<string>, syn: ABT): [string[], ABT][]
```

The structure of the returned array matches the arity, so as long as you use tags (a.k.a. operators) with
consistent bound variables and arguments, you can predict the output of `abt.args` and pattern match against
it:

```typescript
function lambdaToString(fv: Set<string>, e: ABT): string {
    if (typeof e === "string") return e;
    switch (e.tag) {
        case "fn": { // fn(x.e0)
            const [[[x], e0]] = abt.args(fv, e);
            return `(${x} => ${toString(fv.add(x), e0)})`;
        }
        case "ap": { // ap(e1,e2)
            const [[[], e1], [[], e2]] = abt.args(fv, e);
            return `(${toString(fv, e1)} ${toString(fv, e2)})`;
        }
        case "let": { // let(e1,x.e2)
            const [[[], e1], [[x], e2]] = abt.args(fv, e);
            return `(let ${x} = ${toString(fv, e1)} in ${toString(fv.add(x), e2)}`;
        }
        default: throw new Error(`Expected expression, got unexpected operator ${x.tag}`);
    }
}
```

The variable identifiers output by `abt.args` will always be distinct from each other and from any identifier
in `fv`.

```javascript
> const abt = require("@calculemus/abt").abt;
> const Set = require("immutable").Set;
> abt.args(Set([]), abt.oper("fn", [["x"], "x"]));
[ [ [ 'x' ], 'x' ] ]
> abt.args(Set(["x"]), abt.oper("fn", [["x"], "x"]));
[ [ [ 'x1' ], 'x1' ] ]
> abt.args(Set(["x", "x1", "x2"]), abt.oper("fn", [["x"], "x"]));
[ [ [ 'x3' ], 'x3' ] ]
```

Alpha-equality
--------------

Abstract binding trees should be treated as equal if only the names of bound variables differ. The `abt.equal`
function needs to be given the current free variable context, but will then compute alpha-equality.

```typescript
function abt.equal(fv: Set<string>, syn1: ABT, syn2: ABT): boolean
```

```javascript
> abt.equal(Set(["x"]), abt.oper("lam", [["y"], "y"]), abt.oper("lam", [["z"], "z"]));
true
> abt.equal(Set(["x"]), abt.oper("lam", [["y"], "y"]), abt.oper("lam", [["x"], "x"]));
true
> abt.equal(Set(["x"]), abt.oper("lam", [["y"], "y"]), abt.oper("lam", [["z"], "x"]));
false
```

Substitution
------------

Capture-avoiding substitution is the key feature of an abstract binding tree library. You can compute
`[syn1/x]syn2` is by using the `abt.subst` function:

```
abt.subst(fv: Set<string>, syn1: ABT, x: string, syn2: ABT): ABT
```

In this example, `fv` must contain all the free variables in `syn1`, and `fv.add(x)` must contain all the free
variables in `syn2`.

ABT substitution avoids variable capture: the classic problem is that if you substitute `[x / y] lam(x.ap(x,y))`,
you want to get something alpha-equivalent to `lam(z.ap(z,x))`. Just textually replacing `y` with `x` would
give you `lam(x.ap(x,x))`, which is the wrong answer: the free variable `x` has been captured by the binder.
To avoid variable capture, the ABT library renames the bound variable _x_ to avoid capture.

```javascript
> const abt = require("./lib").abt;
> const Set = require("immutable").Set;
> const ex = abt.oper("lam", [["x"], abt.oper("ap", "x", "y")]);
> abt.toString(Set(["x"]), "x", "y", ex);
'x'
> abt.toString(Set(["x"]), abt.subst(Set(["x"]), "x", "y", ex));
'lam(x1.ap(x1,x))'
```

It's possible (though usually unnecessary) to do simultaneous substitution `[synA synB synC / x y z] syn2` as
well. This can be done by calling:

```typescript
abt.subst(fv, [synA, synB, synC], ["x", "y", "z"], syn2)
```

The lengths of the two arrays must be equal, and `synA`, `synB`, and `synC` must all be well formed in the
context `fv`.

There are some examples of how substitution is intended to behave (which I intend to turn into actual test cases
at some point) at [src/test/subst.abt](https://github.com/calculemuscode/abt-js/blob/master/src/test/subst.abt).

