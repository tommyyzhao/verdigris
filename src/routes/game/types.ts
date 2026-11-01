/*
 * Verdigris game contract: level data schema, player actions, view state and
 * events. The pure model (model.ts) turns actions + sensor frames into liquid
 * ticks; presentation and audio read `RoomView` and `GameEvent`s only.
 *
 * Level geometry is in level units (LU): the board is 48×30 LU, one LU = SCALE
 * simulation cells, x right, y down. Fractions are allowed; the model rounds to
 * cells. Liquid amounts are in units: one unit = MARKERS_PER_UNIT markers.
 */
import type {
	Counts,
	LiquidScene,
	LiquidTick,
	SensorFrame,
	Species,
	Vec
} from 'svelte-fluid/experimental';

export type { Counts, LiquidScene, LiquidTick, SensorFrame, Species, Vec };

export const LEVEL_W = 48;
export const LEVEL_H = 30;
export const SCALE = 4;
export const TICK_HZ = 60;
export const READBACK_LAG = 2;
export const MARKERS_PER_UNIT = 64;
/** Engine rest density; 64 markers occupy one square level unit at SCALE 4. */
export const MARKERS_PER_CELL = 4;
/** Empirical rest-height calibration. Kept central for real-liquid tuning. */
export const PACKING = 1;
/** Recipe tolerances (fractions). There is no upper amount: surplus spills physically. */
export const RATIO_TOLERANCE = 0.06;
export const FORBIDDEN_TOLERANCE = 0.02;
export const HOLD_SECONDS = 1.25;
export const SPOIL_GRACE_SECONDS = 0.5;

/** Rectangle in level units. */
export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Parts per species, e.g. [1, 1, 0] = equal dew and sap, no rose. */
export type Mix = readonly [number, number, number];

export interface Recipe {
	/** Minimum amount, units. More is fine; the vessel's rim decides what stays. */
	amount: number;
	mix: Mix;
}

/**
 * Terrain rows, exactly LEVEL_H strings of LEVEL_W chars:
 * '#' stone, '%' loam (diggable), '&' rootbound loam (not diggable), ' ' air.
 */
export type Terrain = readonly string[];

/**
 * A source the player pours from by pressing inside `zone`. One species per
 * spring; emission is a fixed-rate stream at the pointer, clamped into the zone.
 */
export interface Spring {
	id: string;
	species: Species;
	/** Where pouring is allowed (and drawn as cloud / crack / bloom). */
	zone: Box;
	/** Units available; Infinity only in sandbox. */
	well: number;
	/** Units per second while held. */
	rate: number;
	/** Initial downward speed of poured liquid, cells/s (default 20). */
	speed?: number;
	style: 'cloud' | 'crack' | 'bloom';
}

/** An authored steady draft in the air layer, e.g. a vent or a gap in the glass. */
export interface Vent {
	id: string;
	/** Line source in LU. */
	from: Vec;
	to: Vec;
	/** Air velocity, LU per second (x right, y down). */
	velocity: Vec;
	/** Radius of influence, LU (default 1.5). */
	radius?: number;
	/** An unseen draft: no vent fixture or automatic mist; player puffs reveal it. */
	hidden?: boolean;
	control?:
		| { kind: 'switch'; on: boolean }
		| { kind: 'turn'; velocities: readonly Vec[]; index: number };
}

/** Reservoir sensor interior in LU. */
export interface Gauge {
	id: string;
	box: Box;
	label?: string;
}

/** A rotating solid deflector (gutter/plank) with detents. */
export interface Plank {
	id: string;
	pivot: Vec;
	length: number;
	/** Thickness, LU (default 0.5 = 2 cells). */
	thickness?: number;
	angles: readonly number[];
	initial: number;
}

export type GateDriver =
	| { kind: 'player' }
	/** Open while the sensor holds at least `units` of liquid (any species). */
	| { kind: 'weight'; sensor: Box; units: number }
	/** Open while |flux| through the wheel sensor exceeds `flux` cells·units/s. */
	| { kind: 'wheel'; wheel: string; flux: number }
	/** Opens permanently once every listed urn or seed is complete. */
	| { kind: 'urns'; urns: readonly string[] };

/** Sliding solid panel. Plugs are small player gates above drains. */
export interface Gate {
	id: string;
	style: 'sluice' | 'plug' | 'lift';
	box: Box;
	/** Direction the panel retracts when opening. */
	retract: 'up' | 'down' | 'left' | 'right';
	open: boolean;
	driver: GateDriver;
}

export interface Urn {
	id: string;
	/** Interior counted by the sensor. Walls belong in terrain. */
	box: Box;
	recipe: Recipe;
	/** Player gate (style 'plug') that empties this urn; spoiled urns need it. */
	plug?: string;
	/** Machine ids this urn powers (presentation). */
	powers: readonly string[];
}

/** Watering a seed with its recipe grows its vine, cell row by cell row. */
export interface Seed {
	id: string;
	box: Box;
	recipe: Recipe;
	/** Vine body in growth order; becomes solid VINE terrain. */
	vine: readonly Box[];
	/** Player plug that empties the basin after a wrong watering. */
	plug?: string;
}

/** Pre-grown vines that wither (become air) once enough rose touches them. */
export interface Bramble {
	id: string;
	vine: readonly Box[];
	sensor: Box;
	/** Rose units needed in `sensor`. */
	rose: number;
}

export interface Wheel {
	id: string;
	sensor: Box;
	at: Vec;
	radius: number;
}

export interface Drain {
	id: string;
	box: Box;
	/** 'waste' sumps lose liquid; 'machine' outlets feed a machine visually. */
	kind: 'waste' | 'machine';
}

export type MachineKind =
	| 'wheelhouse'
	| 'lanterns'
	| 'lift'
	| 'sprinkler'
	| 'bellows'
	| 'fountain'
	| 'heart';

export interface Machine {
	id: string;
	kind: MachineKind;
	box: Box;
}

/** Dewdrops: Revived = clear; Thrifty = reserve met; Clean = never spoiled and wax within budget. */
export interface MasteryResult {
	revived: boolean;
	thrifty: boolean;
	clean: boolean;
	reserve: number;
	reserveNeeded: number;
	everSpoiled: boolean;
	inkUsed?: number;
	inkBudget?: number;
}

export interface Mastery {
	/** Fraction of well supply left; spring-less rooms count pool water not wasted (0..1). */
	reserve: number;
	/** Ink cells used at most (omit when the room has no ink). */
	ink?: number;
}

export interface Level {
	id: string;
	name: string;
	act: 1 | 2 | 3;
	/** Maximum fractional deviation from each recipe component. */
	ratioTolerance?: number;
	terrain: Terrain;
	springs: readonly Spring[];
	vents: readonly Vent[];
	gauges?: readonly Gauge[];
	cues?: readonly 'puff'[];
	planks: readonly Plank[];
	gates: readonly Gate[];
	urns: readonly Urn[];
	seeds: readonly Seed[];
	brambles: readonly Bramble[];
	wheels: readonly Wheel[];
	drains: readonly Drain[];
	machines: readonly Machine[];
	/** Ink budget in cells (0 = no ink tool). */
	ink: number;
	/** Whether the dig tool is available. */
	dig: boolean;
	/** Liquid already present (puddles, pools) at load. */
	pools: readonly { species: Species; box: Box; units: number }[];
	mastery: Mastery;
	/** Relationship → location → procedure. Shown only on request. */
	hints: readonly [string, string, string];
	/** Authored real-liquid + real-air solution, replayed by browser tests. */
	solution: readonly { tick: number; action: Action }[];
}

export type Action =
	/** Start/move pouring from a spring at `at` (LU, clamped into its zone); `spring: null` stops. */
	| { type: 'pour'; spring: string | null; at?: Vec }
	/** Stir the air along a pointer segment (LU); presentation/air layer only, recorded for replay. */
	| { type: 'stir'; from: Vec; to: Vec }
	/** Dye only; one accepted puff per 20 model ticks. */
	| { type: 'puff'; at: Vec }
	| { type: 'pose'; id: string; index: number }
	| { type: 'toggle'; id: string }
	/** Ink stroke segment (LU). Cells are claimed only where dry air. */
	| { type: 'ink'; stroke: number; from: Vec; to: Vec }
	/** Remove a whole stroke; refunds its cells. */
	| { type: 'erase'; stroke: number }
	/** Dig loam in a disc (LU). */
	| { type: 'dig'; at: Vec; radius: number };

/**
 * 'ready' = enough liquid, in tune, uncontaminated. The room clears when every
 * urn is ready at once for HOLD_SECONDS; only then do urns become 'complete'.
 */
export type UrnStatus = 'filling' | 'ready' | 'complete' | 'spoiled';

export interface UrnView {
	id: string;
	counts: Counts;
	/** Units in the urn. */
	units: number;
	status: UrnStatus;
	/** 0..1 room hold progress while every urn is ready (same value on all urns). */
	hold: number;
	/** Units ÷ recipe amount (may exceed 1). */
	fill: number;
	/** Whether the current ratio is within tolerance. */
	inTune: boolean;
}

export interface RoomView {
	tick: number;
	/** Remaining well units per spring id. */
	springs: Readonly<Record<string, number>>;
	/** Spring currently pouring and its clamped emitter (LU), or null. */
	pouring: { spring: string; at: Vec } | null;
	/** Current velocities in LU/s, including always-on authored vents. */
	vents: Readonly<Record<string, Vec>>;
	/** Switch 0/1 or turn detent index; controllable vents only. */
	ventControls: Readonly<Record<string, number>>;
	/** Surface is a volume-derived estimate, y-down LU. */
	gauges: Readonly<Record<string, { units: number; surface: number }>>;
	planks: Readonly<Record<string, number>>;
	/** 0 closed … 1 open, animated. */
	gates: Readonly<Record<string, number>>;
	urns: readonly UrnView[];
	/** Seed recipe feedback; complete only after its vine finishes growing. */
	seedViews: readonly UrnView[];
	/** Conservatively impossible with all remaining liquid, including recoverable flow. */
	stuck: boolean;
	/** 0..1 growth per seed; -1 if the seed was spoiled. */
	seeds: Readonly<Record<string, number>>;
	/** 1 intact … 0 withered. */
	brambles: Readonly<Record<string, number>>;
	/** Angular speed, rad/s. */
	wheels: Readonly<Record<string, number>>;
	machines: Readonly<Record<string, boolean>>;
	inkLeft: number;
	inkUsed: number;
	/** Cumulative units lost to waste drains. */
	wasted: number;
	everSpoiled: boolean;
	cleared: boolean;
	/** Mean liquid speed (ambience). */
	activity: number;
	/** Current terrain, width*height CellKind values (sim cells). */
	terrain: Uint8Array;
	/** Bumps whenever terrain changes, for cheap redraw checks. */
	terrainRevision: number;
}

export type GameEvent =
	| { type: 'pour'; spring: string | null }
	| { type: 'puff'; at: Vec }
	| { type: 'vent'; id: string; velocity: Vec; index: number }
	| { type: 'pose'; id: string; index: number }
	| { type: 'gate'; id: string; open: boolean }
	| {
			type: 'denied';
			reason: 'ink-empty' | 'wet' | 'not-diggable' | 'supply-empty' | 'busy';
			at?: Vec;
	  }
	| { type: 'splash'; at: Vec; strength: number }
	| { type: 'urn'; id: string; status: UrnStatus }
	| { type: 'seed'; id: string; status: 'growing' | 'grown' | 'spoiled' }
	| { type: 'bramble'; id: string }
	| { type: 'machine'; id: string }
	| { type: 'well-empty'; id: string }
	| { type: 'stuck' }
	| { type: 'clear'; dewdrops: number; mastery: MasteryResult };

/**
 * Pure room rules (model.ts: `createRoom(level, { sandbox? }): RoomModel`).
 * No DOM, GL, storage or audio. Runtime loop per tick:
 * Observe sensor t immediately before planning t+READBACK_LAG, then step with wind t.
 */
export interface RoomModel {
	readonly level: Level;
	/** Initial engine scene (terrain, pools, sensors, drains). */
	scene(): LiquidScene;
	/** Apply a player action now; terrain changes are queued for the next tick. */
	act(action: Action): GameEvent[];
	/** Advance one tick: pour emission, queued terrain edits, gate/vine motion. Wind is added by the runtime. */
	planTick(): LiquidTick;
	/** Reconcile a sensor frame (ignores stale ticks). */
	observe(frame: SensorFrame): GameEvent[];
	view(): RoomView;
	/** Live criteria, frozen at clear so the payoff cannot change the score. */
	mastery(): MasteryResult;
	/** 0..3 once cleared: Revived + Thrifty + Clean. */
	dewdrops(): number;
}

export type UiSound =
	| 'hover'
	| 'click'
	| 'creak'
	| 'aim'
	| 'stir'
	| 'ink'
	| 'erase'
	| 'dig'
	| 'denied'
	| 'map'
	| 'pane'
	| 'hint'
	| 'pause'
	| 'dewdrop';

/** Procedural Web Audio (audio.ts: `createAudio(): GardenAudio`). Silent until `resume()`. */
export interface GardenAudio {
	/** Create/resume the AudioContext; call from a user gesture. */
	resume(): Promise<void>;
	setMuted(muted: boolean): void;
	/** 0..1 master volume. */
	setVolume(volume: number): void;
	/** Music layer set: 0 title/map, 1–3 acts, 4 finale/interlude garden. */
	setScene(scene: 0 | 1 | 2 | 3 | 4): void;
	/** Per animation frame: flow bed from activity, urn fill tones, wheel hum. */
	update(view: RoomView | null, dt: number): void;
	event(event: GameEvent): void;
	/** UI intensity 0..1 (default 1); stirring follows bounded cursor speed. */
	ui(sound: UiSound, pan?: number, strength?: number): void;
	/** Room-clear chord swell, or the finale/interlude resolution. */
	payoff(kind: 'room' | 'finale'): void;
	dispose(): void;
}

/**
 * Cursor-driven air + mist layer (air.ts: `createAirLayer(canvas, level)`),
 * wrapping a svelte-fluid FluidEngine. Stepped by the runtime on the game clock.
 */
export interface AirLayer {
	/** Inject a stir segment (LU) this tick; bounded internally. */
	stir(from: Vec, to: Vec): void;
	/** Accepted, clamped model puff; dye only, never wind. */
	puff(at: Vec): void;
	/** Rebuild air obstructions from the sim terrain (192×120 CellKind, top row first). */
	syncTerrain(terrain: Uint8Array, revision: number): void;
	/** Advance one game tick (1/60 s) and queue a wind snapshot tagged `tick`. */
	step(tick: number, vents?: RoomView['vents']): void;
	/** Poll without consuming: the exact tick-READBACK_LAG snapshot must be ready before planning. */
	ready(tick: number): boolean;
	/** Consume only tick-READBACK_LAG wind (cells/s, y-down, 48×30); first two ticks have none. */
	wind(tick: number): LiquidTick['wind'];
	resize(width: number, height: number): void;
	render(): void;
	dispose(): void;
}

export interface Progress {
	version: 2;
	/** Level id → best dewdrops (0..3) once cleared. */
	cleared: Record<string, number>;
	finale: boolean;
}
