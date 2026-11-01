import { MARKERS_PER_CELL, MARKERS_PER_UNIT, PACKING, SCALE } from './types.js';

/** Height of settled liquid in a rectangular level-unit interior. */
export function levelHeight(units: number, widthLU: number): number {
	if (
		!Number.isFinite(units) ||
		!Number.isFinite(widthLU) ||
		units < 0 ||
		widthLU <= 0
	)
		return 0;
	return (
		(units * MARKERS_PER_UNIT * PACKING) /
		(MARKERS_PER_CELL * SCALE * SCALE * widthLU)
	);
}
