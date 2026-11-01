const COLORS = [
	'transparent',
	'#263d40',
	'#685344',
	'#efe2b8',
	'#9b8050',
	'#456849',
	'#4c4938',
];
/** Contours are cached by the caller's terrainRevision, never rebuilt during idle frames. */
export function drawTerrain(
	canvas: HTMLCanvasElement,
	terrain: Uint8Array,
	width = 192,
	height = 120
) {
	const c = canvas.getContext('2d');
	if (!c) return;
	const scale = 4;
	canvas.width = width * scale;
	canvas.height = height * scale;
	c.scale(scale, scale);
	for (let kind = 1; kind <= 6; kind++) {
		const edges = new Map<number, number[]>();
		const stride = width + 1;
		const edge = (x: number, y: number, tx: number, ty: number) => {
			const key = y * stride + x;
			const list = edges.get(key) ?? [];
			list.push(ty * stride + tx);
			edges.set(key, list);
		};
		const same = (x: number, y: number) =>
			x >= 0 &&
			x < width &&
			y >= 0 &&
			y < height &&
			terrain[y * width + x] === kind;
		for (let y = 0; y < height; y++)
			for (let x = 0; x < width; x++)
				if (same(x, y)) {
					if (!same(x, y - 1)) edge(x, y, x + 1, y);
					if (!same(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
					if (!same(x, y + 1)) edge(x + 1, y + 1, x, y + 1);
					if (!same(x - 1, y)) edge(x, y + 1, x, y);
				}
		const path = new Path2D();
		while (edges.size) {
			const start = edges.keys().next().value as number;
			let key = start;
			const points: { x: number; y: number }[] = [];
			do {
				points.push({ x: key % stride, y: Math.floor(key / stride) });
				const list = edges.get(key);
				if (!list?.length) break;
				const next = list.pop()!;
				if (!list.length) edges.delete(key);
				key = next;
			} while (key !== start && points.length <= width * height * 4);
			if (points.length < 3) continue;
			const last = points[points.length - 1];
			path.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
			for (let i = 0; i < points.length; i++) {
				const p = points[i],
					next = points[(i + 1) % points.length];
				path.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
			}
			path.closePath();
		}
		c.fillStyle = COLORS[kind];
		c.fill(path);
		c.save();
		c.clip(path);
		const gradient = c.createLinearGradient(0, 0, 0, height);
		gradient.addColorStop(0, '#e2dfb61a');
		gradient.addColorStop(1, '#001b2580');
		c.fillStyle = gradient;
		c.fillRect(0, 0, width, height);
		for (let y = 0; y < height; y += 2)
			for (let x = 0; x < width; x += 2) {
				const n = ((x * 7919 + y * 104729) % 101) / 101;
				c.fillStyle = n > 0.55 ? '#d9d4a71c' : '#001b2630';
				c.fillRect(x + n, y + n * 0.5, kind === 3 ? 0.3 : 0.65, 0.24);
			}
		if (kind === 1 || kind === 4) {
			c.strokeStyle = kind === 4 ? '#26363280' : '#0c24275c';
			c.lineWidth = 0.22;
			for (let y = 0; y < height; y += 5) {
				c.beginPath();
				c.moveTo(0, y);
				c.lineTo(width, y);
				c.stroke();
				for (let x = y % 10 ? 3 : 0; x < width; x += 11) {
					c.beginPath();
					c.moveTo(x, y);
					c.lineTo(x, y + 5);
					c.stroke();
				}
			}
		}
		if (kind === 6 || kind === 5) {
			c.strokeStyle = kind === 6 ? '#a18b5060' : '#b2b57a65';
			c.lineWidth = 0.3;
			for (let x = 1; x < width; x += 7) {
				c.beginPath();
				c.moveTo(x, 0);
				for (let y = 0; y < height; y += 4)
					c.quadraticCurveTo(
						x + Math.sin(y) * 3,
						y,
						x + Math.sin(y * 0.4) * 2,
						y + 4
					);
				c.stroke();
			}
		}
		c.restore();
		c.strokeStyle = kind === 3 ? '#fff0c480' : '#b4ba8a36';
		c.lineWidth = 0.25;
		c.stroke(path);
	}
}
