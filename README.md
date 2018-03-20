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

