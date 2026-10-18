/** 取数值参数：只有在不是有限数字时才用默认值（0 是合法值，不会被替换）。 */
export function num(v: unknown, fallback: number): number {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
