<script lang="ts">
	import Greenhouse from './Greenhouse.svelte';
	let { quiet = false, rooms, dewdrops, onwander }: { quiet?: boolean; rooms: number; dewdrops: number; onwander: () => void } = $props();
</script>
<section class="finale-screen" class:quiet aria-label={quiet ? 'The living garden' : 'The garden awakens'}>
	<div class="whole-garden"><Greenhouse alive={9} finale settled={quiet}/></div>
	<div class="vignette"></div>
	<div class="words" aria-live="polite">
		{#if quiet}<span class="eyebrow">nothing here was ever really lost</span><h1>A garden, again.</h1><p>{rooms} rooms remembered. <span aria-hidden="true">·</span> {dewdrops} dewdrops gathered.</p><button onclick={onwander}>Wander a little longer <span aria-hidden="true">↗</span></button>
		{:else}<p class="finale-line">And the heartwood remembered<br/>how to drink the light.</p>{/if}
	</div>
</section>
<style>
	.finale-screen { position: absolute; inset: 0; overflow: hidden; background: #102c34; }.whole-garden { position: absolute; inset: 0; animation: pullback 10s cubic-bezier(.2,.6,.3,1) both; }.vignette { position: absolute; inset: 0; background: linear-gradient(0deg,#071f2aee,transparent 40%); }.words { position: absolute; left: 20px; right: 20px; bottom: 8%; text-align: center; animation: appear 3s 2s both; }.finale-line { color: #e1dcc0; font: 25px/1.8 Georgia,serif; }.eyebrow { color: #aebba0; text-transform: uppercase; letter-spacing: .22em; font-size: 9px; }h1 { font: 400 clamp(36px,5vw,58px)/1.2 Georgia,serif; letter-spacing: -.04em; color: #ece4c9; margin: 16px 0; }.quiet p { font-size: 11px; color: #a3b49a; letter-spacing: .04em; }.quiet p span { padding: 0 9px; }button { background: #203e3577; border: 1px solid #a4aa7a88; color: #e4ddba; border-radius: 3px; font-size: 11px; padding: 15px 20px; margin-top: 20px; cursor: pointer; }button span { margin-left: 26px; }button:focus-visible { outline: 2px solid #e8dba4; outline-offset: 5px; }.quiet .words { animation: appear 2.5s .6s both; }.quiet .vignette { background: linear-gradient(0deg,#0b2b2be8,transparent 44%); }.quiet .whole-garden { filter: saturate(1.12) brightness(1.06); }.quiet .whole-garden { animation: none; }@keyframes pullback { from { transform: scale(1.8); }to { transform: scale(1); } }@keyframes appear { from { opacity: 0; }to { opacity: 1; } }@media(max-width: 600px) { .whole-garden { width: 1000px; left: calc(50% - 500px); height: 100%; }.words { bottom: 13%; }.finale-line { font-size: 21px; } }@media(prefers-reduced-motion: reduce) { .whole-garden { animation: none; }.words { animation: appear .4s both; } }
	.whole-garden { background: #79acb5; }.vignette { background: linear-gradient(0deg,#0b252bdd,transparent 30%); }.words { bottom: 6%; }.finale-line { color: #fff0ce; text-shadow: 0 2px 18px #0c2e32; }.quiet .whole-garden { filter: none; }.quiet .vignette { background: linear-gradient(0deg,#102e2ded,transparent 40%); }.quiet .eyebrow { color: #e0d8af; }.quiet p { color: #d0d6b6; }.quiet h1 { color: #fff0cf; text-shadow: 0 2px 24px #0d2c2f80; }button { background: #244f40c9; border-color: #d0c99799; }button:hover { background: #47694cdc; border-color: #f2dfae; }
	@media(max-width: 600px) { .words { bottom: 9%; } }
</style>
