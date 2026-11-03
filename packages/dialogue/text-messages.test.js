import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTextMessages } from './text-messages.js';
const input={npc:{id:'npc',name:'지우',character:'차분함'},player:{name:'민수'},relationship:{kind:'친한 친구',sharedPast:'학교 축제'},scene:{place:'학교'},facts:[],memories:[],history:[{role:'user',text:'사진 동아리 관심',knownBy:['npc']},{role:'user',text:'보여주면 안 되는 대화',knownBy:['other']}],allowedChoices:[],playerText:'내 관심사 기억해?'};
test('relationship and visible history are transmitted without hidden history',()=>{
 const messages=buildTextMessages(input);
 assert.match(messages[0].content,/친한 친구/);
 assert.match(messages[0].content,/학교 축제/);
 assert.equal(messages.length,3);
 assert.equal(messages[1].content,'사진 동아리 관심');
 assert.equal(JSON.stringify(messages).includes('보여주면 안 되는 대화'),false);
});
test('text dialogue requires explicit relationship',()=>{
 assert.throws(()=>buildTextMessages({...input,relationship:undefined}));
});
