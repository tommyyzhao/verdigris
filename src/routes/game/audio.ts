import type { GardenAudio, GameEvent, RoomView, UiSound } from './types.js';

const NOTES = [293.66, 369.99, 493.88];
const clamp = (n: number, min = 0, max = 1) =>
	Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));

export function createAudio(
	factory?: () => AudioContext,
	springSpecies: (id: string) => number = () => 0
): GardenAudio {
	let ctx: AudioContext | undefined;
	let master: GainNode | undefined;
	let bed: GainNode | undefined;
	let bedFilter: BiquadFilterNode | undefined;
	let bedSource: AudioBufferSourceNode | undefined;
	let noise: AudioBuffer | undefined;
	let disposed = false;
	let muted = false;
	let volume = 1;
	let scene: 0 | 1 | 2 | 3 | 4 = 0;
	let sceneGain: GainNode | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let beat = 0;
	let nextDrop = 0;
	let nextSeed = 0;
	let finaleEnd: number | undefined;
	let finaleTimer: ReturnType<typeof setTimeout> | undefined;
	const mixes = new Map<string, number[]>();
	const hums: { oscillator: OscillatorNode; gain: GainNode }[] = [];
	let trickle:
		| {
				source: AudioBufferSourceNode;
				filter: BiquadFilterNode;
				gain: GainNode;
		  }
		| undefined;
	let nextStir = 0;
	let wasted = 0;
	let nextDrain = 0;
	const urns = new Map<
		string,
		{
			oscillators: OscillatorNode[];
			gains: GainNode[];
			filter: BiquadFilterNode;
		}
	>();
	const active = new Set<AudioNode>();

	function target(param: AudioParam, value: number, seconds = 0.05) {
		param.setTargetAtTime(value, ctx!.currentTime, seconds);
	}
	function masterVolume() {
		if (master && ctx) target(master.gain, muted ? 0 : volume * 0.18);
	}
	function release(nodes: AudioNode[]) {
		for (const node of nodes) {
			try {
				node.disconnect();
			} catch {
				/* Already disconnected. */
			}
			active.delete(node);
		}
	}
	function startBed() {
		if (bedSource || !ctx || !noise || !master) return;
		bedSource = ctx.createBufferSource();
		bedSource.buffer = noise;
		bedSource.loop = true;
		bedFilter = ctx.createBiquadFilter();
		bedFilter.type = 'lowpass';
		bed = ctx.createGain();
		bed.gain.value = 0;
		bedSource.connect(bedFilter).connect(bed).connect(master);
		bedSource.start();
	}
	function stopTrickle() {
		if (!trickle) return;
		const { source, filter, gain } = trickle;
		target(gain.gain, 0, 0.025);
		source.onended = () => release([source, filter, gain]);
		source.stop(ctx!.currentTime + 0.15);
		trickle = undefined;
	}
	function updateTrickle(view: RoomView) {
		if (!view.pouring) {
			stopTrickle();
			return;
		}
		if (!trickle) {
			const source = ctx!.createBufferSource(),
				filter = ctx!.createBiquadFilter(),
				gain = ctx!.createGain();
			source.buffer = noise!;
			source.loop = true;
			filter.type = 'bandpass';
			gain.gain.value = 0;
			source.connect(filter).connect(gain).connect(master!);
			source.start();
			[source, filter, gain].forEach((node) => active.add(node));
			trickle = { source, filter, gain };
		}
		target(
			trickle.filter.frequency,
			[1600, 950, 2100][springSpecies(view.pouring.spring)] ?? 1600,
			0.1
		);
		target(trickle.gain.gain, 0.055, 0.025);
	}
	function fadeRoom() {
		stopTrickle();
		const end = ctx!.currentTime + 0.3;
		for (const voice of urns.values()) {
			for (const gain of voice.gains) target(gain.gain, 0, 0.05);
			let remaining = voice.oscillators.length;
			for (const oscillator of voice.oscillators) {
				oscillator.onended = () => {
					if (--remaining === 0)
						release([...voice.oscillators, ...voice.gains, voice.filter]);
				};
				oscillator.stop(end);
			}
		}
		urns.clear();
		for (const voice of hums.splice(0)) {
			target(voice.gain.gain, 0, 0.05);
			voice.oscillator.onended = () => release([voice.oscillator, voice.gain]);
			voice.oscillator.stop(end);
		}
		if (bedSource && bed && bedFilter) {
			const source = bedSource;
			const nodes = [source, bedFilter, bed];
			target(bed.gain, 0, 0.05);
			source.onended = () => release(nodes);
			source.stop(end);
			bedSource = undefined;
			bed = undefined;
			bedFilter = undefined;
		}
	}
	function tone(
		frequency: number,
		duration: number,
		gain: number,
		start = ctx!.currentTime,
		type: OscillatorType = 'sine',
		pan = 0,
		destination: AudioNode = master!,
		endFrequency = frequency
	) {
		if (!ctx || active.size > 192) return;
		const oscillator = ctx.createOscillator();
		const envelope = ctx.createGain();
		const nodes: AudioNode[] = [oscillator, envelope];
		oscillator.type = type;
		oscillator.frequency.setValueAtTime(frequency, start);
		oscillator.frequency.exponentialRampToValueAtTime(
			Math.max(1, endFrequency),
			start + duration
		);
		envelope.gain.setValueAtTime(0.0001, start);
		envelope.gain.exponentialRampToValueAtTime(
			Math.max(0.0002, gain),
			start + Math.min(0.04, duration / 3)
		);
		envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
		oscillator.connect(envelope);
		if (pan && typeof ctx.createStereoPanner === 'function') {
			const panner = ctx.createStereoPanner();
			panner.pan.value = clamp(pan, -1, 1);
			envelope.connect(panner).connect(destination);
			nodes.push(panner);
		} else envelope.connect(destination);
		nodes.forEach((node) => active.add(node));
		oscillator.onended = () => release(nodes);
		oscillator.start(start);
		oscillator.stop(start + duration + 0.02);
	}
	function grain(
		frequency: number,
		duration: number,
		gain: number,
		pan = 0,
		start = ctx!.currentTime
	) {
		if (!ctx || !noise || active.size > 192) return;
		const source = ctx.createBufferSource();
		const filter = ctx.createBiquadFilter();
		const envelope = ctx.createGain();
		const nodes: AudioNode[] = [source, filter, envelope];
		source.buffer = noise;
		filter.type = 'bandpass';
		filter.frequency.setValueAtTime(frequency, start);
		filter.frequency.exponentialRampToValueAtTime(
			Math.max(80, frequency * 0.55),
			start + duration
		);
		envelope.gain.setValueAtTime(gain, start);
		envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
		source.connect(filter).connect(envelope);
		if (pan && typeof ctx.createStereoPanner === 'function') {
			const panner = ctx.createStereoPanner();
			panner.pan.value = clamp(pan, -1, 1);
			envelope.connect(panner).connect(master!);
			nodes.push(panner);
		} else envelope.connect(master!);
		nodes.forEach((node) => active.add(node));
		source.onended = () => release(nodes);
		source.start(start);
		source.stop(start + duration);
	}
	function chord(start: number, length: number, pitches = NOTES) {
		for (const frequency of pitches) {
			tone(frequency, length, 0.055, start, 'sine');
			tone(frequency * 2.01, length * 0.6, 0.012, start, 'triangle');
		}
	}
	function stopUrn(id: string) {
		const voice = urns.get(id);
		if (!voice) return;
		for (const oscillator of voice.oscillators) oscillator.stop();
		release([...voice.oscillators, ...voice.gains, voice.filter]);
		urns.delete(id);
	}
	function updateUrns(view: RoomView | null) {
		const visible = (view?.urns ?? [])
			.slice(0, 4)
			.filter((urn) => urn.units > 0 && urn.fill > 0);
		const ids = new Set(visible.map((urn) => urn.id));
		for (const id of urns.keys()) if (!ids.has(id)) stopUrn(id);
		for (const urn of visible) {
			let voice = urns.get(urn.id);
			if (!voice) {
				const filter = ctx!.createBiquadFilter();
				filter.type = 'lowpass';
				filter.connect(master!);
				const oscillators: OscillatorNode[] = [];
				const gains: GainNode[] = [];
				for (let i = 0; i < 3; i++) {
					const oscillator = ctx!.createOscillator();
					const gain = ctx!.createGain();
					oscillator.type = 'sine';
					gain.gain.value = 0;
					oscillator.connect(gain).connect(filter);
					oscillator.start();
					oscillators.push(oscillator);
					gains.push(gain);
				}
				voice = { oscillators, gains, filter };
				urns.set(urn.id, voice);
			}
			const sum = urn.counts.reduce((a, b) => a + Math.max(0, b), 0) || 1;
			const fill = clamp(urn.fill);
			target(voice.filter.frequency, 500 + fill * 2200, 0.3);
			for (let i = 0; i < 3; i++) {
				target(voice.oscillators[i].frequency, NOTES[i] / 2, 0.3);
				target(
					voice.oscillators[i].detune,
					urn.inTune ? 0 : i % 2 ? 16 : -16,
					0.3
				);
				const shimmer =
					urn.status === 'ready'
						? 0.8 + 0.2 * Math.sin(ctx!.currentTime * 4)
						: 1;
				target(
					voice.gains[i].gain,
					0.045 * fill * clamp(urn.counts[i] / sum) * shimmer,
					0.25
				);
			}
		}
	}
	function updateHums(view: RoomView | null) {
		const machines = Object.values(view?.machines ?? {}).filter(Boolean).length;
		const speeds = Object.values(view?.wheels ?? {})
			.map((speed) => Math.abs(speed))
			.filter(Number.isFinite)
			.filter((speed) => speed > 0.01);
		// ponytail: eight fixed hum slots bound node use; raise the ceiling if rooms need more voices.
		const values = [
			...Array(Math.min(4, machines)).fill(0),
			...speeds.slice(0, 4),
		];
		while (hums.length < values.length) {
			const oscillator = ctx!.createOscillator();
			const gain = ctx!.createGain();
			gain.gain.value = 0;
			oscillator.connect(gain).connect(master!);
			oscillator.start();
			hums.push({ oscillator, gain });
		}
		for (let i = 0; i < hums.length; i++) {
			const speed = values[i];
			target(
				hums[i].gain.gain,
				speed === undefined
					? 0
					: speed === 0
					? 0.018
					: 0.025 * clamp(speed / 4),
				0.3
			);
			if (speed !== undefined)
				target(
					hums[i].oscillator.frequency,
					speed === 0 ? 82.41 : 65 + clamp(speed / 8) * 110,
					0.3
				);
		}
	}
	function finishFinale() {
		if (!ctx || disposed || finaleEnd === undefined) return;
		const remaining = finaleEnd - ctx.currentTime;
		if (remaining > 0) {
			finaleTimer = setTimeout(finishFinale, Math.max(50, remaining * 1000));
			return;
		}
		finaleEnd = undefined;
		try {
			switchScene(4);
		} catch {
			/* Silent fallback. */
		}
	}
	function scheduleMusic() {
		if (!ctx || disposed || !sceneGain) return;
		try {
			const now = ctx.currentTime;
			const scale = [293.66, 329.63, 369.99, 440, 493.88];
			const root = scale[beat % scale.length];
			tone(
				root * (beat % 3 === 0 ? 2 : 1),
				2.2,
				0.025,
				now,
				'sine',
				0,
				sceneGain
			);
			if (scene >= 1 && beat % 4 === 0)
				tone(146.83, 8, 0.035, now, 'triangle', 0, sceneGain);
			if (scene >= 2) tone(220, 1.2, 0.018, now, 'sine', 0, sceneGain);
			if (scene >= 3 && beat % 4 === 0)
				tone(73.42, 8, 0.03, now, 'sine', 0, sceneGain);
			if (scene >= 3 && beat % 2 === 0)
				tone(
					scale[(beat + 2) % 5] * 2,
					2,
					0.015,
					now + 0.7,
					'sine',
					0,
					sceneGain
				);
			if (scene === 4 && beat % 4 === 0)
				for (const note of NOTES)
					tone(note / 2, 7, 0.018, now, 'sine', 0, sceneGain);
			beat++;
		} catch {
			/* Audio must not interrupt gameplay. */
		}
		timer = setTimeout(scheduleMusic, 2400);
	}
	function switchScene(next: 0 | 1 | 2 | 3 | 4) {
		if (!ctx || !master || (sceneGain && scene === next)) return;
		const old = sceneGain;
		scene = next;
		sceneGain = ctx.createGain();
		sceneGain.gain.value = 0;
		sceneGain.connect(master);
		target(sceneGain.gain, 1, 0.65);
		if (old) {
			target(old.gain, 0, 0.65);
			// ponytail: old layers disconnect after the crossfade; add a scheduler if fades become configurable.
			setTimeout(() => {
				try {
					old.disconnect();
				} catch {
					/* Already disconnected. */
				}
			}, 2200);
		}
	}
	function playEvent(event: GameEvent) {
		const now = ctx!.currentTime;
		switch (event.type) {
			case 'pour':
				if (event.spring === null) stopTrickle();
				else tone(NOTES[springSpecies(event.spring)] ?? NOTES[0], 0.18, 0.03);
				break;
			case 'pose':
				grain(450, 0.4, 0.08);
				tone(90, 0.25, 0.05);
				break;
			case 'vent':
				grain(1100, 0.6, Math.hypot(event.velocity.x, event.velocity.y) ? 0.035 : 0.015);
				tone(650, 0.045, 0.025);
				break;
			case 'puff':
				grain(1800, 0.25, 0.025);
				break;
			case 'gate':
				grain(event.open ? 180 : 110, event.open ? 0.8 : 0.2, 0.12);
				tone(85, 0.35, 0.06);
				break;
			case 'denied':
				grain(500, 0.1, 0.07);
				break;
			case 'splash':
				tone(
					750,
					0.22,
					0.08 * clamp(event.strength),
					now,
					'sine',
					clamp(event.at.x / 24 - 1, -1, 1),
					master!,
					350
				);
				break;
			case 'urn':
				if (event.status === 'complete') {
					const pitches = mixes.get(event.id);
					chord(now, 3, pitches?.length ? pitches : NOTES);
				} else if (event.status === 'ready') {
					tone(587.32, 0.45, 0.035);
				} else if (event.status === 'spoiled') {
					tone(150, 1.5, 0.06, now, 'sine', 0, master!, 100);
					tone(159, 1.5, 0.06, now, 'sine', 0, master!, 106);
				}
				break;
			case 'seed':
				if (event.status === 'growing' && now >= nextSeed) {
					tone(440 + (beat % 5) * 55, 0.6, 0.045);
					nextSeed = now + 0.2;
				} else if (event.status === 'grown')
					NOTES.forEach((note, i) => tone(note * 2, 1.6, 0.05, now + i * 0.16));
				else if (event.status === 'spoiled')
					tone(160, 1, 0.06, now, 'sine', 0, master!, 100);
				break;
			case 'bramble':
				grain(1800, 0.65, 0.06);
				break;
			case 'machine':
				tone(110, 2, 0.05);
				tone(587.32, 1.4, 0.05);
				break;
			case 'well-empty':
				stopTrickle();
				tone(180, 0.45, 0.07, now, 'sine', 0, master!, 65);
				grain(320, 0.25, 0.045);
				break;
			case 'stuck':
				tone(220, 0.8, 0.035, now, 'sine', 0, master!, 130.81);
				break;
			case 'clear':
				chord(now, 2);
				break;
		}
	}
	function playUi(sound: UiSound, pan = 0, strength = 1) {
		switch (sound) {
			case 'hover':
				tone(1100, 0.08, 0.012, ctx!.currentTime, 'sine', pan);
				break;
			case 'dewdrop':
				tone(NOTES[Math.round(clamp(pan, 0, 2))] * 2, 1.1, 0.055);
				break;
			case 'click':
			case 'aim':
				tone(
					sound === 'aim' ? 660 : 440,
					0.12,
					0.04,
					ctx!.currentTime,
					'triangle',
					pan
				);
				break;
			case 'stir':
				if (ctx!.currentTime >= nextStir) {
					grain(350 + clamp(strength) * 900, 0.22, 0.05 * clamp(strength), pan);
					nextStir = ctx!.currentTime + 0.065;
				}
				break;
			case 'creak':
			case 'ink':
			case 'erase':
			case 'dig':
			case 'denied':
				grain(
					{
						creak: 400,
						ink: 900,
						erase: 1200,
						dig: 300,
						denied: 500,
					}[sound],
					sound === 'creak' ? 0.35 : 0.12,
					0.06,
					pan
				);
				break;
			case 'map':
			case 'pane':
			case 'hint':
				tone(
					sound === 'hint' ? 587 : 880,
					1,
					0.04,
					ctx!.currentTime,
					'sine',
					pan
				);
				break;
			case 'pause':
				tone(440, 0.5, 0.035, ctx!.currentTime, 'sine', pan, master!, 180);
				break;
		}
	}
	return {
		async resume() {
			if (disposed) return;
			try {
				if (!ctx) {
					ctx = factory ? factory() : new AudioContext();
					master = ctx.createGain();
					master.gain.value = muted ? 0 : volume * 0.18;
					const compressor = ctx.createDynamicsCompressor();
					compressor.threshold.value = -18;
					compressor.ratio.value = 8;
					master.connect(compressor).connect(ctx.destination);
					noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
					const samples = noise.getChannelData(0);
					for (let i = 0; i < samples.length; i++)
						samples[i] = Math.random() * 2 - 1;
					startBed();
					switchScene(scene);
					scheduleMusic();
				}
				if (ctx.state === 'suspended') await ctx.resume();
			} catch {
				/* Missing or unavailable audio is nonfatal. */
			}
		},
		setMuted(value) {
			if (disposed) return;
			muted = value;
			if (!ctx) return;
			try {
				masterVolume();
			} catch {
				/* Silent fallback. */
			}
		},
		setVolume(value) {
			if (disposed) return;
			volume = clamp(value);
			if (!ctx) return;
			try {
				masterVolume();
			} catch {
				/* Silent fallback. */
			}
		},
		setScene(value) {
			if (!ctx || disposed) return;
			try {
				if (finaleEnd === undefined || value !== 4) switchScene(value);
			} catch {
				/* Silent fallback. */
			}
		},
		update(view, _dt) {
			if (!ctx || disposed) return;
			try {
				if (!view) {
					mixes.clear();
					wasted = 0;
					nextDrain = 0;
					fadeRoom();
					return;
				}
				startBed();
				updateTrickle(view);
				if (view.wasted > wasted && ctx.currentTime >= nextDrain) {
					grain(240, 0.3, 0.045);
					nextDrain = ctx.currentTime + 0.6;
				}
				wasted = view.wasted;
				const activity = clamp((view?.activity ?? 0) / 8);
				target(bed!.gain, activity * 0.045, 0.4);
				target(bedFilter!.frequency, 350 + activity * 2200, 0.4);
				mixes.clear();
				for (const urn of view?.urns ?? [])
					mixes.set(
						urn.id,
						NOTES.filter((_, i) => urn.counts[i] > 0)
					);
				updateUrns(view);
				updateHums(view);
				if (activity > 0.05 && ctx.currentTime >= nextDrop) {
					tone(
						600 + Math.random() * 600,
						0.16,
						activity * 0.025,
						ctx.currentTime,
						'sine',
						Math.random() * 2 - 1,
						master!,
						350
					);
					nextDrop = ctx.currentTime + 0.2 + Math.random() * (2 / activity);
				}
			} catch {
				/* Silent fallback. */
			}
		},
		event(value) {
			if (!ctx || disposed) return;
			try {
				playEvent(value);
			} catch {
				/* Silent fallback. */
			}
		},
		ui(value, pan, strength) {
			if (!ctx || disposed) return;
			try {
				playUi(value, pan, strength);
			} catch {
				/* Silent fallback. */
			}
		},
		payoff(kind) {
			if (!ctx || disposed) return;
			try {
				const now = ctx.currentTime;
				const duration = kind === 'finale' ? 10 : 3;
				for (let i = 0; i < (kind === 'finale' ? 12 : 4); i++)
					tone(
						NOTES[i % 3] * (1 + Math.floor(i / 6)),
						1.8,
						0.035,
						now + (i * duration) / (kind === 'finale' ? 12 : 4)
					);
				chord(now + duration, 5);
				if (kind === 'finale') {
					if (finaleTimer) clearTimeout(finaleTimer);
					finaleEnd = now + duration;
					finaleTimer = setTimeout(finishFinale, duration * 1000);
				}
			} catch {
				/* Silent fallback. */
			}
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (timer) clearTimeout(timer);
			if (finaleTimer) clearTimeout(finaleTimer);
			try {
				stopTrickle();
				for (const hum of hums) {
					hum.oscillator.stop();
					release([hum.oscillator, hum.gain]);
				}
				for (const id of urns.keys()) stopUrn(id);
				if (bedSource && bed && bedFilter) {
					bedSource.stop();
					release([bedSource, bedFilter, bed]);
				}
				release([...active]);
				sceneGain?.disconnect();
				void ctx?.close().catch(() => {});
			} catch {
				/* Silent fallback. */
			}
		},
	};
}
