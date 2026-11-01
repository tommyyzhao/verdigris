import type { Candidate } from './search.js';

/** Static PNG companion to the full JSON table. Hatched blanks mean unvisited, never proven impossible. */
export function archivePng(title: string, candidates: Candidate[]): string {
	const canvas = document.createElement('canvas');
	canvas.width = 1160;
	canvas.height = 490;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = '#fcfcfb';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = '#222222';
	ctx.font = 'bold 24px sans-serif';
	ctx.fillText(`${title} · sampled solution space`, 30, 36);
	ctx.font = '14px sans-serif';
	ctx.fillText(
		'8 × 8 × 4 archive · cell = recipe fitness / evaluations · C = cleared · hatching = unvisited',
		30,
		62
	);
	const ramp = [
		'#cde2fb',
		'#9ec5f4',
		'#6da7ec',
		'#3987e5',
		'#256abf',
		'#1c5cab',
		'#184f95',
		'#0d366b',
	];
	for (let z = 0; z < 4; z++) {
		const left = 55 + z * 280,
			top = 110,
			size = 27;
		ctx.fillStyle = '#222222';
		ctx.font = 'bold 14px sans-serif';
		ctx.fillText(
			['No stirring', '1–32 stir ticks', '33–64 stir ticks', '65+ stir ticks'][
				z
			],
			left,
			95
		);
		for (let y = 0; y < 8; y++)
			for (let x = 0; x < 8; x++) {
				const items = candidates.filter((c) => c.cell === `${x},${y},${z}`);
				const best = [...items].sort((a, b) => b.fitness - a.fitness)[0];
				const px = left + x * size,
					py = top + (7 - y) * size;
				ctx.fillStyle = best
					? ramp[
							Math.min(
								7,
								Math.max(
									0,
									Math.floor(
										(best.outcome.cleared ? 1 : best.fitness / 1.25) * 7
									)
								)
							)
					  ]
					: '#f0efec';
				ctx.fillRect(px, py, size - 2, size - 2);
				if (!best) {
					ctx.strokeStyle = '#d9d9d7';
					ctx.beginPath();
					ctx.moveTo(px + 2, py + 18);
					ctx.lineTo(px + 18, py + 2);
					ctx.stroke();
				} else {
					ctx.fillStyle =
						best.outcome.cleared || best.fitness > 0.65 ? '#ffffff' : '#222222';
					ctx.font = '9px sans-serif';
					ctx.fillText(
						best.outcome.cleared ? 'C' : best.fitness.toFixed(1),
						px + 3,
						py + 11
					);
					ctx.fillText(`n${items.length}`, px + 3, py + 22);
				}
			}
		ctx.font = '12px sans-serif';
		ctx.fillStyle = '#444444';
		ctx.fillText('0%', left, top + 236);
		ctx.fillText('100%', left + 180, top + 236);
		ctx.fillText('Water used / initial supply', left + 24, top + 255);
		ctx.save();
		ctx.translate(left - 15, top + 210);
		ctx.rotate(-Math.PI / 2);
		ctx.fillText('First pour: left to right in spring', 0, 0);
		ctx.restore();
	}
	ctx.fillStyle = '#222222';
	ctx.font = '14px sans-serif';
	ctx.fillText(
		`${candidates.length} evaluated · ${
			candidates.filter((c) => c.outcome.cleared).length
		} clears · JSON includes all timelines, regions, seeds, outcomes`,
		30,
		405
	);
	for (let i = 0; i < ramp.length; i++) {
		ctx.fillStyle = ramp[i];
		ctx.fillRect(30 + i * 35, 428, 33, 16);
	}
	ctx.fillStyle = '#444444';
	ctx.fillText(
		'Low to high recipe progress; C marks a complete solution',
		330,
		442
	);
	ctx.fillText(
		'Finite search budget. Unvisited cells are unknown. Different routes can share a cell; inspect routeSignature in JSON.',
		30,
		472
	);
	return canvas.toDataURL('image/png').split(',')[1];
}
