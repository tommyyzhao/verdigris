import {
	b,
	stamp,
	at,
	pour,
	stop,
	sweep,
	gutter,
	basin,
	plug,
	urn,
	room,
} from './kit.js';

export default room(
	{
		id: 'free-garden',
		name: 'The Living Garden',
		act: 3,
		springs: [
			{
				id: 'dew',
				species: 0,
				zone: b(5, 3, 7, 3),
				well: Infinity,
				rate: 6,
				style: 'cloud',
			},
			{
				id: 'sap',
				species: 1,
				zone: b(20, 3, 7, 3),
				well: Infinity,
				rate: 6,
				style: 'crack',
			},
			{
				id: 'rose',
				species: 2,
				zone: b(35, 3, 7, 3),
				well: Infinity,
				rate: 6,
				style: 'bloom',
			},
		],
		vents: [
			{
				id: 'west-breeze',
				from: { x: 4, y: 9 },
				to: { x: 4, y: 15 },
				velocity: { x: 2, y: 0 },
			},
			{
				id: 'east-breeze',
				from: { x: 44, y: 9 },
				to: { x: 44, y: 15 },
				velocity: { x: -2, y: 0 },
			},
		],
		planks: [
			{
				id: 'west-leaf',
				pivot: { x: 10, y: 13 },
				length: 8,
				angles: [0, 30, -30],
				initial: 1,
			},
			{
				id: 'east-leaf',
				pivot: { x: 30, y: 13 },
				length: 8,
				angles: [0, 30, -30],
				initial: 1,
			},
		],
		urns: [
			urn('garden-green', b(18, 20, 6, 6), 16, [1, 1, 0], ['garden-fountain']),
			urn('garden-blush', b(28, 20, 6, 6), 16, [1, 0, 1], ['garden-fountain']),
		],
		wheels: [
			{
				id: 'west-wheel',
				sensor: b(8, 16, 3, 3),
				at: { x: 9.5, y: 17.5 },
				radius: 1.5,
			},
			{
				id: 'east-wheel',
				sensor: b(37, 18, 3, 3),
				at: { x: 38.5, y: 18.5 },
				radius: 1.5,
			},
		],
		seeds: [
			{
				id: 'garden-seed',
				box: b(4, 21, 4, 4),
				recipe: { amount: 8, mix: [1, 1, 0] },
				plug: 'garden-seed-plug',
				vine: [b(10, 23, 5, 1)],
			},
		],
		brambles: [
			{
				id: 'garden-thorn',
				sensor: b(38, 22, 5, 3),
				rose: 4,
				vine: [b(38, 25, 5, 1)],
			},
		],
		ink: 600,
		dig: true,
		drains: [
			{ id: 'west-sump', kind: 'waste', box: b(2, 27, 15, 1) },
			{ id: 'centre-sump', kind: 'waste', box: b(25, 27, 2, 1) },
			{ id: 'east-sump', kind: 'waste', box: b(35, 27, 11, 1) },
		],
		machines: [
			{ id: 'garden-fountain', kind: 'fountain', box: b(32, 8, 8, 4) },
		],
		mastery: { reserve: 0, ink: 600 },
		hints: [
			'The garden is awake. Nothing here needs to be won.',
			'Every spring returns, and the soft earth is yours.',
			'Make a river, grow a bridge, mix a sunset. Stay as long as you like.',
		],
		solution: [],
	},
	[stamp(11, 20, 5, 6, '%'), stamp(11, 26, 5, 1, '&')]
);
