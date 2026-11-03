import test from 'node:test';
import assert from 'node:assert/strict';
import { createLife, getNpcContext } from './index.js';
import { advanceWithNpcSchedules } from './npc-schedule.js';
import { npcDialogueMemories } from './dialogue-memory.js';
const plans=[{npcId:'friend',minuteOfDay:480,detail:'친구가 도서관에서 책을 골랐다.',observers:['witness']}];
test('Time advance records a due event at its actual game time for actor and witness',()=>{
 const initial=createLife({npcIds:['friend','witness','other']});
 const state=advanceWithNpcSchedules(initial,540,plans);
 assert.equal(state.minute,540);assert.equal(initial.minute,420);
 assert.equal(getNpcContext(state,'friend').memories[0].minute,480);
 assert.equal(getNpcContext(state,'witness').memories[0].channel,'observed');
 assert.deepEqual(npcDialogueMemories(state,'other'),[]);
 assert.match(npcDialogueMemories(state,'friend')[0].text,/도서관/);
});
test('Saved state and repeated advances do not duplicate a past occurrence',()=>{
 let state=createLife({npcIds:['friend','witness']});
 state=advanceWithNpcSchedules(state,480,plans);
 state=JSON.parse(JSON.stringify(state));
 state=advanceWithNpcSchedules(state,480,plans);
 assert.equal(getNpcContext(state,'friend').memories.length,1);
 state=advanceWithNpcSchedules(state,1920,plans);
 assert.deepEqual(getNpcContext(state,'friend').memories.map(x=>x.minute),[480,1920]);
});
test('Invalid or conflicting plans cannot partially change the input state',()=>{
 const state=createLife({npcIds:['friend','witness']});const before=structuredClone(state);
 assert.throws(()=>advanceWithNpcSchedules(state,540,[...plans,{...plans[0],detail:'다른 장소'}]));
 assert.throws(()=>advanceWithNpcSchedules(state,540,[{...plans[0],observers:['missing']}]));
 assert.throws(()=>advanceWithNpcSchedules(state,419,plans));
 assert.deepEqual(state,before);
});
