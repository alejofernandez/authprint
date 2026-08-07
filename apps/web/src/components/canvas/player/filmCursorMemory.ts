/** Normalized tip position inside the film container (0..1). */
export type FilmCursorNorm = { nx: number; ny: number };

let memory: FilmCursorNorm | null = null;

export function clearFilmCursorMemory(): void {
  memory = null;
}

export function readFilmCursorMemory(): FilmCursorNorm | null {
  return memory;
}

export function writeFilmCursorMemory(norm: FilmCursorNorm): void {
  memory = {
    nx: Math.min(1, Math.max(0, norm.nx)),
    ny: Math.min(1, Math.max(0, norm.ny)),
  };
}

export function filmCursorFromNorm(
  root: { offsetWidth: number; offsetHeight: number },
  norm: FilmCursorNorm,
): { x: number; y: number } {
  return {
    x: norm.nx * root.offsetWidth,
    y: norm.ny * root.offsetHeight,
  };
}

export function filmCursorToNorm(
  root: { offsetWidth: number; offsetHeight: number },
  pos: { x: number; y: number },
): FilmCursorNorm {
  const w = root.offsetWidth || 1;
  const h = root.offsetHeight || 1;
  return { nx: pos.x / w, ny: pos.y / h };
}
