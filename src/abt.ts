import { List, Set, Map } from "immutable";

export type Bind = { bound: string[]; value: ABT };
export type ABT = string | { tag: string; value: Bind[] };

export class AbstractBindingTree {
    private freshen: (fv: Set<string>, xold: string) => string;

    public constructor(freshen: (fv: Set<string>, xold: string) => string) {
        this.freshen = freshen;
    }

    private findFresh(fv: Set<string>, xold: string): string {
        if (!fv.has(xold)) return xold;
        return this.freshen(fv, xold);
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
     * Substitute ABT(s) into the bindings b. The number of [syns] must match the number of bound variables in
     * [bindings], and the [fv] must be a superset of all variables free in both [syns] and [bindings]. (The
     * free variables do not need to include variables bound _in_ [bindings].)
     */
    public subst(fv: Set<string>, syns: ABT[], bindings: Bind): ABT {
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
    }

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

    // Transforms a single Bind into its public form
    private freshenArg(fv: Set<string>, abt: Bind): [string[], ABT] {
        const initReduce: [Set<string>, List<string>, boolean] = [fv, List([]), false];
        const res = abt.bound.reduce((accum: [Set<string>, List<string>, boolean], xold: string): [
            Set<string>,
            List<string>,
            boolean
        ] => {
            const [fv, freshbound, isnew] = accum;
            const x = this.findFresh(fv, xold);
            return [fv.add(x), freshbound.push(x), isnew || x !== xold];
        }, initReduce);

        // TODO: implement fast path if !res[2]
        const newvars = res[1].toArray();
        return [newvars, this.subst(fv, newvars, abt)];
    }

    private arity(syn: { value: Bind[] }): List<number> {
        return List(syn.value.map((bind: Bind) => bind.bound.length));
    }

    /**
     * fv1 |- syn1
     * fv2 |- syn2
     * sigma1 : fv1 --> fv
     * sigma2 : fv2 --> fv
     */
    private eqAbt(
        fv: Set<string>,
        fv1: Set<string>,
        sigma1: Map<string, string>,
        syn1: ABT,
        fv2: Set<string>,
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
            const args1 = this.args(fv1, syn1);
            const args2 = this.args(fv2, syn2);
            return args1.every(([xs1, subsyn1], index) => {
                const [xs2, subsyn2] = args2[index];
                const result = xs1.reduce(
                    (accum, x1, index) => {
                        const x2 = xs2[index];
                        const newx = this.findFresh(accum.fv, "x");
                        return {
                            fv: accum.fv.add(newx),
                            fv1: accum.fv1.add(x1),
                            sigma1: accum.sigma1.set(x1, newx),
                            fv2: accum.fv2.add(x2),
                            sigma2: accum.sigma2.set(x2, newx)
                        };
                    },
                    { fv: fv, fv1: fv1, sigma1: sigma1, fv2: fv2, sigma2: sigma2 }
                );
                return this.eqAbt(
                    result.fv,
                    result.fv1,
                    result.sigma1,
                    subsyn1,
                    result.fv2,
                    result.sigma2,
                    subsyn2
                );
            });
        } else {
            return false;
        }
    }

    public equal(fv: Set<string>, syn1: ABT, syn2: ABT): boolean {
        return this.eqAbt(fv, fv, Map<string, string>(), syn1, fv, Map<string, string>(), syn2);
    }

    /**
     * Exposes the arguments to an ABT. If you are working with a consistent signature, the structure
     * is predictable, so you can say
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

    public freevars(abt: ABT): Set<string> {
        if (typeof abt === "string") return Set([abt]);
        return abt.value.reduce((fv: Set<string>, bind: Bind) => fv.union(this.freevarsBind(bind)), Set());
    }
}
