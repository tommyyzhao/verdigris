import { b, stamp, at, pour, stop, gutter, urn, room } from './kit.js';

export default room(
	{
		id: 'two-springs',
		name: 'Two Springs',
		act: 2,
		ratioTolerance: 0.1,
		springs: [
			{
				id: 'dew',
				species: 0,
				zone: b(7, 3, 5, 2),
				well: 16,
				rate: 5,
				style: 'cloud',
			},
			{
				id: 'sap',
				species: 1,
				zone: b(30, 3, 10, 2),
				well: 28,
				rate: 5,
				style: 'crack',
			},
		],
		vents: [
			{
				id: 'spring-draft',
				from: { x: 5, y: 6 },
				to: { x: 5, y: 10 },
				velocity: { x: 24, y: 0 },
				radius: 4,
				control: { kind: 'switch', on: false },
			},
		],
		gauges: [{ id: 'green-level', box: b(20, 17, 6, 5), label: 'Green' }],
		urns: [
			urn('green-urn', b(20, 17, 6, 5), 14, [1, 1, 0], ['garden-lift']),
			urn('sap-urn', b(30, 21, 4, 4), 12, [0, 1, 0], ['garden-lift']),
		],
		planks: [
			gutter('blue-gutter', 12.75, 12, 10.5, 25),
			gutter('gold-green-gutter', 34, 10, 12, 150),
			gutter('gold-safe-gutter', 40, 12, 10, 145),
			gutter('neighbour-spill', 27.25, 18.25, 4, 25),
		],
		ink: 0,
		drains: [
			{ id: 'west-sump', kind: 'waste', box: b(2, 27, 17, 1) },
			{ id: 'middle-sump', kind: 'waste', box: b(27, 27, 2, 1) },
			{ id: 'east-sump', kind: 'waste', box: b(35, 27, 11, 1) },
		],
		machines: [{ id: 'garden-lift', kind: 'lift', box: b(41, 18, 4, 8) }],
		mastery: { reserve: 0.06 },
		hints: [
			'Two gifts make green; overflow carries its colour to the neighbour.',
			'The western vent bends blue onto its gutter. The right lip carries any surplus toward the gold vessel.',
			'Switch on the vent for blue. Let it land, shut the vent, balance green with gold, then pour pure gold into the far gutter.',
		],
		solution: [
			at(0, { type: 'toggle', id: 'spring-draft' }),
			pour(120, 'dew', 11, 4),
			stop(276),
			at(312, { type: 'toggle', id: 'spring-draft' }),
			pour(420, 'sap', 30.5, 4),
			stop(552),
			pour(780, 'sap', 39, 4),
			stop(954),
		],
	},
	[stamp(35, 7, 1, 5)]
);
