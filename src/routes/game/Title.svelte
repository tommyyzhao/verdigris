<script lang="ts">
	import Greenhouse from './Greenhouse.svelte';
	let { cleared = 0, onenter, onnew }: { cleared?: number; onenter: () => void; onnew: () => void } = $props();
</script>
<section class="title-screen" aria-labelledby="verdigris-title">
	<div class="world"><Greenhouse alive={cleared}/></div>
	<div class="shade"></div>
	<div class="title-copy">
		<div class="eyebrow"><span></span> a sleeping machine-garden <span></span></div>
		<h1 id="verdigris-title">Fluider<span class="title-dot">.</span></h1>
		<p>Some things only need<br/>a little water to remember.</p>
		<button class="enter" onclick={onenter}>{cleared ? 'Continue the garden' : 'Enter the greenhouse'}<span aria-hidden="true">↗</span></button>
		{#if cleared}<button class="new" onclick={onnew}>Begin a new garden</button>{/if}
	</div>
	<div class="footer"><span>A small study in water, patience &amp; growing things</span><span>Headphones welcome <span aria-hidden="true">◌</span></span></div>
</section>
<style>
	.title-screen { position: absolute; inset: 0; overflow: hidden; background: #102d36; }
	.world { position: absolute; width: max(100%, 1400px); height: 100%; left: 50%; transform: translateX(-42%); opacity: .94; }
	.shade { position: absolute; inset: 0; background: linear-gradient(90deg, #09252fe8 0%, #0a2739b8 22%, transparent 68%), linear-gradient(0deg, #0a222bcc, transparent 23%); }
	.title-copy { position: absolute; left: clamp(28px, 8vw, 140px); top: 50%; transform: translateY(-49%); max-width: 680px; }
	.eyebrow { display: flex; align-items: center; gap: 12px; color: #c3bc96; font-size: 10px; letter-spacing: .25em; text-transform: uppercase; }
	.eyebrow span { width: 23px; height: 1px; background: #b1ae7f80; }
	.eyebrow span:last-child { display: none; }
	h1 { font-family: Georgia, 'Times New Roman', serif; font-weight: 400; font-size: clamp(66px, 9vw, 132px); letter-spacing: -.065em; line-height: 1; margin: 21px 0 24px -6px; color: #e8e2c7; text-shadow: 0 4px 40px #061e2b66; }
	.title-dot { color: #aaa971; }
	p { font-family: Georgia, serif; font-size: clamp(18px, 1.8vw, 23px); line-height: 1.65; color: #c7d2bf; margin-bottom: 40px; }
	.enter { border: 1px solid #b2b48a77; background: #d7dfac; border-radius: 3px; color: #173b35; padding: 17px 24px; font-size: 12px; letter-spacing: .06em; display: flex; align-items: center; gap: 39px; transition: background .3s, border-color .3s; cursor: pointer; }
	.enter:hover { background: #edf0c9; border-color: #ded3a8; }.enter:focus-visible, .new:focus-visible { outline: 2px solid #ead59f; outline-offset: 5px; }
	.enter span { font-size: 22px; line-height: .7; font-weight: 200; color: #c5c49b; }
	.new { display: block; background: none; border: 0; color: #a3b6a4; font-size: 11px; margin-top: 18px; cursor: pointer; padding: 5px 0; }
	.footer { position: absolute; bottom: 30px; left: 40px; right: 40px; display: flex; justify-content: space-between; color: #99af9f; font-size: 10px; letter-spacing: .07em; }.footer span:last-child span { font-size: 17px; margin-left: 9px; }
	@media(max-width: 600px) { .world { width: 1300px; left: 47%; transform: translateX(-53%); opacity: .6; }.shade { background: linear-gradient(0deg, #09252ff2, #09252f30 95%); }.title-copy { top: 43%; left: 29px; }.eyebrow { font-size: 8px; letter-spacing: .17em; }h1 { margin-top: 26px; font-size: 78px; }p { font-size: 19px; }.footer { left: 29px; right: 29px; bottom: 25px; flex-direction: column; gap: 15px; font-size: 9px; } }
</style>
