import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBeliefMessages} from './belief-messages.js';
const base={npc:{id:'n',name:'지우',character:'차분함'},personality:'유연함',relationship:'친구',stage:'약속 확인',scene:{place:'학교'},facts:[],memories:[],history:[{role:'user',text:'둘만의 대화',knownBy:['n']},{role:'user',text:'다른 사람의 비밀',knownBy:['other']}],allowedChoices:[],playerText:'몇 시지?'};
test('belief dialogue passes personality, scene and visible history only',()=>{
 const messages=buildBeliefMessages(base);
 assert.match(messages[0].content,/유연함/);
 assert.match(messages[0].content,/생각을 바꾸는 것은 가능/);
 assert.equal(messages[1].content,'둘만의 대화');
 assert.equal(JSON.stringify(messages).includes('다른 사람의 비밀'),false);
});
test('belief dialogue requires stage and personality',()=>{
 assert.throws(()=>buildBeliefMessages({...base,stage:undefined}));
 assert.throws(()=>buildBeliefMessages({...base,personality:undefined}));
});
