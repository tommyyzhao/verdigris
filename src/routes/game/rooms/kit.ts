import {
	LEVEL_H,
	LEVEL_W,
	type Action,
	type Box,
	type Gate,
	type Level,
	type Plank,
	type Urn,
} from '../types.js';

type Stamp = readonly [Box, '#' | '%' | '&' | ' '];
export const b = (x: number, y: number, w: number, h: number): Box => ({
	x,
	y,
	w,
	h,
});
export const stamp = (
	x: number,
	y: number,
	w: number,
	h: number,
	kind: Stamp[1] = '#'
): Stamp => [b(x, y, w, h), kind];
export const at = (tick: number, action: Action) => ({ tick, action });
export const pour = (tick: number, spring: string, x: number, y = 4) =>
	at(tick, { type: 'pour', spring, at: { x, y } });
export const stop = (tick: number) => at(tick, { type: 'pour', spring: null });
export const sweep = (
	tick: number,
	from: { x: number; y: number },
	to: { x: number; y: number },
	ticks: number
) =>
	Array.from({ length: ticks }, (_, i) =>
		at(tick + i, {
			type: 'stir',
			from: {
				x: from.x + ((to.x - from.x) * i) / ticks,
				y: from.y + ((to.y - from.y) * i) / ticks,
			},
			to: {
				x: from.x + ((to.x - from.x) * (i + 1)) / ticks,
				y: from.y + ((to.y - from.y) * (i + 1)) / ticks,
			},
		})
	);
export const gutter = (
	id: string,
	x: number,
	y: number,
	length: number,
	angle: number
): Plank => ({
	id,
	pivot: { x, y },
	length,
	angles: [angle],
	initial: 0,
});

export function basin(box: Box, hasPlug: boolean): Stamp[] {
	const { x, y, w, h } = box;
	const px = Math.floor(x + w / 2) - 1;
	// A lower right lip makes overflow visible before a deep vessel reaches its crown.
	const lip = h >= 5 ? 1 : 0;
	return [
		stamp(x - 1, y, 1, h + 2),
		stamp(x + w, y + lip, 1, h + 2 - lip),
		stamp(x, y + h, w, 2),
		stamp(x, y, w, h, ' '),
		...(hasPlug ? [stamp(px, y + h, 2, 2, ' ')] : []),
	];
}

export function plug(id: string, box: Box): Gate {
	return {
		id,
		style: 'plug',
		box: b(Math.floor(box.x + box.w / 2) - 1, box.y + box.h, 2, 1),
		retract: 'left',
		open: false,
		driver: { kind: 'player' },
	};
}

export function urn(
	id: string,
	box: Box,
	amount: number,
	mix: Urn['recipe']['mix'],
	powers: string[]
): Urn {
	return { id, box, recipe: { amount, mix }, plug: `${id}-plug`, powers };
}

/** Authoring-only rasterization; exported rooms contain data, never executable rules. */
export function room(
	spec: Pick<
		Level,
		'id' | 'name' | 'act' | 'springs' | 'urns' | 'hints' | 'solution'
	> &
		Partial<Level>,
	stamps: readonly Stamp[] = []
): Level {
	const level: Level = {
		vents: [],
		planks: [],
		gates: [],
		seeds: [],
		brambles: [],
		wheels: [],
		drains: [],
		machines: [],
		ink: 0,
		dig: false,
		pools: [],
		mastery: { reserve: 0.25 },
		terrain: [],
		...spec,
	};
	const cells = Array.from({ length: LEVEL_H }, () =>
		Array<string>(LEVEL_W).fill(' ')
	);
	const paint = ([box, kind]: Stamp) => {
		for (let y = box.y; y < box.y + box.h; y++)
			for (let x = box.x; x < box.x + box.w; x++) cells[y][x] = kind;
	};
	[
		stamp(0, 2, 2, 28),
		stamp(46, 2, 2, 28),
		stamp(0, 28, 48, 2),
		...stamps,
	].forEach(paint);
	for (const u of [...level.urns, ...level.seeds]) {
		basin(u.box, !!u.plug).forEach(paint);
		if (!u.plug) continue;
		const gate = plug(u.plug, u.box);
		level.gates = [...level.gates, gate];
		level.drains = [
			...level.drains,
			{
				id: `${u.id}-out`,
				kind: level.urns.includes(u as Urn) ? 'machine' : 'waste',
				box: { ...gate.box, y: gate.box.y + 1 },
			},
		];
	}
	// Withering must expose air, not immortal stone hidden beneath the vine.
	for (const bramble of level.brambles)
		for (const vine of bramble.vine) paint([vine, ' ']);
	level.terrain = cells.map((row) => row.join(''));
	return level;
}
