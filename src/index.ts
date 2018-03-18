import { Set } from "immutable";
import { AbstractBindingTree, ABT, Bind } from "./abt";
export { AbstractBindingTree, ABT, Bind };

export function freshen(fv: Set<string>, xold: string): string {
  // Find the 'root' of the identifier by removing training numbers and single-quotes
  let n = xold.length;
  while (n > 0 && xold.charAt(n - 1).match(/[0-9']/)) {
    n--;
  }
  const x = xold.slice(0, n);

  // Find a fresh identifier by appending numbers to the root
  let i = 1;
  while (fv.has(`${x}${i}`)) {
    i++;
  }
  return `${x}${i}`;
}

export const abt = new AbstractBindingTree(freshen);
