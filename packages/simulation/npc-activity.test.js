import test from 'node:test';
import assert from 'node:assert/strict';
import { createLife, applyAction, getNpcContext } from './index.js';
import { npcDialogueMemories } from './dialogue-memory.js';
test('NPC personal activity is remembered by actor and witnesses, not everyone', () => {
 const initial=createLife({npcIds:['actor','witness','other']});
 const state=applyAction(initial,{type:'npc_activity',npcId:'actor',detail:'도서관에서 책을 골랐다',observers:['witness','actor','witness']});
 assert.equal(getNpcContext(state,'actor').memories[0].channel,'experienced');
 assert.equal(getNpcContext(state,'witness').memories.length,1);
 assert.equal(getNpcContext(state,'witness').memories[0].channel,'observed');
 assert.deepEqual(getNpcContext(state,'other').memories,[]);
 assert.match(npcDialogueMemories(state,'actor')[0].text,/내가 직접 한 일/);
 assert.match(npcDialogueMemories(state,'witness')[0].text,/내가 본 일/);
 assert.deepEqual(npcDialogueMemories(state,'other'),[]);
 assert.deepEqual(initial.events,[]);
 assert.throws(()=>applyAction(state,{type:'npc_activity',npcId:'actor',detail:'일',observers:['missing']}));
});
