<script lang="ts">
	import Lantern from './art/Lantern.svelte';

	let { alive = 0, finale = false, compact = false, settled = false }: { alive?: number; finale?: boolean; compact?: boolean; settled?: boolean } = $props();
	const id = $props.id();
	const paint = (name: string) => `url(#${id}-${name})`;
	const liquids = ['#6ec6ff', '#f2b134', '#e8608a', '#a2d497', '#cba4e6', '#f5a980'];
	const leaves = Array.from({ length: 138 }, (_, i) => {
		const angle = i * 2.399963;
		const radius = Math.sqrt((i + .5) / 138);
		return {
			x: 600 + Math.cos(angle) * radius * (161 + Math.sin(angle * 3) * 17),
			y: 280 + Math.sin(angle) * radius * (108 + Math.cos(angle * 5) * 13),
			angle: angle * 180 / Math.PI + i % 5 * 17,
			size: .55 + (i * 7 % 13) / 12,
			color: ['#376c43', '#50854c', '#76a34d', '#90b756', '#519876', '#b1c86d', '#43845b'][i % 7],
			delay: 3.8 + radius * 1.9 + i % 3 * .16
		};
	});
	const panes = Array.from({ length: 9 }, (_, i) => ({
		x: 144 + (i % 3) * 314,
		y: 286 + Math.floor(i / 3) * 110,
		delay: 2.3 + Math.abs(i % 3 - 1) * .6 + (2 - Math.floor(i / 3)) * .45
	}));
</script>

<svg class:finale class:settled class:compact viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
	<defs>
		<linearGradient id={`${id}-sky`} x2="0" y2="100%"><stop stop-color="#102e3c" /><stop offset=".55" stop-color="#28474a" /><stop offset="1" stop-color="#6c6d56" /></linearGradient>
		<linearGradient id={`${id}-dawn`} x2="0" y2="100%"><stop stop-color="#79acb5" /><stop offset=".52" stop-color="#e3d5a7" /><stop offset="1" stop-color="#f7ce88" /></linearGradient>
		<radialGradient id={`${id}-sun`}><stop stop-color="#fff6d5" stop-opacity=".85" /><stop offset=".24" stop-color="#ffe7ab" stop-opacity=".32" /><stop offset="1" stop-color="#ffe7ab" stop-opacity="0" /></radialGradient>
		<linearGradient id={`${id}-glass`} x2="100%" y2="100%"><stop stop-color="#52767b" stop-opacity=".35" /><stop offset=".5" stop-color="#163e43" stop-opacity=".3" /><stop offset="1" stop-color="#183237" stop-opacity=".8" /></linearGradient>
		<linearGradient id={`${id}-morning`} x1="100%" y1="0" x2="0" y2="100%"><stop stop-color="#f4da92" stop-opacity=".75" /><stop offset=".4" stop-color="#afbf79" stop-opacity=".65" /><stop offset="1" stop-color="#49856b" stop-opacity=".65" /></linearGradient>
		<linearGradient id={`${id}-pane`} x2="0" y2="100%"><stop stop-color="#f8e6ab" stop-opacity=".3" /><stop offset="1" stop-color="#b3cf85" stop-opacity=".06" /></linearGradient>
		<linearGradient id={`${id}-copper`} x2="100%" y2="100%"><stop stop-color="#b8ac72" /><stop offset=".45" stop-color="#568776" /><stop offset="1" stop-color="#365f56" /></linearGradient>
		<linearGradient id={`${id}-ground`} x2="0" y2="100%"><stop stop-color="#183b36" /><stop offset="1" stop-color="#0a2228" /></linearGradient>
		<linearGradient id={`${id}-water`}><stop stop-color="#6ec6ff" stop-opacity=".1" /><stop offset=".3" stop-color="#6ec6ff" /><stop offset=".55" stop-color="#b8dba5" /><stop offset=".75" stop-color="#f2b134" /><stop offset="1" stop-color="#e8608a" stop-opacity=".25" /></linearGradient>
		<pattern id={`${id}-rain`} width="97" height="83" patternUnits="userSpaceOnUse"><path d="M14 8v8m57 31v5m-37 13v3" stroke="#c3d9cd" stroke-opacity=".16" stroke-linecap="round" /></pattern>
		<path id={`${id}-leaf`} d="M0 0C-14-5-12-20 0-31 10-21 10-7 0 0Z" />
		<path id={`${id}-flower`} d="M0-2C-10-15-14-2-4 2-13 8-2 14 1 5 6 15 15 5 5 1 16-6 6-13 0-2Z" />
	</defs>
	<path fill={paint('sky')} d="M0 0h1200v760H0z" />
	{#if finale}
		<path class="dawn-sky" fill={paint('dawn')} d="M0 0h1200v760H0z" />
		<g class="sunrise"><circle cx="937" cy="242" r="340" fill={paint('sun')} /><circle cx="937" cy="242" r="29" fill="#fff2c8" opacity=".8" /></g>
	{/if}
	<g class="night">
		<circle cx="916" cy="127" r="32" fill="#c8cdb1" opacity=".45" />
		<path d="M899 99a32 32 0 0 0 24 56 32 32 0 0 1-24-56" fill="#e2ddbd" opacity=".5" />
		{#each Array.from({ length: 24 }, (_, i) => i) as i}<circle cx={44 + i * 173 % 1110} cy={35 + i * 71 % 180} r={i % 3 === 0 ? 1.2 : .7} fill="#d7d8b7" opacity=".45" />{/each}
	</g>
	<path d="M0 357Q90 278 210 341T460 321 730 339 1000 293 1200 333V760H0Z" fill="#244d47" />
	<path d="M0 421Q180 341 319 408T625 378 960 405 1200 367V760H0Z" fill="#163b36" />
	<path d="M109 620V281l174-97 156 97 161-161 161 161 156-97 174 97v339Z" fill="#123138" stroke="#214944" stroke-width="18" />
	<path d="M121 615V286l162-88 156 88 161-151 161 151 156-88 162 88v329Z" fill={paint('glass')} />
	{#if finale}<path class="morning-glass" d="M121 615V286l162-88 156 88 161-151 161 151 156-88 162 88v329Z" fill={paint('morning')} />{/if}
	{#each panes as p, i}
		<g class="pane" class:revived={i < alive} style={`--flow-delay:${p.delay}s;--bloom-delay:${p.delay + 2.1}s`}>
			<rect class="pane-light" x={p.x - 15} y={p.y + 3} width="282" height="105" fill={i < alive ? paint('pane') : '#2b5355'} opacity={i < alive ? 1 : .1} />
			<path d={`M${p.x - 13} ${p.y + 103}q48-14 100-6t182-1v11h-282Z`} fill={i < alive ? '#395f40' : '#23473d'} />
			{#if finale || i < alive}
				<g class="waterlines">
					<path class="water-feed" pathLength="1" d={`M598 607Q${i % 3 === 0 ? 424 : i % 3 === 2 ? 785 : 601} ${p.y + 97} ${p.x + 125} ${p.y + 101}`} stroke={liquids[i % 6]} stroke-opacity=".5" stroke-width="2.5" />
					<path class="water-floor" pathLength="1" d={`M${p.x + 126} ${p.y + 101}q-63-3-138 0m138 0q66 3 137-1`} stroke={paint('water')} stroke-width="5" />
					<path class="water-glint" pathLength="1" d={`M${p.x - 8} ${p.y + 99}q52-2 94 1m18-1 36 1m14 0 72-1m12 0h12`} stroke="#fff4cd" stroke-width=".8" />
				</g>
			{/if}
			<g class="pane-foliage">
				{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as j}
					{@const x = p.x + 8 + j * 29}
					{@const h = 30 + (j * 13 + i * 7) % 44}
					<path d={`M${x} ${p.y + 101}q${j % 2 ? -10 : 8}-${h / 2} ${j % 2 ? 4 : -5}-${h}`} stroke={i < alive ? '#71974e' : '#43634d'} stroke-width="1.6" />
					{#each [0, 1, 2] as k}
						<g transform={`translate(${x + (j % 2 ? -1 : 1) * k * 2} ${p.y + 94 - k * h / 4}) rotate(${(k + j) % 2 ? -58 : 58}) scale(${.35 + (j + k) % 3 * .09})`}>
							<use href={`#${id}-leaf`} fill={i < alive ? ['#3b784d', '#5b964c', '#87b457', '#a1bd64'][(j + k + i) % 4] : '#34564d'} />
						</g>
					{/each}
					{#if i < alive || finale}
						<g class="bloom" transform={`translate(${x + (j % 2 ? 4 : -5)} ${p.y + 100 - h}) rotate(${j * 31}) scale(${.4 + j % 3 * .11})`}>
							<use href={`#${id}-flower`} fill={liquids[(i + j) % 6]} /><circle r="2.5" fill="#fff0bb" />
						</g>
					{/if}
				{/each}
			</g>
			<g class="pane-lantern" transform={`translate(${p.x + 233} ${p.y + 32})`}><Lantern lit={i < alive || finale} /></g>
		</g>
	{/each}
	<!-- Dark inner foliage stays behind the branches; the crown is not a flat wreath. -->
	{#if finale}
		<g class="inner-canopy">
			{#each [0, 1, 2, 3, 4, 5, 6] as i}<path d="M-65 12C-100-33-49-75-11-61 17-92 74-59 67-22 108 2 51 55 16 35-18 72-68 50-65 12Z" transform={`translate(${504 + i % 3 * 89} ${242 + Math.floor(i / 3) * 47}) rotate(${i * 53}) scale(${.5 + i % 3 * .12})`} fill={['#285e43', '#326b45', '#407a48'][i % 3]} />{/each}
		</g>
	{/if}
	<path d="M579 615q22-117 9-183-12-67 3-141m5 97q-67-72-98-72m99 109q74-95 116-98m-114-15q-20-56-51-75m51 35q54-67 87-71" stroke="#284e3d" stroke-width="29" stroke-linecap="round" />
	<path d="M582 614q22-113 10-182-11-59 4-142m-1 98q-63-69-96-71m98 107q69-90 116-96m-114-19-26-61m40 44 52-43" stroke="#8a8d59" stroke-width="7" stroke-linecap="round" opacity=".65" />
	{#if finale}
		<g class="veins" stroke-linecap="round">
			<path pathLength="1" d="M580 616q32-103 15-182-8-71 4-143l-7-71" stroke="#6ec6ff" />
			<path pathLength="1" d="M587 616q32-106 10-193 63-89 116-95" stroke="#f2b134" />
			<path pathLength="1" d="M574 616q28-106 22-227-63-73-97-72" stroke="#e8608a" />
		</g>
		<g class="canopy">
			{#each leaves as leaf, i}
				<g class="new-leaf" style={`--leaf-delay:${leaf.delay}s`}>
					<g transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle}) scale(${leaf.size})`}>
						<use href={`#${id}-leaf`} fill={leaf.color} /><path d="M0-2v-23m0 10-5-5m5-1 4-5" stroke="#d6db8b" stroke-opacity={i % 3 === 0 ? '.42' : '.18'} stroke-width=".65" />
					</g>
				</g>
			{/each}
		</g>
		<g class="canopy-flowers">
			{#each leaves.filter((_, i) => i % 4 === 0) as f, i}<g class="new-leaf" style={`--leaf-delay:${f.delay + 1}s`}><g transform={`translate(${f.x} ${f.y - 9}) rotate(${i * 47}) scale(${.45 + i % 4 * .12})`}><use href={`#${id}-flower`} fill={liquids[i % 6]} /><circle r="2.6" fill="#fff4d0" /><path d="M-2-4h1" stroke="#fff7e3" stroke-width="2" stroke-linecap="round" /></g></g>{/each}
		</g>
	{/if}
	<!-- Mullions sit in front of the planting, preserving the little rooms. -->
	<path d="M121 615V286l162-88 156 88 161-151 161 151 156-88 162 88v329Zm0-329 162-48 156 48 161-100 161 100 156-48 162 48M283 198v417m156-329v329m161-480v65m161 86v329m156-417v417M121 396h430m99 0h429M121 505h449m48 0h461" stroke={paint('copper')} stroke-width="4" />
	<path d="m121 286 162-88 156 88 161-151 161 151 156-88 162 88" stroke="#d5c38b" stroke-opacity=".6" stroke-width="1.5" />
	<path class="glass-mist" d="M123 291h955v319H123z" fill={paint('rain')} />
	{#if finale}<g class="first-light" fill="#fff1b4"><path d="m857 194-430 420h117l337-402Z" opacity=".1" /><path d="m936 207-230 407h78l182-390Z" opacity=".12" /></g>{/if}
	<path d="M477 615v-30q0-26 26-26h19v56m156 0v-56h19q26 0 26 26v30" fill="#304b39" stroke="#8b9566" stroke-width="3" />
	<path d="M121 615h958v23H121z" fill="#344d43" stroke="#929467" stroke-width="3" />
	{#if finale}<path class="root-water" pathLength="1" d="M596 620H124m472 0h481" stroke={paint('water')} stroke-width="3" stroke-linecap="round" />{/if}
	<path d="M0 643q150-43 274-3t312-4 300 4 314-14v134H0Z" fill={paint('ground')} />
	<path d="M487 760 565 640h69l88 120" fill="#c4b983" opacity=".12" />
	<path d="M0 700q110-39 218-6m728-11q106-29 254-2" stroke="#63806a" stroke-width="2" opacity=".3" />
	{#each [56, 91, 1103, 1140] as x, i}
		<path d={`M${x} 760q${i % 2 ? 28 : -25}-122 3-202m-5 122q-42-46-37-65m42 42q36-48 39-79m-37 38q-32-37-31-62`} stroke={finale ? '#376442' : '#1a4138'} stroke-width={i % 2 ? 5 : 8} stroke-linecap="round" />
		{#if finale}<g class="outer-growth">{#each [0, 1, 2, 3, 4] as j}<g transform={`translate(${x + (j % 2 ? 17 : -14)} ${662 - j * 19}) rotate(${j % 2 ? 55 : -55}) scale(.65)`}><use href={`#${id}-leaf`} fill={['#5b8a45', '#7e9e51', '#3e7955'][j % 3]} /></g><g transform={`translate(${x + (j % 2 ? 21 : -18)} ${627 - j * 18}) scale(.45)`}><use href={`#${id}-flower`} fill={liquids[(i + j) % 6]} /><circle r="2" fill="#ffe7aa" /></g>{/each}</g>{/if}
	{/each}
	<path d="M121 286q38 48 21 117m-12-82q33-12 33 16m-20 28q-27-15-21 7M1079 286q-40 31-31 121m15-82q-29-15-32 12m17 26q28-12 20 10" stroke="#6c8b56" stroke-width="3" stroke-linecap="round" />
	{#if finale}
		<g class="petals">{#each Array.from({ length: 16 }, (_, i) => i) as i}<path class="petal" d="M-2 0Q0-6 3-2 4 2 0 4Z" transform={`translate(${270 + i * 43} ${220 + i * 29 % 240})`} fill={liquids[i % 6]} style={`--petal-delay:${7 + i % 5 * .3}s;--petal-length:${9 + i % 4}s`} />{/each}</g>
	{/if}
	{#each [168, 386, 812, 1041] as x, i}<circle class="firefly" cx={x} cy={580 + i % 2 * 57} r="1.7" fill="#e6d899" style={`--delay:${i * 1.3}s`} />{/each}
</svg>

<style>
	svg { width: 100%; height: 100%; display: block; }
	.dawn-sky { animation: fade-in 7s 1s both; }
	.sunrise { animation: sunrise 7s 1s both; }
	.finale .night { animation: fade-out 5s both; }
	.morning-glass { animation: fade-in 5s 2.5s both; }
	.first-light { animation: fade-in 4s 4s both; }
	.finale .glass-mist { animation: fade-out 7s both; }
	.finale .pane-light { animation: fade-in 3s var(--flow-delay) both; }
	.finale .pane-foliage { transform-box: fill-box; transform-origin: bottom; animation: grow 2.5s calc(var(--flow-delay) + 1s) both; }
	.finale .bloom { animation: fade-in 1.8s var(--bloom-delay) both; }
	.finale .pane-lantern { animation: fade-in 2s calc(var(--flow-delay) + 1.8s) both; }
	.water-feed,.water-floor,.water-glint,.root-water,.veins path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: flow 2s var(--flow-delay, 0s) ease-out both; }
	.water-feed { animation: flow 2s var(--flow-delay) ease-out both, feed-rest 2.5s calc(var(--flow-delay) + 2s) both; }
	.water-floor { animation-delay: calc(var(--flow-delay) + .65s); }
	.water-glint { animation: flow 2s calc(var(--flow-delay) + .7s) ease-out both, shimmer 4s calc(var(--flow-delay) + 2.7s) ease-in-out infinite; }
	.root-water { animation-delay: 1.5s; }
	.veins path { stroke-width: 4; animation-duration: 3.2s; }
	.veins path:nth-child(2) { animation-delay: .3s; }
	.veins path:nth-child(3) { animation-delay: .6s; }
	.inner-canopy { animation: fade-in 2.5s 3.6s both; }
	.new-leaf { animation: leaf 1.8s var(--leaf-delay) both; }
	.outer-growth { animation: fade-in 3s 5s both; }
	.petal { opacity: 0; animation: petal var(--petal-length) var(--petal-delay) linear infinite; }
	.firefly { animation: drift 7s var(--delay) ease-in-out infinite; }
	.settled :is(.dawn-sky,.sunrise,.night,.morning-glass,.first-light,.glass-mist,.pane-light,.pane-foliage,.bloom,.pane-lantern,.inner-canopy,.new-leaf,.outer-growth,.water-feed,.water-floor,.root-water,.veins path) { animation-delay: -20s !important; }
	.settled .water-glint { stroke-dashoffset: 0; animation: shimmer 4s ease-in-out infinite; }
	@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
	@keyframes fade-out { to { opacity: 0; } }
	@keyframes sunrise { from { opacity: 0; transform: translateY(90px); } to { opacity: 1; transform: translateY(0); } }
	@keyframes grow { from { opacity: .25; transform: scaleY(.55); } to { opacity: 1; transform: scaleY(1); } }
	@keyframes leaf { from { opacity: 0; } to { opacity: 1; } }
	@keyframes flow { to { stroke-dashoffset: 0; } }
	@keyframes shimmer { 50% { opacity: .35; } }
	@keyframes feed-rest { to { opacity: .12; } }
	@keyframes petal { 0% { opacity: 0; translate: 0 -10px; } 15% { opacity: .7; } 85% { opacity: .5; } to { opacity: 0; translate: 60px 140px; } }
	@keyframes drift { 50% { opacity: .25; translate: 4px -9px; } }
	@media (prefers-reduced-motion: reduce) {
		.sunrise,.finale .pane-foliage,.new-leaf { animation-name: fade-in; transform: none; }
		.water-feed,.water-floor,.water-glint,.root-water,.veins path { stroke-dashoffset: 0; animation: fade-in 2s var(--flow-delay, 0s) both; }
		.firefly,.petal { animation: none; }
		.petal { display: none; }
		.settled .water-glint { animation: none; }
	}
</style>
