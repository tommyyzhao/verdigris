import type { Level } from './types.js';
import firstRain from './rooms/first-rain.js';
import breath from './rooms/breath.js';
import hiddenDraft from './rooms/hidden-draft.js';
import stillPond from './rooms/still-pond.js';
import twoSprings from './rooms/two-springs.js';
import bringItBack from './rooms/bring-it-back.js';
export { default as SANDBOX } from './rooms/free-garden.js';
export { sweep } from './rooms/kit.js';

export const LEVELS: readonly Level[] = [firstRain, breath, hiddenDraft, stillPond, twoSprings, bringItBack];
