<script lang="ts">
	import { onMount } from 'svelte';
	import Title from './game/Title.svelte';
	import Map from './game/Map.svelte';
	import Board from './game/Board.svelte';
	import Greenhouse from './game/Greenhouse.svelte';
	const ENDING_URL = 'https://delos.tz.mt/quotes';
	import { createAirLayer } from './game/air.js';
	import { LEVELS, SANDBOX } from './game/levels.js';
	import { createAudio } from './game/audio.js';
	import { loadSound, saveSound, loadProgress, recordClear, saveProgress, unlocked, loadOnboarding, rememberOnboarding, type Onboarding } from './game/progress.js';
	import { createRuntime, type Runtime, type RuntimeState } from './game/runtime.js';
	import type { Telemetry } from './game/telemetry.js';
	import StudyPanel from './game/StudyPanel.svelte';
	import { makeSim } from './game/make-sim.js';
	import type { LiquidOptions, LiquidSim } from 'svelte-fluid/experimental';
	import type { createRoom } from './game/model.js';
	import type { Action, GameEvent, GardenAudio, Level, MasteryResult, Progress, RoomView, UiSound } from './game/types.js';

	// Explicit fixture injection never changes the production refusal path.
	let { simFactory, airFactory, roomFactory, levels = LEVELS, fixtureProgress, onRoomView }: { simFactory?: (options: LiquidOptions) => LiquidSim; airFactory?: typeof createAirLayer; roomFactory?: typeof createRoom; levels?: readonly Level[]; fixtureProgress?: Progress; onRoomView?: (view: RoomView) => void } = $props();
	type Screen = 'title' | 'map' | 'room' | 'payoff' | 'interlude' | 'sandbox';
	let screen = $state<Screen>('title');
	let progress = $state<Progress>({ version: 2, cleared: {}, finale: false });
	let selected = $state(0);
	let session = $state(0);
	let resetToken = $state(0);
	let view = $state.raw<RoomView | null>(null);
	let paused = $state(false);
	let studyPaused = $state(false);
	let stuckCard = $state(false);
	let status = $state<RuntimeState>('running');
	let error = $state('');
	let hint = $state(0);
	let hintsOpen = $state(false);
	const roomHints = new globalThis.Map<string, number>();
	let muted = $state(false);
	let volume = $state(.7);
	let readyToContinue = $state(false);
		let dewdrops = $state(0);
	let marks = $state<MasteryResult>();
	let revealed = $state(0);
	let newBest = $state(false);
	let nextButton = $state<HTMLButtonElement>();
	let interludeButton = $state<HTMLButtonElement>();
	let seen = $state<Partial<Record<Onboarding, true>>>({});
	let feedback = $state('');
	let revived = $state('');
	let resetArmed = $state(false);
	let newArmed = $state(false);
	let denied = $state<{ at?: { x: number; y: number }; key: number }>();
	let dialog = $state<HTMLDialogElement>();
	let audio: GardenAudio | undefined;
	let runtime: Runtime | undefined;
	let telemetry = $state.raw<Telemetry>();
	let mounted = false;
	let reducedMotion = false;
	let factory: ((options: LiquidOptions) => LiquidSim) | undefined;
	let generation = 0;
	let timerIds: ReturnType<typeof setTimeout>[] = [];
	let deniedTimer: ReturnType<typeof setTimeout> | undefined;
	const lastDenied = new globalThis.Map<string, number>();
	let lastFocus: HTMLElement | null = null;
	let roomHistory = false;
	let dawnPending = false;
	const acts = ['The Pumphouse', 'The Glasshouse', 'The Heartwood'];
	let activeLevel = $derived(screen === 'sandbox' ? SANDBOX : levels[selected]);
	let inRoom = $derived(screen === 'room' || screen === 'payoff' || screen === 'sandbox');
	let blocked = $derived(studyPaused || paused || ['unavailable', 'context-lost', 'error'].includes(status));
	let totalDrops = $derived(Object.values(progress.cleared).reduce((a, b) => a + b, 0));
	let isStuck = $derived(screen === 'room' && !!view?.stuck);
	const later = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); timerIds.push(id); return id; };
	const clearTimers = () => { for (const id of timerIds) clearTimeout(id); timerIds = []; clearTimeout(deniedTimer); deniedTimer = undefined; lastDenied.clear(); };
	const ui = (sound: UiSound, pan?: number) => audio?.ui(sound, pan);
	$effect(() => {
		resetToken;
		stuckCard = false;
		if (!isStuck || blocked) return;
		const timer = setTimeout(() => stuckCard = true, 3000);
		return () => clearTimeout(timer);
	});
	$effect(() => {
		if (dialog && blocked && !studyPaused && !dialog.open) { lastFocus = document.activeElement as HTMLElement; dialog.showModal(); }
		else if (dialog?.open && (!blocked || studyPaused)) { dialog.close(); lastFocus?.focus({ preventScroll: true }); }
	});
	$effect(() => { if (readyToContinue && nextButton) nextButton.focus({ preventScroll: true }); });
	$effect(() => { if (screen === 'interlude' && interludeButton) interludeButton.focus({ preventScroll: true }); });
	onMount(() => {
		mounted = true;
		progress = fixtureProgress ?? loadProgress();
		seen = loadOnboarding();
		({ muted, volume } = loadSound());
		reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
		audio = createAudio(undefined, id => activeLevel?.springs.find(s => s.id === id)?.species ?? 0);
		audio.setVolume(volume); audio.setMuted(muted); audio.setScene(0);
		return () => { mounted = false; stopRoom('session_stop'); telemetry?.finish('navigation', false); audio?.dispose(); };
	});
	function stopRoom(reason: 'map' | 'next' | 'clear_exit' | 'session_stop' = 'map') { generation++; telemetry?.endRoom(reason); runtime?.dispose(); runtime = undefined; clearTimers(); paused = false; view = null; denied = undefined; }
	async function enter() { await audio?.resume(); ui('click'); const next = levels.findIndex(level => progress.cleared[level.id] === undefined); if (next >= 0) select(next); else if (!progress.finale) openDawn(); else { audio?.setScene(0); screen = 'map'; } }
	function newGarden() {
		if (!newArmed) { newArmed = true; later(() => newArmed = false, 3500); return; }
		progress = { version: 2, cleared: {}, finale: false }; if (!telemetry) saveProgress(progress); newArmed = false; void enter();
	}
	async function replayDawn() { await audio?.resume(); stopRoom(); audio?.setScene(4); audio?.payoff('room'); screen = 'interlude'; }
	function openDawn() { dawnPending = false; progress = { ...progress, finale: true }; if (!telemetry) saveProgress(progress); audio?.setScene(4); audio?.payoff('room'); screen = 'interlude'; }
	async function wander() { await audio?.resume(); select(0, true); }
	function select(index: number, sandbox = false) {
		if (!sandbox && (index < 0 || index >= levels.length || (!telemetry && index >= unlocked(progress) + 1))) return;
		if (!roomHistory) { history.pushState({ ...history.state, verdigrisRoom: true }, ''); roomHistory = true; }
		stopRoom(screen === 'payoff' ? 'clear_exit' : 'next'); selected = index; screen = sandbox ? 'sandbox' : 'room'; session++; hint = roomHints.get(activeLevel.id) ?? 0; hintsOpen = hint > 0; error = ''; status = 'running'; readyToContinue = false; marks = undefined; revealed = 0; feedback = ''; resetArmed = false;
		telemetry?.startRoom(sandbox ? SANDBOX : levels[index], sandbox, !sandbox && index >= unlocked(progress) + 1);
		if (hintsOpen && hint) telemetry?.hint(hint);
		audio?.setScene(sandbox ? 4 : levels[index].act); ui('pane');
	}
	async function attachCanvas(canvas: HTMLCanvasElement, airCanvas: HTMLCanvasElement) {
		if (!mounted || !audio || !activeLevel) return;
		const ownGeneration = ++generation;
		const level = activeLevel;
		try {
			factory ??= simFactory ?? makeSim;
			if (!mounted || ownGeneration !== generation || !inRoom) return;
			runtime?.dispose();
			runtime = createRuntime({ canvas, airCanvas, level, sandbox: screen === 'sandbox', makeSim: factory, makeAir: airFactory, makeRoom: roomFactory, audio, telemetry, onEvent: event, onView: next => { view = next; onRoomView?.(next); }, onState: (next, message) => { status = next; error = message ?? ''; if (next === 'paused') paused = true; } });
		} catch (cause) { if (ownGeneration === generation) { status = 'unavailable'; error = cause instanceof Error ? cause.message : 'The garden cannot wake in this browser.'; } }
	}
	function learn(cue: Onboarding) { if (!seen[cue]) { seen = { ...seen, [cue]: true }; rememberOnboarding(cue); } }
	function action(a: Action) {
		runtime?.act(a);
		if (a.type === 'ink') learn('wax');
		if (a.type === 'stir' && Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y) >= .3) learn('stir');
	}
	function say(text: string) { feedback = text; later(() => { if (feedback === text) feedback = ''; }, 3200); }
	function studyChoice(choice: string, roomId?: string) { if (choice === 'stop') { telemetry?.finish('participant_stop'); map(); } else if (choice === 'break') runtime?.pause(); else if (choice === 'sandbox') select(0, true); else { const index = levels.findIndex(l => l.id === roomId); if (index >= 0) select(index); } }
	function event(e: GameEvent) {
		if (e.type === 'denied') {
			const now = performance.now();
			if (now - (lastDenied.get(e.reason) ?? -Infinity) < 600) return;
			lastDenied.set(e.reason, now);
		}
		audio?.event(e);
		if (e.type === 'pour' && e.spring) learn('pour');
		if (e.type === 'puff') learn('puff');
		if (e.type === 'vent') say(`Vent ${e.id.replaceAll('-', ' ')}: ${e.velocity.x || e.velocity.y ? `heading ${Math.round((Math.atan2(e.velocity.y, e.velocity.x) * 180 / Math.PI + 360) % 360)} degrees` : 'off'}.`);
		if (e.type === 'well-empty') say('This spring is empty. Let the remaining water settle.');
		if (e.type === 'denied') {
			denied = { at: e.at, key: (denied?.key ?? 0) + 1 }; clearTimeout(deniedTimer); deniedTimer = setTimeout(() => denied = undefined, 850);
			say(({ 'supply-empty': 'This spring is empty.', 'ink-empty': 'No wax left. Lift a line to reuse it.', wet: 'Wax needs dry air.', 'not-diggable': 'Only soft soil can be dug.', busy: 'Try another spot.' })[e.reason]);
		}
		if (e.type !== 'clear' || screen !== 'room') return;
		dewdrops = e.dewdrops; marks = e.mastery; newBest = e.dewdrops > (progress.cleared[activeLevel.id] ?? 0); screen = 'payoff';
		progress = recordClear(progress, activeLevel.id, e.dewdrops);
		if (levels.every(level => progress.cleared[level.id] !== undefined)) dawnPending = !progress.finale;
		if (!telemetry) saveProgress(progress);
		audio?.payoff('room'); runtime?.setTimeScale(.35); runtime?.setGlow(.65);
		later(() => { runtime?.setTimeScale(1); runtime?.setGlow(1); }, 1200);
		later(() => {
			readyToContinue = true;
			const earned = [e.mastery.revived, e.mastery.thrifty, e.mastery.clean];
			for (let i = 0; i < 3; i++) {
				const reveal = () => { revealed = i + 1; if (earned[i]) ui('dewdrop', i); };
				if (reducedMotion) reveal(); else later(reveal, i * 340);
			}
		}, 2200);
	}
	function pause() { if (!inRoom || screen === 'payoff' || blocked) return; paused = true; runtime?.pause(); ui('pause'); }
	function resume() { if (studyPaused) return; if (status !== 'paused' && status !== 'running') return; paused = false; runtime?.resume(); ui('pause'); }
	function restart() {
		if (dawnPending) { continueRoom(); return; }
		clearTimers(); readyToContinue = false; resetArmed = false; paused = false; status = 'running'; error = ''; feedback = ''; marks = undefined; revealed = 0; denied = undefined; resetToken++;
		if (screen === 'payoff') screen = 'room';
		if (runtime) runtime.restart(); else { generation++; session++; }
		ui('click');
	}
	function resetRequest() { if (resetArmed) restart(); else { resetArmed = true; ui('click'); later(() => resetArmed = false, 2500); } }
	function map() {
		if (dawnPending) { continueRoom(); return; }
		if (roomHistory) { roomHistory = false; history.back(); }
		const interlude = inRoom && screen !== 'sandbox' && selected === levels.length - 1 && progress.cleared[activeLevel.id] !== undefined && !progress.finale;
		stopRoom(); status = 'running'; readyToContinue = false;
		if (interlude) openDawn();
		else { screen = 'map'; audio?.setScene(0); ui('map'); }
	}
	function continueRoom() {
		if (!readyToContinue && !dawnPending) return;
		revived = activeLevel.id;
		if (selected === levels.length - 1) {
			dawnPending = false;
			stopRoom('clear_exit'); readyToContinue = false;
			openDawn();
		} else select(selected + 1);
	}
	function keyboard(e: KeyboardEvent) {
		if ((e.target as Element)?.matches('input, textarea, select') || !inRoom || screen === 'payoff') return;
		if (e.code === 'Space' && (e.target as Element)?.closest('button, input, select, summary, [role="slider"]')) return;
		if (e.key === 'Escape' || e.code === 'Space') { e.preventDefault(); if (e.repeat) return; if (blocked) resume(); else pause(); }
		else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.repeat) { e.preventDefault(); resetRequest(); }
	}
	function toggleHints() { if (!hintsOpen && hint) hintsOpen = true; else hint = Math.min(3, hint + 1); hintsOpen = true; telemetry?.hint(hint); roomHints.set(activeLevel.id, hint); ui('hint'); }
	function soundSettings() { audio?.setMuted(muted); audio?.setVolume(volume); saveSound(muted, volume); }
</script>

<svelte:head><title>Verdigris</title><meta name="description" content="A sleeping machine-garden. A little water, a little patience. An intimate liquid puzzle game."/><meta name="theme-color" content="#0c2932"/></svelte:head>
<svelte:window onkeydown={keyboard} onpopstate={() => { if (roomHistory) { roomHistory = false; map(); } }}/>
<div class="verdigris" data-screen={screen}>
	<StudyPanel {levels} onrecorder={value => { telemetry = value; progress = { version: 2, cleared: {}, finale: false }; seen = {}; roomHints.clear(); }} onchoice={studyChoice} onpause={value => { studyPaused = value; if (value) runtime?.pause(); else { runtime?.resume(); paused = false; } }}/>

	{#if screen === 'title'}
		<Title cleared={Object.keys(progress.cleared).length} onenter={enter} onnew={newGarden}/>
		{#if newArmed}<div class="new-confirm" role="status">Begin again? Press “Begin a new garden” once more. Your saved garden will be replaced.</div>{/if}
	{:else if screen === 'map'}
		<Map {levels} {progress} available={unlocked(progress) + 1} onselect={select} onback={() => screen = 'title'} {revived}/>
	{:else if screen === 'interlude'}
		<section class="interlude" aria-label="The first wing wakes"><Greenhouse alive={3} settled/><div class="interlude-words"><span>{levels.length} small rooms · {totalDrops} dewdrops</span><h1>The first wing remembers.</h1><p>Beyond the glass, the rest of the garden is still dreaming.</p><button class="primary" bind:this={interludeButton} onclick={map}>Explore the greenhouse →</button><p class="interlude-end">You’ve revived all {levels.length} available rooms. Replay for more dewdrops, or wander freely.</p><a class="ending-link" href={ENDING_URL}>delos.tz.mt/quotes</a></div></section>
	{:else if activeLevel}
		<div class="room-screen" class:celebrating={screen === 'payoff'} inert={blocked}>
			<header class="room-header" class:cleared={screen === 'payoff'}>
				{#if screen !== 'payoff'}<button class="round" title="Return to greenhouse" aria-label="Return to greenhouse map" onclick={map}>‹</button>{/if}
				<div class="room-heading">{#if screen !== 'payoff'}<span>{screen === 'sandbox' ? 'the living garden' : acts[activeLevel.act - 1]}</span>{/if}<h1>{activeLevel.name}</h1></div>
				{#if screen !== 'payoff'}<div class="room-actions"><button class="seed-pod" title="Hint" aria-label={hint < 3 ? 'Open next hint' : 'All hints revealed'} aria-expanded={hintsOpen} onclick={toggleHints}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21Q0 11 11 4q9 3 4 12m-3 5q-2-8 6-16M6 11l5 2m5-4-3 1"/></svg><span>Hint</span></button><button class="round pause-button" title="Pause · Space or Esc" aria-label="Pause garden" onclick={pause}><span aria-hidden="true">Ⅱ</span><span class="pause-label">Pause</span></button><button class="bar-restart" aria-label={resetArmed ? 'Confirm restart room' : 'Restart room, press twice'} onclick={resetRequest}>{resetArmed ? 'Confirm' : 'Restart'}</button></div>{/if}
			</header>
			<div class="room-body"><div class="board-wrap" inert={screen === 'payoff'}>{#key session}<Board {telemetry} level={activeLevel} {view} oncanvas={attachCanvas} onact={action} onui={ui} waxCue={screen === 'room' && activeLevel.ink > 0 && !seen.wax} onlearn={() => learn('wax')} payoff={screen === 'payoff'} {denied} {resetToken} suspended={blocked || screen === 'payoff'} onboarding={screen === 'room' ? activeLevel.id === 'first-rain' && !seen.pour ? 'pour' : activeLevel.cues?.includes('puff') && !seen.puff ? 'puff' : undefined : undefined}/>{/key}</div></div>
			{#if hintsOpen && screen !== 'payoff'}<aside class="hints" aria-live="polite"><button aria-label="Close hints" onclick={() => { telemetry?.closeHint(hint); hintsOpen = false; }}>×</button>{#each activeLevel.hints.slice(0, hint) as text, i}<p><span aria-hidden="true">{'·'.repeat(i + 1)}</span>{text}</p>{/each}{#if hint < 3}<button class="next-hint" onclick={toggleHints}>A little more light</button>{/if}</aside>{/if}
			{#if stuckCard && screen !== 'payoff'}<aside class="stuck-card" aria-label="Spent springs"><p>Not enough water remains.</p><button onclick={restart}>Restart room</button><span>R, then R, restarts. No progress is lost.</span></aside>{/if}
			{#if readyToContinue && marks}
				<section class="clear-card" aria-label="Room complete" aria-labelledby="clear-title">
					<div class="clear-heading"><span>Room revived</span><h2 id="clear-title">{activeLevel.name}</h2><p>{dewdrops}/3 dewdrops <span>·</span> {newBest ? 'New best' : `Best: ${progress.cleared[activeLevel.id] ?? dewdrops}`}</p></div>
					<div class="score-marks">
						{#each [{ label: 'Revived', earned: marks.revived, text: 'Every vessel awakened' }, { label: 'Thrifty', earned: marks.thrifty, text: `Saved ${Math.floor(marks.reserve * 100 + 1e-7)}% (needs ${Math.round(marks.reserveNeeded * 100)}%)` }, { label: 'Clean', earned: marks.clean, text: `${marks.everSpoiled ? 'A vessel spoiled' : 'Nothing spoiled'}${marks.inkBudget !== undefined ? ` · wax ${marks.inkUsed}/${marks.inkBudget}` : ''}` }] as mark, i}
							<div class="score-mark" class:earned={revealed > i && mark.earned} data-mark={mark.label} data-earned={mark.earned}><svg viewBox="0 0 40 48" aria-hidden="true"><path d="M20 3C16 13 6 22 6 31a14 14 0 0 0 28 0C34 22 24 13 20 3Z"/><path class="drop-check" d="m13 30 5 5 10-12"/></svg><strong>{mark.label}</strong><span>{mark.text}</span></div>
						{/each}
					</div>
					<div class="clear-actions"><button class="primary next-room" bind:this={nextButton} onclick={continueRoom}>{selected === levels.length - 1 ? 'Wake the first wing →' : 'Next room →'}</button><button class="replay" onclick={restart}>Replay</button><button class="text-button" onclick={map}>Greenhouse</button></div>
				</section>
			{/if}
			{#if screen !== 'payoff'}
				{#if feedback}<div class="action-feedback" role="status">{feedback}</div>{/if}
				<footer class="room-footer"><button class:armed={resetArmed} title="Restart room · press twice or R, then R" aria-label={resetArmed ? 'Confirm restart room' : 'Restart room, press twice'} onclick={resetRequest}>{resetArmed ? 'Restart? Confirm' : '↺'}<span>{resetArmed ? '' : ' Restart'}</span></button><span class="quiet-note">{screen === 'sandbox' ? 'Stay as long as you like.' : ''}</span></footer>
			{/if}
		</div>
	{/if}
	{#if progress.finale && (screen === 'title' || screen === 'map')}<nav class="completed-garden" aria-label="The awakened garden"><button onclick={wander}>Wander the garden</button><button onclick={replayDawn}>See the dawn again</button><a class="ending-link" href={ENDING_URL}>delos.tz.mt/quotes</a></nav>{/if}
	{#if inRoom && blocked && !studyPaused}
		<dialog bind:this={dialog} oncancel={e => { e.preventDefault(); resume(); }} aria-labelledby="pause-title">
			<div class="modal-ornament" aria-hidden="true">{status === 'context-lost' || status === 'unavailable' ? '☾' : '❧'}</div>
			{#if status === 'unavailable' || status === 'error'}
				<span class="modal-eyebrow">a little more light is needed</span><h2 id="pause-title">This garden cannot<br/>wake here. Yet.</h2><p class="error-message">{error}</p><p class="fine">A browser with hardware-accelerated WebGL 2 and floating-point textures lets the water move as it should.</p><button class="primary" onclick={map}>Return to the greenhouse</button>
			{:else if status === 'context-lost'}
				<span class="modal-eyebrow">a passing cloud</span><h2 id="pause-title">The garden’s lights<br/>went out.</h2><p>Your cleared rooms are safe. This room will restart.</p><button class="primary" onclick={() => { restart(); }}>Wake this room</button><button class="text-button" onclick={map}>Return to the greenhouse</button>
			{:else}
				<span class="modal-eyebrow">the water can wait</span><h2 id="pause-title">A moment of stillness.</h2>{#if error}<p class="error-message">{error}</p>{/if}<button class="primary" onclick={resume}>Return to the garden</button>
				<div class="sound-controls"><button aria-pressed={muted} onclick={() => { muted = !muted; soundSettings(); }}>{muted ? 'Sound is sleeping' : 'Sound is awake'}</button><input aria-label="Garden volume" type="range" min="0" max="1" step=".01" bind:value={volume} oninput={soundSettings}/></div>
				<details><summary>Controls &amp; goals</summary><p>Press a spring to pour. Release to stop.<br/>Tap empty air or press P to reveal drafts with mist.<br/>Drag elsewhere to stir the air (optional). Click a vent to switch or turn it.<br/>{#if activeLevel.gates.some(g => g.style === 'plug' && g.driver.kind === 'player')}Open a plug to flush a wrong colour. Close it before refilling.{/if}</p><p>Tab explores springs, vessels and plugs.<br/>Arrows move your cursor. Hold Enter to pour or stir.<br/>Space or Esc pauses. R, then R, restarts.<br/>{#if activeLevel.ink > 0 || activeLevel.dig}1 hand{#if activeLevel.ink > 0} · 2 wax · 4 lift wax{/if}{#if activeLevel.dig} · 3 trowel{/if}.<br/>With a tool: arrows move, Enter makes a mark.<br/>{#if activeLevel.ink > 0}Right-click lifts a wax line.{/if}{/if}</p><p>Fill to the stripe. Keep every vessel ready together for 1.25 seconds.<br/>Extra water spills; only a wrong colour spoils.</p><p>Dewdrops: Revived for clearing · Thrifty for keeping {Math.round(activeLevel.mastery.reserve * 100)}% of your water · Clean for never spoiling{activeLevel.ink > 0 ? ` and using at most ${activeLevel.mastery.ink ?? activeLevel.ink} wax` : ''}.</p></details>
				<div class="pause-links"><button onclick={restart}>Restart room</button><button onclick={map}>Back to the greenhouse</button></div>
			{/if}
		</dialog>
	{/if}
</div>

<style>
	:global(body:has(.verdigris)) { overflow: hidden; }
	:global(.verdigris button) { min-width: 44px; min-height: 44px; }
	.verdigris { position: fixed; inset: 0; background: #0c2932; color: #d9dec3; font: 13px ui-sans-serif,system-ui,sans-serif; isolation: isolate; }
	.room-screen { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 38%,#294c44aa,transparent 65%),#0d2b32; display: flex; flex-direction: column; }
	.room-header { display: flex; align-items: center; gap: 20px; padding: 24px 38px 18px; position: relative; z-index: 5; min-height: 52px; }.room-header.cleared { justify-content: center; }
	.room-heading>span { color: #b5c4a6; font-size: 10px; text-transform: uppercase; letter-spacing: .18em; }.room-heading h1 { font: 400 22px/1.3 Georgia,serif; color: #e5e5c9; margin: 5px 0 0; }.pause-label,.bar-restart { display: none; }.room-actions { margin-left: auto; display: flex; align-items: center; gap: 15px; }
	.round { width: 44px; height: 44px; border-radius: 50%; border: 1px solid #7f947077; color: #ced7b9; background: transparent; cursor: pointer; font: 28px/1 Georgia,serif; }.pause-button { font-size: 15px; }.seed-pod { display: flex; align-items: center; gap: 6px; min-height: 44px; background: transparent; border: 0; padding: 6px; cursor: pointer; color: #c6cca0; }.seed-pod svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }.seed-pod span { font-size: 11px; }
	.room-body { flex: 1; min-height: 0; display: grid; place-items: center; padding: 0 55px 70px; }.board-wrap { width: min(100%,calc((100dvh - 208px) * 1.6)); }
	.room-footer { position: absolute; bottom: 20px; left: 39px; right: 39px; display: flex; align-items: center; justify-content: space-between; pointer-events: none; }.room-footer button { pointer-events: auto; font: 23px Georgia,serif; color: #b3c7a7; border: 0; background: transparent; cursor: pointer; min-height: 44px; }.room-footer button span { font: 11px ui-sans-serif,system-ui; vertical-align: middle; margin-left: 6px; }.room-footer button.armed { font: 13px ui-sans-serif,system-ui; color: #eed6a7; }.quiet-note { color: #a7bca0; font: italic 13px Georgia,serif; }
	.hints { position: absolute; z-index: 8; right: 35px; top: 90px; max-width: 310px; border: 1px solid #8b9e6d80; background: #183b39fa; box-shadow: 0 10px 40px #041b2380; padding: 20px 24px; border-radius: 6px; }.hints p { color: #e0dfbe; font: 15px/1.7 Georgia,serif; }.hints p span { color: #bdaf7c; margin-right: 10px; }.hints>button:first-child { position: absolute; top: 0; right: 0; background: transparent; border: 0; color: #cfdbb5; font-size: 24px; width: 44px; height: 44px; cursor: pointer; }.next-hint { background: transparent; color: #cfdbb5; border: 0; padding: 10px 0; cursor: pointer; font-size: 12px; text-decoration: underline; }
	.stuck-card { position: absolute; z-index: 7; left: 50%; bottom: 85px; transform: translateX(-50%); width: max-content; max-width: calc(100% - 60px); text-align: center; padding: 14px 22px; border: 1px solid #8b9e6d80; border-radius: 6px; background: #183b39f5; }.stuck-card p { margin: 0 0 9px; font: 18px Georgia,serif; }.stuck-card button,.completed-garden button { color: #eee7c9; border: 1px solid #a4ac7699; background: #163834ed; border-radius: 4px; padding: 12px 16px; font-size: 12px; cursor: pointer; }.stuck-card span { display: block; margin-top: 8px; color: #b9c9ac; font-size: 11px; }.ending-link { display: inline-block; margin-top: 14px; color: #eee7c9; font: 15px Georgia,serif; letter-spacing: .03em; text-underline-offset: 4px; }.completed-garden .ending-link { margin: 0; align-self: center; font-size: 13px; }.completed-garden { position: absolute; z-index: 9; right: 28px; bottom: 24px; display: flex; flex-wrap: wrap; gap: 10px; max-width: calc(100% - 56px); }
	.action-feedback { position: absolute; bottom: 70px; left: 50%; transform: translateX(-50%); padding: 10px 16px; max-width: calc(100% - 50px); width: max-content; background: #163c36f5; border: 1px solid #8ea77988; border-radius: 5px; font-size: 12px; text-align: center; z-index: 7; }
	.clear-card { position: absolute; z-index: 8; bottom: 24px; left: 50%; transform: translateX(-50%); width: min(590px,calc(100% - 32px)); box-sizing: border-box; padding: 20px 24px; border: 1px solid #b8c397; border-radius: 12px; background: #123833f5; box-shadow: 0 16px 70px #001b24aa; text-align: center; animation: appear .3s both; max-height: calc(100dvh - 90px); overflow: auto; }
	.clear-heading>span { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #bdcdad; }.clear-heading h2 { margin: 4px 0; font: 400 27px Georgia,serif; color: #f2e9ca; }.clear-heading p { margin: 8px 0 16px; color: #d5ddb8; font-size: 12px; }.clear-heading p span { padding: 0 8px; }
	.score-marks { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }.score-mark { display: flex; align-items: center; flex-direction: column; gap: 6px; }.score-mark svg { width: 38px; height: 46px; fill: #244b46; stroke: #92aa94; stroke-width: 1.5; transition: fill .3s,filter .3s; }.score-mark.earned svg { fill: #a8dce1; stroke: #e6f4d6; filter: drop-shadow(0 0 8px #a8dce150); }.drop-check { fill: none; stroke: #173e40; stroke-width: 2.5; opacity: 0; }.earned .drop-check { opacity: 1; }.score-mark strong { font-size: 13px; color: #f1e8ca; }.score-mark>span { font-size: 11px; line-height: 1.5; color: #c1d0b6; }
	.clear-actions { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-top: 20px; align-items: center; }.primary { display: block; width: 100%; box-sizing: border-box; background: #d7dfac; color: #173b35; border: 1px solid #edf1ca; font-size: 15px; font-weight: 650; min-height: 48px; padding: 12px 20px; border-radius: 5px; cursor: pointer; }.clear-actions .primary { font-size: 16px; }.clear-actions .replay { min-height: 48px; padding: 10px 22px; font-size: 13px; color: #e5e5c7; border: 1px solid #8da984; background: transparent; border-radius: 5px; cursor: pointer; }.text-button { background: transparent; border: 0; color: #baceaa; font-size: 12px; min-height: 44px; cursor: pointer; }.clear-actions .text-button { grid-column: 1/-1; }
	.interlude { position: absolute; inset: 0; background: #173b3d; }.interlude-words { position: absolute; inset: auto 20px 8%; text-align: center; text-shadow: 0 2px 20px #082b32; animation: appear 2s both; background: radial-gradient(ellipse,#0c302ed9,transparent 75%); }.interlude-words>span { text-transform: uppercase; font-size: 11px; letter-spacing: .16em; color: #d4dfbe; }.interlude-words h1 { font: 400 clamp(26px,4vw,48px) Georgia,serif; color: #f4eccc; margin: 18px 0; }.interlude-words p { font: italic 16px Georgia,serif; color: #d7e0c2; }.interlude-words .primary { width: auto; margin: 24px auto 0; padding: 14px 25px; text-shadow: none; }.interlude-words p.interlude-end { font: 12px/1.6 ui-sans-serif,system-ui; max-width: 390px; margin: 14px auto 0; }
	dialog { color: #dce1c5; background: #163834; border: 1px solid #8d9e6e; border-radius: 18px; max-width: min(430px,calc(100vw - 38px)); box-sizing: border-box; width: 430px; max-height: calc(100dvh - 40px); padding: 28px 32px; text-align: center; box-shadow: 0 24px 100px #001920b3; }dialog::backdrop { background: #051e29bd; backdrop-filter: blur(7px); }.modal-ornament { color: #c8c28e; font: 32px Georgia,serif; margin-bottom: 14px; }.modal-eyebrow { text-transform: uppercase; letter-spacing: .16em; color: #bcd2b2; font-size: 10px; }dialog h2 { font: 400 28px/1.35 Georgia,serif; color: #ede8c9; margin: 12px 0 24px; }dialog p { font: 14px/1.7 Georgia,serif; color: #c7d5bc; }.sound-controls { display: flex; gap: 18px; align-items: center; padding: 20px 0; }.sound-controls button { background: transparent; padding: 0; white-space: nowrap; border: 0; color: #c1d3b3; font-size: 12px; cursor: pointer; min-height: 44px; }.sound-controls input { min-width: 0; width: 100%; accent-color: #d7dfac; height: 44px; }details { text-align: left; border-block: 1px solid #92aa7055; padding: 15px 0; }summary { min-height: 44px; display: flex; align-items: center; color: #d9dfbf; font-size: 12px; cursor: pointer; }details p { font: 12px/1.8 ui-sans-serif,system-ui; }.pause-links { display: flex; justify-content: space-between; gap: 15px; padding-top: 16px; }.pause-links button { border: 0; background: transparent; color: #c1d3b3; font-size: 12px; cursor: pointer; min-height: 44px; }.error-message { overflow-wrap: anywhere; }dialog p.fine { font: 12px/1.7 ui-sans-serif,system-ui; }.new-confirm { position: absolute; z-index: 10; bottom: 90px; left: 8%; right: 20px; color: #f0dfb9; font-size: 12px; max-width: 350px; line-height: 1.7; }
	button:hover { filter: brightness(1.15); }button:focus-visible,input:focus-visible,summary:focus-visible { outline: 2px solid #ecdba7; outline-offset: 4px; }@keyframes appear { from { opacity: 0; }to { opacity: 1; } }
	@media(max-width: 600px) { .room-header { padding: max(18px,env(safe-area-inset-top)) 16px 12px; gap: 12px; }.room-heading h1 { font-size: 20px; }.room-heading>span { font-size: 11px; letter-spacing: .1em; }.room-actions { position: fixed; bottom: max(16px,env(safe-area-inset-bottom)); left: 16px; right: 16px; justify-content: space-around; gap: 8px; padding: 8px; border: 1px solid #829d7055; border-radius: 12px; background: #123831; }.room-actions button { min-width: 88px; min-height: 48px; font: 12px ui-sans-serif,system-ui; color: #d9dec3; }.room-actions .pause-button { width: auto; border: 0; display: flex; align-items: center; justify-content: center; gap: 8px; }.pause-label,.bar-restart { display: inline; }.bar-restart { background: transparent; border: 0; cursor: pointer; }.room-footer { display: none; }.room-body { align-items: start; padding: 40px 8px 100px; overflow-y: auto; }.board-wrap { width: 100%; }.room-footer { left: 18px; right: 18px; bottom: 18px; }.hints { right: 18px; left: 18px; max-width: none; top: 88px; }.clear-card { bottom: max(18px,env(safe-area-inset-bottom)); padding: 18px 16px; }.score-marks { gap: 9px; }.clear-heading h2 { font-size: 24px; }.clear-actions .replay { padding: 10px 16px; }.interlude-words { inset: auto 18px 7%; }dialog { padding: 24px; }.completed-garden { right: 18px; left: 18px; max-width: none; justify-content: center; } }
	.celebrating .room-body { padding-bottom: 340px; }.celebrating .board-wrap { width: min(100%,calc((100dvh - 440px) * 1.6)); }@media(max-width:600px) { .celebrating .room-body { padding-bottom: 340px; }.celebrating .board-wrap { width: 100%; } }
	@media(max-height: 550px) and (min-width: 601px) { .room-header { padding: 10px 25px 8px; }.room-body { padding-bottom: 50px; }.board-wrap { width: min(100%,calc((100dvh - 145px) * 1.6)); }.room-footer { bottom: 6px; }.clear-card { bottom: 12px; padding: 12px 20px; width: 500px; }.score-mark svg { width: 28px; height: 32px; }.clear-heading h2 { font-size: 21px; }.clear-heading p { margin: 6px 0 10px; }.clear-actions { margin-top: 12px; } }
	@media(prefers-reduced-motion: reduce) { .clear-card,.interlude-words { animation: none; }.score-mark svg { transition: none; } }
</style>
