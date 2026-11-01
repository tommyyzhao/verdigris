import { b, stamp, at, room } from './kit.js';

export default room(
	{
		id: 'bring-it-back',
		name: 'Bring It Back',
		act: 3,
		cues: ['puff'],
		springs: [],
		pools: [{ species: 0, box: b(6, 8, 8, 6), units: 40 }],
		gauges: [{ id: 'source-head', box: b(6, 7, 8, 7), label: 'Head' }],
		gates: [
			{
				id: 'pool-release',
				style: 'sluice',
				box: b(14, 12, 1, 2),
				retract: 'up',
				open: false,
				driver: { kind: 'player' },
			},
		],
		vents: [
			{
				id: 'return-draft',
				from: { x: 17, y: 17 },
				to: { x: 17, y: 24 },
				velocity: { x: 72, y: -24 },
				radius: 4,
				control: {
					kind: 'turn',
					velocities: [
						{ x: -72, y: -24 },
						{ x: 72, y: -24 },
					],
					index: 0,
				},
			},
		],
		urns: [
			{
				id: 'heart-urn',
				box: b(25, 22, 15, 4),
				recipe: { amount: 12, mix: [1, 0, 0] },
				powers: ['garden-heart'],
			},
		],
		drains: [
			{ id: 'gap-waste', kind: 'waste', box: b(15, 27, 9, 1) },
			{ id: 'east-waste', kind: 'waste', box: b(41, 27, 5, 1) },
		],
		machines: [{ id: 'garden-heart', kind: 'heart', box: b(40, 8, 5, 7) }],
		mastery: { reserve: 0.9 },
		hints: [
			'Still water is not lost. Release it, then let the air take it.',
			'The tank has head above its side outlet. The louvres meet the jet outside.',
			'Turn the return draft toward the urn, then open the side sluice.',
		],
		solution: [
			at(0, { type: 'pose', id: 'return-draft', index: 1 }),
			at(120, { type: 'toggle', id: 'pool-release' }),
		],
	},
	[stamp(5, 7, 1, 9), stamp(6, 14, 9, 2), stamp(14, 7, 1, 5)]
);
