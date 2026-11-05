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

test('Game-confirmed shared-history absence survives routing to the free dialogue view', async () => {
  const input={npc:{id:'n',name:'수아'},player:{id:'p',name:'현우'},speech:'polite',playerText:'지난달에 제 이사를 도와주셔서 고마웠어요.',
    personality:'차분하다',relationship:'오늘 처음 대면',stage:'자연스럽게 응답한다',scene:{place:'학교'},
    facts:[],memories:[],history:[],interactions:[],allowedChoices:[],confirmedNoSharedPast:true};
  const result=await generateFactAwareTurn(input,{classify:async()=>'{"index":0}',freeDialogue:async view=>{
    assert.equal(view.confirmedNoSharedPast,true);
    const {buildGroundedMessages}=await import('./grounded-messages.js');
    assert.match(buildGroundedMessages(view)[0].content,/과거에 어떤 일도 함께한 적이 없다/);
    return '다른 분과 헷갈리신 걸까요?';
  }});
  assert.equal(result.mode,'free-dialogue');
});
