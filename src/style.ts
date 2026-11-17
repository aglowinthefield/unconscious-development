// Terminal colour for the CLI. Colour only on a terminal, and never with NO_COLOR; FORCE_COLOR
// wins over both.

export const useColor = () =>
  process.env.FORCE_COLOR ? process.env.FORCE_COLOR !== "0" : Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

export const paint = (code: string) => (s: string) => (useColor() ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  bold: paint("1"), dim: paint("2"), cmd: paint("38;5;141"), arg: paint("38;5;180"), head: paint("1;38;5;183"),
  ok: paint("38;5;114"), bad: paint("38;5;174"),
};

export const yes = (s: string) => `${c.ok("✓")} ${s}`;
export const no = (s: string) => `${c.bad("✗")} ${s}`;
export const columns = () => process.stdout.columns || 80;
export const pad = (s: string, w: number) => s + " ".repeat(Math.max(1, w - s.length));
