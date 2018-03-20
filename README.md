A Javascript library for Abstract Binding Trees
===============================================

[![npm version](https://badge.fury.io/js/%40calculemus%2Fabt.svg)](https://badge.fury.io/js/%40calculemus%2Fabt)
[![Build Status](https://travis-ci.org/calculemuscode/abt-js.svg?branch=master)](https://travis-ci.org/calculemuscode/abt-js)
[![Dependency Status](https://david-dm.org/calculemuscode/abt-js.svg)](https://david-dm.org/calculemuscode/abt-js)
[![Dev Dependency Status](https://david-dm.org/calculemuscode/abt-js/dev-status.svg)](https://david-dm.org/calculemuscode/abt-js?type=dev)

This ABT library is based on some course infrastructure used at Carnegie Mellon's Foundations of Programming
Languages course and on Prof. Robert Harpers's book, Practical Foundations of Programming Languages. Compared
to the ABT library that was historically used for that course, this ABT library:

 * Results in nicer looking code. The CMU course takes an approach to ABTs that has the following failure
   mode: after you do some computation, the perfectly reasonable return-the-identity-function function that
   you wrote as `fn x => fn x => x` is now getting printed out as the well-I-suppose-technically-correct
   jibberish `fn x125123 => fn x124512 => x124512`. This ABT library (in default configuration) will print
   this out as the much more reasonable `fn x => fn x1 => x1`.

 * Harder to use. This is a direct consequence of printing nicer looking code. Most functions require an
   immutable.Set<string> of all free-or-potentially-free variables to be given as an input, and if you get
   this wrong the behavior of the library is undefined. (The CMU-style ABT construction assumes that any
   variable ever created is free-or-potentially-free, which is why you end up with extremely large numbers
   floating around.)

 * More complicated in its implementation. Substitution and ABT equality are implemented "under the hood," and
   when students try to implement substitution and ABT equality under the hood in Foundations of Programming
   Langauges we tell them to not do that.

For an introduction to what Abstract Binding Trees are, see XXX blogpost and XXX neel's blogpost.

Interface
=========

An Abstract Binding Tree has Typescript type `ABT = string | { tag: string, ... }`.

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

To respect this library's interface, do not access any fields of a non-string ABT aside from `tag`.

ABTs are built and inspected by the methods of an `AbstractBindingTree` class; the default instantiation of
this class is provided in the library and called `abt`, which you can see imported in the example
above. Objects of type ABT don't have any methods, they're only treated as data objects.

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

const three: ABT = abt.oper("succ", abt.oper("succ", abt.oper("zero")));
const bintree: ABT = abt.oper("node", abt.oper("leaf"), abt.oper("leaf"));
```

This style doesn't give us any way to bind variables, though. It's just a shorthand for the full syntax, where
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
const three: ABT = abt.oper("succ", [[], abt.oper("succ", [[], abt.oper("zero")])]);
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

The variables output by `abt.args` will always be fresh in `fv`. This means that as you traverse an `ABT`
adding fresh variables to the set as required, you'll never add a free variable to `fv` that was already
there.

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
