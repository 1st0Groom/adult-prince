import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFactAwareTurn } from './fact-answers.js';

test('Free dialogue adapter receives only visible records and no unrelated state', async () => {
  const input = { npc:{id:'n',name:'지우',secret:'내부'}, player:{id:'p',name:'민수'}, playerText:'안녕', speech:'casual',
    facts:[{id:'a',text:'공개',knownBy:['n']},{id:'b',text:'타인 비밀',knownBy:['other']},{id:'c',text:'민감',knownBy:['n'],sensitive:true}],
    memories:[], history:[{role:'user',text:'다른 대화',knownBy:['other']}], interactions:[], loans:[],
    socialState:{knownBy:['other'],state:{belief:{time:'비밀 시간'}}}, debugSecret:'내부 전체 정보' };
  const before=structuredClone(input);
  const result=await generateFactAwareTurn(input,{classify:async()=>'{"index":0}',freeDialogue:async view=>{
    const text=JSON.stringify(view);
    for(const secret of ['타인 비밀','민감','다른 대화','비밀 시간','내부']) assert.equal(text.includes(secret),false);
    assert.equal(view.facts[0].text,'공개');return '안녕!';
  }});
  assert.equal(result.text,'안녕!');assert.deepEqual(input,before);
});
