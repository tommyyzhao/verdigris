<script lang="ts">
	let { lit = true }: { lit?: boolean } = $props();
	const id = $props.id();
</script>

<g class="lantern" class:lit>
	<defs>
		<radialGradient id={id}>
			<stop stop-color="#ffdc8b" stop-opacity=".24" />
			<stop offset=".35" stop-color="#ffc46b" stop-opacity=".09" />
			<stop offset="1" stop-color="#ffc46b" stop-opacity="0" />
		</radialGradient>
	</defs>
	{#if lit}<circle class="glow" cy="4" r="33" fill={`url(#${id})`} />{/if}
	<path d="M0-25V-9m-2 0v-3a2 2 0 0 1 4 0v3" stroke="#ac9158" stroke-width=".8" />
	<path d="m-6-5 3-4h6l3 4m-10 0-1 14h10L4-5m-9 14-2 3H7L5 9" fill="#3a5848" stroke="#c6a464" stroke-width=".9" stroke-linejoin="round" />
	<path d="M-3-4h6L4 8h-8Z" fill={lit ? '#f5be5a' : '#617a67'} fill-opacity={lit ? '.18' : '.12'} />
	{#if lit}<path class="flame" d="M0-2C-4 3-2 7 0 7S4 4 0-2Z" fill="#ffe0a1" /><path d="M0 2q-2 4 0 4t0-4" fill="#fff5cd" />{/if}
	<path d="M0-5V9" stroke="#c6a464" stroke-width=".65" />
</g>

<style>
	.flame { transform-box: fill-box; transform-origin: bottom; animation: flicker 3.7s ease-in-out infinite; }
	@keyframes flicker { 50% { opacity: .75; transform: scale(.85, 1.08); } }
	@media (prefers-reduced-motion: reduce) { .flame { animation: none; } }
</style>
