// Test/dev fixture only. This deliberately simple particle solver is not the shipped liquid engine.
import type {
	Counts,
	LiquidOptions,
	LiquidScene,
	LiquidSim,
	LiquidTick,
	Rect,
	RenderOptions,
	SensorFrame,
	Species,
} from 'svelte-fluid/experimental';
type Particle = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	species: Species;
};
const inside = (p: Particle, r: Rect) =>
	p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
export class FakeLiquid implements LiquidSim {
	private ctx: CanvasRenderingContext2D;
	private scene!: LiquidScene;
	private particles: Particle[] = [];
	private frames: SensorFrame[] = [];
	private terrain = new Uint8Array();
	private epoch = 0;
	private randomState: number;
	private seeded: [number, number, number] = [0, 0, 0];
	private totals: [number, number, number] = [0, 0, 0];
	private drained: Record<string, [number, number, number]> = {};
	constructor(private options: LiquidOptions) {
		const ctx = options.canvas.getContext('2d');
		if (!ctx) throw new Error('The fixture needs Canvas2D.');
		this.ctx = ctx;
		this.randomState = options.seed || 1;
	}
	get emitted(): Counts {
		return [...this.totals];
	}
	get capacityLeft() {
		return 16000 - this.particles.length;
	}
	private random() {
		this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
		return this.randomState / 4294967296;
	}
	load(scene: LiquidScene) {
		this.scene = scene;
		this.terrain = new Uint8Array(scene.terrain);
		this.particles = [];
		this.frames = [];
		this.epoch++;
		this.seeded = [0, 0, 0];
		this.totals = [0, 0, 0];
		this.drained = Object.fromEntries(
			scene.drains.map((d) => [d.id, [0, 0, 0]])
		);
		for (const fill of scene.fills)
			this.seeded[fill.species] += this.add(
				fill.species,
				fill.markers,
				fill.rect,
				0,
				0
			);
	}
	private add(
		species: Species,
		count: number,
		rect: Rect,
		vx: number,
		vy: number
	) {
		const n = Math.min(this.capacityLeft, Math.max(0, Math.floor(count)));
		for (let i = 0; i < n; i++)
			this.particles.push({
				x: rect.x + this.random() * Math.max(0.2, rect.w),
				y: rect.y + this.random() * Math.max(0.2, rect.h),
				vx,
				vy,
				species,
			});
		return n;
	}
	step(tick: LiquidTick) {
		const { width: w, height: h } = this.scene;
		for (const edit of tick.edits)
			this.terrain[edit.y * w + edit.x] = edit.kind;
		for (const e of tick.emit)
			this.totals[e.species] += this.add(
				e.species,
				e.count,
				e.rect,
				e.velocity.x,
				e.velocity.y
			);
		const occupancy = new Uint8Array(w * h);
		const solid = (x: number, y: number) =>
			x < 0 ||
			x >= w ||
			y < 0 ||
			y >= h ||
			!!this.terrain[Math.floor(y) * w + Math.floor(x)];
		let activity = 0;
		for (const p of this.particles) {
			p.vy = Math.min(
				this.scene.maxSpeed ?? 150,
				p.vy + (this.scene.gravity ?? 300) / 60
			);
			p.vx *= 0.997;
			if (tick.wind && !solid(p.x, p.y + 1.5)) {
				const wind = tick.wind;
				const x = Math.max(
					0,
					Math.min(wind.width - 1, Math.floor((p.x / w) * wind.width))
				);
				const y = Math.max(
					0,
					Math.min(wind.height - 1, Math.floor((p.y / h) * wind.height))
				);
				const i = (y * wind.width + x) * 2;
				// ponytail: nearest-cell drag is presentation-only; physical assertions use LiquidEngine.
				p.vx += (wind.data[i] - p.vx) * 0.03;
				p.vy += (wind.data[i + 1] - p.vy) * 0.03;
			}
			for (let sub = 0; sub < 3; sub++) {
				const x = p.x + p.vx / 180;
				const y = p.y + p.vy / 180;
				if (!solid(x, p.y)) p.x = x;
				else p.vx *= -0.15;
				if (!solid(p.x, y)) p.y = y;
				else {
					p.vy *= -0.04;
					p.vx += (this.random() - 0.5) * 12;
				}
			}
			p.x = Math.max(0.05, Math.min(w - 0.05, p.x));
			p.y = Math.max(0.05, Math.min(h - 0.05, p.y));
			let cell = Math.floor(p.y) * w + Math.floor(p.x);
			if (occupancy[cell] >= 3) {
				const side = this.random() > 0.5 ? 1 : -1;
				if (!solid(p.x + side, p.y) && occupancy[cell + side] < 3) {
					p.x += side;
					cell += side;
				} else if (!solid(p.x, p.y - 0.6)) {
					p.y -= 0.6;
					cell = Math.floor(p.y) * w + Math.floor(p.x);
					p.vy = Math.min(0, p.vy);
				}
			}
			occupancy[cell]++;
			activity += Math.hypot(p.vx, p.vy);
		}
		this.particles = this.particles.filter((p) => {
			const d = this.scene.drains.find((d) => inside(p, d.rect));
			if (d) this.drained[d.id][p.species]++;
			return !d;
		});
		const sensors: SensorFrame['sensors'] = Object.fromEntries(
			this.scene.sensors.map((sensor) => {
				const counts: [number, number, number] = [0, 0, 0];
				const flux = { x: 0, y: 0 };
				for (const p of this.particles)
					if (inside(p, sensor.rect)) {
						counts[p.species]++;
						flux.x += p.vx;
						flux.y += p.vy;
					}
				return [sensor.id, { counts, flux }];
			})
		);
		const alive: [number, number, number] = [0, 0, 0];
		for (const p of this.particles) alive[p.species]++;
		this.frames.push({
			tick: tick.tick,
			epoch: this.epoch,
			sensors,
			drained: structuredClone(this.drained),
			alive,
			seeded: [...this.seeded],
			emitted: [...this.totals],
			activity: activity / Math.max(1, this.particles.length),
			occupancy,
		});
	}
	pollSensors() {
		const frames = this.frames;
		this.frames = [];
		return frames;
	}
	compact() {}
	render(options: RenderOptions) {
		const { canvas } = this.options;
		const c = this.ctx;
		c.clearRect(0, 0, canvas.width, canvas.height);
		if (!this.scene) return;
		c.save();
		c.scale(canvas.width / this.scene.width, canvas.height / this.scene.height);
		c.globalAlpha = 0.7;
		for (let s = 0; s < 3; s++) {
			c.fillStyle = this.options.palette[s];
			c.shadowColor = this.options.palette[s];
			c.shadowBlur = 1 + (options.glow ?? 0) * 4;
			c.beginPath();
			for (const p of this.particles)
				if (p.species === s) {
					c.moveTo(p.x + 0.72, p.y);
					c.arc(p.x, p.y, 0.72, 0, Math.PI * 2);
				}
			c.fill();
		}
		c.restore();
	}
	resize(width: number, height: number) {
		this.options.canvas.width = width;
		this.options.canvas.height = height;
	}
	dispose() {
		this.particles = [];
		this.frames = [];
		this.ctx.clearRect(
			0,
			0,
			this.options.canvas.width,
			this.options.canvas.height
		);
	}
}
