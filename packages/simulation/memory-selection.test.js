import test from 'node:test';
import assert from 'node:assert/strict';
import { createLife,applyAction } from './index.js';
import { npcDialogueMemories,selectNpcDialogueMemories,selectNpcDialogueMemoryResult } from './dialogue-memory.js';
test('An old relevant memory and recent activities fit in a bounded view',()=>{
 let state=createLife({npcIds:['friend','other']});
 state=applyAction(state,{type:'important_event',detail:'민수가 친구에게 우산을 빌려줬다.',observers:['friend']});
 for(let i=0;i<12;i++)state=applyAction(state,{type:'npc_activity',npcId:'friend',detail:`친구가 일상 활동 ${i}를 했다.`,observers:[]});
 const before=structuredClone(state);
 const selected=selectNpcDialogueMemories(state,'friend','예전에 빌려준 우산은 기억나?',{limit:4,recent:2});
 assert.equal(selected.length,4);assert.ok(selected.some(x=>x.text.includes('우산')));
 assert.ok(selected.some(x=>x.text.includes('활동 11')));assert.ok(selected.some(x=>x.text.includes('활동 10')));
 assert.equal(npcDialogueMemories(state,'friend').length,13);assert.deepEqual(state,before);
 assert.deepEqual(selectNpcDialogueMemories(state,'other','우산은?'),[]);
});
test('A shared date label cannot outweigh an old matching event',()=>{
 let state=createLife({npcIds:['friend']});
 state=applyAction(state,{type:'npc_activity',npcId:'friend',detail:'친구가 도서관에 갔다.',observers:[]});
 state=applyAction(state,{type:'sleep'});
 for(let i=0;i<5;i++)state=applyAction(state,{type:'npc_activity',npcId:'friend',detail:`친구가 운동 ${i}를 했다.`,observers:[]});
 const selected=selectNpcDialogueMemories(state,'friend','오늘 도서관에 갔어?',{limit:2,recent:1});
 assert.ok(selected.some(x=>x.text.includes('도서관')));
});
test('Invalid bounds are rejected and empty searches select recent records',()=>{
 let state=createLife({npcIds:['friend']});
 for(let i=0;i<5;i++)state=applyAction(state,{type:'npc_activity',npcId:'friend',detail:`일상 ${i}`,observers:[]});
 assert.deepEqual(selectNpcDialogueMemories(state,'friend','',{limit:2,recent:1}).map(x=>x.text.includes('일상 4')),[false,true]);
 assert.throws(()=>selectNpcDialogueMemories(state,'friend','안녕',{limit:1,recent:2}));
});
test('An explicit reference can use only the latest visible, non-sensitive conversation as a clue',()=>{
 let state=createLife({npcIds:['friend']});
 state=applyAction(state,{type:'npc_activity',npcId:'friend',detail:'친구가 도서관에 갔다.',observers:[]});
 for(let i=0;i<8;i++)state=applyAction(state,{type:'npc_activity',npcId:'friend',detail:`일상 ${i}`,observers:[]});
 const options={limit:3,recent:1,history:[{role:'user',text:'도서관 이야기인데',knownBy:['friend']},{role:'assistant',text:'응',knownBy:['friend']}]};
 assert.ok(selectNpcDialogueMemories(state,'friend','거기 언제 갔어?',options).some(x=>x.text.includes('도서관')));
 options.history[0].knownBy=['other'];
 assert.equal(selectNpcDialogueMemories(state,'friend','거기 언제 갔어?',options).some(x=>x.text.includes('도서관')),false);
 options.history[0].knownBy=['friend'];options.history[0].sensitive=true;
 assert.equal(selectNpcDialogueMemories(state,'friend','거기 언제 갔어?',options).some(x=>x.text.includes('도서관')),false);
 options.history[0].sensitive=false;
 assert.equal(selectNpcDialogueMemories(state,'friend','밥 먹었어?',options).some(x=>x.text.includes('도서관')),false);
});
test('A reference to two equally plausible past topics is flagged rather than arbitrarily selecting one',()=>{
 let state=createLife({npcIds:['friend']});
 state=applyAction(state,{type:'npc_activity',npcId:'friend',detail:'친구가 우산을 빌렸다.',observers:[]});
 state=applyAction(state,{type:'npc_activity',npcId:'friend',detail:'친구가 카메라를 빌렸다.',observers:[]});
 for(let i=0;i<5;i++)state=applyAction(state,{type:'npc_activity',npcId:'friend',detail:`일상 ${i}`,observers:[]});
 const history=[{role:'user',text:'우산과 카메라 이야기야',knownBy:['friend']}];
 const result=selectNpcDialogueMemoryResult(state,'friend','그거 기억나?',{limit:3,recent:1,history});
 assert.equal(result.resolution,'ambiguous');
 assert.equal(result.memories.some(x=>x.text.includes('우산')||x.text.includes('카메라')),false);
 const missing=selectNpcDialogueMemoryResult(state,'friend','그거 기억나?',{limit:3,recent:1});
 assert.equal(missing.resolution,'no-match');
});
