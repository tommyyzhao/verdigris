import { expect, it } from 'vitest';
import { levelHeight } from './level-height.js';
it('paints the recipe at the physical resting height, independent of vessel height', () => {
	expect(levelHeight(12, 6)).toBe(2);
	expect(levelHeight(24, 6)).toBe(4);
	expect(levelHeight(12, 12)).toBe(1);
	for (const [units, width] of [
		[-1, 3],
		[1, 0],
		[Infinity, 3],
		[1, NaN],
	])
		expect(levelHeight(units, width)).toBe(0);
});
