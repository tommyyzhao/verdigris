<script lang="ts">
	import { onMount } from 'svelte';
	import type { Stop, Telemetry } from './telemetry.js';
	import { drawTerrain } from './Terrain.js';
	import Machine from './Machine.svelte';
	import SpringArt from './SpringArt.svelte';
	import { FORBIDDEN_TOLERANCE, RATIO_TOLERANCE, HOLD_SECONDS } from './types.js';
	import { levelHeight } from './level-height.js';
	import type { Action, Level, Recipe, RoomView, UiSound, UrnView, Vec, Vent } from './types.js';
	let { telemetry, level, view, oncanvas, onact, onui, payoff = false, denied, resetToken = 0, suspended = false, onboarding, waxCue = false, onlearn }: { telemetry?: Telemetry; level: Level; view: RoomView | null; oncanvas: (canvas: HTMLCanvasElement, airCanvas: HTMLCanvasElement) => void; onact: (action: Action) => void; onui: (sound: UiSound, pan?: number) => void; payoff?: boolean; denied?: { at?: Vec; key: number }; resetToken?: number; suspended?: boolean; onboarding?: 'pour' | 'puff'; waxCue?: boolean; onlearn?: () => void } = $props();
	let terrainCanvas: HTMLCanvasElement;
	let liquidCanvas: HTMLCanvasElement;
	let airCanvas: HTMLCanvasElement;
	let board: HTMLDivElement;
	let terrainRevision = -1;
	let tool = $state<'hand' | 'ink' | 'dig' | 'erase'>('hand');
	let hovered = $state('');
	let inspected = $state('');
	let lastStir = $state(-Infinity);
	let wasteFlash = $state(false);
	let lastWaste = 0;
	let wasted = $derived(view?.wasted ?? 0);
	$effect(() => { if (wasted <= lastWaste) return; lastWaste = wasted; wasteFlash = true; const timer = setTimeout(() => wasteFlash = false, 650); return () => clearTimeout(timer); });
	
	let supply = $derived(level.springs.length ? level.springs.reduce((sum, s) => sum + s.well, 0) : level.pools.reduce((sum, p) => sum + p.units, 0));
	let remaining = $derived(level.springs.length ? level.springs.reduce((sum, s) => sum + (view?.springs[s.id] ?? s.well), 0) : Math.max(0, supply - (view?.wasted ?? 0)));
	function amount(r: Recipe, u?: UrnView) {
		if (u?.status === 'spoiled') return `${Math.floor(u.units * 10) / 10} · flush`;
		if (u?.status === 'ready' || u?.status === 'complete') return `${r.amount}+ ✓`;
		const n = Math.floor((u?.units ?? 0) * 10) / 10;
		const total = u?.counts.reduce((a, b) => a + b, 0) ?? 0, parts = r.mix.reduce((a, b) => a + b, 0);
		const missing = total && !u?.inTune ? r.mix.findIndex((n, i) => n && n / parts - u!.counts[i] / total > (level.ratioTolerance ?? RATIO_TOLERANCE)) : -1;
		return missing >= 0 ? `${n} · more ${['dew', 'sap', 'rose'][missing]}` : `${n} / ${r.amount}`;
	}
	let virtual = $state({ x: 24, y: 15, visible: false });
	let stroke = 0;
	let gesture: { pointer: number; at: Vec; stroke: number; spring: string | null; origin: Vec; started: number; moved: boolean } | null = null;
	let drag: { pointer: number; id: string; at: Vec; value: number; count: number } | null = null;
	let owner: { id: number; target: HTMLElement } | null = null;
	let keyHeld = false;
	let keySpring: string | null = null;
	const strokes = new Map<number, Vec[]>();
	const colors = ['#6ec6ff', '#f2b134', '#e8608a'];
	const gaugeColors = ['#2798dc', '#bf861b', '#dc5b82'];
	const names = ['Dew (blue)', 'Sap (gold)', 'Rose (pink)'];
	const glyphs = ['◆', '●', '▲'];
	const words = (id: string) => id.replace('sap-urn', 'gold vessel').replaceAll('urn', 'vessel').replaceAll('-', ' ');
	const springAt = (at: Vec) => level.springs.find(s => at.x >= s.zone.x && at.x <= s.zone.x + s.zone.w && at.y >= s.zone.y && at.y <= s.zone.y + s.zone.h);
	const recipeWords = (r: Recipe) => r.mix.map((n, i) => n ? `${n} ${n === 1 ? 'part' : 'parts'} ${names[i].toLowerCase()}` : '').filter(Boolean).join(', ');
	function forbidden(r: Recipe, u?: UrnView) {
		const total = u?.counts.reduce((a, b) => a + b, 0) ?? 0;
		return u?.status === 'spoiled' ? u.counts.map((n, i) => !r.mix[i] && n > total * FORBIDDEN_TOLERANCE ? i : -1).filter(i => i >= 0) : [];
	}
	function status(r: Recipe, u?: UrnView, plug?: string) {
		return u?.status === 'spoiled' ? `spoiled: ${forbidden(r, u).map(i => `contains ${names[i].toLowerCase()}`).join(', ')}${plug ? '; open its plug to flush' : ''}` : u?.status === 'ready' ? 'ready; keep all vessels in tune together' : u?.status === 'complete' ? 'complete' : u?.inTune ? 'in tune' : 'not yet in tune';
	}
	let objectives = $derived([...level.urns.map(u => ({ ...u, state: view?.urns.find(v => v.id === u.id) })), ...level.seeds.map(u => ({ ...u, state: view?.seedViews.find(v => v.id === u.id) }))].map(u => `${words(u.id).replaceAll('urn', 'vessel')}: ${u.state?.status ?? 'filling'}.`).join(' ') + (view?.stuck ? ' The springs are spent. Restart with R, then R.' : '') + (view?.cleared ? ' Room clear.' : ''));
	const mixColor = (mix: readonly number[]) => {
		const total = mix.reduce((a, b) => a + b, 0) || 1;
		const rgb = [[110, 198, 255], [242, 177, 52], [232, 96, 138]];
		return `rgb(${[0, 1, 2].map(c => { const k = mix.reduce((sum, amount, i) => { const r = rgb[i][c] / 255; return sum + amount / total * (1 - r) ** 2 / (2 * r); }, 0); return Math.round(255 * (1 + k - Math.sqrt(k * k + 2 * k))); }).join(',')})`;
	};
	const pose = (id: string, initial: number) => view?.planks[id] ?? initial;
	function claim(e: PointerEvent) {
		if (suspended || owner || keyHeld) return false;
		const target = e.currentTarget as HTMLElement;
		telemetry?.inputStart();
		owner = { id: e.pointerId, target }; target.setPointerCapture(e.pointerId); return true;
	}
	function cancel(e?: PointerEvent, reason: Stop = 'release') {
		if (e && owner?.id !== e.pointerId) return;
		const old = owner;
		telemetry?.inputEnd(reason);
		if (gesture || keyHeld) onact({ type: 'pour', spring: null });
		owner = null; drag = null; gesture = null; keyHeld = false; keySpring = null;
		if (old?.target.hasPointerCapture(old.id)) old.target.releasePointerCapture(old.id);
	}
	$effect(() => { resetToken; suspended; cancel(undefined, suspended ? payoff ? 'clear_ui' : 'pause' : 'restart'); });
	$effect(() => { resetToken; lastStir = -Infinity; lastWaste = 0; strokes.clear(); terrainRevision = -1; tool = 'hand'; virtual = { x: 24, y: 15, visible: false }; });
	$effect(() => { if (terrainCanvas && view && terrainRevision !== view.terrainRevision) { drawTerrain(terrainCanvas, view.terrain); terrainRevision = view.terrainRevision; } });
	onMount(() => { oncanvas(liquidCanvas, airCanvas); board.focus({ preventScroll: true }); return () => cancel(undefined, 'navigation'); });
	function point(e: PointerEvent): Vec { const r = board.getBoundingClientRect(); return { x: Math.max(0, Math.min(48, (e.clientX - r.left) / r.width * 48)), y: Math.max(0, Math.min(30, (e.clientY - r.top) / r.height * 30)) }; }
	function erase(at: Vec) {
		let nearest = -1, distance = 1.8;
		for (const [id, points] of strokes) for (const p of points) { const d = Math.hypot(p.x - at.x, p.y - at.y); if (d < distance) { nearest = id; distance = d; } }
		if (nearest >= 0) { onact({ type: 'erase', stroke: nearest }); strokes.delete(nearest); onui('erase'); }
	}
	function apply(at: Vec, from = at, id = ++stroke) {
		if (tool === 'ink') { onact({ type: 'ink', stroke: id, from, to: at }); const points = strokes.get(id) ?? []; const count = Math.max(1, Math.ceil(Math.hypot(at.x - from.x, at.y - from.y) / .4)); for (let i = 0; i <= count; i++) points.push({ x: from.x + (at.x - from.x) * i / count, y: from.y + (at.y - from.y) * i / count }); strokes.set(id, points); }
		else if (tool === 'dig') { const count = Math.max(1, Math.ceil(Math.hypot(at.x - from.x, at.y - from.y) / .4)); for (let i = 0; i <= count; i++) onact({ type: 'dig', at: { x: from.x + (at.x - from.x) * i / count, y: from.y + (at.y - from.y) * i / count }, radius: .65 }); }
		else if (tool === 'erase') erase(at);
	}
	function start(e: PointerEvent) {
		if ((e.target as Element).closest('button:not(.spring-hit)') || suspended || owner || keyHeld) return;
		const at = point(e);
		if (e.button === 2 && level.ink > 0) { e.preventDefault(); erase(at); return; }
		if (e.button !== 0) return;
		e.preventDefault(); board.focus({ preventScroll: true });
		if (!claim(e)) return;
		virtual.visible = false;
		const spring = tool === 'hand' ? (e.target as Element).closest<HTMLButtonElement>('.spring-hit')?.dataset.spring ?? springAt(at)?.id ?? null : null;
		gesture = { pointer: e.pointerId, at, stroke: ++stroke, spring, origin: at, started: performance.now(), moved: false };
		if (tool === 'hand') { if (spring) onact({ type: 'pour', spring, at }); }
		else { apply(at, at, gesture.stroke); onui(tool); }
	}
	function move(e: PointerEvent) {
		const at = point(e); telemetry?.cursor(at, e.pointerType, !!gesture || !!drag || keyHeld); hovered = springAt(at)?.id ?? '';
		inspected = [...level.urns, ...level.seeds].find(u => at.x >= u.box.x && at.x <= u.box.x + u.box.w && at.y >= u.box.y && at.y <= u.box.y + u.box.h)?.id ?? '';
		if (!gesture || gesture.pointer !== e.pointerId || owner?.id !== e.pointerId) return;
		if (tool === 'hand') { if (gesture.spring) onact({ type: 'pour', spring: gesture.spring, at }); else if (gesture.moved || Math.hypot(at.x - gesture.origin.x, at.y - gesture.origin.y) > .3) { gesture.moved = true; onact({ type: 'stir', from: gesture.at, to: at }); lastStir = view?.tick ?? 0; } }
		else apply(at, gesture.at, gesture.stroke);
		gesture.at = at;
	}
	function focusSpring(id: string) { const s = level.springs.find(s => s.id === id)!; hovered = id; virtual = { x: s.zone.x + s.zone.w * .9, y: s.zone.y + s.zone.h / 2, visible: true }; }
	function keyboard(e: KeyboardEvent) {
		if (suspended || (e.target as Element).closest('button:not(.spring-hit)')) return;
		if (e.key === '1' || e.key === '2' && level.ink || e.key === '3' && level.dig || e.key === '4' && level.ink) { cancel(); const previousTool = tool; tool = ({ '1': 'hand', '2': 'ink', '3': 'dig', '4': 'erase' } as const)[e.key as '1']; telemetry?.tool(tool, previousTool, 'keyboard'); onlearn?.(); board.focus(); }
		else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
			e.preventDefault(); const from = { ...virtual };
			virtual = { x: Math.max(.5, Math.min(47.5, virtual.x + (e.key === 'ArrowRight' ? .5 : e.key === 'ArrowLeft' ? -.5 : 0))), y: Math.max(.5, Math.min(29.5, virtual.y + (e.key === 'ArrowDown' ? .5 : e.key === 'ArrowUp' ? -.5 : 0))), visible: true };
			if (keyHeld && tool === 'hand') { if (keySpring) onact({ type: 'pour', spring: keySpring, at: virtual }); else { onact({ type: 'stir', from, to: virtual }); lastStir = view?.tick ?? 0; } }
		} else if (e.key.toLowerCase() === 'p' && !e.repeat && !owner && !keyHeld) { e.preventDefault(); onact({ type: 'puff', at: virtual }); }
		else if (e.key === 'Enter') {
			e.preventDefault(); if (e.repeat || keyHeld || owner) return;
			telemetry?.inputStart(); keyHeld = true;
			if (tool === 'hand') { keySpring = springAt(virtual)?.id ?? null; if (keySpring) onact({ type: 'pour', spring: keySpring, at: virtual }); }
			else { apply(virtual); onui(tool); }
		}
	}
	function setTool(next: typeof tool) { onlearn?.(); cancel(); telemetry?.tool(next, tool, 'pointer'); tool = next; board.focus(); onui('click'); }
	function plankStart(e: PointerEvent, id: string) { if (e.button !== 0 || !claim(e)) return; e.preventDefault(); e.stopPropagation(); const p = level.planks.find(p => p.id === id)!; drag = { pointer: e.pointerId, id, at: point(e), value: pose(id, p.initial), count: p.angles.length }; }
	function plankMove(e: PointerEvent) { if (!drag || drag.pointer !== e.pointerId) return; const p = level.planks.find(p => p.id === drag?.id)!, at = point(e), angle = Math.atan2(at.y - p.pivot.y, at.x - p.pivot.x) * 180 / Math.PI; let best = 0, distance = Infinity; p.angles.forEach((a, i) => { const d = Math.abs(((angle - a + 540) % 360) - 180); if (d < distance) { best = i; distance = d; } }); onact({ type: 'pose', id: p.id, index: best }); }
	function plankEnd(e: PointerEvent) { if (!drag || drag.pointer !== e.pointerId) return; const at = point(e); if (Math.hypot(at.x - drag.at.x, at.y - drag.at.y) < .3) onact({ type: 'pose', id: drag.id, index: (drag.value + 1) % drag.count }); cancel(e); }
	function plankKey(e: KeyboardEvent, id: string) { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return; e.preventDefault(); e.stopPropagation(); const p = level.planks.find(p => p.id === id)!, old = pose(id, p.initial); onact({ type: 'pose', id, index: e.key === 'Home' ? 0 : e.key === 'End' ? p.angles.length - 1 : Math.max(0, Math.min(p.angles.length - 1, old + (['ArrowLeft','ArrowDown'].includes(e.key) ? -1 : 1))) }); }
	function end(e: PointerEvent) {
		if (gesture?.pointer === e.pointerId && tool === 'hand' && !gesture.spring && !gesture.moved && performance.now() - gesture.started < 450) onact({ type: 'puff', at: gesture.origin });
		cancel(e);
	}
	const ventVelocity = (v: Vent) => view?.vents[v.id] ?? (v.control?.kind === 'turn' ? v.control.velocities[v.control.index] : v.control?.kind === 'switch' && !v.control.on ? { x: 0, y: 0 } : v.velocity);
	const ventIndex = (v: Vent) => view?.ventControls[v.id] ?? (v.control?.kind === 'turn' ? v.control.index : Number(v.control?.kind === 'switch' && v.control.on));
	const heading = (v: Vent) => { const p = ventVelocity(v); return !p.x && !p.y ? 'off' : `${Math.round((Math.atan2(p.y, p.x) * 180 / Math.PI + 360) % 360)} degrees clockwise from right`; };
	function changeVent(v: Vent) {
		if (suspended || owner || keyHeld || !v.control) return;
		onact(v.control.kind === 'switch' ? { type: 'toggle', id: v.id } : { type: 'pose', id: v.id, index: (ventIndex(v) + 1) % v.control.velocities.length });
	}
</script>

<svelte:window onblur={() => cancel(undefined, 'blur')} onkeyup={e => { if (e.key === 'Enter' && keyHeld) { e.preventDefault(); cancel(); } }}/>
<div class="board-shell">
	<div class="objective-summary" aria-live="polite" aria-atomic="true">{objectives}</div>
	<!-- One keyboard cursor shares the same contextual gesture as touch. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div class="board" class:payoff class:drawing={tool !== 'hand'} class:spring-cursor={tool === 'hand' && !!level.springs.find(s => s.id === hovered)} bind:this={board} tabindex="0" role="application" aria-label="Machine garden room. Press a spring to pour. Tap empty air or press P for mist. Drag elsewhere to stir air. Arrows move the cursor; hold Enter to pour or stir." onkeydown={keyboard} onfocusout={e => { if (!board.contains(e.relatedTarget as Node)) cancel(undefined, 'blur'); }} onpointerdown={start} onpointermove={move} onpointerleave={() => { telemetry?.cursor(null, 'unknown', false); hovered = ''; inspected = ''; }} onpointerup={end} onpointercancel={e => cancel(e, 'unknown')} onlostpointercapture={e => cancel(e, 'unknown')} oncontextmenu={e => e.preventDefault()}>
		<svg class="layer backdrop" viewBox="0 0 48 30" fill="none" aria-hidden="true">
			<defs>
				<linearGradient id="board-sky" x2="0" y2="1"><stop stop-color="#163946"/><stop offset="1" stop-color="#31524c"/></linearGradient>
				<radialGradient id="board-haze"><stop stop-color="#bac5a3" stop-opacity=".14"/><stop offset="1" stop-color="#bac5a3" stop-opacity="0"/></radialGradient>
				<linearGradient id="urn-glaze" x2="1" y2="1"><stop stop-color="#b28662" stop-opacity=".22"/><stop offset=".5" stop-color="#945f4f" stop-opacity=".06"/><stop offset="1" stop-color="#7a6855" stop-opacity=".35"/></linearGradient>
				<pattern id="board-grain" width="3.1" height="2.7" patternUnits="userSpaceOnUse"><circle cx=".2" cy=".4" r=".025" fill="#d4ddba" opacity=".22"/><circle cx="1.8" cy="1.7" r=".035" fill="#001b2b" opacity=".25"/></pattern>
			</defs>
			<path fill="url(#board-sky)" d="M0 0h48v30H0Z"/><circle cx="41" cy="8" r="1.8" fill="#c1c7a5" opacity=".07"/>
			<path d="M0 18Q6 14 12 18T28 17 48 14V30H0Z" fill="#153c3c" opacity=".5"/>
			{#each [3,17,34,44] as x, i}<path d={`M${x} 30q-1-8 .3-${9 + i}m-.3 3q-3-3-3.5-2.4m3.7 4q3-4 4-3.5`} stroke="#0b3237" stroke-width=".35" opacity=".48"/>{/each}
			{#each [0,8,16,24,32,40,48] as x}<path d={`M${x} 0V30`} stroke="#709786" stroke-opacity=".055" stroke-width=".1"/>{/each}
			{#each [0,10,20,30] as y}<path d={`M0 ${y}H48`} stroke="#709786" stroke-opacity=".055" stroke-width=".1"/>{/each}
			{#each [0,8,16,24,32,40] as x}<path d={`m${x + .6} .6 6.8 8.6m-6.8 2 6.8 8.2`} stroke="#b3d0b8" stroke-opacity=".012" stroke-width=".4"/>{/each}
			<ellipse cx="34" cy="10" rx="19" ry="18" fill="url(#board-haze)"/>
			<path d="M.3 0v30M47.7 0v30M0 .4h48M0 29.6h48" stroke="#7c9270" stroke-opacity=".5" stroke-width=".3"/>
			<path d="M1 0q2 2.7.5 5m.5-2q1.8.7 1.5 2M47 0q-3.2 3-2 7m1-3q-2-.5-2.3 1.5" stroke="#5e805b" stroke-width=".2"/>
			{#each [0,1,2,3,4,5] as i}<g fill="#74906a" opacity=".5"><ellipse cx={1.5 + Math.sin(i) * .35} cy={1 + i * .66} rx=".18" ry=".42" transform={`rotate(${i % 2 ? 40 : -35} ${1.5 + Math.sin(i) * .35} ${1 + i * .66})`}/><ellipse cx={46 - Math.sin(i) * .6} cy={1 + i * .9} rx=".2" ry=".45"/></g>{/each}
			<path fill="url(#board-grain)" d="M0 0h48v30H0Z"/>
		</svg>
		<canvas class="layer air" bind:this={airCanvas} aria-hidden="true"></canvas>
		<canvas class="layer terrain" bind:this={terrainCanvas} aria-hidden="true"></canvas>
		<canvas class="layer liquid" bind:this={liquidCanvas} aria-label="Flowing liquid"></canvas>
		<svg class="layer foreground" viewBox="0 0 48 30" fill="none" aria-hidden="true">
			{#each level.vents.filter(v => !v.hidden) as vent}
				{@const v = ventVelocity(vent)}{@const on = !!(v.x || v.y)}{@const x = (vent.from.x + vent.to.x) / 2}{@const y = (vent.from.y + vent.to.y) / 2}{@const angle = Math.atan2(v.y, v.x) * 180 / Math.PI}
				<g class="vent" class:vent-off={!on} data-vent={vent.id} data-heading={heading(vent)}>
					<path d={`M${vent.from.x} ${vent.from.y}L${vent.to.x} ${vent.to.y}`} stroke="#0d2b32" stroke-width="1.25" stroke-linecap="round"/>
					<path d={`M${vent.from.x} ${vent.from.y}L${vent.to.x} ${vent.to.y}`} stroke="#b0cbc0" stroke-width=".85" stroke-opacity=".5" stroke-dasharray=".13 .35"/>
					<g transform={`translate(${x} ${y})`}><circle r=".9" fill="#163b40" stroke="#c4d8ca" stroke-width=".1"/>
						{#if on}<g transform={`rotate(${angle})`}><path d="M-.55 0H.6M.1-.4.6 0 .1.4" stroke="#edf4df" stroke-width=".14" stroke-linejoin="round"/></g>{:else}<path d="m-.35-.35.7.7m-.7 0 .7-.7" stroke="#e3d5ae" stroke-width=".13"/>{/if}
						{#if vent.control?.kind === 'turn'}{#each vent.control.velocities as velocity, i}<circle cx={Math.cos(Math.atan2(velocity.y, velocity.x)) * 1.15} cy={Math.sin(Math.atan2(velocity.y, velocity.x)) * 1.15} r={i === ventIndex(vent) ? .12 : .07} fill="#e3d5ae"/>{/each}{/if}
					</g>
					{#if on}<g class="vent-motes" style={`--draft-x:${v.x / Math.hypot(v.x,v.y) * 3}px;--draft-y:${v.y / Math.hypot(v.x,v.y) * 3}px`}>{#each [0,1,2] as i}<circle cx={vent.from.x + (vent.to.x - vent.from.x) * (i + .5) / 3} cy={vent.from.y + (vent.to.y - vent.from.y) * (i + .5) / 3} r=".13" fill="#e0f2e6"/>{/each}</g>{/if}
				</g>
			{/each}
			{#each level.machines as machine, i}<Machine {machine} powered={payoff || (view?.machines[machine.id] ?? false)} delay={payoff ? i * .6 : 0}/>{/each}
			{#each level.springs as spring}
				<SpringArt {spring} showWell={!payoff} fill={Number.isFinite(spring.well) ? Math.max(0, (view?.springs[spring.id] ?? spring.well) / spring.well) : 1} active={hovered === spring.id || view?.pouring?.spring === spring.id}/>
				{#if hovered === spring.id}<text class="spring-glyph" x={spring.zone.x + spring.zone.w / 2} y={spring.zone.y - .5} text-anchor="middle" fill={colors[spring.species]}>{glyphs[spring.species]}</text>{/if}
			{/each}
			{#if view?.pouring}{@const s = level.springs.find(s => s.id === view.pouring?.spring)}<g data-emitter={view.pouring.spring} transform={`translate(${view.pouring.at.x} ${view.pouring.at.y})`}><circle r=".6" fill="none" stroke={colors[s?.species ?? 0]} stroke-width=".055" opacity=".55"/><path d="M0-.4Q-.6.2 0 .55Q.6.2 0-.4Z" fill={colors[s?.species ?? 0]} stroke="#e5f3d8" stroke-width=".07"/></g>{/if}
			{#each [...level.urns.map(u => ({ ...u, seed: false })), ...level.seeds.map(u => ({ ...u, seed: true }))] as urn}
				{@const b = urn.box}{@const u = (urn.seed ? view?.seedViews : view?.urns)?.find(v => v.id === urn.id)}{@const total = u?.counts.reduce((a,c) => a+c, 0) ?? 0}{@const parts = urn.recipe.mix.reduce((a,c) => a+c, 0)}
				<g class="urn" class:inspecting={inspected === urn.id} class:ready={u?.status === 'ready'} class:spoiled={u?.status === 'spoiled'} class:complete={u?.status === 'complete'} data-basin={urn.id} data-hold={u?.hold ?? 0} data-in-tune={u?.inTune ?? false}>
					<path d={`M${b.x - .25} ${b.y - .3}q-.8 ${b.h * .55} .3 ${b.h + .5}q${b.w * .5} .8 ${b.w - .1} 0q1-3 .4-${b.h + .5}`} fill="url(#urn-glaze)" stroke="#b38d70" stroke-opacity=".65" stroke-width=".18"/>
					<path d={`M${b.x - .5} ${b.y - .35}h${b.w + .1}q.5 0 .5 .5v.5h.9`} stroke="#d2b18a" stroke-width=".18" stroke-linejoin="round"/>
					<path d={`M${b.x + b.w + .1} ${b.y + .65}h.9m-.3 .25h.3`} stroke="#e2c39a" stroke-width=".07" opacity=".7"/>
					<g transform={`translate(${b.x + b.w / 2 - 2} ${b.y + .3})`}><g class="plaque" class:green={u?.inTune && urn.recipe.mix.filter(Boolean).length > 1} data-plaque={urn.id}>
						<path d="M.45 0v-.5m3.1.5v-.5" stroke="#c1a875" stroke-width=".09"/><rect x="-1" width="6" height="2.7" rx=".22" fill="#705c3f" stroke={u?.inTune && urn.recipe.mix.filter(Boolean).length > 1 ? mixColor(urn.recipe.mix) : '#d0b47c'} stroke-width=".12"/><rect x="-.87" y=".13" width="5.74" height="2.44" rx=".12" fill="#183b39" stroke="#a99465" stroke-width=".035"/>
						{#each urn.recipe.mix as n, species}{#each Array.from({ length: n }) as _, i}<text class="plaque-glyph" data-recipe-species={species} x={.38 + (urn.recipe.mix.slice(0, species).reduce((a,c) => a+c, 0) + i) * .47} y=".75" fill={colors[species]}>{glyphs[species]}</text>{/each}{/each}
						{#each forbidden(urn.recipe, u) as species, i}<g data-forbidden-species={species} transform={`translate(${3.05 + i * .38} .68)`}><text class="plaque-glyph" fill={colors[species]}>{glyphs[species]}</text><path d="M-.05 .1l.48-.57" stroke="#f3dfbd" stroke-width=".09"/></g>{/each}
						<path d="M.32 1h3.36" stroke="#c4b688" stroke-width=".055"/>
						{#each urn.recipe.mix as n, species}{#if n}<path d={`M${.32 + 3.36 * urn.recipe.mix.slice(0, species).reduce((a,c) => a+c, 0) / parts} .9v.2`} stroke="#e4d6a6" stroke-width=".06"/>{/if}{/each}
						<g class="mixture-gauge" opacity={total ? 1 : 0}>
							{#each u?.counts ?? [0,0,0] as n, species}{#if n}<rect x={.32 + 3.36 * (u?.counts.slice(0, species).reduce((a,c) => a+c, 0) ?? 0) / total} y="1.18" width={3.36 * n / total} height=".22" fill={gaugeColors[species]}/>{/if}{/each}
						</g>
<text class="amount-label" x="2" y="2.3" text-anchor="middle">{amount(urn.recipe, u)}</text>
						{#if u?.status === 'ready'}<text class="release-label" x="2" y="3.7" text-anchor="middle">release</text>{/if}
						{#if u?.inTune && urn.recipe.mix.filter(Boolean).length > 1}<text class="amount-label" x="2" y="2.95" text-anchor="middle" fill={mixColor(urn.recipe.mix)}>green ✓</text>{/if}
						{#if u?.status === 'ready' || u?.status === 'complete'}<text class="ready-check" x="4.65" y="1.2">✓</text>{/if}
					</g></g>
					<path class="target-stripe" class:green={u?.inTune && urn.recipe.mix.filter(Boolean).length > 1} d={`M${b.x - 2.6} ${b.y + b.h - Math.min(b.h, levelHeight(urn.recipe.amount, b.w))}h.5 M${b.x + b.w + 2.1} ${b.y + b.h - Math.min(b.h, levelHeight(urn.recipe.amount, b.w))}h.5`} stroke={mixColor(urn.recipe.mix)} stroke-width=".16" stroke-linecap="round"/>
					<path d={`M${b.x + b.w - .4} ${b.y + b.h + .4}q1.2-1.4 .8-3.1m-.2 1.4q-1.1-.5-.8-1m1 1q1.1-.7 1-.2`} stroke="#8caa77" stroke-width=".13"/>
					<g transform={`translate(${b.x + b.w + .4} ${b.y + b.h - 2.8})`}><path d="M0 0q-.9-.6-.35-1.1Q.5-1.2.5-.5Z" fill={u?.status === 'spoiled' ? '#6b755b' : u?.inTune ? '#e1be88' : '#8b9b67'} stroke="#b7bd84" stroke-width=".06"/>{#if u?.status === 'complete'}<g fill="#e3bd88"><ellipse cy="-.4" rx=".28" ry=".55" transform="rotate(-45)"/><ellipse cy="-.4" rx=".28" ry=".55" transform="rotate(45)"/></g>{/if}</g>
					{#if u?.status === 'spoiled'}<text class="spoil-label" x={b.x + b.w / 2} y={b.y + b.h / 2} text-anchor="middle">No {forbidden(urn.recipe, u).map(i => ['dew', 'sap', 'rose'][i]).join(' + ') || 'wrong colour'} here</text><text class="spoil-label" x={b.x + b.w / 2} y={b.y + b.h / 2 + .85} text-anchor="middle">{urn.plug ? 'Open plug ↓' : 'Flush to retry'}</text><rect class="cloud" x={b.x + .2} y={b.y + .2} width={b.w - .4} height={b.h - .4} rx="1" fill="#a5a58a" opacity=".32"/>{/if}
					{#if (u?.hold ?? 0) > 0}<text class="hold-label" x={b.x + b.w + .8} y={b.y - .7} text-anchor="start">{u?.status === 'complete' ? '✓' : `${Math.max(.1, Math.ceil((1 - (u?.hold ?? 0)) * HOLD_SECONDS * 10) / 10)}s`}</text><rect class="hold-ring" x={b.x - .55} y={b.y - .65} width={b.w + 1.1} height={b.h + 1.25} rx="1" pathLength="1" stroke="#e7d4a0" stroke-width=".1" stroke-dasharray={`${u!.hold} 1`} stroke-linecap="round" opacity=".65"/>{/if}
				</g>
			{/each}
			{#each level.wheels as wheel}<g transform={`translate(${wheel.at.x} ${wheel.at.y})`}><g class="waterwheel" class:flowing={Math.abs(view?.wheels[wheel.id] ?? 0) > .02} style={`animation-duration:${Math.abs(view?.wheels[wheel.id] ?? 0) > .02 ? Math.max(.4, 6 / Math.abs(view?.wheels[wheel.id] ?? 1)) : 1000}s;animation-play-state:${Math.abs(view?.wheels[wheel.id] ?? 0) > .02 ? 'running' : 'paused'}`}><circle r={wheel.radius} stroke="#c1b27a" stroke-opacity=".55" stroke-width=".16"/>{#each [0,45,90,135] as a}<path d={`M${-wheel.radius} 0h${wheel.radius * 2}`} transform={`rotate(${a})`} stroke="#c1b27a" stroke-width=".09"/>{/each}<circle r=".3" fill="#bbac79"/></g></g>{/each}
			{#each level.brambles as bramble}{#if (view?.brambles[bramble.id] ?? 1) > .05}{#each bramble.vine as b}<path d={`M${b.x} ${b.y + b.h / 2}q${b.w * .4}-1 ${b.w} 0m-${b.w * .7} 0-.35-.6`} stroke="#6c7860" stroke-width=".19"/>{/each}{/if}{/each}
			{#each level.drains as drain}{@const b = drain.box}<g class:draining={wasteFlash && drain.kind === 'waste'} data-drain={drain.id} opacity=".6"><path d={`M${b.x} ${b.y + b.h / 2}h${b.w}`} stroke="#102a30" stroke-width={Math.min(b.h,.8)}/>{#each [0,1,2,3] as i}<path d={`M${b.x + b.w * (i + .5) / 4} ${b.y}v${b.h}`} stroke="#97a187" stroke-width=".08"/>{/each}</g>{/each}
			{#each level.gates as gate}{@const b = gate.box}{@const open = view?.gates[gate.id] ?? (gate.open ? 1 : 0)}
				{#if [...level.urns,...level.seeds].some(u => u.plug === gate.id && [...view?.urns ?? [],...view?.seedViews ?? []].find(v => v.id === u.id)?.status === 'spoiled')}<ellipse class="plug-hint" cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={Math.max(1,b.w)} ry={Math.max(.7,b.h + .5)} stroke="#f2dca5" stroke-width=".1"/>{/if}
				<g transform={`translate(${gate.retract === 'left' ? -b.w * open : gate.retract === 'right' ? b.w * open : 0} ${gate.retract === 'up' ? -b.h * open : gate.retract === 'down' ? b.h * open : 0})`} opacity={1 - open * .75}><rect x={b.x} y={b.y} width={b.w} height={b.h} rx=".12" fill="#8d8555" stroke="#b4ad7b" stroke-width=".1"/>{#if gate.style === 'plug'}<path d={`M${b.x + b.w / 2} ${b.y}v-.6m-.25 0h.5`} stroke="#c2b284" stroke-width=".16"/>{/if}</g>
			{/each}
			{#each level.planks as p}<g class="deflector" transform={`translate(${p.pivot.x} ${p.pivot.y}) rotate(${p.angles[pose(p.id,p.initial)]})`}><rect y={-(p.thickness ?? .5) / 2} width={p.length} height={p.thickness ?? .5} rx=".12" fill="#705d43" stroke="#b5a578" stroke-width=".12"/><path d={`M.3 0h${p.length - .6}`} stroke="#bf9f6b" stroke-width=".06"/><circle r=".38" fill="#354e41" stroke="#d0bc83" stroke-width=".12"/></g>{/each}
			{#if denied}<g class="denied-puff" style={`--puff:${denied.key}`} transform={`translate(${denied.at?.x ?? 24} ${denied.at?.y ?? 15})`}><circle r=".7" fill="#c7bd8b22" stroke="#d5bf8d" stroke-width=".06"/><path d="m-.3-.3.6.6m-.6 0 .6-.6" stroke="#d2bb8c" stroke-width=".08"/></g>{/if}
			{#if virtual.visible}<g transform={`translate(${virtual.x} ${virtual.y})`}><circle r=".55" stroke="#f0ddb0" stroke-width=".07"/><path d="M-1 0h.3m1.4 0H1M0-1v.3m0 1.4V1" stroke="#f0ddb0" stroke-width=".07"/></g>{/if}
		</svg>
		{#if onboarding && !payoff}
			{@const spring = level.springs[0]}
			<div class="onboarding-cue" data-onboarding={onboarding} style={`left:${(onboarding === 'pour' ? spring.zone.x + spring.zone.w * .89 : 18) / 48 * 100}%;top:${(onboarding === 'pour' ? spring.zone.y + spring.zone.h + 1.1 : 7) / 30 * 100}%`}>
				<span aria-hidden="true">{onboarding === 'pour' ? '↑' : '◌'}</span>{onboarding === 'pour' ? 'press & hold' : 'tap the air to see it move'}
			</div>
		{/if}
		{#each level.vents.filter(v => v.control) as vent}<button data-control={vent.id} class="mechanism vent-hit" style={`left:${(vent.from.x + vent.to.x) / 2 / 48 * 100}%;top:${(vent.from.y + vent.to.y) / 2 / 30 * 100}%`} aria-label={`Vent ${words(vent.id)}, ${heading(vent)}. ${vent.control?.kind === 'turn' ? 'Click to cycle heading detents' : 'Click to switch'}.`} aria-pressed={!!(ventVelocity(vent).x || ventVelocity(vent).y)} onclick={() => changeVent(vent)}></button>{/each}
		{#each level.gauges ?? [] as gauge}<div class="gauge-readout" data-gauge={gauge.id} style={`left:${gauge.box.x / 48 * 100}%;top:${gauge.box.y / 30 * 100}%;height:${gauge.box.h / 30 * 100}%`} role="img" aria-label={`${gauge.label ?? 'Water level'}: ${(view?.gauges[gauge.id]?.units ?? 0).toFixed(1)} units`} title={`${gauge.label ?? 'Water level'}: ${(view?.gauges[gauge.id]?.units ?? 0).toFixed(1)} units`}><span class="gauge-line" style={`bottom:${Math.max(0,Math.min(100, (gauge.box.y + gauge.box.h - (view?.gauges[gauge.id]?.surface ?? gauge.box.y + gauge.box.h)) / gauge.box.h * 100))}%`}></span><span class="gauge-value">{gauge.label ?? 'Level'} · {(view?.gauges[gauge.id]?.units ?? 0).toFixed(1)}</span></div>{/each}
		{#each level.springs as s}<button data-spring={s.id} class="spring-hit" title={`${names[s.species]} spring · ${Math.ceil(view?.springs[s.id] ?? s.well)} units left`} style={`left:${(s.zone.x + s.zone.w / 2) / 48 * 100}%;top:${(s.zone.y + s.zone.h / 2) / 30 * 100}%;width:${s.zone.w / 48 * 100}%;height:${s.zone.h / 30 * 100}%`} aria-label={`${names[s.species]} spring. Hold Enter or press here to pour; release to stop.`} onpointerenter={() => hovered = s.id} onfocus={() => focusSpring(s.id)} onblur={() => { hovered = ''; cancel(undefined, 'blur'); }} onclick={e => e.preventDefault()}></button>{/each}
		{#each [...level.urns,...level.seeds] as u}<div class="urn-focus" tabindex="0" role="img" style={`left:${(u.box.x + u.box.w / 2) / 48 * 100}%;top:${(u.box.y + 1) / 30 * 100}%`} aria-label={`${words(u.id).replaceAll('urn', 'vessel')}, recipe: ${recipeWords(u.recipe)}, ${[...view?.urns ?? [], ...view?.seedViews ?? []].find(v => v.id === u.id)?.units.toFixed(1) ?? 0} of ${u.recipe.amount} units, ${status(u.recipe, [...view?.urns ?? [], ...view?.seedViews ?? []].find(v => v.id === u.id), u.plug)}`} onfocus={() => inspected = u.id} onblur={() => inspected = ''}></div>{/each}
		{#each level.planks.filter(p => p.angles.length > 1) as p}<button data-control={p.id} class="mechanism" style={`left:${p.pivot.x / 48 * 100}%;top:${p.pivot.y / 30 * 100}%`} title="Adjust gutter · drag or click" aria-label={`Gutter ${words(p.id)}`} onpointerdown={e => plankStart(e,p.id)} onpointermove={plankMove} onpointerup={plankEnd} onpointercancel={e => cancel(e, 'unknown')} onlostpointercapture={e => cancel(e, 'unknown')} onkeydown={e => plankKey(e,p.id)} onclick={e => { if (e.detail === 0) onact({ type: 'pose', id: p.id, index: (pose(p.id,p.initial) + 1) % p.angles.length }); }}></button>{/each}
		{#each level.gates.filter(g => g.driver.kind === 'player') as g}<button data-control={g.id} class="mechanism gate-hit" style={`left:${(g.box.x + g.box.w / 2) / 48 * 100}%;top:${(g.box.y + g.box.h / 2) / 30 * 100}%`} title={`${(view?.gates[g.id] ?? 0) > .5 ? 'Close' : 'Open'} ${g.style === 'plug' ? 'drain plug' : 'gate'}`} aria-label={`${g.style === 'plug' ? 'Pull drain plug' : 'Slide brass gate'}, ${words(g.id)}`} aria-pressed={(view?.gates[g.id] ?? 0) > .5} onclick={() => { if (!suspended && !owner && !keyHeld) { onact({ type: 'toggle', id: g.id }); onui('creak'); } }}></button>{/each}
	</div>
	{#if !payoff}
		<div class="portrait-goals" aria-label="Room goals">
			{#each [...level.urns, ...level.seeds] as urn}
				{@const u = [...view?.urns ?? [], ...view?.seedViews ?? []].find(v => v.id === urn.id)}
				<div class="portrait-goal" class:goal-ready={u?.status === 'ready' || u?.status === 'complete'}><strong>{u?.status === 'ready' || u?.status === 'complete' ? '✓ Ready' : u?.status === 'spoiled' ? 'Wrong colour · open plug' : recipeWords(urn.recipe)}</strong><span>{amount(urn.recipe, u)}{u?.status === 'ready' ? ' · release' : ''}</span></div>
			{/each}
			<p>Keep every vessel ready together for 1.25 seconds.</p>
			<div class="portrait-wells">{#each level.springs as s}<span>{names[s.species]}: {Math.ceil(view?.springs[s.id] ?? s.well)} / {s.well}</span>{/each}</div>
		</div>
		{#if Number.isFinite(supply) && supply > 0}<label class="room-supply" data-room-supply><span>Water saved: {Math.floor(remaining / supply * 100 + 1e-7)}% · Thrifty needs {Math.round(level.mastery.reserve * 100)}% room-total</span><meter min="0" max={supply} low={supply * level.mastery.reserve} value={remaining} optimum={supply} aria-label="Room water remaining">{remaining} / {supply}</meter></label>{/if}
	{/if}
	{#if !payoff && (level.ink > 0 || level.dig)}
	<div class="tools" role="toolbar" aria-label="Garden tools">
		{#if waxCue}<div class="wax-cue" data-onboarding="wax">Wax: draw a wall</div>{/if}
		<button class:chosen={tool === 'hand'} aria-label="Hand, key 1" aria-pressed={tool === 'hand'} onclick={() => setTool('hand')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V7a1.3 1.3 0 0 1 2.6 0v5-7a1.3 1.3 0 0 1 2.6 0v7-5a1.3 1.3 0 0 1 2.6 0v6-3a1.3 1.3 0 0 1 2.6 0v6q0 5-5 5-3 0-5-3l-3-4q-1-2 1-2Z"/></svg></button>
		{#if level.ink > 0}<button class:chosen={tool === 'ink'} aria-label="Wax quill, key 2" aria-pressed={tool === 'ink'} onclick={() => setTool('ink')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 20 3-7L20 3q2 7-12 12Zm3-5L19 4M3 21h7"/></svg><span class="wax" style={`--wax:${(view?.inkLeft ?? level.ink) / level.ink * 100}%`}></span></button><button class:chosen={tool === 'erase'} aria-label="Lift wax strokes, key 4" aria-pressed={tool === 'erase'} onclick={() => setTool('erase')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 15 9-11 7 6-9 11H9Zm3-4 7 6M11 21h10"/></svg></button>{/if}
		{#if level.dig}<button class:chosen={tool === 'dig'} aria-label="Trowel, key 3" aria-pressed={tool === 'dig'} onclick={() => setTool('dig')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 10 5-6q2-2 3 0l-5 8M5 11l7-3 7 6-9 7-7 1Z"/></svg></button>{/if}
	</div>
	{/if}
</div>

<style>
	.vent-hit { cursor: pointer; }
	.vent-off { opacity: .6; }
	.gauge-readout { position: absolute; z-index: 4; width: 16px; margin-left: -26px; border: 1px solid #b0cbc0; border-radius: 7px; background: repeating-linear-gradient(to top, transparent 0, transparent calc(10% - 1px), #b0cbc077 calc(10% - 1px), #b0cbc077 10%), #d3e6dd0d; }
	.gauge-line { position: absolute; left: 2px; right: 2px; height: 2px; background: #e0f2e6; }
	.gauge-value { position: absolute; bottom: -24px; left: 0; white-space: nowrap; font: 12px sans-serif; color: #e0f2e6; }
	.board-shell { width: 100%; position: relative; }.board { width: 100%; aspect-ratio: 8 / 5; position: relative; isolation: isolate; touch-action: none; outline: none; border-radius: 3px; box-shadow: 0 0 0 1px #6f8e7133,0 20px 90px #00151e80; overflow: hidden; background: #163946; cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M7 19c-8-9 11-18 14-8 2 8-11 12-11 4 0-5 8-5 7 0' fill='none' stroke='%23d2dfcf' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 14 14,crosshair; }.board.spring-cursor { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='30'%3E%3Cpath d='M13 3C10 9 6 12 6 17a7 7 0 0 0 14 0c0-5-4-8-7-14Z' fill='%2399ccce' fill-opacity='.6' stroke='%23e4efdb'/%3E%3C/svg%3E") 13 17,pointer; }.board:focus-visible { outline: 1px solid #b9bc8777; outline-offset: 5px; }.board.drawing { cursor: crosshair; }
	.layer { position: absolute; width: 100%; height: 100%; inset: 0; display: block; pointer-events: none; }.backdrop { z-index: 0; }.air { z-index: 1; opacity: .75; }.terrain { z-index: 2; }.liquid { z-index: 3; }.foreground { z-index: 4; overflow: visible; }
	.spring-hit { position: absolute; z-index: 5; min-width: 44px; min-height: 44px; transform: translate(-50%, -50%); border: 0; padding: 0; background: transparent; border-radius: 50%; cursor: inherit; outline: none; }.spring-hit:focus-visible { outline: 1px solid #dce8c3; outline-offset: 6px; }.spring-glyph { font: .7px sans-serif; }.ready { filter: drop-shadow(0 0 .3px #d8edaa); }.hold-ring { transition: stroke-dasharray .1s linear; }
	.mechanism:hover { outline: 1px solid #eddda999; outline-offset: 2px; }.mechanism { position: absolute; z-index: 5; width: 4.166667%; height: 6.666667%; min-width: 44px; min-height: 44px; padding: 0; border: 0; background: transparent; transform: translate(-50%,-50%); border-radius: 50%; touch-action: none; cursor: grab; }.gate-hit { cursor: pointer; }.mechanism:focus-visible { outline: 2px solid #eddda9; outline-offset: 1px; }
	.plaque { opacity: .92; transform-box: fill-box; transform-origin: center; transition: scale .2s,filter .2s; }.inspecting .plaque { scale: 1.12; filter: brightness(1.2); }.plaque-glyph { font: bold .54px sans-serif; }.mixture-gauge { transition: opacity .2s; }.urn-focus { position: absolute; width: 8.333%; height: 6%; transform: translate(-50%,-50%); pointer-events: none; outline: none; }.urn-focus:focus-visible { outline: 2px solid #eddda9; outline-offset: 2px; }.objective-summary { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.tools { display: flex; gap: 10px; position: absolute; bottom: -81px; left: 50%; transform: translateX(-50%); }.tools button { width: 44px; height: 44px; border: 1px solid #81987940; background: #183b3cbb; color: #a4b49b; border-radius: 50%; cursor: pointer; padding: 10px; position: relative; }.tools button.chosen { border-color: #c1ba88; color: #ded7ae; background: #70866326; }.tools button:focus-visible { outline: 2px solid #ecdba7; outline-offset: 4px; }.tools svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }.wax { position: absolute; height: 16px; width: 4px; bottom: 9px; right: 5px; border: 1px solid #c5bd8c66; background: linear-gradient(to top,#e8d8a1 var(--wax),transparent var(--wax)); border-radius: 2px; }
	.vent-motes { animation: draft 2s linear infinite; }@keyframes draft { to { transform: translate(var(--draft-x), var(--draft-y)); opacity: 0; } }@media(prefers-reduced-motion: reduce) { .vent-motes { display: none; } }
	.waterwheel { animation: spin 6s linear infinite; }.plug-hint { animation: pulse 1.5s ease-in-out infinite; }.denied-puff { animation: puff .8s ease-out both; }.payoff { animation: awaken 5s ease-out both; }.payoff ~ .tools { visibility: hidden; }@keyframes spin { to { transform: rotate(360deg); } }@keyframes pulse { 50% { opacity: .25; } }@keyframes puff { to { opacity: 0; } }@keyframes awaken { 40% { filter: brightness(1.13); }to { filter: brightness(1.08); } }
	@media(max-width: 600px) { .plaque { scale: 1.65; }.inspecting .plaque { scale: 1.85; }.tools { bottom: -86px; }.tools button { width: 44px; height: 44px; }.board { border-radius: 0; } }
	@media(prefers-reduced-motion: reduce) { .payoff,.waterwheel,.plug-hint,.denied-puff { animation: none; }.plaque,.mixture-gauge,.hold-ring { transition: none; } }
	.release-label { font: 600 .64px ui-sans-serif,system-ui; fill: #e7f3b9; }.amount-label { font: 600 .64px ui-sans-serif,system-ui; fill: #f3e8ca; paint-order: stroke; stroke: #123530; stroke-width: .15; }.ready-check { font: bold 1.1px sans-serif; fill: #e7f3b9; }.hold-label { font: 600 1.05px ui-sans-serif,system-ui; fill: #f3e6ba; paint-order: stroke; stroke: #123530; stroke-width: .2; }.spoil-label { font: 600 .63px ui-sans-serif,system-ui; fill: #fff0cb; paint-order: stroke; stroke: #173c36; stroke-width: .16; }
	.onboarding-cue { position: absolute; z-index: 6; transform: translateX(-50%); padding: 5px 9px; border: 1px solid #c1d9b899; border-radius: 5px; background: #173e3bf2; color: #f0eccd; font: 12px/1.3 ui-sans-serif,system-ui; white-space: nowrap; pointer-events: none; animation: cue 2s ease-in-out infinite; }.onboarding-cue span { display: block; text-align: center; font-size: 18px; }@keyframes cue { 50% { opacity: .65; } }
	@media(max-width: 600px) { .onboarding-cue { font-size: 11px; }.spoil-label { font-size: .8px; }.amount-label,.release-label { font-size: .86px; } }
	@media(prefers-reduced-motion: reduce) { .onboarding-cue { animation: none; } }
	.portrait-goals { display: none; }@media(max-width: 600px) { .portrait-goals { display: block; margin: 20px 12px 0; padding: 14px 16px; border: 1px solid #829d7055; border-radius: 6px; background: #123831; }.portrait-goal { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 5px 0; color: #e3e7c7; font-size: 12px; }.portrait-goal strong { font-weight: 500; text-transform: capitalize; }.portrait-goal span { white-space: nowrap; }.goal-ready strong { color: #e8f1b6; }.portrait-goals p { font-size: 11px; line-height: 1.7; color: #b5c9ab; margin: 10px 0 0; }.mechanism { min-width: 44px; min-height: 44px; } }
	.payoff .plaque { visibility: hidden; }
	.room-supply { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin: 18px 12px 0; font-size: 12px; color: #d9dec3; }.room-supply meter { width: 140px; height: 12px; accent-color: #b5c9ab; }.portrait-wells { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 12px; margin-top: 12px; }.green { filter: drop-shadow(0 0 .3px #98d482); }.ready .amount-label { animation: ready-pulse 1.8s ease-in-out infinite; }.draining { filter: drop-shadow(0 0 .5px #d1e8d1); opacity: 1; }@keyframes ready-pulse { 50% { fill: #fffbdc; filter: drop-shadow(0 0 .2px #d8edaa); } }
	@media(max-width:600px) { .room-supply { font-size: 11px; }.ready-check { display: none; } }
	@media(prefers-reduced-motion:reduce) { .ready .amount-label { animation: none; }.waterwheel.flowing { filter: drop-shadow(0 0 .5px #e6e9b7); } }
	.wax-cue { position: absolute; bottom: 52px; left: 50%; transform: translateX(-50%); background: #173e3bf5; border: 1px solid #c1d9b899; color: #f0eccd; border-radius: 5px; padding: 8px 12px; white-space: nowrap; font-size: 12px; pointer-events: none; }
</style>
