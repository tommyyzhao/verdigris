import { b, stamp, at, urn, room } from './kit.js';

// Wrong belief: enough wind will blow the pond over its sill. Only the fall is steerable.
export default room(
	{
		id: 'still-pond',
		name: 'Still Pond',
		act: 2,
		springs: [],
		pools: [{ species: 0, box: b(8, 7, 8, 4), units: 32 }],
		gauges: [{ id: 'pond-level', box: b(8, 4, 8, 7), label: 'Pond' }],
		vents: [
			{
				id: 'pond-draft',
				from: { x: 6, y: 12 },
				to: { x: 6, y: 17 },
				velocity: { x: 96, y: 0 },
				radius: 5,
				control: {
					kind: 'turn',
					velocities: [
						{ x: -96, y: 0 },
						{ x: 0, y: 0 },
						{ x: 96, y: 0 },
					],
					index: 1,
				},
			},
		],
		gates: [
			{
				id: 'pond-plug',
				style: 'plug',
				box: b(12, 11, 3, 1),
				retract: 'left',
				open: false,
				driver: { kind: 'player' },
			},
		],
		urns: [urn('pond-urn', b(20, 22, 10, 4), 12, [1, 0, 0], ['pond-wheel'])],
		drains: [
			{ id: 'pond-miss', kind: 'waste', box: b(2, 27, 17, 1) },
			{ id: 'pond-east', kind: 'waste', box: b(32, 27, 14, 1) },
		],
		machines: [{ id: 'pond-wheel', kind: 'wheelhouse', box: b(36, 17, 8, 8) }],
		mastery: { reserve: 0.85 },
		hints: [
			'Wind bends falling water, not water resting in a pond.',
			'The sill is above the pond. The brass floor plug can make a falling ribbon instead.',
			'Aim the side draft right. Pull the floor plug so the falling water travels over the wall.',
		],
		solution: [
			at(0, { type: 'pose', id: 'pond-draft', index: 2 }),
			at(600, { type: 'toggle', id: 'pond-plug' }),
		],
	},
	[
		stamp(7, 4, 1, 9),
		stamp(16, 4, 1, 9),
		stamp(8, 11, 8, 2),
		stamp(12, 11, 3, 2, ' '),
		stamp(19, 20, 1, 8),
	]
);
