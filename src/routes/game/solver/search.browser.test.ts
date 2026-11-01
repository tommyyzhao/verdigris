import { describe, expect, it } from "vitest";
import { commands } from "vitest/browser";
import { LEVELS } from "../levels.js";
import {
  evaluate,
  perturbTimeline,
  replayPng,
  type Outcome,
  type Timeline,
} from "./evaluate.js";
import { fromTimeline, naivePlans, seeded } from "./genome.js";
import { archivePng } from "./maps.js";
import { cell, fitness, search, type Candidate } from "./search.js";

const output = commands as unknown as {
  readSolverCheckpoint(name: string, dir: string): Promise<string>;
  writeBenchJson(path: string, json: string): Promise<void>;
  writeBenchBase64(path: string, base64: string): Promise<void>;
};
const run = import.meta.env.VITE_SOLVER_RUN ?? "";
const room = import.meta.env.VITE_SOLVER_ROOM ?? "";
// Fresh experiments get their own directory so stale checkpoints never resume into them.
const OUT = import.meta.env.VITE_SOLVER_OUT ?? "/tmp/verdigris-v3/solver";
const BUDGET = Number(import.meta.env.VITE_SOLVER_BUDGET ?? 12);
const SEEDS = [1, 71, 429];
const PERTURB_SEEDS = Array.from({ length: 10 }, (_, i) => 71 + i * 97);
const SIZES = [
  { timing: 0, position: 0 },
  { timing: 3, position: 0.25 },
  { timing: 6, position: 0.5 },
  { timing: 12, position: 1 },
];

/** Each selected test is a separate lock acquisition; no run may hold the shared GPU >10 minutes. */
describe.sequential("solution-space searches (opt-in)", () => {
  for (const level of LEVELS) {
    const selected = room === level.id;
    const cap = Math.ceil(
      Math.max(600, (level.solution.at(-1)?.tick ?? 0) + 300) * 1.5
    );
    const evalPlan = (timeline: Timeline, seed: number) =>
      evaluate(level, timeline, seed, { cap, queueDepth: 1, earlyStop: true });
    it.skipIf(!selected || run !== "canonical")(
      `${level.id} canonical fixed-lag validation`,
      async () => {
        const fixed: Outcome[] = [];
        for (const seed of SEEDS) {
          fixed.push(await evalPlan(level.solution, seed));
          await output.writeBenchJson(
            `${OUT}/${level.id}-canonical.json`,
            JSON.stringify(fixed, null, 2)
          );
        }
        expect(
          fixed.every((r) => r.cleared),
          JSON.stringify(fixed)
        ).toBe(true);
      },
      570_000
    );
    it.skipIf(!selected || run !== "naive")(
      `${level.id} naive breakers`,
      async () => {
        const rows: { name: string; timeline: Timeline; outcome: Outcome }[] =
          [];
        for (const plan of naivePlans(level)) {
          const outcome = await evaluate(level, plan.timeline, 1, {
            cap,
            queueDepth: 1,
            earlyStop: true,
            airOff: plan.airOff,
          });
          rows.push({ ...plan, outcome });
          await output.writeBenchJson(
            `${OUT}/${level.id}-naive.json`,
            JSON.stringify(rows, null, 2)
          );
        }
      },
      570_000
    );
    for (const mode of ["random", "ga", "map-elites"] as const)
      it.skipIf(!selected || run !== mode)(
        `${level.id} ${mode}`,
        async () => {
          const partial: Candidate[] = JSON.parse(
            await output.readSolverCheckpoint(
              `${level.id}-${mode}-partial`,
              OUT
            )
          );
          const result = await search(level, mode, evalPlan, {
            budget: BUDGET,
            seed: 71429,
            previous: [...partial],
            horizon: Math.min(1200, cap - 120),
            onEvaluation: async (candidate) => {
              partial.push(candidate);
              await output.writeBenchJson(
                `${OUT}/${level.id}-${mode}-partial.json`,
                JSON.stringify(partial, null, 2)
              );
            },
          });
          await output.writeBenchJson(
            `${OUT}/${level.id}-${mode}.json`,
            JSON.stringify(result, null, 2)
          );
          await output.writeBenchBase64(
            `${OUT}/${level.id}-${mode}.png`,
            archivePng(`${level.name} · ${mode}`, result.evaluations)
          );
          expect(result.evaluations).toHaveLength(BUDGET);
        },
        570_000
      );
    it.skipIf(!selected || run !== "clear-replay")(
      `${level.id} replay off-target vent clears`,
      async () => {
        for (const mode of ["random", "map-elites"]) {
          const result = JSON.parse(
            await output.readSolverCheckpoint(`${level.id}-${mode}`, OUT)
          );
          for (const [index, candidate] of (
            result.evaluations as Candidate[]
          ).entries()) {
            if (!candidate.outcome.cleared) continue;
            const arrival = candidate.outcome.route["urn:draft-urn"]?.firstTick;
            if (arrival === undefined) continue;
            const pose = candidate.timeline
              .filter(
                (e) =>
                  e.tick <= arrival &&
                  e.action.type === "pose" &&
                  e.action.id === "return-louvres"
              )
              .at(-1);
            if (pose?.action.type === "pose" && pose.action.index === 0)
              continue;
            const name = `${OUT}/${level.id}-${mode}-${index}-replay`;
            let shot = "";
            const original = await evaluate(
              level,
              candidate.timeline,
              candidate.outcome.seed,
              {
                cap,
                queueDepth: 1,
                earlyStop: true,
                async onTick(state) {
                  if (state.room.view().cleared) shot = replayPng(level, state);
                },
              }
            );
            const noStirTimeline = candidate.timeline.filter(
              (e) => e.action.type !== "stir"
            );
            const noStir = await evalPlan(
              noStirTimeline,
              candidate.outcome.seed
            );
            const noVentTimeline = candidate.timeline.filter(
              (e) =>
                e.action.type !== "pose" || e.action.id !== "return-louvres"
            );
            const noVent = await evalPlan(
              noVentTimeline,
              candidate.outcome.seed
            );
            expect(original.cleared).toBe(true);
            expect(shot).not.toBe("");
            await output.writeBenchJson(
              `${name}.json`,
              JSON.stringify(
                {
                  candidate,
                  original,
                  noStirTimeline,
                  noStir,
                  noVentTimeline,
                  noVent,
                },
                null,
                2
              )
            );
            await output.writeBenchBase64(`${name}.png`, shot);
          }
        }
      },
      570_000
    );
    it.skipIf(!selected || run !== "perturbation")(
      `${level.id} intended-solution perturbation curve`,
      async () => {
        const rows: {
          timing: number;
          position: number;
          seed: number;
          timeline: Timeline;
          outcome: Outcome;
        }[] = [];
        for (const size of SIZES)
          for (const seed of PERTURB_SEEDS) {
            const timeline = perturbTimeline(
              level.solution,
              seeded(seed),
              size.timing,
              size.position
            );
            rows.push({
              ...size,
              seed,
              timeline,
              outcome: await evalPlan(timeline, seed),
            });
            await output.writeBenchJson(
              `${OUT}/${level.id}-perturbation.json`,
              JSON.stringify(rows, null, 2)
            );
          }
      },
      570_000
    );
    it.skipIf(!selected || run !== "warm-map")(
      `${level.id} intended-neighborhood MAP-Elites`,
      async () => {
        const result = await search(level, "map-elites", evalPlan, {
          budget: BUDGET,
          seed: 71,
          warm: fromTimeline(level.solution),
        });
        await output.writeBenchJson(
          `${OUT}/${level.id}-warm-map.json`,
          JSON.stringify(result, null, 2)
        );
        await output.writeBenchBase64(
          `${OUT}/${level.id}-warm-map.png`,
          archivePng(`${level.name} · warm MAP-Elites`, result.evaluations)
        );
      },
      570_000
    );
    it.skipIf(!selected || run !== "map")(
      `${level.id} combined archive`,
      async () => {
        const candidates: Candidate[] = [];
        for (const mode of ["random", "ga", "map-elites"]) {
          const saved = JSON.parse(
            await output.readSolverCheckpoint(`${level.id}-${mode}`, OUT)
          );
          if (!Array.isArray(saved)) candidates.push(...saved.evaluations);
        }
        const naive = JSON.parse(
          await output.readSolverCheckpoint(`${level.id}-naive`, OUT)
        );
        for (const row of naive)
          candidates.push({
            genome: [],
            timeline: row.timeline,
            outcome: row.outcome,
            fitness: fitness(level, row.outcome),
            cell: cell(level, row.outcome),
          });
        await output.writeBenchJson(
          `${OUT}/${level.id}-map.json`,
          JSON.stringify(candidates, null, 2)
        );
        await output.writeBenchBase64(
          `${OUT}/${level.id}-map.png`,
          archivePng(level.name, candidates)
        );
      },
      60_000
    );
    it.skipIf(!selected || run !== "shortcut")(
      `${level.id} replay simplest naive clear`,
      async () => {
        // Explicit replay chosen from the naive suite, not another unbudgeted search.
        const plan = naivePlans(level).find((p) => p.name === "dump-all-4")!;
        let shot = "";
        const outcome = await evaluate(level, plan.timeline, 1, {
          cap,
          queueDepth: 1,
          async onTick(state) {
            if (state.room.view().cleared || state.room.view().tick === cap)
              shot = replayPng(level, state);
          },
        });
        expect(shot).not.toBe("");
        await output.writeBenchJson(
          `${OUT}/${level.id}-shortcut.json`,
          JSON.stringify(
            {
              plan,
              outcome,
              fitness: fitness(level, outcome),
              cell: cell(level, outcome),
            },
            null,
            2
          )
        );
        await output.writeBenchBase64(`${OUT}/${level.id}-shortcut.png`, shot);
      },
      570_000
    );
  }
});
