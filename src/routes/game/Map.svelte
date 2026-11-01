<script lang="ts">
	import Greenhouse from './Greenhouse.svelte';
	import RoomThumbnail from './RoomThumbnail.svelte';
	import type { Level, Progress } from './types.js';
	let { levels, progress, available, onselect, onback, revived }: { levels: readonly Level[]; progress: Progress; available: number; onselect: (index: number) => void; onback: () => void; revived?: string } = $props();
	let selected = $state(-1);
	let next = $derived(levels.findIndex((level, i) => i < available && !progress.cleared[level.id]));
	const wings = ['The Pumphouse', 'The Glasshouse', 'The Heartwood'];
</script>
<section class="map-screen" aria-label="The greenhouse">
	<div class="map-world"><Greenhouse alive={Object.keys(progress.cleared).length}/></div>
	<div class="map-shade"></div>
	<header><button class="back" onclick={onback} aria-label="Return to title">‹</button><div><span class="eyebrow">the garden is waiting</span><h1>One pane at a time.</h1></div><span class="count">{Object.keys(progress.cleared).length}<span> / {levels.length}</span></span></header>
	<div class="wings">
		{#each wings as wing, act}
			{#if levels.some(level => level.act === act + 1)}
			<div class="wing">
				<div class="wing-title"><span>0{act + 1}</span><h2>{wing}</h2><i></i></div>
				<div class="panes">
					{#each levels.filter(level => level.act === act + 1) as level}
						{@const index = levels.indexOf(level)}
						{@const clear = progress.cleared[level.id] !== undefined}
						<button class="room-pane" class:locked={index >= available} class:clear class:revived={revived === level.id} class:next={index === next} aria-current={index === next ? 'step' : undefined} disabled={index >= available} onpointerenter={() => selected = index} onfocus={() => selected = index} onclick={() => onselect(index)} aria-label={`${level.name}${clear ? ', revived' : index >= available ? `, sleeping; clear ${levels[index - 1]?.name ?? 'the previous room'} to wake` : ', enter room'}`} aria-describedby={clear ? `drops-${level.id}` : undefined}>
							{#if clear}<span class="sr-only" id={`drops-${level.id}`}>{progress.cleared[level.id]} dewdrops earned</span>{/if}
							<div class="pane-art"><RoomThumbnail {level} {clear} locked={index >= available}/></div>
							<div class="pane-bottom"><span class="room-number">{String(index + 1).padStart(2, '0')}</span><span class="room-name">{level.name}{#if index >= available}<small>Clear {levels[index - 1]?.name ?? 'the previous room'} to wake</small>{/if}{#if index === next}<small>Play next →</small>{/if}</span><span class="pane-mark" aria-hidden="true">{#if clear}<svg class="earned-drops" viewBox="0 0 39 17">{#each [0,1,2] as drop}<path d="M0-6C-1-3-4 0-4 2a4 4 0 0 0 8 0C4 0 1-3 0-6Z" transform={`translate(${6 + drop * 13} 8)`} fill={drop < progress.cleared[level.id] ? '#a8dce1' : 'none'} stroke={drop < progress.cleared[level.id] ? '#e6f4d6' : '#758c74'} stroke-width=".8" opacity={drop < progress.cleared[level.id] ? 1 : .4}/>{/each}</svg>{:else}{index >= available ? '·' : '↗'}{/if}</span></div>
						</button>
					{/each}
				</div>
			</div>
			{/if}
		{/each}
	</div>
	<footer><span>{selected >= 0 && selected < available ? 'Listen to the room. Follow the water.' : 'A little water. A little patience.'}</span><span>{levels.length} rooms. One living garden.</span></footer>
</section>
<style>
	.map-screen { position: absolute; inset: 0; overflow: auto; background: #0b2931; }.map-world { position: absolute; inset: -10% -5% 0; opacity: .3; }.map-shade { position: absolute; inset: 0; background: linear-gradient(#0b293166,#0b2931d9 35%,#0b2931eb); pointer-events: none; }
	header,.wings,footer { position: relative; z-index: 1; }header { display: flex; align-items: center; gap: 28px; max-width: 1180px; margin: 0 auto; padding: 47px 30px 27px; }.back { background: transparent; border: 1px solid #728d7255; border-radius: 50%; color: #d0d1b5; width: 44px; height: 44px; font-family: Georgia,serif; font-size: 29px; line-height: 28px; cursor: pointer; }.eyebrow { color: #aeb498; font-size: 9px; text-transform: uppercase; letter-spacing: .23em; }h1 { font-family: Georgia,serif; color: #e1dfc6; font-size: clamp(25px, 3vw, 38px); font-weight: 400; margin: 9px 0 0; letter-spacing: -.035em; }.count { margin-left: auto; font-family: Georgia,serif; font-size: 25px; color: #e4d8b3; }.count span { font-size: 15px; color: #809c90; }
	.wings { display: grid; grid-template-columns: 1fr; gap: 28px; max-width: 1080px; margin: 20px auto 0; padding: 0 30px; }.wing-title { display: flex; gap: 12px; align-items: center; margin-bottom: 18px; }.wing-title>span { font-family: Georgia,serif; color: #b8ae7d; font-size: 12px; }h2 { color: #bfcab3; font-family: Georgia,serif; font-size: 17px; font-weight: 400; margin: 0; white-space: nowrap; }.wing-title i { height: 1px; flex: 1; background: #66826d50; }.panes { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
	.room-pane { padding: 0; overflow: hidden; border: 1px solid #6f8b7466; border-radius: 90px 90px 4px 4px / 18px 18px 4px 4px; background: linear-gradient(140deg,#507e7820,#092b314d); text-align: left; cursor: pointer; color: #d4d9bd; transition: border .3s, background .3s, transform .3s; position: relative; }.room-pane:not(:disabled):hover { border-color: #b8bd8d; transform: translateY(-2px); background: #6d92692b; }.room-pane:focus-visible { outline: 2px solid #eedc9f; outline-offset: 5px; }.room-pane.locked { opacity: .43; cursor: default; }.room-pane.clear { background: #69885a1f; border-color: #829b6d88; }.pane-art { display: block; width: 100%; height: clamp(72px, 13vh, 132px); }.pane-bottom { display: flex; gap: 11px; align-items: center; border-top: 1px solid #68816c3a; padding: 13px 15px; background: #0b2a2d99; }.room-number { font-family: Georgia,serif; color: #8f9e7e; font-size: 11px; }.room-name { font-size: 11px; letter-spacing: .02em; }.pane-mark { margin-left: auto; color: #c3b784; font-size: 15px; white-space: nowrap; }
	footer { max-width: 1020px; margin: 28px auto 20px; display: flex; justify-content: space-between; font-size: 10px; color: #91a58f; letter-spacing: .025em; }.revived { animation: revive 2s ease-out; }@keyframes revive { from { box-shadow: 0 0 60px #e3d18266; filter: brightness(1.7); }to { box-shadow: 0 0 0 transparent; filter: brightness(1); } }
	.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
	.room-pane.locked { opacity: .65; border-color: #a5beb238; }.room-pane.clear { background: linear-gradient(140deg,#acb97133,#47795d26); border-color: #c6c18b88; box-shadow: inset 0 1px #f0d6a12b; }.clear .pane-bottom { background: #385343bb; border-top-color: #d7d4a13d; }.clear .room-name { color: #eeead1; }.clear .room-number { color: #c9c795; }.earned-drops { width: 39px; height: 17px; display: block; }
	@media(max-width: 700px) { header { padding: 28px 24px 23px; gap: 17px; }.wings { grid-template-columns: 1fr; gap: 28px; margin-top: 7px; padding: 0 24px 25px; }.panes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }.pane-art { height: 82px; }.pane-bottom { padding: 11px 7px; gap: 5px; min-height: 49px; }.room-name { font-size: 9px; line-height: 1.3; }.room-number { display: none; }.pane-mark { font-size: 11px; }.wing-title { margin-bottom: 10px; }footer { margin: 0 24px 28px; gap: 24px; line-height: 1.7; }footer span:last-child { display: none; } }
	@media(prefers-reduced-motion: reduce) { .revived { animation: none; }.room-pane { transition: none; } }
	.room-pane.next { border: 2px solid #d6dd9f; background: #69885a33; box-shadow: 0 0 24px #b7cd7420; }.room-name small { display: block; font-size: 10px; margin-top: 5px; color: #e4e9b8; }.map-screen { padding-bottom: 75px; box-sizing: border-box; }footer { padding: 0 30px; }@media(max-width: 700px) { .panes { grid-template-columns: 1fr; }.room-pane { display: grid; grid-template-columns: 120px 1fr; border-radius: 12px 4px 4px 12px; }.pane-art { height: 84px; }.pane-bottom { border-top: 0; border-left: 1px solid #68816c3a; padding: 12px 16px; }.room-name { font-size: 13px; }.room-number { display: inline; }.earned-drops { width: 39px; }.wing-title h2 { font-size: 19px; }footer { padding: 0; } }
</style>
