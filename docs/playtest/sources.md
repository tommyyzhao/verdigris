# Playtest sources and evidence ledger

Access date for every URL: **2026-10-31**. IDs below are the citations used by `protocol.md`, `instrumentation.md`, `checklist.md`. Proposed thresholds, scripts, rubrics and event schemas are **Verdigris study-design decisions**, not findings established by these sources. No human playtests were conducted for this dossier.

## Primary sources

### [A09] Ambinder — empirical playtesting, GDC 2009

Mike Ambinder. *Valve’s Approach to Playtesting: The Application of Empiricism*. GDC, 26 March 2009.
https://media.gdcvault.com/gdc09/slides/GDC09_Ambinder_ValvesApproach.pdf

**Verified:** fetched slide text. “Valve’s Game Design Process” treats game designs as hypotheses, playtests as experiments, followed by evaluation and repetition. “Direct Observation” stresses what players do, observer bias and interpretive limitations. “Verbal Reports” lists interference with gameplay/artificiality/distraction and inaccurate/biased reports. “Stat Collection/Analysis” warns that averages hide extremes and telemetry misses context. “Our Q&A Procedure” puts survey before individual Q&A. Use: observation + logs + private questionnaire, explicit hypotheses, no facilitator coaching. **Not evidence:** any particular Verdigris numerical target or five-person efficacy guarantee.

### [A11] Ambinder — biofeedback limitations, GDC 2011

Mike Ambinder. *Biofeedback in Gameplay: How Valve Measures Physiology to Enhance Gaming Experience*. GDC, 3 March 2011.
https://cdn.fastly.steamstatic.com/apps/valve/2011/ValveBiofeedback-Ambinder.pdf

**Verified:** fetched slide text. Emotional states described as transient/volatile; heart-rate/SCL sections distinguish arousal from difficult-to-determine valence; facial expressions subject to bias/training; EEG expensive, intrusive, noisy, difficult to validate. “Analysis of SCL Data” pairs categorized game events with enjoyment/frustration survey responses. Use: do not label cursor motion, facial change or inactivity as measured emotion; no biometrics needed for this small formative study. The slides do not validate our aha proxy.

### [P03] Pagulayan et al. — user-centred game design

Randy J. Pagulayan, Kevin Keeker, Dennis Wixon, Ramon L. Romero, Thomas Fuller. *User-Centered Design in Games*. In *The Human-Computer Interaction Handbook*, pp. 883–906. Commonly cited as 2003; publisher landing page says first published 2002.
https://doi.org/10.1201/9781410606723-41

**Verified:** publisher metadata, authors, chapter and 24-page extent. The publisher landing page supplies only a contents-style abstract. Subsequently found/read an author-uploaded **in-press manuscript**, same five authors/title, first four manuscript pages and more:
https://www.researchgate.net/publication/234820600_User-Centered_Design_in_Games
The site’s DOI metadata points to a later edition, but the fetched manuscript itself cites the original Jacko/Sears volume as in press; no silent substitution of edition. Manuscript p. 2: usability should remove obstacles to fun, not merely obstacles to accomplishment; pleasurable process differs from productivity. Pp. 3–4: games deliberately impose consistent constraints; more difficulty does not automatically improve fun; distinguishes meaningful constraints from unreadable pieces/inconsistent rules. Use: clear-rate alone cannot validate the intended puzzle; remove execution/readability barriers without removing reasoning. **UNVERIFIED:** exact line-for-line correspondence and pagination to final 2002/2003 published chapter; manuscript cited as such.

Companion primary chapter, read in author-uploaded full text:
Randy J. Pagulayan, Keith R. Steury, Bill Fulton, Ramon L. Romero. *Designing for Fun: User-Testing Case Studies*. *Funology*, 2003, pp. 137–150.
https://doi.org/10.1007/1-4020-2967-5_14
https://www.researchgate.net/publication/200553259_Designing_for_Fun_User-Testing_Case_Studies

**Verified:** pp. 137–138 distinguish pleasurable, appropriately challenging play from efficient task completion; comprehension of rules/objectives is part of game usability. MechWarrior case explicitly avoids simplifying away complexity that contributes to fun. Use: solve-rate alone cannot validate a puzzle; separate control friction from desirable reasoning difficulty. Author’s institutional retrospective corroborates the “appropriately difficult” distinction:
https://www.microsoft.com/en-us/research/publication/designing-for-fun-user-testing-case-studies

### [R02] Medlock et al. — RITE

Michael C. Medlock, Dennis Wixon, Mark Terrano, Ramon L. Romero, Bill Fulton. *Using the RITE method to improve products; a definition and a case study*. 2002.
https://www.jpattonassociates.com/wp-content/uploads/2015/04/rite_method.pdf

**Verified:** fetched complete paper. Defines rapid fixes plus immediate verification with new participants; obvious cause/solution may justify a fix after one participant. Four issue categories distinguish quick obvious fixes, slower obvious fixes, unclear cause and possible test artifacts. Requires predefined critical tasks, participating decision makers, repair capacity and fresh participants to verify fixes. Warns against unclear fixes, too many simultaneous changes, insufficient follow-up and missing low-frequency issues. Use: RITE repair lane, separate from a frozen five-person decision round; never pool different builds into a fictitious 4/5 result. Historical case-study sales are not treated as causal evidence for RITE.

### [NL93] Nielsen & Landauer — problem discovery, not statistical certification

Jakob Nielsen, Thomas K. Landauer. *A mathematical model of the finding of usability problems*. INTERCHI/CHI 1993, pp. 206–213.
https://doi.org/10.1145/169059.169166
https://dl.acm.org/doi/pdf/10.1145/169059.169166

**Verified:** original paper fetched. Eleven interface studies; model `Found(i) = N[1 − (1 − λ)^i]`; detection varies by interface/evaluator/task. Independence assumptions and heterogeneous difficulty are discussed; model can miss remaining problems. Use: five people can reveal recurring breakdowns economically; not “five proves 85% of all problems found,” not a game-enjoyment benchmark. Illustrative arithmetic at λ=.31: discovery probability in five tests `1−.69^5 = .8436`; for a 10%-occurrence issue `1−.9^5 = .4095`. These are model examples, not estimates for Verdigris.

### [ES80] Ericsson & Simon — reports depend on elicitation

K. Anders Ericsson, Herbert A. Simon. *Verbal reports as data*. *Psychological Review* 87(3), 1980, pp. 215–251.
https://doi.org/10.1037/0033-295X.87.3.215
https://www.ovid.com/journals/plrev/pdf/00006832-198005000-00001~verbal-reports-as-data
https://psycnet.apa.org/record/1980-24435-001

**Verified:** publisher/index abstract. Distinguishes information attended in short-term memory from reports requiring otherwise-unattended information or inference; cautions about experimental instructions and inaccurate reconstruction. **UNVERIFIED:** full-book/chapter specifics of the 1993 revised *Protocol Analysis* were not read. Use: retrospective reports are fallible recollections, not direct recordings of thought; ask what they remember, permit “I don’t remember,” avoid requests to invent reasons.

### [S93] Schooler, Ohlsson & Brooks — verbal overshadowing of insight

Jonathan W. Schooler, Stellan Ohlsson, Kevin Brooks. *Thoughts beyond words: When language overshadows insight*. *Journal of Experimental Psychology: General* 122(2), 1993, pp. 166–183.
https://doi.org/10.1037/0096-3445.122.2.166
https://www.researchgate.net/publication/232475020_Thoughts_Beyond_Words_When_Language_Overshadows_Insight

**Verified:** author-uploaded article/abstract fetched. Experiments 1–2: interrupting ongoing solving to retrospectively verbalize strategy reduced subsequent success relative to controls. Experiments 3–4: concurrent nondirective verbalization impaired insight solving; Experiment 3 found no effect on noninsight problems. **Boundary:** laboratory tasks, not Verdigris; does not prove every think-aloud protocol harmful. Crucial consequence: finish the entire scored silent sequence and optional free-choice block before explanatory interviews/replay. A retrospective interruption midway through an unsolved room is NOT the protective alternative.

Author’s old lab links now redirect to lab home; not relied on as successfully fetched article text:
https://labs.psych.ucsb.edu/schooler/jonathan/publications/1376

### [F11] Fox, Ericsson & Best — important think-aloud counterweight

Mark C. Fox, K. Anders Ericsson, Ryan Best. *Do procedures for verbal reporting of thinking have to be reactive? A meta-analysis and recommendations for best reporting methods*. *Psychological Bulletin* 137(2), 2011, pp. 316–344.
https://doi.org/10.1037/a0021663
https://pubmed.ncbi.nlm.nih.gov/21090887/

**Verified fetched primary abstract:** 94 studies, nearly 3,500 participants; undirected think-aloud accuracy effect r=−.03, indistinguishable from zero; directed describing/explaining significantly reactive, associated with higher performance; all verbal-report procedures tend to increase completion time. Use: Schooler’s insight-task result does not establish universal think-aloud impairment; silent protocol is conservative task-specific design. Do not compare silent and verbal completion times as equivalent. Full meta-analysis methods/subgroup estimates not independently read.

### [GUR18] Drachen, Mirza-Babaei & Nacke, editors — methods matched to questions

*Games User Research*. Oxford University Press, 2018.
https://doi.org/10.1093/oso/9780198794844.001.0001
https://academic.oup.com/book/26677
Publisher preview:
https://api.pageplace.de/preview/DT0400.9780192513915_A35502530/preview-9780192513915_A35502530.pdf

**Verified:** publisher metadata, contents, preview foreword. Foreword frames GUR as data-informed feedback to realize the intended player experience. Contents separately cover methods overview (Medlock), surveys (Brühlmann/Mekler), interviewing (Bromley), observation (Sangin), think-aloud (Knoll), RITE (Medlock), reporting (Mirza-Babaei), analytics (Drachen/Connor), biases/test validity (Louvel), accessibility (Gerling/Linehan/Mandryk). **UNVERIFIED:** unread full chapters’ detailed prescriptions. Use: question-driven mix; consult full chapters if institutional access available, not claim the book validates this bespoke instrument.

### [TRUE08] Microsoft — event streams with context

Jun H. Kim, Daniel V. Gunn, Eric Schuh, Bruce C. Phillips, Randy J. Pagulayan, Dennis Wixon. *Tracking Real-Time User Experience (TRUE): A comprehensive instrumentation solution for complex systems*. CHI 2008, pp. 443–452.
https://doi.org/10.1145/1357054.1357126
Author-uploaded full paper:
https://www.researchgate.net/profile/Dennis-Wixon-4/publication/221516745_Tracking_Real-Time_User_Experience_TRUE_A_comprehensive_instrumentation_solution_for_complex_systems/links/54ad8fd10cf2828b29fcad41/Tracking-Real-Time-User-Experience-TRUE-A-comprehensive-instrumentation-solution-for-complex-systems.pdf

**Verified:** fetched paper pp. 443–445 and beginning of visualization section. Instrumentation alone lacks the “why”; time-stamped event streams and contextual event sets more informative than aggregate counters; combine attitude, behavior and video; winning first time can mean boredom, losing can motivate. Use: action/outcome/time streams + separately coded explanation; not a proof that a telemetry change is an insight.

### [BUNGIE] Bungie heatmaps — primary artifact plus clearly secondary case account

Archived Bungie page, third-party mirror of original artifact:
http://bnetarchive.haloman30.com/Stats/halo3/heatmapstatsdea7.html?player=GS%20dark%20shadow

**Verified fetched artifact:** archived page describes individual maps of where players kill/die. **Additional search extraction only:** map/weapon options, last update 2012-03-31. **UNVERIFIED provenance/completeness:** mirror not Bungie-controlled; do not use player identity or sample values. Original official historical route independently linked in contemporary Bungie community post:
https://www.bungie.net/en/Forums/Post/48149043?page=0&path=1&sort=0
That post is player commentary, not a staff research-method publication.

Clive Thompson. *Halo 3: How Microsoft Labs Invented a New Science of Play*. WIRED, 21 August 2007.
https://www.wired.com/2007/08/ff-halo-2

**Verified secondary reporting:** fetched article describes Valhalla death concentrations favoring one base and subsequent terrain adjustment, plus Microsoft/Bungie location/event logging combined with observation. **Not primary research evidence.** Use heatmaps only to locate repeated interaction/spill areas, inspect each tester’s timeline, do not infer attention or frustration from color density. Microsoft’s primary methodological support is [TRUE08], not this press story.

### [PORTAL07] Swift — fresh-player weekly Portal observation

Kim Swift. *Our Journey From Narbacular Drop To Portal*. Independent Games Summit, GDC 2007. Recording uploaded by Simon Carless.
https://www.youtube.com/watch?v=2F0SVZA9fIo

**Verified fetched transcript:** approximately 19:15–21:38 (1155–1298 seconds): playtesting as major design element; weekly Portal testers who had never seen game; observe start-to-finish and body language rather than rely on later praise; start early. At approximately 21:05–21:37 Swift describes testing after about **two weeks**, with one cage room/exit. These timestamps come from fetched transcript, not manual audiovisual review; timing approximate. **UNVERIFIED broader anecdotes:** GLaDOS creation, sterile-wall changes, exact Friday/Monday cadence not independently checked in the primary talk. Do not repeat as established facts. Body language is a cue to ask about, not an emotion detector.

### [D14] Danek et al. — multidimensional aha self-report

Amory H. Danek, Thomas Fraps, Albrecht von Müller, Benedikt Grothe, Michael Öllinger. *It’s a kind of magic—what self-reports can reveal about the phenomenology of insight problem solving*. *Frontiers in Psychology* 5:1408, 2014.
https://doi.org/10.3389/fpsyg.2014.01408
https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.01408/full
https://pmc.ncbi.nlm.nih.gov/articles/PMC4258999/

**Verified:** article/search-extracted methods use 0–100 visual analog ratings of pleasantness, surprise, suddenness, certainty and prior impasse, with verbal anchors. Retrospective ratings concerned magic-trick insight experiences, not validated room-by-room videogame scores. Article reports impasse least strongly endorsed; absence of observable impasse cannot alone disqualify insight. Our room-specific wording/cutoff is an adaptation, never called a validated Danek total score.

### [D17] Danek & Wiley — false insights

Amory H. Danek, Jennifer Wiley. *What about False Insights? Deconstructing the Aha! Experience along Its Multiple Dimensions for Correct and Incorrect Solutions Separately*. *Frontiers in Psychology* 7:2077, 2017.
https://pmc.ncbi.nlm.nih.gov/articles/PMC5247466/

**Verified search extraction:** compares correct and incorrect solutions; aha multidimensional, not equivalent to correctness. **UNVERIFIED full methods:** not fetched in full. Use: retain aha with wrong explanation as a false-insight signal, score understanding independently.

### [NIST] Exact binomial intervals

NIST Dataplot. *Exact Binomial Confidence Limits*.
https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/exacbici.htm

**Verified:** fetched binomial-CDF inversion equations; cautions against symmetric normal-approximation intervals at small n. Our n=5 table computed by stdlib binomial-tail bisection, α=.05, assertions checked. Confidence intervals assume independent Bernoulli trials from a target population; convenience/quota recruitment, correlated rooms, repeated gates and adaptive rounds weaken generalization. Not simultaneous confidence for every threshold.

Reproduce/check the n=5 interval table with stdlib only (no installation, no downloaded code):

```sh
python3 -I - <<'PY'
from math import comb

def cdf(k, p):
    return sum(comb(5, j) * p**j * (1-p)**(5-j) for j in range(k+1))

def inverse(k, target):
    lo, hi = 0.0, 1.0
    for _ in range(100):
        mid = (lo + hi) / 2
        if cdf(k, mid) > target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2

expected = [(0,52.18),(.51,71.64),(5.27,85.34),
            (14.66,94.73),(28.36,99.49),(47.82,100)]
for k, (want_lo, want_hi) in enumerate(expected):
    lower = 0 if k == 0 else inverse(k-1, .975)
    upper = 1 if k == 5 else inverse(k, .025)
    assert abs(lower*100-want_lo) < .0051
    assert abs(upper*100-want_hi) < .0051
    print(f'{k}/5: {lower*100:.2f}–{upper*100:.2f}%')
assert abs(inverse(0,.025) - (1-.025**.2)) < 1e-12
print('Checks passed')
PY
```

### [IMI] Enjoyment, competence, perceived choice

Center for Self-Determination Theory. *Intrinsic Motivation Inventory*, official complete instrument/instructions.
https://selfdeterminationtheory.org/intrinsic-motivation-inventory/
https://selfdeterminationtheory.org/wp-content/uploads/2022/02/IMI_Complete.pdf

**Verified:** fetched full description/items/scoring. Seven-point response anchors; reverse coding `8−response`; average within subscale; multiple items outperform single items. Self-report and free-choice behavior need not agree; pressured persistence possible. Our four-item-per-construct short adaptation is not psychometrically validated at n=5. Perceived choice about joining a study is not equivalent to autonomy of in-game strategy; protocol separates these.

## [CODE] Repository evidence (local primary implementation)

Reviewed baseline: `f858bc05137da74008cf07912086abda38b4f67e`. Repository remained read-only. Use absolute local paths below; line numbers refer to that revision.

- `src/routes/game/types.ts:227–239`: `Action` union, including stir and pour positions.
- Same file `:261–294`, `:296–312`: view and game-event contracts. `stuck` means resource impossibility, not psychological impasse.
- `src/routes/game/model.ts:381–509`: model action validation; stir intentionally returns no game event; same-spring moves do not produce new pour event.
- Same file `:549–580`: per-tick emission, empty-well stop. `:591–595`: sensor timestamp handling. `:649–665`: simultaneous urn hold/clear. `:691–725`: conservative resource-impossibility stuck detector.
- `src/routes/game/runtime.ts:97–114`: internal stop/state changes; `:130–164`: initialization/restart; `:173–190`: capped wall-time accumulator, coupling and sensor observation; `:225–271`: runtime input/lifecycle/scale/dispose. Simulation ticks are not wall-clock elapsed time.
- `src/routes/+page.svelte:111–145`, `:164`, `:185`: UI action/event wiring, restart, hints outside runtime, hint counter resets on close/restart.
- `src/routes/game/levels.ts:132–294`: existing three-room rules, hints and authored solutions. These ground example answer keys, not a claim that a v3 room exists.
- svelte-fluid `src/lib/engine/liquid/LiquidEngine.ts:411–418`: build requires `EXT_color_buffer_float`, `EXT_float_blend`, and `supportRenderTextureFormat(gl, gl.RGBA32F, gl.RGBA, gl.FLOAT)`; failure throws `WebGLUnavailableError`. Remote preflight must exercise actual allocation/rendering, not assert extension strings suffice. Capability-only test page is a proposed implementation requirement, not a verified existing route.
