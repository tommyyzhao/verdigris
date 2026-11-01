import { b, stamp, at, pour, stop, gutter, urn, room } from './kit.js';

export default room(
	{
		id: 'breath',
		name: 'Breath',
		act: 1,
		ratioTolerance: 0.1,
		cues: ['puff'],
		springs: [
			{
				id: 'dew',
				species: 0,
				zone: b(12, 3, 4, 2),
				well: 40,
				rate: 6,
				style: 'cloud',
			},
		],
		vents: [
			{
				id: 'glass-draft',
				from: { x: 9, y: 7 },
				to: { x: 9, y: 12 },
				velocity: { x: 24, y: 0 },
				radius: 4,
				control: { kind: 'switch', on: false },
			},
		],
		urns: [urn('breath-urn', b(25, 18, 6, 7), 16, [1, 0, 0], ['roof-bellows'])],
		planks: [
			gutter('intercept-gutter', 16.5, 14, 11, 18),
			gutter('breath-catch', 32, 21, 9, 20),
		],
		drains: [
			{ id: 'miss-sump', kind: 'waste', box: b(2, 27, 21, 1) },
			{ id: 'east-sump', kind: 'waste', box: b(32, 27, 14, 1) },
		],
		machines: [{ id: 'roof-bellows', kind: 'bellows', box: b(36, 13, 8, 7) }],
		mastery: { reserve: 0.2 },
		hints: [
			'Wind bends falling water; it cannot carry a settled pool.',
			'The glass louvres left of the cloud blow across the falling ribbon.',
			'Switch the vent on. Tap the air to see the draft, then pour toward the gutter.',
		],
		solution: [
			at(0, { type: 'toggle', id: 'glass-draft' }),
			pour(120, 'dew', 15, 4),
			stop(400),
		],
	},
	[stamp(23, 8, 11, 2)]
);
