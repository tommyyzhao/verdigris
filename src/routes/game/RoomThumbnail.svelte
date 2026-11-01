<script lang="ts">
	import type { Level } from './types.js';
	import { levelHeight } from './level-height.js';
	import Lantern from './art/Lantern.svelte';
	import SpringArt from './SpringArt.svelte';
	const id = $props.id();
	let { level, clear = false, locked = false }: { level: Level; clear?: boolean; locked?: boolean } = $props();
	const colors = ['#6ec6ff', '#f2b134', '#e8608a'];
	let runs = $derived(level.terrain.flatMap((row, y) => {
		const result: { x: number; y: number; w: number; kind: string }[] = [];
		for (let x = 0; x < row.length;) {
			const start = x, kind = row[x]; while (x < row.length && row[x] === kind) x++;
			if (kind !== ' ') result.push({ x: start, y, w: x - start, kind });
		}
		return result;
	}));
</script>
<svg viewBox="-1 -1 50 32" fill="none" class:locked class:clear aria-hidden="true">
	<defs>
		<linearGradient id={`${id}-morning`} x2="100%" y2="100%"><stop stop-color="#d7c78a" stop-opacity=".65"/><stop offset=".6" stop-color="#6b9b69" stop-opacity=".45"/><stop offset="1" stop-color="#285748" stop-opacity=".4"/></linearGradient>
		<linearGradient id={`${id}-frost`} x2="100%" y2="100%"><stop stop-color="#c3d8d4" stop-opacity=".2"/><stop offset=".5" stop-color="#789f9e" stop-opacity=".06"/><stop offset="1" stop-color="#bdcfc5" stop-opacity=".15"/></linearGradient>
	</defs>
	<path d="M0 0h48v30H0Z" fill={clear ? `url(#${id}-morning)` : '#315d5a22'}/>
	{#if clear}<path d="m34 0-20 30h5L39 0m4 0L28 30h2L46 0" fill="#ffe7a4" opacity=".12"/>{/if}
	<path d="M8 0v30m8-30v30m8-30v30m8-30v30m8-30v30M0 10h48M0 20h48" stroke="#83a489" stroke-opacity=".12" stroke-width=".15"/>
	{#each runs as r}<rect x={r.x} y={r.y} width={r.w} height="1.03" fill={r.kind === '#' ? '#688575' : r.kind === '%' ? '#9a805e' : '#73795b'} opacity={clear ? '.5' : '.3'}/>{/each}
	{#each level.springs as spring}<SpringArt {spring}/>{/each}
	{#each level.planks as p}<path d={`M${p.pivot.x} ${p.pivot.y}l${Math.cos(p.angles[p.initial] * Math.PI / 180) * p.length} ${Math.sin(p.angles[p.initial] * Math.PI / 180) * p.length}`} stroke="#c0ac73" stroke-width=".5"/>{/each}
	{#each level.urns as u}
		{@const b = u.box}{@const h = levelHeight(u.recipe.amount, b.w)}
		{#if clear}<rect x={b.x} y={b.y + b.h - h} width={b.w} height={h} fill={u.recipe.mix[2] ? '#c493ac' : u.recipe.mix[1] && u.recipe.mix[0] ? '#8db47d' : u.recipe.mix[1] ? '#dab86f' : '#80bccc'} opacity=".35"/>{/if}
		<path d={`M${b.x} ${b.y}v${b.h}h${b.w}v-${b.h}`} stroke="#bd9c7b" stroke-width=".3"/>
		<path d={`M${b.x} ${b.y + b.h - h}h${b.w}`} stroke="#cccca5" stroke-width=".18"/>
		{#if clear}<path d={`M${b.x + b.w} ${b.y + b.h}q1-3 .5-4`} stroke="#b0c286" stroke-width=".2"/><circle cx={b.x + b.w + .5} cy={b.y + b.h - 4} r=".5" fill="#e5c792"/>{/if}
	{/each}
	{#each level.gates as g}<rect x={g.box.x} y={g.box.y} width={g.box.w} height={g.box.h} fill="#b1a777" opacity=".7"/>{/each}
	{#each level.machines as m}
		{@const b = m.box}
		{#if m.kind === 'heart'}<path d={`M${b.x + b.w / 2} ${b.y + b.h}q1-${b.h / 2} 0-${b.h}m0 ${b.h / 2} -${b.w / 2}-${b.h / 4}m${b.w / 2} ${b.h / 4} ${b.w / 2}-${b.h / 3}`} stroke={clear ? '#b4bb86' : '#789274'} stroke-width=".6"/>
		{:else if m.kind === 'lanterns'}<rect x={b.x + b.w / 2} y={b.y + b.h / 3} width="1.2" height="1.8" rx=".1" fill={clear ? '#efd598' : '#69836d'} opacity={clear ? '.9' : '.4'}/>
		{:else}<path d={`M${b.x} ${b.y + b.h}V${b.y + b.h / 3}l${b.w / 2}-${b.h / 3} ${b.w / 2} ${b.h / 3}v${b.h * 2 / 3}Z`} stroke="#a0ab83" stroke-width=".3" fill="#6a855933"/>{/if}
	{/each}
	{#if clear}
		<path d="M1 29q10-1 23 0t23 0" stroke="#90cbb4" stroke-width=".3" opacity=".65"/>
		{#each [0,1,2,3,4,5,6,7,8,9,10] as i}
			{@const x = 2 + i * 4.2}{@const h = 2 + i * 7 % 5}
			<path d={`M${x} 29q-1-${h / 2} 0-${h}m0 ${h / 2}q-3-2-2-3m2 4q3-2 2-3`} stroke={['#7ba94e','#b1c878','#5a9b65'][i % 3]} stroke-width=".3"/>
			<g transform={`translate(${x} ${29-h})`} fill={colors[i % 3]}><ellipse rx=".35" ry=".7" transform="rotate(-40)"/><ellipse rx=".35" ry=".7" transform="rotate(40)"/><circle r=".2" fill="#fff0bd"/></g>
		{/each}
		<g transform="translate(43 6) scale(.19)"><Lantern/></g>
	{/if}
	{#if locked}
		<path d="M0 0h48v30H0Z" fill={`url(#${id}-frost)`}/>
		<path d="M3 7q19 3 39-1M7 12q16 3 34 0M3 22q22-3 41 2" stroke="#d0dbc9" stroke-width="2.3" opacity=".07" stroke-linecap="round"/>
		{#each [0,1,2,3,4,5,6] as i}<path d="M0-2v4m-1.7-3 3.4 2m-3.4 0 3.4-2" transform={`translate(${3 + i * 7 % 43} ${3 + i * 11 % 25})`} stroke="#d2e0d4" stroke-width=".12" opacity=".3"/>{/each}
	{/if}
</svg>
<style>svg { width: 100%; height: 100%; display: block; }.locked { filter: saturate(.15) blur(.25px); }</style>
