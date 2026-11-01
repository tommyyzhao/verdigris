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
		id: 'first-rain',
		name: 'First Rain',
		act: 1,
		ratioTolerance: 0.1,
		springs: [
			{
				id: 'dew',
				species: 0,
				zone: b(19, 3, 3, 3),
				well: 36,
				rate: 6,
				style: 'cloud',
			},
		],
		urns: [
			urn(
				'dew-urn',
				b(30, 18, 6, 7),
				24,
				[1, 0, 0],
				['wheelhouse', 'lanterns']
			),
		],
		planks: [
			gutter('rain-gutter', 18, 8, 16, 30),
			gutter('catch-gutter', 37, 21, 7, 25),
		],
		wheels: [
			{
				id: 'rain-wheel',
				sensor: b(31, 17, 3, 1),
				at: { x: 32.5, y: 17 },
				radius: 1,
			},
		],
		drains: [
			{ id: 'moss-sump', kind: 'waste', box: b(2, 27, 16, 1) },
			{ id: 'catch-sump', kind: 'waste', box: b(37, 27, 9, 1) },
		],
		machines: [
			{ id: 'wheelhouse', kind: 'wheelhouse', box: b(40, 14, 4, 6) },
			{ id: 'lanterns', kind: 'lanterns', box: b(29, 3, 15, 3) },
		],
		mastery: { reserve: 0.18 },
		hints: [
			'The roof drinks nothing. Its edge carries rain.',
			'Watch the gutter beneath the cloud’s right shoulder.',
			'Pour onto that gutter; release when the stripe is reached.',
		],
		solution: [pour(0, 'dew', 20.5, 4.5), stop(264)],
	},
	[
		stamp(17, 7, 1, 4),
		stamp(18, 10, 3, 1),
		stamp(21, 12, 3, 1),
		stamp(24, 14, 3, 1),
		stamp(27, 16, 3, 1),
		stamp(30, 10, 8, 2),
	]
);
