import { createSteppedFluidEngine, type SteppedFluidEngine } from 'svelte-fluid/experimental';
import type { FluidConfig, RGB } from 'svelte-fluid';
import { READBACK_LAG, type AirLayer, type Level, type LiquidTick, type Vec } from './types.js';

const WIDTH = 192,
	HEIGHT = 120;
const SNAP_W = 48,
	SNAP_H = 30;
const MIST: RGB = { r: 0.075, g: 0.14, b: 0.135 };
const MAX_IMPULSE = 150;
type Snapshot = {
	tick: number;
	epoch: number;
	width: number;
	height: number;
	data: Float32Array;
};
type AirEngine = Pick<
	SteppedFluidEngine,
	'splat' | 'setConfig' | 'advance' | 'renderOnce' | 'resize' | 'dispose'
> & {
	queueVelocitySnapshot?(tick: number, width: number, height: number): boolean;
	pollVelocitySnapshot?(): Snapshot | null;
};
type EngineFactory = (options: {
	canvas: HTMLCanvasElement;
	config: FluidConfig;
	autoStart: false;
}) => AirEngine;
const normalized = (p: Vec) => ({ x: p.x / 48, y: 1 - p.y / 30 });

export function createAirLayer(
	canvas: HTMLCanvasElement,
	level: Level,
	makeEngine: EngineFactory = (options) => createSteppedFluidEngine(options)
): AirLayer {
	const initialVents = Object.fromEntries(level.vents.map(v => [v.id, v.control?.kind === 'turn' ? v.control.velocities[v.control.index] : v.control?.kind === 'switch' && !v.control.on ? { x: 0, y: 0 } : v.velocity]));
	const sources = (velocities: Readonly<Record<string, Vec>>) => level.vents.map(vent => ({
		kind: 'line' as const,
		from: normalized(vent.from),
		to: normalized(vent.to),
		velocity: { x: velocities[vent.id].x * 3.2, y: -velocities[vent.id].y * 3.2 },
		rate: 0.7,
		radius: (vent.radius ?? 1.5) ** 2 / 9,
	}));
	let currentVents = initialVents;
	const engine = makeEngine({
		canvas,
		autoStart: false,
		config: {
			pointerInput: false,
			transparent: true,
			initialSplatCount: 0,
			bloom: false,
			sunrays: false,
			shading: false,
			simResolution: 96,
			dyeResolution: 384,
			densityDissipation: 0.9,
			// A hand-length sweep lasts a ribbon, not a room; curl keeps the mist alive.
			velocityDissipation: 0.15,
			curl: 4,
			// Gaussian 20%-amplitude width ≈8 LU; localized to an interception corridor.
			splatRadius: 0.7,
			flow: {
				sources: sources(initialVents),
			},
		},
	});
	let disposed = false,
		tick = 0,
		spent = 0,
		splats = 0;
	let revision = -1,
		rebuiltAt = -Infinity;
	let pending: { terrain: Uint8Array; revision: number } | undefined;
	const snapshots = new Map<number, Snapshot>();
	const queued = new Set<number>();
	let pendingSize: { width: number; height: number } | undefined;
	function collect() {
		for (let frame = engine.pollVelocitySnapshot?.(); frame; frame = engine.pollVelocitySnapshot?.()) {
			queued.delete(frame.tick);
			if (frame.width !== SNAP_W || frame.height !== SNAP_H || frame.data.length !== SNAP_W * SNAP_H * 2)
				throw new Error(`Invalid air snapshot at ${frame.tick}`);
			snapshots.set(frame.tick, frame);
		}
	}
	function resize() {
		// Engine resize invalidates fences: retain every issued tick before touching its epoch.
		if (!pendingSize || queued.size) return;
		engine.resize(pendingSize.width, pendingSize.height);
		pendingSize = undefined;
	}
	function rebuild() {
		if (!pending || tick - rebuiltAt < 30) return;
		const { terrain } = pending;
		let d = '';
		for (let y = 0; y < HEIGHT; y++)
			for (let x = 0; x < WIDTH; ) {
				if (!terrain[y * WIDTH + x]) {
					x++;
					continue;
				}
				const start = x;
				while (x < WIDTH && terrain[y * WIDTH + x]) x++;
				d += `M${start} ${y}h${x - start}v1H${start}Z`;
			}
		engine.setConfig({
			obstructions: d
				? [{ d, viewBox: [0, 0, WIDTH, HEIGHT], fit: 'fill' }]
				: [],
		});
		revision = pending.revision;
		pending = undefined;
		rebuiltAt = tick;
	}
	return {
		stir(from, to) {
			if (disposed || ![from.x, from.y, to.x, to.y].every(Number.isFinite))
				return;
			const dx = to.x - from.x,
				dy = to.y - from.y,
				distance = Math.hypot(dx, dy);
			if (!distance || spent >= MAX_IMPULSE || splats >= 12) return;
			// A tick budget prevents event frequency or synthetic pointer floods buying stronger wind.
			const impulse = Math.min(distance * 28, 90, MAX_IMPULSE - spent);
			const count = Math.min(
				12 - splats,
				6,
				Math.max(1, Math.ceil(distance / 0.7))
			);
			for (let i = 1; i <= count; i++) {
				const p = normalized({
					x: Math.max(0, Math.min(48, from.x + (dx * i) / count)),
					y: Math.max(0, Math.min(30, from.y + (dy * i) / count)),
				});
				engine.splat(
					p.x,
					p.y,
					((dx / distance) * impulse) / count,
					((-dy / distance) * impulse) / count,
					{ r: MIST.r / count, g: MIST.g / count, b: MIST.b / count }
				);
			}
			spent += impulse;
			splats += count;
		},
		puff(at) {
			if (disposed || ![at.x, at.y].every(Number.isFinite)) return;
			const p = normalized({ x: Math.max(0, Math.min(48, at.x)), y: Math.max(0, Math.min(30, at.y)) });
			engine.splat(p.x, p.y, 0, 0, { r: 0.8, g: 1.25, b: 1.15 });
		},
		syncTerrain(terrain, next) {
			if (
				disposed ||
				next === revision ||
				next === pending?.revision ||
				terrain.length !== WIDTH * HEIGHT
			)
				return;
			pending = { terrain, revision: next };
			rebuild();
		},
		step(next, vents = currentVents) {
			if (disposed) return;
			collect();
			resize();
			tick = next;
			rebuild();
			if (level.vents.some(v => vents[v.id] && (vents[v.id].x !== currentVents[v.id].x || vents[v.id].y !== currentVents[v.id].y))) {
				currentVents = Object.fromEntries(level.vents.map(v => [v.id, { ...(vents[v.id] ?? currentVents[v.id]) }]));
				engine.setConfig({ flow: { sources: sources(currentVents) } });
			}
			// Only dye is added here: authored drafts remain velocity-only flow sources.
			if (tick % 15 === 0)
				for (const vent of level.vents) {
					if (vent.hidden || (!currentVents[vent.id].x && !currentVents[vent.id].y)) continue;
					const t = (tick % 105) / 105;
					const p = normalized({
						x: vent.from.x + (vent.to.x - vent.from.x) * t,
						y: vent.from.y + (vent.to.y - vent.from.y) * t,
					});
					engine.splat(p.x, p.y, 0, 0, { r: 0.14, g: 0.25, b: 0.24 });
				}
			engine.advance(1, 1 / 60);
			if (engine.queueVelocitySnapshot) {
				if (!engine.queueVelocitySnapshot(tick, SNAP_W, SNAP_H))
					throw new Error(`Air snapshot could not be queued at ${tick}`);
				queued.add(tick);
			}
			spent = 0;
			splats = 0;
		},
		ready(next) {
			if (disposed) return false;
			collect();
			return !engine.queueVelocitySnapshot || next <= READBACK_LAG || snapshots.has(next - READBACK_LAG);
		},
		wind(now): LiquidTick['wind'] {
			if (disposed || !engine.queueVelocitySnapshot || now <= READBACK_LAG) return undefined;
			collect();
			const target = now - READBACK_LAG;
			const fresh = snapshots.get(target);
			if (!fresh) throw new Error(`Missing exact-lag air snapshot ${target}`);
			snapshots.delete(target);
			const converted = new Float32Array(SNAP_W * SNAP_H * 2);
			for (let y = 0; y < SNAP_H; y++)
				for (let x = 0; x < SNAP_W; x++) {
					const source = ((SNAP_H - 1 - y) * SNAP_W + x) * 2,
						dest = (y * SNAP_W + x) * 2;
					converted[dest] = Number.isFinite(fresh.data[source]) ? WIDTH * fresh.data[source] : 0;
					converted[dest + 1] = Number.isFinite(fresh.data[source + 1]) ? -HEIGHT * fresh.data[source + 1] : 0;
					const magnitude = Math.hypot(converted[dest], converted[dest + 1]);
					if (magnitude > 399.99) {
						converted[dest] *= 399.99 / magnitude;
						converted[dest + 1] *= 399.99 / magnitude;
					}
				}
			return { width: SNAP_W, height: SNAP_H, data: converted };
		},
		resize(width, height) {
			if (disposed) return;
			pendingSize = { width, height };
			collect();
			resize();
		},
		render() {
			if (!disposed) engine.renderOnce();
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			engine.dispose();
			snapshots.clear();
			queued.clear();
			pendingSize = undefined;
			pending = undefined;
		},
	};
}
