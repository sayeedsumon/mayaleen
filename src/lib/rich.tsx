import { Fragment, type ReactNode } from "react";
import { italicParts } from "./text-vars";

export { plain } from "./text-vars";

/** Owner text → React: *words* become italics; {name} placeholders are filled from `vars`. */
export function rich(text: string, vars: Record<string, string | number> = {}): ReactNode {
  return italicParts(text, vars).map((p, i) => (i % 2 ? <em key={i} className="italic">{p}</em> : <Fragment key={i}>{p}</Fragment>));
}
