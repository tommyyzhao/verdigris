<script lang="ts">
	import type { Spring } from './types.js';
	let { spring, fill = 1, active = false, showWell = false }: { spring: Spring; fill?: number; active?: boolean; showWell?: boolean } = $props();
	const uid = $props.id();
	const colors = ['#6ec6ff', '#f2b134', '#e8608a'];
	let b = $derived(spring.zone);
</script>
<g class="spring" class:active class:dry={fill <= 0} style={`--spring-color:${colors[spring.species]}`}>
	<defs><clipPath id={`${uid}-well`}><rect x={b.x} y={b.y + b.h * (1 - fill)} width={b.w} height={b.h * fill}/></clipPath></defs>
	{#if spring.style === 'cloud'}
		{#if b.x === 19 && b.w === 3}<path d="M8 5q-1-2 1-2q1-2 3-1q2-2 4-.5q3-1 5 1q2 0 1 2.5Z" fill="#b6d8d9" opacity=".2"/>{/if}
		<rect x={b.x} y={b.y} width={b.w} height={b.h} rx=".8" fill="#a8e6ee" opacity=".3" stroke="#d9f5ed" stroke-width=".1"/>
		<path class="halo" d={`M${b.x + .3} ${b.y + b.h * .65}q-.9-1.1 .8-1.4q.2-1.8 2.1-1.1q1.2-1.5 2.7-.3Q${b.x + b.w * .62} ${b.y - .8} ${b.x + b.w - 1.3} ${b.y + .5}q2.1-.2 1.1 1.5Z`} fill="#b6d8d9" opacity=".1"/>
		<rect x={b.x} y={b.y + .2} width={b.w} height={b.h - .3} rx={b.h / 2} fill="#b9d9d5" opacity=".08"/>
		<ellipse class="halo" cx={b.x + b.w * .89} cy={b.y + b.h * .5} rx={Math.min(1.3, b.w * .18)} ry={b.h * .3} fill="#d4eeea" opacity={.16 + fill * .2}/>
		<g clip-path={`url(#${uid}-well)`}><path d={`M${b.x + .3} ${b.y + b.h * .7}Q${b.x + b.w * .2} ${b.y - .5} ${b.x + b.w * .5} ${b.y + .6}T${b.x + b.w - .3} ${b.y + b.h * .7}Q${b.x + b.w / 2} ${b.y + b.h + .1} ${b.x + .3} ${b.y + b.h * .7}`} fill={colors[spring.species]} opacity=".35"/></g>
		{#each [.2,.48,.76] as t, i}<path class="hint-drop" d="M0-.22Q-.4.2 0 .36Q.4.2 0-.22Z" transform={`translate(${b.x + b.w * t} ${b.y + b.h + .4 + i % 2 * .4})`} fill="#c7e5df" style={`animation-delay:${i * .7}s`}/>{/each}
	{:else if spring.style === 'crack'}
		<path d={`M${b.x} ${b.y + b.h / 2}l${b.w * .22}-${b.h * .6} ${b.w * .2} ${b.h * .5} ${b.w * .3}-${b.h * .35} ${b.w * .28} ${b.h * .6}v${b.h * .4}l-${b.w * .4}-${b.h * .2}-${b.w * .25} ${b.h * .3}Z`} fill="#273d32" stroke="#a79768" stroke-width=".1"/>
		<g clip-path={`url(#${uid}-well)`}><path class="halo" d={`M${b.x + .2} ${b.y + b.h * .6}l${b.w * .2}-${b.h * .45} ${b.w * .25} ${b.h * .5} ${b.w * .2}-${b.h * .35} ${b.w * .3} ${b.h * .45}`} stroke={colors[spring.species]} stroke-width=".27" stroke-linejoin="round"/></g>
	{:else}
		<g transform={`translate(${b.x + b.w / 2} ${b.y + b.h / 2})`}>
			<path d={`M0 ${b.h * .2}q-.7 2 .2 3m-.2-1q-1.7-.7-1.8-1.8q1.3-.2 1.8.8m0-.2q1.5-1.4 2-.8q-.5 1.1-1.7 1.3`} fill="#719370" stroke="#9bb583" stroke-width=".07"/>
			{#each [0,60,120,180,240,300] as angle}<ellipse cy={-b.h * .2} rx={b.w * .23} ry={b.h * .42} transform={`rotate(${angle})`} fill={colors[spring.species]} opacity={.14 + .4 * fill} stroke="#e9b2a3" stroke-width=".055"/>{/each}<circle r={Math.min(b.w,b.h) * .16} fill="#ebc78b"/>
		</g>
	{/if}
	<path d={`M${b.x + .35} ${b.y + b.h + .05}q${b.w / 2 - .35} .35 ${b.w - .7} 0`} stroke={colors[spring.species]} stroke-width=".055" opacity=".55"/>
	{#if showWell && Number.isFinite(spring.well)}
		<g class="well-gauge" data-well={spring.id}>
			<rect x={b.x} y={b.y - .85} width={b.w} height=".22" rx=".1" fill="#092c32" stroke="#a7c0aa" stroke-width=".04"/>
			<rect x={b.x} y={b.y - .85} width={b.w * fill} height=".22" rx=".1" fill={colors[spring.species]}/>
			<text x={b.x + b.w / 2} y={b.y - 1.3} text-anchor="middle">{fill <= 0 ? 'Empty' : `${Math.ceil(fill * spring.well)} / ${spring.well}`}</text>
		</g>
	{/if}
</g>
<style>
	.well-gauge text { font: 600 .62px ui-sans-serif,system-ui; fill: #e4ecd1; paint-order: stroke; stroke: #153b3e; stroke-width: .13; }.dry .well-gauge { opacity: 1; }
	@media(max-width: 600px) { .well-gauge text { font-size: 1.2px; }.well-gauge { display: none; } }
	.spring { transition: opacity .3s; }.halo { filter: drop-shadow(0 0 .3px var(--spring-color)); }.active .halo { filter: drop-shadow(0 0 .6px var(--spring-color)); }.dry { opacity: .35; }.hint-drop { opacity: .3; animation: dew 3s ease-in infinite; }@keyframes dew { 0%,70%,100% { opacity: .12; }30% { opacity: .6; } }@media(prefers-reduced-motion: reduce) { .hint-drop { animation: none; } }
</style>
