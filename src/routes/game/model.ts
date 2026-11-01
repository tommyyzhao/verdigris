import {
	AIR,
	GATE,
	INK,
	LOAM,
	ROOT,
	STONE,
	VINE,
	type CellKind,
	type Rect,
	type TerrainEdit
} from 'svelte-fluid/experimental';
import {
	FORBIDDEN_TOLERANCE,
	HOLD_SECONDS,
	LEVEL_H,
	LEVEL_W,
	MARKERS_PER_UNIT,
	RATIO_TOLERANCE,
	SCALE,
	SPOIL_GRACE_SECONDS,
	TICK_HZ,
	type Action,
	type Box,
	type Counts,
	type GameEvent,
	type Level,
	type LiquidScene,
	type MasteryResult,
	type Recipe,
	type RoomModel,
	type SensorFrame,
	type UrnStatus,
	type UrnView,
	type Vec
} from './types.js';
import { levelHeight } from './level-height.js';

const W = LEVEL_W * SCALE;
const H = LEVEL_H * SCALE;
const GATE_TICKS = Math.round(0.6 * TICK_HZ);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const finitePoint = (p: Vec) => Number.isFinite(p.x) && Number.isFinite(p.y);
const total = (counts: Counts) => counts[0] + counts[1] + counts[2];
const cleanCounts = (counts?: Counts): Counts =>
	[0, 1, 2].map((i) => {
		const n = counts?.[i];
		return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;
	}) as unknown as Counts;

function rect(box: Box): Rect {
	const x = Math.round(box.x * SCALE);
	const y = Math.round(box.y * SCALE);
	return {
		x,
		y,
		w: Math.round((box.x + box.w) * SCALE) - x,
		h: Math.round((box.y + box.h) * SCALE) - y
	};
}

function boxCells(box: Box): Set<number> {
	const r = rect(box);
	const cells = new Set<number>();
	for (let y = Math.max(0, r.y); y < Math.min(H, r.y + r.h); y++) {
		for (let x = Math.max(0, r.x); x < Math.min(W, r.x + r.w); x++) cells.add(y * W + x);
	}
	return cells;
}

function lineCells(from: Vec, to: Vec, thickness: number): Set<number> {
	const ax = from.x * SCALE;
	const ay = from.y * SCALE;
	const dx = (to.x - from.x) * SCALE;
	const dy = (to.y - from.y) * SCALE;
	const length2 = dx * dx + dy * dy;
	const radius = thickness / 2;
	const cells = new Set<number>();
	const x0 = Math.max(0, Math.floor(Math.min(ax, ax + dx) - radius));
	const x1 = Math.min(W, Math.ceil(Math.max(ax, ax + dx) + radius));
	const y0 = Math.max(0, Math.floor(Math.min(ay, ay + dy) - radius));
	const y1 = Math.min(H, Math.ceil(Math.max(ay, ay + dy) + radius));
	for (let y = y0; y < y1; y++) {
		for (let x = x0; x < x1; x++) {
			const t = length2 ? clamp(((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / length2, 0, 1) : 0;
			if ((x + 0.5 - ax - t * dx) ** 2 + (y + 0.5 - ay - t * dy) ** 2 <= radius ** 2) {
				cells.add(y * W + x);
			}
		}
	}
	return cells;
}

function tip(pivot: Vec, length: number, angle: number): Vec {
	const a = (angle * Math.PI) / 180;
	return {
		x: pivot.x + length * Math.cos(a),
		y: pivot.y + length * Math.sin(a)
	};
}

interface RecipeState {
	counts: Counts;
	units: number;
	status: UrnStatus;
	holdTicks: number;
	forbiddenTicks: number;
	qualifying: boolean;
	forbidden: boolean;
	inTune: boolean;
}

const recipeState = (): RecipeState => ({
	counts: [0, 0, 0],
	units: 0,
	status: 'filling',
	holdTicks: 0,
	forbiddenTicks: 0,
	qualifying: false,
	forbidden: false,
	inTune: false
});

/** Pure rules. Tick-generated events are delivered by the next fresh observe(). */
export function createRoom(source: Level, options: { sandbox?: boolean } = {}): RoomModel {
	const level = structuredClone(source);
	const sandbox = !!options.sandbox;
	let tick = 0;
	let puffAt = -Infinity;
	let observed = 0;
	let terrainRevision = 0;
	let inkUsed = 0;
	let wasted = 0;
	let activity = 0;
	let everSpoiled = false;
	let cleared = false;
	let holdTicks = 0;
	let allReady = false;
	let pouring: { spring: string; at: Vec } | null = null;
	let supplyDenied = false;
	let stuck = false;
	let drops = 0;
	let clearMastery: MasteryResult | undefined;
	function mastery(): MasteryResult {
		if (clearMastery) return { ...clearMastery };
		const supply = level.springs.reduce((sum, s) => sum + s.well, 0);
		const poolSupply = level.pools.reduce((sum, p) => sum + p.units, 0);
		const reserve =
			supply > 0 && Number.isFinite(supply)
				? Object.values(wells).reduce((sum, markers) => sum + markers / MARKERS_PER_UNIT, 0) /
				  supply
				: level.springs.length === 0 && poolSupply > 0
					? clamp(1 - wasted / poolSupply, 0, 1)
					: 1;
		return {
			revived: cleared,
			thrifty: reserve + 1e-9 >= level.mastery.reserve,
			clean: !everSpoiled && (level.ink === 0 || inkUsed <= (level.mastery.ink ?? level.ink)),
			reserve,
			reserveNeeded: level.mastery.reserve,
			everSpoiled,
			...(level.ink > 0 ? { inkUsed, inkBudget: level.mastery.ink ?? level.ink } : {})
		};
	}
	let occupancy = new Uint8Array(W * H);
	const pending: GameEvent[] = [];
	const edits = new Map<number, CellKind>();
	const base = new Uint8Array(W * H);
	const kinds: Record<string, CellKind> = {
		' ': AIR,
		'#': STONE,
		'%': LOAM,
		'&': ROOT
	};
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++)
			base[y * W + x] = kinds[level.terrain[Math.floor(y / SCALE)][Math.floor(x / SCALE)]];
	}
	const terrain = base.slice();
	const wells = Object.fromEntries(
		level.springs.map((s) => [s.id, sandbox ? Infinity : Math.round(s.well * MARKERS_PER_UNIT)])
	);
	const fractions = Object.fromEntries(level.springs.map((s) => [s.id, 0]));
	const scheduled = [0, 0, 0];
	const ventControls = Object.fromEntries(level.vents.flatMap(v => v.control ? [[v.id, v.control.kind === 'switch' ? Number(v.control.on) : v.control.index]] : []));
	const ventVelocity = (v: Level['vents'][number]): Vec => v.control?.kind === 'turn' ? v.control.velocities[ventControls[v.id]] : v.control && !ventControls[v.id] ? { x: 0, y: 0 } : v.velocity;
	const gauges = Object.fromEntries((level.gauges ?? []).map(g => [g.id, { units: 0, surface: g.box.y + g.box.h }]));
	const planks = Object.fromEntries(level.planks.map((p) => [p.id, p.initial]));
	const gates = Object.fromEntries(
		level.gates.map((g) => [g.id, { target: g.open, motion: g.open ? GATE_TICKS : 0 }])
	);
	const urns = new Map(level.urns.map((u) => [u.id, recipeState()]));
	const seeds = new Map(
		level.seeds.map((s) => [s.id, { recipe: recipeState(), row: 0, next: Infinity }])
	);
	const brambles = new Map(
		level.brambles.map((b) => [b.id, { row: 0, next: Infinity, started: false }])
	);
	const wheels = Object.fromEntries(level.wheels.map((w) => [w.id, 0]));
	const wheelFlux = Object.fromEntries(level.wheels.map((w) => [w.id, 0]));
	const machines = Object.fromEntries(level.machines.map((m) => [m.id, false]));
	const strokes = new Map<number, Set<number>>();
	const inkCells = new Set<number>();
	const wetDenied = new Set<number>();
	const splashAt = new Map<string, number>();
	const sensorUnits = new Map<string, number>();
	const plankCells = new Map<string, Set<number>>();
	const gateCells = new Map<string, Set<number>>();
	const vineCells = new Map<string, Set<number>>();

	function rows(boxes: readonly Box[]): Set<number>[] {
		return boxes.flatMap((box) => {
			const r = rect(box);
			return Array.from({ length: r.h }, (_, y) =>
				boxCells({
					x: r.x / SCALE,
					y: (r.y + y) / SCALE,
					w: r.w / SCALE,
					h: 1 / SCALE
				})
			);
		});
	}
	const seedRows = new Map(level.seeds.map((s) => [s.id, rows(s.vine)]));
	const brambleRows = new Map(level.brambles.map((b) => [b.id, rows(b.vine)]));
	function panel(id: string): Set<number> {
		const gate = level.gates.find((g) => g.id === id)!;
		const r = rect(gate.box);
		const open = gates[id].motion / GATE_TICKS;
		const vertical = gate.retract === 'up' || gate.retract === 'down';
		const removed = Math.round((vertical ? r.h : r.w) * open);
		if (gate.retract === 'up') r.h -= removed;
		if (gate.retract === 'down') {
			r.y += removed;
			r.h -= removed;
		}
		if (gate.retract === 'left') r.w -= removed;
		if (gate.retract === 'right') {
			r.x += removed;
			r.w -= removed;
		}
		return boxCells({
			x: r.x / SCALE,
			y: r.y / SCALE,
			w: r.w / SCALE,
			h: r.h / SCALE
		});
	}
	for (const p of level.planks) {
		// The fixed end stays put while each detent redirects the falling stream.
		plankCells.set(
			p.id,
			lineCells(p.pivot, tip(p.pivot, p.length, p.angles[p.initial]), (p.thickness ?? 0.5) * SCALE)
		);
	}
	for (const g of level.gates) gateCells.set(g.id, panel(g.id));
	for (const s of level.seeds) vineCells.set(`seed:${s.id}`, new Set());
	for (const b of level.brambles)
		vineCells.set(`bramble:${b.id}`, new Set(brambleRows.get(b.id)!.flatMap((r) => [...r])));
	function kindAt(i: number): CellKind {
		if ([...vineCells.values()].some((cells) => cells.has(i))) return VINE;
		if ([...plankCells.values()].some((cells) => cells.has(i))) return STONE;
		if ([...gateCells.values()].some((cells) => cells.has(i))) return GATE;
		return inkCells.has(i) ? INK : (base[i] as CellKind);
	}
	for (const group of [gateCells, plankCells, vineCells]) {
		for (const cells of group.values()) for (const i of cells) terrain[i] = kindAt(i);
	}
	const sensors = [
		...(level.gauges ?? []).map(g => ({ id: `gauge:${g.id}`, rect: rect(g.box) })),
		...level.urns.map((u) => ({ id: `urn:${u.id}`, rect: rect(u.box) })),
		...level.seeds.map((s) => ({ id: `seed:${s.id}`, rect: rect(s.box) })),
		...level.brambles.map((b) => ({
			id: `bramble:${b.id}`,
			rect: rect(b.sensor)
		})),
		...level.wheels.map((w) => ({ id: `wheel:${w.id}`, rect: rect(w.sensor) })),
		...level.gates.flatMap((g) =>
			g.driver.kind === 'weight' ? [{ id: `weight:${g.id}`, rect: rect(g.driver.sensor) }] : []
		)
	];
	const initial: LiquidScene = {
		width: W,
		height: H,
		terrain: terrain.slice(),
		fills: level.pools.map((p) => ({
			species: p.species,
			rect: rect(p.box),
			markers: Math.round(p.units * MARKERS_PER_UNIT)
		})),
		sensors,
		drains: level.drains.map((d) => ({ id: d.id, rect: rect(d.box) })),
		gravity: 300,
		maxSpeed: 150
	};
	for (const p of level.pools) for (const i of boxCells(p.box)) occupancy[i] = 1;
	const protectedCells = new Set<number>();
	for (const r of [...sensors, ...initial.drains].map((s) => s.rect)) {
		for (const i of boxCells({
			x: r.x / SCALE,
			y: r.y / SCALE,
			w: r.w / SCALE,
			h: r.h / SCALE
		}))
			protectedCells.add(i);
	}
	// The emitter must remain clear wherever the hand can pour.
	for (const spring of level.springs) for (const i of boxCells(spring.zone)) protectedCells.add(i);

	function refresh(cells: Iterable<number>): void {
		let changed = false;
		for (const i of cells) {
			const kind = kindAt(i);
			if (terrain[i] === kind) continue;
			terrain[i] = kind;
			edits.set(i, kind);
			changed = true;
		}
		if (changed) terrainRevision++;
	}
	function setGate(id: string | undefined, open: boolean, events: GameEvent[]): void {
		if (!id || !gates[id] || gates[id].target === open) return;
		gates[id].target = open;
		events.push({ type: 'gate', id, open });
	}
	function complete(id: string): boolean {
		return urns.get(id)?.status === 'complete' || seeds.get(id)?.recipe.status === 'complete';
	}
	function drivers(events: GameEvent[], frame: SensorFrame): void {
		for (const g of level.gates) {
			const driver = g.driver;
			if (driver.kind === 'weight') {
				const units =
					total(cleanCounts(frame.sensors[`weight:${g.id}`]?.counts)) / MARKERS_PER_UNIT;
				setGate(g.id, units >= driver.units * (gates[g.id].target ? 0.9 : 1), events);
			} else if (driver.kind === 'wheel') {
				setGate(g.id, wheelFlux[driver.wheel] >= driver.flux, events);
			} else if (driver.kind === 'urns' && driver.urns.every(complete)) {
				setGate(g.id, true, events);
			}
		}
	}
	function recipe(
		s: RecipeState,
		target: Recipe,
		counts: Counts,
		elapsed: number,
		seed = false
	): void {
		// Cleared vessels are sealed even while their physical contents discharge.
		if (!seed && s.status === 'complete') return;
		s.counts = counts;
		s.units = total(counts) / MARKERS_PER_UNIT;
		const parts = total(target.mix);
		s.inTune =
			s.units > 0 &&
			counts.every(
				(c, i) => Math.abs(c / total(counts) - target.mix[i] / parts) <= (level.ratioTolerance ?? RATIO_TOLERANCE) + 1e-9
			);
		if (s.status === 'complete') return;
		if (s.status === 'spoiled') {
			if (s.units < target.amount * 0.05) {
				s.status = 'filling';
				s.holdTicks = 0;
				s.forbiddenTicks = 0;
				s.qualifying = false;
				s.forbidden = false;
			}
			return;
		}
		const forbidden = s.units >= Math.max(1, target.amount * 0.1) && counts.some(
			(c, i) => target.mix[i] === 0 && c > total(counts) * FORBIDDEN_TOLERANCE
		);
		// Two qualifying samples establish an interval; a delayed first sample proves no history.
		s.forbiddenTicks = forbidden ? s.forbiddenTicks + (s.forbidden ? elapsed : 0) : 0;
		s.forbidden = forbidden;
		const qualifying = s.units >= target.amount && s.inTune && !forbidden;
		if (s.forbiddenTicks > SPOIL_GRACE_SECONDS * TICK_HZ) {
			s.status = 'spoiled';
			s.holdTicks = 0;
			everSpoiled = true;
		} else if (qualifying) {
			if (seed) s.holdTicks += s.qualifying ? elapsed : 0;
			s.status = seed && s.holdTicks >= HOLD_SECONDS * TICK_HZ ? 'complete' : 'ready';
		} else {
			s.status = 'filling';
			s.holdTicks = 0;
		}
		s.qualifying = qualifying;
	}
	function act(action: Action): GameEvent[] {
		const events: GameEvent[] = [];
		const denied = (reason: Extract<GameEvent, { type: 'denied' }>['reason'], at?: Vec) =>
			events.push({ type: 'denied', reason, ...(at ? { at: { ...at } } : {}) });
		if (action.type === 'stir') return events;
		if (action.type === 'puff') {
			if (!finitePoint(action.at)) denied('busy');
			else if (tick - puffAt >= 20) {
				puffAt = tick;
				events.push({ type: 'puff', at: { x: clamp(action.at.x, 0, LEVEL_W), y: clamp(action.at.y, 0, LEVEL_H) } });
			}
			return events;
		}
		if (action.type === 'pour') {
			if (action.spring === null) {
				supplyDenied = false;
				if (pouring) events.push({ type: 'pour', spring: null });
				pouring = null;
				return events;
			}
			const spring = level.springs.find((s) => s.id === action.spring);
			if (!spring || !action.at || !finitePoint(action.at)) {
				denied('busy');
				return events;
			}
			if (wells[spring.id] <= 0) {
				// Pointer moves may arrive before the empty-well view; only release rearms feedback.
				if (!supplyDenied) denied('supply-empty', { x: spring.zone.x + spring.zone.w / 2, y: spring.zone.y + spring.zone.h / 2 });
				supplyDenied = true;
				return events;
			}
			const { x, y, w, h } = spring.zone;
			const at = {
				x: clamp(action.at.x, Math.max(0.5, x + 0.5), Math.min(LEVEL_W - 0.5, x + w - 0.5)),
				y: clamp(action.at.y, Math.max(0.5, y + 0.5), Math.min(LEVEL_H - 0.5, y + h - 0.5))
			};
			if (pouring?.spring !== spring.id) events.push({ type: 'pour', spring: spring.id });
			pouring = { spring: spring.id, at };
		} else if (action.type === 'pose') {
			const vent = level.vents.find(v => v.id === action.id);
			if (vent) {
				if (vent.control?.kind !== 'turn' || !Number.isInteger(action.index) || action.index < 0 || action.index >= vent.control.velocities.length) denied('busy');
				else if (ventControls[vent.id] !== action.index) {
					ventControls[vent.id] = action.index;
					events.push({ type: 'vent', id: vent.id, velocity: { ...ventVelocity(vent) }, index: action.index });
				}
				return events;
			}
			const p = level.planks.find((p) => p.id === action.id);
			if (
				!p ||
				!Number.isInteger(action.index) ||
				action.index < 0 ||
				action.index >= p.angles.length
			) {
				denied('busy');
				return events;
			}
			if (planks[p.id] === action.index) return events;
			planks[p.id] = action.index;
			const before = plankCells.get(p.id)!;
			const after = lineCells(
				p.pivot,
				tip(p.pivot, p.length, p.angles[action.index]),
				(p.thickness ?? 0.5) * SCALE
			);
			plankCells.set(p.id, after);
			refresh(new Set([...before, ...after]));
			events.push({ type: 'pose', id: p.id, index: action.index });
		} else if (action.type === 'toggle') {
			const vent = level.vents.find(v => v.id === action.id);
			if (vent) {
				if (vent.control?.kind !== 'switch') denied('busy');
				else {
					ventControls[vent.id] = Number(!ventControls[vent.id]);
					events.push({ type: 'vent', id: vent.id, velocity: { ...ventVelocity(vent) }, index: ventControls[vent.id] });
				}
				return events;
			}
			const g = level.gates.find((g) => g.id === action.id);
			if (!g || g.driver.kind !== 'player') denied('busy');
			else setGate(g.id, !gates[g.id].target, events);
		} else if (action.type === 'ink') {
			if (
				!finitePoint(action.from) ||
				!finitePoint(action.to) ||
				!Number.isSafeInteger(action.stroke) ||
				action.stroke < 0
			) {
				denied('busy');
				return events;
			}
			if (level.ink <= 0) {
				denied('ink-empty');
				return events;
			}
			const stroke = strokes.get(action.stroke) ?? new Set<number>();
			strokes.set(action.stroke, stroke);
			const claimed: number[] = [];
			const dx = action.to.x - action.from.x;
			const dy = action.to.y - action.from.y;
			// Spend scarce wax from the hand's starting point, not raster scan order.
			const along = (i: number) => (i % W) * dx + Math.floor(i / W) * dy;
			const candidates = [...lineCells(action.from, action.to, 2)].sort(
				(a, b) => along(a) - along(b)
			);
			for (const i of candidates) {
				if (terrain[i] !== AIR || protectedCells.has(i)) continue;
				if (occupancy[i]) {
					if (!wetDenied.has(action.stroke)) {
						denied('wet', {
							x: ((i % W) + 0.5) / SCALE,
							y: (Math.floor(i / W) + 0.5) / SCALE
						});
						wetDenied.add(action.stroke);
					}
					continue;
				}
				if (inkUsed >= level.ink) {
					denied('ink-empty');
					break;
				}
				stroke.add(i);
				inkCells.add(i);
				inkUsed++;
				claimed.push(i);
			}
			refresh(claimed);
		} else if (action.type === 'erase') {
			const stroke = strokes.get(action.stroke);
			if (stroke) {
				for (const i of stroke) inkCells.delete(i);
				inkUsed -= stroke.size;
				strokes.delete(action.stroke);
				wetDenied.delete(action.stroke);
				refresh(stroke);
			}
		} else if (action.type === 'dig') {
			if (!level.dig) {
				denied('not-diggable', action.at);
				return events;
			}
			if (!finitePoint(action.at) || !Number.isFinite(action.radius) || action.radius <= 0) {
				denied('busy');
				return events;
			}
			const changed: number[] = [];
			let hard = false;
			for (const i of lineCells(action.at, action.at, action.radius * SCALE * 2)) {
				if (terrain[i] === LOAM) {
					base[i] = AIR;
					changed.push(i);
				} else if (terrain[i] === ROOT || terrain[i] === STONE) hard = true;
			}
			if (!changed.length && hard) denied('not-diggable', action.at);
			refresh(changed);
		}
		return events;
	}
	function planTick() {
		tick++;
		for (const g of level.gates) {
			const state = gates[g.id];
			const next = clamp(state.motion + (state.target ? 1 : -1), 0, GATE_TICKS);
			if (next === state.motion) continue;
			state.motion = next;
			const old = gateCells.get(g.id)!;
			const cells = panel(g.id);
			gateCells.set(g.id, cells);
			refresh(new Set([...old, ...cells]));
		}
		for (const s of level.seeds) {
			const state = seeds.get(s.id)!;
			const rows = seedRows.get(s.id)!;
			if (state.row >= rows.length || tick < state.next) continue;
			const row = rows[state.row++];
			for (const i of row) vineCells.get(`seed:${s.id}`)!.add(i);
			refresh(row);
			state.next = tick + 3;
			if (state.row === rows.length) pending.push({ type: 'seed', id: s.id, status: 'grown' });
		}
		for (const b of level.brambles) {
			const state = brambles.get(b.id)!;
			const rows = brambleRows.get(b.id)!;
			if (state.row >= rows.length || tick < state.next) continue;
			const row = rows[state.row++];
			for (const i of row) vineCells.get(`bramble:${b.id}`)!.delete(i);
			refresh(row);
			state.next = tick + 3;
			if (state.row === rows.length) pending.push({ type: 'bramble', id: b.id });
		}
		const emit = [] as {
			species: 0 | 1 | 2;
			count: number;
			rect: Rect;
			velocity: Vec;
		}[];
		if (pouring) {
			const spring = level.springs.find((s) => s.id === pouring!.spring)!;
			fractions[spring.id] += (spring.rate * MARKERS_PER_UNIT) / TICK_HZ;
			const count = Math.min(Math.floor(fractions[spring.id] + 1e-9), wells[spring.id]);
			fractions[spring.id] -= count;
			if (count > 0) {
				const zone = spring.zone;
				emit.push({
					species: spring.species,
					count,
					rect: {
						x: clamp(
							Math.round((pouring.at.x - 0.5) * SCALE),
							Math.max(0, Math.ceil(zone.x * SCALE)),
							Math.min(W, Math.floor((zone.x + zone.w) * SCALE)) - SCALE
						),
						y: clamp(
							Math.round((pouring.at.y - 0.5) * SCALE),
							Math.max(0, Math.ceil(zone.y * SCALE)),
							Math.min(H, Math.floor((zone.y + zone.h) * SCALE)) - SCALE
						),
						w: SCALE,
						h: SCALE
					},
					velocity: { x: 0, y: spring.speed ?? 20 }
				});
				wells[spring.id] -= count;
				scheduled[spring.species] += count;
				if (wells[spring.id] === 0) {
					pending.push({ type: 'well-empty', id: spring.id }, { type: 'pour', spring: null });
					pouring = null;
				}
			}
		}
		const writes: TerrainEdit[] = [...edits].map(([i, kind]) => ({
			x: i % W,
			y: Math.floor(i / W),
			kind
		}));
		edits.clear();
		return { tick, emit, edits: writes };
	}
	function observe(frame: SensorFrame): GameEvent[] {
		if (!Number.isSafeInteger(frame.tick) || frame.tick <= observed) return [];
		const elapsed = Math.min(frame.tick - observed, 6);
		observed = frame.tick;
		const events = pending.splice(0);
		const wasCleared = cleared;
		if (frame.occupancy.length === W * H) occupancy = new Uint8Array(frame.occupancy);
		activity = Number.isFinite(frame.activity) ? Math.max(0, frame.activity) : 0;
		wasted = Math.max(
			wasted,
			level.drains
				.filter((d) => d.kind === 'waste')
				.reduce((sum, d) => sum + total(cleanCounts(frame.drained[d.id])) / MARKERS_PER_UNIT, 0)
		);
		for (const g of level.gauges ?? []) {
			const units = total(cleanCounts(frame.sensors[`gauge:${g.id}`]?.counts)) / MARKERS_PER_UNIT;
			gauges[g.id] = { units, surface: g.box.y + g.box.h - Math.min(g.box.h, levelHeight(units, g.box.w)) };
		}
		for (const w of level.wheels) {
			const flux = frame.sensors[`wheel:${w.id}`]?.flux;
			const magnitude =
				flux && finitePoint(flux) ? Math.hypot(flux.x, flux.y) / MARKERS_PER_UNIT : 0;
			// One unit of tangential flow contributes v/r rad/s; 15% smoothing per 60 Hz tick.
			wheelFlux[w.id] += (magnitude - wheelFlux[w.id]) * (1 - 0.85 ** elapsed);
			wheels[w.id] = wheelFlux[w.id] / Math.max(1, w.radius * SCALE);
		}
		for (const u of level.urns) {
			const state = urns.get(u.id)!;
			const before = state.status;
			recipe(state, u.recipe, cleanCounts(frame.sensors[`urn:${u.id}`]?.counts), elapsed);
			if (state.status !== before) {
				if (before === 'spoiled' && state.status === 'filling') setGate(u.plug, false, events);
				events.push({ type: 'urn', id: u.id, status: state.status });
			}
		}
		for (const s of level.seeds) {
			const state = seeds.get(s.id)!;
			const before = state.recipe.status;
			recipe(
				state.recipe,
				s.recipe,
				cleanCounts(frame.sensors[`seed:${s.id}`]?.counts),
				elapsed,
				true
			);
			if (before === 'spoiled' && state.recipe.status === 'filling') setGate(s.plug, false, events);
			if (state.recipe.status === 'spoiled' && before !== 'spoiled')
				events.push({ type: 'seed', id: s.id, status: 'spoiled' });
			if (state.recipe.status === 'complete' && before !== 'complete') {
				state.next = tick + 3;
				events.push({ type: 'seed', id: s.id, status: 'growing' });
				setGate(s.plug, true, events);
				if (!seedRows.get(s.id)!.length) events.push({ type: 'seed', id: s.id, status: 'grown' });
			}
		}
		for (const b of level.brambles) {
			const state = brambles.get(b.id)!;
			if (
				!state.started &&
				cleanCounts(frame.sensors[`bramble:${b.id}`]?.counts)[2] / MARKERS_PER_UNIT >= b.rose
			) {
				state.started = true;
				state.next = tick + 3;
				if (!brambleRows.get(b.id)!.length) events.push({ type: 'bramble', id: b.id });
			}
		}
		if (!cleared) {
			const ready = level.urns.length > 0 && [...urns.values()].every((s) => s.status === 'ready');
			holdTicks = ready
				? Math.min(HOLD_SECONDS * TICK_HZ, holdTicks + (allReady ? elapsed : 0))
				: 0;
			allReady = ready;
			if (!sandbox && ready && holdTicks >= HOLD_SECONDS * TICK_HZ) {
				cleared = true;
				for (const u of level.urns) {
					urns.get(u.id)!.status = 'complete';
					events.push({ type: 'urn', id: u.id, status: 'complete' });
					setGate(u.plug, true, events);
				}
				clearMastery = mastery();
				drops =
					Number(clearMastery.revived) + Number(clearMastery.thrifty) + Number(clearMastery.clean);
			}
		}
		drivers(events, frame);
		for (const m of level.machines) {
			const powers = level.urns.filter((u) => u.powers.includes(m.id));
			if (!machines[m.id] && powers.length > 0 && powers.every((u) => complete(u.id))) {
				machines[m.id] = true;
				events.push({ type: 'machine', id: m.id });
			}
		}
		for (const sensor of sensors) {
			const units = total(cleanCounts(frame.sensors[sensor.id]?.counts)) / MARKERS_PER_UNIT;
			const jump = units - (sensorUnits.get(sensor.id) ?? 0);
			if (jump >= 0.5 && frame.tick - (splashAt.get(sensor.id) ?? -Infinity) >= 12) {
				events.push({
					type: 'splash',
					at: {
						x: (sensor.rect.x + sensor.rect.w / 2) / SCALE,
						y: (sensor.rect.y + sensor.rect.h / 2) / SCALE
					},
					strength: clamp(jump / 12, 0, 1)
				});
				splashAt.set(sensor.id, frame.tick);
			}
			sensorUnits.set(sensor.id, units);
		}
		if (cleared && !wasCleared) events.push({ type: 'clear', dewdrops: drops, mastery: mastery() });
		if (!sandbox && !cleared && !stuck) {
			// All surviving flow is optimistically recoverable: never call a room lost mid-flight.
			const available = [0, 1, 2].map((species) => {
				const wellMarkers = level.springs
					.filter((s) => s.species === species)
					.reduce((sum, s) => sum + wells[s.id], 0);
				const states = [...urns.values(), ...[...seeds.values()].map((s) => s.recipe)];
				const counted = states.reduce((sum, s) => sum + s.counts[species], 0);
				const committed = states
					.filter((s) => s.status === 'spoiled' || s.status === 'complete')
					.reduce((sum, s) => sum + s.counts[species], 0);
				const inFlight = Math.max(0, scheduled[species] - cleanCounts(frame.emitted)[species]);
				return (
					(wellMarkers +
						inFlight +
						Math.max(0, Math.max(cleanCounts(frame.alive)[species], counted) - committed)) /
					MARKERS_PER_UNIT
				);
			});
			const needed = [0, 1, 2].map((species) =>
				[...level.urns, ...level.seeds]
					.filter((u) => !complete(u.id))
					.reduce(
						(sum, u) =>
							sum +
							u.recipe.amount *
								Math.max(0, u.recipe.mix[species] / total(u.recipe.mix) - (level.ratioTolerance ?? RATIO_TOLERANCE)),
						0
					)
			);
			stuck = needed.some(
				(minimum, species) => available[species] + 1 / MARKERS_PER_UNIT < minimum
			);
			if (stuck) events.push({ type: 'stuck' });
		}
		return events;
	}
	function recipeView(id: string, amount: number, s: RecipeState): UrnView {
		return {
			id,
			counts: [...s.counts] as unknown as Counts,
			units: s.units,
			status: s.status,
			hold: clamp(s.holdTicks / (HOLD_SECONDS * TICK_HZ), 0, 1),
			fill: s.units / amount,
			inTune: s.inTune
		};
	}
	return {
		get level() {
			return structuredClone(level);
		},
		scene: () => structuredClone(initial),
		act,
		planTick,
		observe,
		view: () => ({
			tick,
			springs: Object.fromEntries(
				Object.entries(wells).map(([id, markers]) => [id, markers / MARKERS_PER_UNIT])
			),
			pouring: pouring ? { spring: pouring.spring, at: { ...pouring.at } } : null,
			vents: Object.fromEntries(level.vents.map(v => [v.id, { ...ventVelocity(v) }])),
			ventControls: { ...ventControls },
			gauges: Object.fromEntries(Object.entries(gauges).map(([id, g]) => [id, { ...g }])),
			planks: { ...planks },
			gates: Object.fromEntries(
				Object.entries(gates).map(([id, state]) => [id, state.motion / GATE_TICKS])
			),
			urns: level.urns.map((u) => ({
				...recipeView(u.id, u.recipe.amount, urns.get(u.id)!),
				hold: holdTicks / (HOLD_SECONDS * TICK_HZ)
			})),
			seedViews: level.seeds.map((s) => {
				const state = seeds.get(s.id)!;
				const view = recipeView(s.id, s.recipe.amount, state.recipe);
				if (view.status === 'complete' && state.row < seedRows.get(s.id)!.length)
					view.status = 'ready';
				return view;
			}),
			stuck,
			seeds: Object.fromEntries(
				[...seeds].map(([id, state]) => [
					id,
					state.recipe.status === 'spoiled'
						? -1
						: seedRows.get(id)!.length
						? state.row / seedRows.get(id)!.length
						: Number(state.recipe.status === 'complete')
				])
			),
			brambles: Object.fromEntries(
				[...brambles].map(([id, state]) => [
					id,
					brambleRows.get(id)!.length
						? 1 - state.row / brambleRows.get(id)!.length
						: Number(!state.started)
				])
			),
			wheels: { ...wheels },
			machines: { ...machines },
			inkLeft: level.ink - inkUsed,
			inkUsed,
			wasted,
			everSpoiled,
			cleared,
			activity,
			terrain: terrain.slice(),
			terrainRevision
		}),
		mastery,
		dewdrops: () => drops
	};
}
