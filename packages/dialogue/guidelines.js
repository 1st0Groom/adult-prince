import { readFileSync } from 'node:fs';

// Shared verbatim with the training experiment; scenario details are separate.
export const NPC_GUIDELINES = readFileSync(new URL('../../config/npc-dialogue-guidelines.txt', import.meta.url), 'utf8').trim();
