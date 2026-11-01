import { b, at, pour, stop, gutter, urn, room } from './kit.js';

// Wrong belief: the air is still. A free puff diagnoses the misleading near route.
export default room({
	id: 'hidden-draft',
	name: 'Hidden Draft',
	act: 2,
	cues: ['puff'],
	springs: [
		{
			id: 'dew',
			species: 0,
			zone: b(12, 3, 6, 2),
			well: 40,
			rate: 6,
			style: 'cloud',
		},
	],
	vents: [
		{
			id: 'hidden-draft',
			from: { x: 9, y: 7 },
			to: { x: 9, y: 12 },
			velocity: { x: 24, y: 0 },
			radius: 4,
			hidden: true,
		},
		{
			id: 'return-louvres',
			from: { x: 23, y: 7 },
			to: { x: 23, y: 12 },
			velocity: { x: -30, y: 0 },
			radius: 5,
			control: {
				kind: 'turn',
				velocities: [
					{ x: -30, y: 0 },
					{ x: 0, y: 0 },
					{ x: 30, y: 0 },
				],
				index: 1,
			},
		},
	],
	planks: [
		gutter('near-chute', 9, 14, 6, 55),
		gutter('far-chute', 23, 14, 6, 55),
	],
	urns: [urn('draft-urn', b(10, 22, 6, 4), 14, [1, 0, 0], ['draft-lantern'])],
	drains: [
		{ id: 'draft-waste', kind: 'waste', box: b(17, 27, 29, 1) },
		{ id: 'west-waste', kind: 'waste', box: b(2, 27, 7, 1) },
	],
	machines: [{ id: 'draft-lantern', kind: 'lanterns', box: b(33, 15, 7, 8) }],
	mastery: { reserve: 0.25 },
	hints: [
		'Clear air can still carry a falling stream. Mist costs no water.',
		'Tap the gap above the near chute. The hidden draft pushes away from its mouth.',
		'Turn the louvres left against the hidden draft, then pour from the right edge of the cloud into the near chute.',
	],
	solution: [
		at(30, { type: 'puff', at: { x: 10, y: 10 } }),
		at(240, { type: 'pose', id: 'return-louvres', index: 0 }),
		pour(300, 'dew', 17, 4),
		stop(560),
	],
});
