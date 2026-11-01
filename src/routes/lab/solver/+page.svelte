<script lang="ts">
	import { onMount } from 'svelte';
	import { LEVELS } from '../../game/levels.js';
	import { evaluate, perturbTimeline } from '../../game/solver/evaluate.js';
	import { naivePlans, seeded } from '../../game/solver/genome.js';
	import { search } from '../../game/solver/search.js';

	let status = $state('Idle. Use ?auto=1&room=breath&mode=random&budget=100&seed=71429');
	let completed = $state(0);
	let serialized = $state('');
	onMount(() => {
		const params = new URLSearchParams(location.search);
		if (params.get('auto') !== '1') return;
		const level = LEVELS.find((l) => l.id === params.get('room'));
		const mode = params.get('mode') ?? 'random';
		const budget = Number(params.get('budget') ?? 12);
		const seed = Number(params.get('seed') ?? 71429);
		const host = window as typeof window & { __solverResult?: unknown; __solverProgress?: unknown };
		async function run() {
			if (!level || !Number.isInteger(budget) || budget < 1 || budget > 10000 || !Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff)
				throw new RangeError('Invalid room, budget (1..10000), or uint32 seed');
			status = `${level.name} · ${mode} · ${budget} real-engine evaluations`;
			const cap = Math.ceil(Math.max(600, (level.solution.at(-1)?.tick ?? 0) + 300) * 1.5);
			const evaluatePlan = (timeline: typeof level.solution, s: number) => evaluate(level, timeline, s, { cap, queueDepth: 1, earlyStop: true });
			let result: unknown;
			if (mode === 'random' || mode === 'ga' || mode === 'map-elites') {
				result = await search(level, mode, evaluatePlan, { budget, seed, horizon: Math.min(1200, cap - 120), onEvaluation(candidate, index) {
					completed = index + 1; host.__solverProgress = { completed, candidate };
				} });
			} else if (mode === 'naive' || mode === 'perturbation') {
				const rows = [];
				const plans = naivePlans(level);
				for (let i = 0; i < (mode === 'naive' ? plans.length : budget); i++) {
					const magnitude = [{ timing: 3, position: .25 }, { timing: 6, position: .5 }, { timing: 12, position: 1 }][i % 3];
					const timeline = mode === 'naive' ? plans[i].timeline : perturbTimeline(level.solution, seeded(seed + i), magnitude.timing, magnitude.position);
					rows.push({ name: mode === 'naive' ? plans[i].name : `perturb-${i}`, magnitude, timeline, outcome: await evaluatePlan(timeline, seed + i) });
					completed = i + 1; host.__solverProgress = { completed, rows };
				}
				result = rows;
			} else throw new RangeError('Mode must be random, ga, map-elites, naive, or perturbation');
			host.__solverResult = { room: level.id, mode, seed, budget, userAgent: navigator.userAgent, result };
			serialized = JSON.stringify(host.__solverResult);
			status = `Complete · ${completed} evaluations`;
		}
		void run().catch((error) => { status = String(error); host.__solverResult = { error: String(error), completed }; });
	});
</script>

<svelte:head><title>Verdigris solver lab</title><meta name="robots" content="noindex" /></svelte:head>
<main>
	<h1>Real-engine solver</h1>
	<p role="status">{status}</p>
	<p>Completed: {completed}. No rendering. This page occupies the GPU until complete or closed.</p>
	{#if serialized}<details><summary>Result JSON</summary><pre>{serialized}</pre></details>{/if}
</main>

<style>
	main { padding: 2rem; font-family: system-ui, sans-serif; max-width: 70rem; margin: auto; }
	pre { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
