import { Set } from "immutable";
import { abt } from "../index";
import { expect, use } from "chai";
import * as chaiImmutable from "chai-immutable";
import "mocha";

use(chaiImmutable);

/* Example ABT constants */

// zero()
const zero = abt.oper("zero");

// succ(succ(succ(succ(zero))))
const four = abt.oper("succ", abt.oper("succ", abt.oper("succ", abt.oper("succ", zero))));

// node(node(leaf(),x),node(y,x))
const tree1 = abt.oper("node", abt.oper("node", abt.oper("leaf"), "x"), abt.oper("node", "y", "x"));

// node(x,leaf())
const tree2 = abt.oper("node", "x", abt.oper("leaf"));

// node(leaf(),y)
const tree3 = abt.oper("node", abt.oper("leaf"), "y");

// lam(x.x)
const id1 = abt.oper("lam", [["x"], "x"]);

// lam(y.y)
const id2 = abt.oper("lam", [["y"], "y"]);

// lam(z.z)
const id3 = abt.oper("lam", [["z"], "z"]);

// lam(lam.lam)
const id4 = abt.oper("lam", [["lam"], "lam"]);

// lam(x.y)
const take = abt.oper("lam", [["x"], abt.oper("ap", "x", "y")]);

// ap(lam(x.ap(x,x)),lam(x.ap(x,x)))
const omega = abt.oper(
    "ap",
    abt.oper("lam", [["x"], abt.oper("ap", "x", "x")]),
    abt.oper("lam", [["x"], abt.oper("ap", "x", "x")])
);

// lam(x.lam(y.lam(z.ap(ap(x,z),ap(y,z)))))
const s1 = abt.oper("lam", [
    ["x"],
    abt.oper("lam", [
        ["y"],
        abt.oper("lam", [["z"], abt.oper("ap", abt.oper("ap", "x", "z"), abt.oper("ap", "y", "z"))])
    ])
]);

// lam(a.lam(b.lam(c.ap(ap(a,c),ap(b,c)))))
const s2 = abt.oper("lam", [
    ["a"],
    abt.oper("lam", [
        ["b"],
        abt.oper("lam", [["c"], abt.oper("ap", abt.oper("ap", "a", "c"), abt.oper("ap", "b", "c"))])
    ])
]);

// lam(x.lam(x.x))
const ign1 = abt.oper("lam", [["x"], abt.oper("lam", [["x"], "x"])]);

// lam(lam.lam(lam.lam))
const ign2 = abt.oper("lam", [["lam"], abt.oper("lam", [["lam"], "lam"])]);

describe("abt.freevars", () => {
    it("Should handle binding-free closed expressions", () => {
        expect(abt.freevars(zero)).to.equal(Set([]));
        expect(abt.freevars(four)).to.equal(Set([]));
    });

    it("Should handle bindless expressions", () => {
        expect(abt.freevars(tree1)).to.equal(Set(["x", "y"]));
        expect(abt.freevars(tree2)).to.equal(Set(["x"]));
        expect(abt.freevars(tree3)).to.equal(Set(["y"]));
    });

    it("Should handle closed expressions with bound variables", () => {
        expect(abt.freevars(id1)).to.equal(Set([]));
        expect(abt.freevars(id2)).to.equal(Set([]));
        expect(abt.freevars(id3)).to.equal(Set([]));
        expect(abt.freevars(id4)).to.equal(Set([]));
        expect(abt.freevars(omega)).to.equal(Set([]));
        expect(abt.freevars(s1)).to.equal(Set([]));
        expect(abt.freevars(s2)).to.equal(Set([]));
        expect(abt.freevars(ign1)).to.equal(Set([]));
        expect(abt.freevars(ign2)).to.equal(Set([]));
    });

    it("Should handle open expressions with bound variables", () => {
        expect(abt.freevars(take)).to.equal(Set(["y"]));
    });
});

describe("abt.toString", () => {
    it("Should preserve closed terms in any context", () => {
        expect(abt.toString(Set([]), zero)).to.equal("zero()");
        expect(abt.toString(Set(["x", "y", "z"]), zero)).to.equal("zero()");
        expect(abt.toString(Set(["zero", "succ"]), zero)).to.equal("zero()");

        expect(abt.toString(Set([]), four)).to.equal("succ(succ(succ(succ(zero()))))");
        expect(abt.toString(Set(["x", "y", "z"]), four)).to.equal("succ(succ(succ(succ(zero()))))");
        expect(abt.toString(Set(["zero", "succ"]), four)).to.equal("succ(succ(succ(succ(zero()))))");
    });

    it("Should preserve bindless terms in any valid context", () => {
        expect(abt.toString(Set(["x"]), "x")).to.equal("x");
        expect(abt.toString(Set(["x", "y"]), "x")).to.equal("x");

        expect(abt.toString(Set(["x", "y"]), tree1)).to.equal("node(node(leaf(),x),node(y,x))");
        expect(abt.toString(Set(["x", "y", "z"]), tree1)).to.equal("node(node(leaf(),x),node(y,x))");

        expect(abt.toString(Set(["x"]), tree2)).to.equal("node(x,leaf())");
        expect(abt.toString(Set(["x", "y", "z"]), tree2)).to.equal("node(x,leaf())");

        expect(abt.toString(Set(["y"]), tree3)).to.equal("node(leaf(),y)");
        expect(abt.toString(Set(["x", "y", "z"]), tree3)).to.equal("node(leaf(),y)");
    });

    it("Should rename bound variables that appear in the context", () => {
        expect(abt.toString(Set([]), id1)).to.equal("lam(x.x)");
        expect(abt.toString(Set(["x"]), id1)).to.equal("lam(x1.x1)");
        expect(abt.toString(Set(["x", "x1", "x2", "x3", "x4", "x5"]), id1)).to.equal("lam(x6.x6)");
        expect(abt.toString(Set(["y"]), take)).to.equal("lam(x.ap(x,y))");
        expect(abt.toString(Set(["x", "y"]), take)).to.equal("lam(x1.ap(x1,y))");
        expect(abt.toString(Set(["x", "x1", "x2", "y", "y1", "y2"]), take)).to.equal("lam(x3.ap(x3,y))");
        expect(abt.toString(Set(["a", "b", "c"]), s1)).to.equal("lam(x.lam(y.lam(z.ap(ap(x,z),ap(y,z)))))");
        expect(abt.toString(Set(["a", "b", "c"]), s2)).to.equal(
            "lam(a1.lam(b1.lam(c1.ap(ap(a1,c1),ap(b1,c1)))))"
        );
        expect(abt.toString(Set(["x", "y", "b"]), s2)).to.equal("lam(a.lam(b1.lam(c.ap(ap(a,c),ap(b1,c)))))");
    });

    it("Should rename bound variables that appear in the scope of the same bound variable", () => {
        expect(abt.toString(Set([]), ign1)).to.equal("lam(x.lam(x1.x1))");
        expect(abt.toString(Set(["x"]), ign1)).to.equal("lam(x1.lam(x2.x2))");
        expect(abt.toString(Set([]), ign2)).to.equal("lam(lam.lam(lam1.lam1))");
        expect(abt.toString(Set(["lam", "lam1", "lam3"]), ign2)).to.equal("lam(lam2.lam(lam4.lam4))");
    });
});
