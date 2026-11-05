/** {name} placeholders in owner text, filled from `vars`; unknown ones are left as typed. */
export function fillVars(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Plain text with {name} placeholders filled and any *stars* removed. */
export function plain(text: string, vars: Record<string, string | number> = {}): string {
  return fillVars(text, vars).replace(/\*([^*]+)\*/g, "$1");
}

/** Splits owner text into [normal, italic, normal, …] parts (*words* are italic). */
export function italicParts(text: string, vars: Record<string, string | number> = {}): string[] {
  return fillVars(text, vars).split(/\*([^*]+)\*/g);
}
