import { List, Set, Map } from "immutable";

export type Bind = { bound: string[]; value: ABT };
export type ABT = string | { tag: string; value: Bind[] };

export class AbstractBindingTree {
    private freshenImpl: (fv: Set<string>, xold: string) => string;

    public constructor(freshen: (fv: Set<string>, xold: string) => string) {
        this.freshenImpl = freshen;
    }

    private findFresh(fv: Set<string>, xold: string): string {
        if (!fv.has(xold)) return xold;
        return this.freshenImpl(fv, xold);
    }

    /**
     * permuteFresh(fv, sigma, syn) computes syn[sigma]
     *
     * ```
     *   fv' |- syn
     *   syn |- fv' --> fv
     *   fv  |- syn[sigma]
     * ```
     */
    private permuteFresh(fv: Set<string>, sigma: Map<string, string>, syn: ABT): ABT {
        if (typeof syn === "string") {
            const x = sigma.has(syn) ? sigma.get(syn) : syn;
            if (!fv.has(x)) throw new Error(`eqAbt: variable ${x} was not among the free variables`);
            return x;
        } else {
            return {
                tag: syn.tag,
                value: syn.value.map(({ bound, value }) => {
                    const result = bound.reduce(
                        (accum, xold) => {
                            const xnew = this.findFresh(accum.fv, xold);
                            return {
                                fv: accum.fv.add(xnew),
                                sigma: accum.sigma.set(xold, xnew),
                                xs: accum.xs.push(xnew)
                            };
                        },
                        { fv: fv, sigma: sigma, xs: List<string>([]) }
                    );
                    return {
                        bound: result.xs.toArray(),
                        value: this.permuteFresh(result.fv, result.sigma, value)
                    };
                })
            };
        }
    }

    /**
     * Transforms a single Bind into its fresh form. A bit of a repetition of the more general permuteFresh()
     * function.
     *
     * ```
     *   fv |- syn
     * ```
     */
    private freshenArg(fv: Set<string>, syn: Bind): [string[], ABT] {
        const result = syn.bound.reduce(
            (accum, xold) => {
                const xnew = this.findFresh(accum.fv, xold);
                return {
                    someRenaming: accum.someRenaming || xnew !== xold,
                    fv: accum.fv.add(xnew),
                    sigma: accum.sigma.set(xold, xnew),
                    xs: accum.xs.push(xnew)
                };
            },
            { someRenaming: false, fv: fv, sigma: Map<string, string>(), xs: List<string>() }
        );

        // Take fast path if the variables were already fresh in the current context
        if (!result.someRenaming) return [syn.bound, syn.value];
        return [result.xs.toArray(), this.permuteFresh(result.fv, result.sigma, syn.value)];
    }

    /**
     * Expose the arguments to an ABT. If you are working with a consistent signature, the structure is
     * predictable, so you can pattern match against the arguments.
     *
     * ```
     *   switch(e.tag)
     *   case "Ap": { // Ap(e1,e2)
     *     const [[[],e1], [[], e2]] = abt.args(fv, e);
     *     ...
     *   }
     *   case "Fn": { // Lam(x.e0)
     *     const [[[x], e0]] = abt.args(fv, e);
     *   }
     * ```
     *
     * Any bound variables will be freshened to be distinct from those in [fv].
     */
    public args(fv: Set<string>, abt: { value: Bind[] }): [string[], ABT][] {
        return abt.value.map((arg: Bind): [string[], ABT] => this.freshenArg(fv, arg));
    }

    /**
     * Performs the simultaneous substitution sigma on the ABT syn.
     */
    private substSyn(fv: Set<string>, sigma: Map<string, ABT>, syn: ABT): ABT {
        if (typeof syn === "string") {
            if (sigma.has(syn)) return sigma.get(syn);
            if (!fv.has(syn)) throw new Error(`substSyn: '${syn}' not among the free variables`);
            return syn;
        } else {
            return {
                tag: syn.tag,
                value: syn.value.map(bind => this.substBind(fv, sigma, bind))
            };
        }
    }

    /**
     *
     */
    private substBind(fv: Set<string>, sigma: Map<string, ABT>, syn: Bind): Bind {
        const initReduce: [Set<string>, Map<string, ABT>, string[]] = [fv, sigma, []];
        const [fv2, sigma2, boundvars2] = syn.bound.reduce(([fv, sigma, boundvars], xold): [
            Set<string>,
            Map<string, ABT>,
            string[]
        ] => {
            const xfresh = this.findFresh(fv, xold);
            return [fv.add(xfresh), sigma.set(xold, xfresh), boundvars.concat([xfresh])];
        }, initReduce);
        return { bound: boundvars2, value: this.substSyn(fv2, sigma2, syn.value) };
    }

    /**
     * subst(fv, syn1, x, syn2)
     *
     * Substitute ABT(s) [syn1] for the variable(s) x into [syn2]. We must have both [syn1] and [x] as single
     * variables or both as arrays of the same length.
     *
     * The variable(s) [x] must be distinct from [fv]. All free variables in [syn1] must be in [fv], and all
     * free variables in [syn2] must be in [fv] or the variable(s) [x]. Notationally:
     *
     * ```
     *   fv |- syn1
     *   fv, x |- syn2
     * ``
     *
     * The result will only include free variables from [fv].
     *
     * If multiple xs are given, multiple syn2s must also be given, and their numbers must match.
     */
    public subst(fv: Set<string>, syns1: ABT | ABT[], xs: string | string[], syn2: ABT): ABT {
        if (syns1 instanceof Array && xs instanceof Array) {
            throw new Error("Unimplemented");
        } else if (syns1 instanceof Array || xs instanceof Array) {
            throw new Error("subst: first argument and second argument must both be arrays if either is");
        } else {
            return this.subst(fv, [syns1], [xs], syn2);
        }
    }
    /*

        const initReduce: [Set<string>, Map<string, ABT>, List<string>] = [
            fv,
            Map<string, ABT>(),
            List(bindings.bound)
        ];
        const [fv2, sigma, b] = syns.reduce(([fv, sigma, b], syn): [
            Set<string>,
            Map<string, ABT>,
            List<string>
        ] => {
            if (b.size == 0) throw new Error("subst: not enough bindings");
            const x: string = this.findFresh(fv, b.get(0));
            return [fv.add(x), sigma.set(b.get(0), syn), b.shift()];
        }, initReduce);

        if (b.size !== 0) throw new Error("subst: too many bindings");
        return this.substSyn(fv2, sigma, bindings.value);
*/

    /**
     * Let e1 and e2 be two ABTs:
     *
     * These three are equivalent:
     *
     * ```
     *   oper("Ap", [[], e1], [[], e2])
     *   oper("Ap", e1, e2)
     *   oper("Ap", e1, [e2])
     * ```
     *
     * This is permissible way of defining Letrec(f.x.e1, f.e2):
     *
     * ```
     *   oper("Letrec", [["f", "x"], e1], [["f"], e2])
     * ```
     *
     * This is allowed by the type system but will generate a runtime error:
     *
     * ```
     *   oper("Bad", [e1, e2])
     * ```
     */
    public oper(tag: string, ...args: (ABT | [string[], ABT])[]): ABT {
        const value: Bind[] = args.map((arg: ABT | [string[], ABT]) => {
            if (arg instanceof Array) {
                const value: ABT = arg[1];
                const bound: string[] = arg[0].map((x: ABT) => {
                    if (typeof x === "string") return x;
                    throw new Error(`Oper ${tag}, non-string ABT in a bound-variable position`);
                });
                return { bound: bound, value: value };
            } else {
                return { bound: [], value: arg };
            }
        });

        return {
            tag: tag,
            value: value
        };
    }

    /**
     * Get the arity of a function. One list member per subterm, and the numbers count the bindings, so
     * `letrec(anno, tau, x.f.e, f.g)` has arity [0,0,2,1].
     */
    private arity(syn: { value: Bind[] }): List<number> {
        return List(syn.value.map((bind: Bind) => bind.bound.length));
    }

    /**
     * The CMU ABT approach is to substitute in new variables for both fv1 and fv2. In attempting to do
     * something more symmetric, and also avoid calling this.subst or this.args directly... I began to
     * understand why CMU implements substitution outside the ABT interface. We need a ton of arguments, but
     * they all have pretty simple relationships.
     *
     * We're actually checking fv |- syn1[sigma1] = syn2[sigma2]. We start off with fv1 = fv2 = fv, but as we
     * descend under binders in parallel, we learn about more free variables of syn1, which go in fv1, and
     * more variables of syn2, which go in fv2.
     *
     * fv1 |- syn1
     * fv2 |- syn2
     *
     * The simultaneous substitutions sigma1 and sigma2 map the new free variables back to a single shared
     * context.
     *
     * sigma1 : fv1 --> fv   (meaning that fv |- syn1[sigma])
     * sigma2 : fv2 --> fv   (meaning that fv |- syn2[sigma])
     *
     * fv1 and fv2 may be smaller than fv if syn1 or syn2 (respectively) contain shadowed variables in their
     * internal representation.
     */
    private eqAbt(
        fv: Set<string>,
        sigma1: Map<string, string>,
        syn1: ABT,
        sigma2: Map<string, string>,
        syn2: ABT
    ): boolean {
        if (typeof syn1 === "string" && typeof syn2 === "string") {
            const x1 = sigma1.has(syn1) ? sigma1.get(syn1) : syn1;
            const x2 = sigma2.has(syn2) ? sigma2.get(syn2) : syn2;
            if (!fv.has(x1)) throw new Error(`eqAbt: variable ${x1} was not among the free variables`);
            if (!fv.has(x2)) throw new Error(`eqAbt: variable ${x2} was not among the free variables`);
            return x1 === x2;
        } else if (typeof syn1 !== "string" && typeof syn2 !== "string") {
            if (syn1.tag !== syn2.tag) return false;
            if (!this.arity(syn1).equals(this.arity(syn2))) return false;
            return syn1.value.every((bind1, index) => {
                const bind2 = syn2.value[index];
                const result = bind1.bound.reduce(
                    (accum, x1, index) => {
                        const x2 = bind2.bound[index];
                        const newx = this.findFresh(accum.fv, "x");
                        return {
                            fv: accum.fv.add(newx),
                            sigma1: accum.sigma1.set(x1, newx),
                            sigma2: accum.sigma2.set(x2, newx)
                        };
                    },
                    { fv: fv, sigma1: sigma1, sigma2: sigma2 }
                );
                return this.eqAbt(result.fv, result.sigma1, bind1.value, result.sigma2, bind2.value);
            });
        } else {
            return false;
        }
    }

    /**
     * Checks whether [syn1] and [syn2] are alpha-equivalent. All the free variables in [syn1] and [syn2] must
     * be contained in the set [fv].
     */
    public equal(fv: Set<string>, syn1: ABT, syn2: ABT): boolean {
        return this.eqAbt(fv, Map<string, string>(), syn1, Map<string, string>(), syn2);
    }

    /**
     * Prints out [abt], freshening relative to the free variables [fv].
     */
    public toString(fv: Set<string>, abt: ABT): string {
        if (typeof abt === "string") return abt;
        const args = this.args(fv, abt);
        const subterms = args.map(([bound, abt]) => {
            const bv = bound.reduce((bv, x) => bv.add(x), fv);
            return `${bound.map(x => x + ".").join("")}${this.toString(bv, abt)}`;
        });
        return `${abt.tag}(${subterms.join(",")})`;
    }

    private freevarsBind(bind: Bind): Set<string> {
        return bind.bound.reduce((fv: Set<string>, x: string) => fv.delete(x), this.freevars(bind.value));
    }

    /**
     * Calculates the exact set of free variables of a given [abt].
     */
    public freevars(abt: ABT): Set<string> {
        if (typeof abt === "string") return Set([abt]);
        return abt.value.reduce((fv: Set<string>, bind: Bind) => fv.union(this.freevarsBind(bind)), Set());
    }
}
