<script lang="ts">
	import { onMount } from 'svelte';
	import { createTelemetry, hashData, type Telemetry, type Phase } from './telemetry.js';
	import type { Level } from './types.js';
	let { levels, onrecorder, onchoice, onpause }: { levels: readonly Level[]; onrecorder: (recorder: Telemetry) => void; onchoice: (choice: string, roomId?: string) => void; onpause: (paused: boolean) => void } = $props();
	let requested = $state(false);
	let consent = $state<HTMLDialogElement>();
	let recorder = $state.raw<Telemetry>();
	let downloadConsent = $state(false);
	let round = $state('R01');
	let participant = $state('P01');
	let message = $state('');
	let warning = $state(false);
	let finished = $state(false);
	let researchBreak = $state(false);
	let withdrawn = $state(false);
	let phase = $state<Phase>('scored_silent');
	let hintTier = $state(1);
	let marker = $state('IDLE_CANDIDATE');
	let selectedRoom = $state('');
	let format = $state<'lean' | 'full'>('lean');
	let remote = $state(false);
	let inputClass = $state<'mouse' | 'trackpad' | 'touch' | 'keyboard' | 'mixed' | 'unknown'>('unknown');
	let strategy = $state('');
	let assessed = $state<string[]>([]);
	let compatibility = $state<'PASS' | 'not_checked'>('not_checked');
	let deleted = $state(false);
	let pulse: ReturnType<typeof setInterval> | undefined;
	onMount(() => {
		selectedRoom = levels[0]?.id ?? '';
		requested = new URLSearchParams(location.search).get('study') === '1';
		const unload = (e: BeforeUnloadEvent) => { if (recorder?.unsaved && !withdrawn) { e.preventDefault(); e.returnValue = ''; } };
		const hide = () => { clearInterval(pulse); recorder?.finish('navigation', false); };
		const show = (e: PageTransitionEvent) => { if (e.persisted && recorder?.ended) { finished = true; researchBreak = false; onpause(false); message = 'Recording ended when this page was left. Restored page is not recording; save the ended log or reload to start a new study.'; } };
		window.addEventListener('pageshow', show);
		window.addEventListener('beforeunload', unload);
		window.addEventListener('pagehide', hide);
		return () => { clearInterval(pulse); window.removeEventListener('beforeunload', unload); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show); recorder?.finish('navigation', false); };
	});
	$effect(() => { if (requested && consent && !consent.open) consent.showModal(); });
	function accept() {
		if (!/^[A-Za-z0-9_.-]{1,40}$/.test(round) || !/^[A-Za-z0-9_.-]{1,40}$/.test(participant)) { message = 'Use study codes only: letters, numbers, dots, hyphens or underscores.'; return; }
		let storage: Storage | undefined;
		try { storage = window.localStorage; } catch { /* Consent remains usable without browser storage. */ }
		recorder = createTelemetry(levels, { consent: { telemetry: true, screen: false, voice: false, face: false }, storage, metadata: { round_id: round, participant_id: participant, viewport_bucket: innerWidth < 600 ? 'compact' : innerWidth < 1200 ? 'medium' : 'large', build_hash: import.meta.env.VITE_STUDY_BUILD_HASH, engine_settings_hash: hashData({ width: 192, height: 120, hz: 60, seed: 71429 }), protocol_version: '1', session_format: format, remote, input_class: inputClass, strategy_dictionary_version: strategy, assessed_room_ids: assessed, not_assessed_gates: format === 'lean' ? ['strategy_autonomy'] : [], free_choice_cap_ms: format === 'lean' ? 180000 : 300000, compatibility }, onLimit: () => warning = true });
		if (recorder) { onrecorder(recorder); pulse = setInterval(() => recorder?.pulse(), 500); }
		requested = false; consent?.close(); message = '';
	}
	function decline() { requested = false; consent?.close(); message = 'Study recording declined. Gameplay remains available.'; }
	function download() {
		if (!recorder) return;
		try {
			const url = URL.createObjectURL(new Blob([recorder.serialize()], { type: 'application/json' }));
			const link = document.createElement('a'); link.href = url; link.download = recorder.filename(); link.click();
			setTimeout(() => URL.revokeObjectURL(url), 0);
			message = `Download requested: ${recorder.filename()}. Check Downloads; delivery cannot be verified. If blocked, use Download log or Copy log.`;
		} catch { message = 'Export unavailable. Recording may be incomplete; keep this tab open.'; }
	}
	async function copy() { if (!recorder) return; try { await navigator.clipboard.writeText(recorder.serialize()); message = 'Log copied. Nothing uploaded.'; } catch { message = 'Copy blocked; use Download log.'; } }
	function finish() { clearInterval(pulse); recorder?.finish(); researchBreak = false; onpause(false); finished = true; if (downloadConsent) download(); else message = 'Study finished. Save only if you want to; nothing uploaded.'; }
	function revoke() { clearInterval(pulse); recorder?.finish('withdrawn'); researchBreak = false; onpause(false); withdrawn = true; finished = true; message = 'Recording stopped immediately. Retain or delete your previously consented local log.'; }
	function choice(value: string) { if (value === 'stop') { clearInterval(pulse); finished = true; } recorder?.selectChoice(value, ['replay', 'continue'].includes(value) ? selectedRoom : undefined); onchoice(value, selectedRoom); }
	function changePhase() { recorder?.phaseChange(phase); syncPause(); if (phase === 'free_choice') recorder?.choices(['replay', 'continue', 'sandbox', 'stop', 'break']); }
	function syncPause() { onpause(researchBreak || !['controls', 'scored_silent', 'free_choice'].includes(phase)); }
	function setBreak(value: boolean) { researchBreak = value; recorder?.pause('facilitator_break', value); syncPause(); }
</script>

{#if requested}
	<dialog bind:this={consent} aria-labelledby="study-consent-title" oncancel={e => { e.preventDefault(); decline(); }}>
		<h2 id="study-consent-title">Optional local playtest log</h2>
		<p>Record board actions, hints, room outcomes and elapsed times under study codes, not your name. No network uploads, cookies, screen, voice or face capture. The local buffer is capped; closing or refreshing can lose unsaved data.</p>
		<p>Participation is optional. Declining or stopping does not affect gameplay or compensation. You may stop immediately, keep or delete your log, or decline handing it over. The owner keeps coded logs up to 90 days; request withdrawal within 14 days using your study code. Screen, voice and face permissions are separate, outside this game.</p>
		<label>Round code <input aria-label="Round code" bind:value={round} maxlength="40" autocomplete="off"/></label>
		<label>Participant code <input aria-label="Participant code" bind:value={participant} maxlength="40" autocomplete="off"/></label>
		<details><summary>Facilitator freeze-sheet metadata</summary>
			<label>Session format <select bind:value={format}><option value="lean">lean</option><option value="full">full</option></select></label>
			<label><input type="checkbox" bind:checked={remote}/> Remote session</label>
			<label>Input class <select bind:value={inputClass}>{#each ['unknown', 'mouse', 'trackpad', 'touch', 'keyboard', 'mixed'] as value}<option>{value}</option>{/each}</select></label>
			<label>Strategy dictionary code <input bind:value={strategy} maxlength="80" autocomplete="off"/></label>
			<fieldset><legend>Assessed rooms</legend>{#each levels as level}<label><input type="checkbox" bind:group={assessed} value={level.id}/>{level.name}</label>{/each}</fieldset>
			<label>Prior capability check <select bind:value={compatibility}><option value="not_checked">not checked</option><option value="PASS">PASS (verified separately)</option></select></label>
		</details>
		<label><input type="checkbox" bind:checked={downloadConsent}/> Allow one local download when I press Finish study. Nothing is uploaded.</label>
		<button onclick={accept}>Accept telemetry and start study</button><button onclick={decline}>Decline recording</button>
		<p role="status">{message}</p>
	</dialog>
{/if}
{#if recorder}
	<aside class="study-controls" aria-label="Study recording">
		<span>{finished ? 'Study recording stopped' : 'Study recording enabled · local only'}</span>
		{#if !finished}<button onclick={finish}>Finish study</button><button onclick={revoke}>Stop recording / withdraw</button>{/if}
		{#if !deleted}<button onclick={download}>Download log</button><button onclick={copy}>Copy log</button>
		<button onclick={() => { recorder?.saved(); message = 'Save confirmed. Keep the file private; handoff is a separate choice.'; }}>I saved my log</button>{/if}
		{#if withdrawn}<button onclick={() => { recorder?.revoke(false); deleted = true; withdrawn = false; message = 'Local log deleted. Previously downloaded copies are yours to delete.'; }}>Delete local log</button><button onclick={() => { withdrawn = false; message = 'Previously consented log retained. Capture remains stopped.'; }}>Retain local log</button>{/if}
		{#if warning}<strong role="alert">Log limit reached. Some capture is incomplete. Save now; gameplay is unaffected.</strong>{/if}
		<span role="status">{message}</span>
		{#if !finished}
			<details><summary>Facilitator controls</summary>
				<label>Phase <select aria-label="Study phase" bind:value={phase} onchange={changePhase}>{#each ['controls', 'scored_silent', 'free_choice', 'questionnaire', 'retrospective', 'debrief'] as value}<option>{value}</option>{/each}</select></label>
				<button onclick={() => { setBreak(true); }}>Start research break</button><button onclick={() => { setBreak(false); }}>End research break</button>
				<label>Hint tier <select bind:value={hintTier}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>
				<button onclick={() => recorder?.hintOffer(hintTier, 'pending')}>Offer hint</button><button onclick={() => recorder?.hintOffer(hintTier, 'decline')}>Hint declined</button>
				<button onclick={() => recorder?.help('solution', 'external-solution')}>Mark solution help</button><button onclick={() => recorder?.help('technical', 'technical')}>Mark technical help</button>
				<label>Observer marker <select bind:value={marker}>{#each ['IDLE_CANDIDATE', 'IMPASSE_IDLE', 'IMPASSE_REPEAT', 'WAIT_EXPECTED', 'STRATEGY_CHANGE_CANDIDATE', 'INSIGHT_SUPPORTED', 'QUIT_ROOM', 'QUIT_SESSION'] as value}<option>{value}</option>{/each}</select></label><button onclick={() => recorder?.marker(marker, 'candidate')}>Mark candidate</button>
				{#if phase === 'free_choice'}<nav aria-label="Optional play choices"><label>Room <select bind:value={selectedRoom}>{#each levels as level}<option value={level.id}>{level.name}</option>{/each}</select></label>{#each ['replay', 'continue', 'sandbox', 'stop', 'break'] as value}<button onclick={() => choice(value)}>{value}</button>{/each}</nav>{/if}
			</details>
		{/if}
	</aside>
{:else if message}<div class="study-message" role="status">{message}</div>{/if}

<style>
	dialog { color: #dce1c5; background: #163834; border: 1px solid #8d9e6e; border-radius: 12px; width: min(560px, calc(100vw - 48px)); max-height: calc(100dvh - 64px); overflow: auto; padding: 24px; font: 14px/1.6 system-ui; } dialog::backdrop { background: #051e29ed; } label { display: block; margin: 8px 0; } button, input, select { font: inherit; min-height: 44px; } button { color: #d9dec3; background: #294c44; border: 1px solid #8b9e6d; cursor: pointer; padding: 6px 10px; margin: 2px; } button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #ecdba7; outline-offset: 2px; } .study-controls, .study-message { position: fixed; z-index: 30; bottom: 0; left: 0; max-width: 100%; max-height: 45vh; overflow: auto; box-sizing: border-box; color: #d9dec3; background: #163834; padding: 4px 8px; font: 11px/1.5 system-ui; } .study-controls>span { margin: 0 6px; } summary { cursor: pointer; min-height: 44px; display: inline-flex; align-items: center; } nav { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } strong { display: block; } .study-controls details { max-width: 700px; } .study-controls details button { margin: 4px; }
</style>
