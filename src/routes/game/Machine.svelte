<script lang="ts">
	import type { Machine } from './types.js';
	let { machine, powered = false, delay = 0 }: { machine: Machine; powered?: boolean; delay?: number } = $props();
	let b = $derived(machine.box);
</script>
<g class="machine" class:powered style={`--delay:${delay}s`} transform={`translate(${b.x} ${b.y}) scale(${b.w / 6} ${b.h / 7})`}>
	{#if machine.kind === 'lanterns'}
		{#each (b.w > b.h * 2 ? [1, 3, 5] : [3]) as x}
			<g transform={`translate(${x - 3} 0) translate(3 0) scale(${b.w > b.h * 2 ? .35 : 1} 1) translate(-3 0)`}>
				<path d="M3-2v3M1 2h4L4.5 6h-3Z" stroke="#a49766" stroke-width=".17" fill="#163b3d"/>
				<ellipse class="halo" cx="3" cy="4.2" rx="3.7" ry="4" fill="#f8c87c" opacity=".16"/>
				<path class="light" d="M1.7 2.5h2.6l-.3 3H2Z" fill="#ecd191"/>
				<path d="M1 2h4M1.5 6h3M2.5 2v4m1-4v4M2 1h2" stroke="#b2a472" stroke-width=".15"/>
			</g>
		{/each}
	{:else if machine.kind === 'wheelhouse'}
		<path d="M.2 7V3L3 .5 5.8 3v4Z" fill="#36584b" stroke="#7b8d69" stroke-width=".2"/>
		<path d="M0 3 3 .2 6 3M1 5h4" stroke="#b0a57b" stroke-width=".18"/>
			<path class="belt" d="M3 3.8h8a.8.8 0 0 1 0 1.6H3a.8.8 0 0 1 0-1.6Z" stroke="#a5a178" stroke-width=".1" stroke-dasharray=".3 .35"/>
		<g class="spin" style="transform-origin: 3px 4.6px"><circle cx="3" cy="4.6" r="1.5" stroke="#aa9665" stroke-width=".3"/><path d="m3 3.1 0 3m-1.5-1.5h3m-2.56-1.06 2.12 2.12m-2.12 0 2.12-2.12" stroke="#9e9264" stroke-width=".15"/></g>
	{:else if machine.kind === 'lift'}
		<path d="M.6 7V0m4.8 0v7M.3.5h5.4M1 6h4" stroke="#938a65" stroke-width=".25"/>
		<g class="lift"><path d="M1 5.6h4v.7H1Z" fill="#a38959"/><path d="M1.3.5v5m3.4-5v5" stroke="#688570" stroke-width=".12"/><path d="M2 5.4q-.5-1.8.6-2.2 1.4-.7 1.1 2.2" fill="#66875e"/></g>
	{:else if machine.kind === 'sprinkler'}
		<path d="M3 7V3m-2-1h4M2.5 3h1v-.8h-1Z" stroke="#a09a6e" stroke-width=".25"/>
		<g class="spray" stroke="#9cd2ce" stroke-width=".1" stroke-linecap="round"><path d="M1.8 2Q-.6-1-2 3m4-1Q.2-2-1 1.5M4.2 2Q6.6-1 8 3m-4-1Q5.8-2 7 1.5" stroke-dasharray=".3 .5"/></g>
		<path d="M-.5 7q.2-1.6 1-2m-.4.7-1-.3M6 7q-.3-1.3.6-2m-.4.7 1-.3" stroke="#6e9460" stroke-width=".2"/>
	{:else if machine.kind === 'bellows'}
		<path d="M.5 2h4v4h-4Z" fill="#8b6049" stroke="#ab9669" stroke-width=".2"/>
		<path class="bellows" d="m.7 2.4 3.6.5-3.6.5 3.6.5-3.6.5 3.6.5-.2.8H.7" stroke="#bf9b6a" stroke-width=".13"/>
		<path d="M4.5 3h1v2h-1M1 6v1m3-1v1" stroke="#829778" stroke-width=".2"/>
		<path class="spray" d="M5.7 4q1.3-1 2.3-.3m-2.3.7q1.2.5 2.3.1" stroke="#b4c3a5" stroke-width=".1"/>
			<g class="roof-petals" transform="translate(3 1)"><path class="roof-left" d="M0 0Q-2-2-3.6-.3L-.2.4Z" fill="#739b76" fill-opacity=".4" stroke="#a4bc8d" stroke-width=".1"/><path class="roof-right" d="M0 0Q2-2 3.6-.3L.2.4Z" fill="#739b76" fill-opacity=".4" stroke="#a4bc8d" stroke-width=".1"/></g>
	{:else if machine.kind === 'fountain'}
		<path d="M.2 5q2.8 2.2 5.6 0m-2.8.8V7M1 7h4M3 5V2" stroke="#92a68d" stroke-width=".25"/>
		<g class="spray" stroke="#a9d4cb" stroke-width=".12"><path d="M3 4q-2-5-3 0m3 0q2-5 3 0M3 3q-1-5-1.5-1M3 3q1-5 1.5-1"/></g>
	{:else}
		<path d="M2.6 7Q4 3 3 0M3 3Q.7 1.5 0 2M3.2 4Q5 1.5 6 1" stroke="#23473e" stroke-width=".95" stroke-linecap="round"/>
		<path d="M2.6 7Q4 3 3 0M3 3Q.7 1.5 0 2M3.2 4Q5 1.5 6 1" stroke="#7a8461" stroke-width=".43" stroke-linecap="round"/>
		<path d="M2.6 7Q4 3 3 0M3 3Q.7 1.5 0 2M3.2 4Q5 1.5 6 1" stroke="#bdac72" stroke-width=".06" stroke-linecap="round"/>
		<path d="M2.7 6.6q-.8-.3-1.1.3m1.3-1q1.1-.2 1.3.2M2.8 2.1q-.8-.5-.7-1" stroke="#72935e" stroke-width=".12"/>
		<g fill="#72935e"><ellipse cx="2" cy=".7" rx=".18" ry=".4" transform="rotate(-30 2 .7)"/><ellipse cx="4.1" cy="5.8" rx=".35" ry=".13" transform="rotate(-25 4.1 5.8)"/></g>
		<path class="heart-vein" d="M2.6 7Q4 3 3 0M3 3Q.7 1.5 0 2M3.2 4Q5 1.5 6 1" stroke="#e7c17e" stroke-width=".13" stroke-linecap="round"/>
		<g class="flowers" fill="#c8af7f"><circle cx="0" cy="2" r=".4"/><circle cx="6" cy="1" r=".4"/><circle cx="3" cy=".1" r=".5"/></g>
	{/if}
</g>
<style>
	.roof-left,.roof-right { transition: transform 3s; transform-origin: 0 0; }.powered .roof-left { transform: rotate(-35deg); }.powered .roof-right { transform: rotate(35deg); }.powered .belt { animation: belt 2s linear infinite; }@keyframes belt { to { stroke-dashoffset: -1.3; } }
	.halo,.light,.spray,.flowers,.heart-vein { opacity: 0; transition: opacity 2s; transition-delay: var(--delay); }.powered .halo { opacity: .16; }.powered .light,.powered .spray,.powered .flowers,.powered .heart-vein { opacity: 1; }.powered .spin { animation: spin 8s linear infinite; }.powered .lift { animation: rise 5s ease-in-out infinite; }.powered .bellows { animation: breathe 2s ease-in-out infinite; transform-box: fill-box; transform-origin: left; }.powered .spray { animation: shimmer 2s ease-in-out infinite; }@keyframes spin { to { transform: rotate(360deg); } }@keyframes rise { 50% { transform: translateY(-3px); } }@keyframes breathe { 50% { transform: scaleX(.8); } }@keyframes shimmer { 50% { opacity: .45; } }@media(prefers-reduced-motion: reduce) { .machine * { animation: none!important; transition-duration: .2s; } }
</style>
