export interface SketchView {
  data: string;
  updatedAt: number;
}

export interface SketchSet {
  front?: SketchView;
  side?: SketchView;
  top?: SketchView;
  frames?: SketchView[];
  note?: string;
}

export function hasAnyView(s: SketchSet | null | undefined): boolean {
  if (!s) return false;
  return !!(s.front || s.side || s.top || (s.frames && s.frames.length > 0));
}

export function countViews(s: SketchSet | null | undefined): number {
  if (!s) return 0;
  let n = 0;
  if (s.front) n++;
  if (s.side) n++;
  if (s.top) n++;
  if (s.frames) n += s.frames.length;
  return n;
}