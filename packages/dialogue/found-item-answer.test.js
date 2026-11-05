import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,applyAction} from '../simulation/index.js';
import {answerConfirmedReturn} from './found-item-answer.js';
const p={kind:'player'},n={kind:'npc',id:'n'};
const event=(state,actor=p,owner=n,item='책')=>applyAction(state,{type:'found_item_returned',actor,owner,item,observers:[]});
const query=(state,playerText,speech='casual')=>answerConfirmedReturn({lifeState:state,npc:{id:'n'},player:{id:'p',name:'준호'},playerText,speech});
test('A unique verified event answers with the correct actor, owner, register and item grammar',()=>{
 let s=applyAction(event(createLife({npcIds:['n']})),{type:'sleep'});
 assert.equal(query(s,'어제 책을 주운 거 기억나?'),'응, 네가 내 책을 주워줬어.');
 assert.equal(query(s,'네가 내 책을 주워줬잖아.'),'내 기억엔 네가 내 책을 주워줬어.');
 assert.equal(query(s,'누가 누구 책을 주운 거였지?','polite'),'제 책은 준호 님이 주워주셨어요.');
 let reverse=event(createLife({npcIds:['n']}),n,p,'모자');
 assert.equal(query(reverse,'누가 모자를 주웠어?'),'내가 네 모자를 주워줬어.');
 assert.equal(query(reverse,'누가 모자를 주웠어요?','polite'),'제 기억에는 제가 준호 님의 모자를 주워드렸어요.');
});
test('Requests, different topics, wrong dates and missing or competing records are not converted into facts',()=>{
 let s=applyAction(event(createLife({npcIds:['n']})),{type:'sleep'});
 for(const text of ['책 주워줘','내일 책 주워줄래?','책 찢은 거 기억나?','민수가 책 주운 거 기억나?', '누가 친구 책을 주운 거였지?','책 주울 때 기분 어땠어?','오늘 책 주운 거 기억나?','지난주 책 주운 거 기억나?','우산 주운 거 기억나?']) assert.equal(query(s,text),null,text);
 const withOther=applyAction(s,{type:'important_event',detail:'친구가 책을 찢었다.',observers:['n']});
 assert.equal(query(withOther,'어제 책 얘기 기억나?'),null);
 s=event(s,n,p,'책');assert.equal(query(s,'누가 책 주운 거였지?'),null);
 assert.equal(query(createLife({npcIds:['n']}),'책 주운 거 기억나?'),null);
});

test('Natural explicit owner and return questions use only a unique player/NPC record',()=>{
  const namedQuery=(state,playerText,speech='casual')=>answerConfirmedReturn({lifeState:state,npc:{id:'n',name:'서윤'},player:{id:'p',name:'준호'},playerText,speech});
  const notebook=event(createLife({npcIds:['n','other']}),p,n,'초록 수첩');
  assert.equal(namedQuery(notebook,'이 초록 수첩 주워 왔는데 서윤님 물건인가요?','polite'),'제 초록 수첩은 준호 님이 주워주셨어요.');
  const nextDay=applyAction(notebook,{type:'sleep'});
  assert.equal(namedQuery(nextDay,'어제 그 초록 수첩, 누가 누구 물건을 돌려준 거였죠?','polite'),'제 초록 수첩은 준호 님이 주워주셨어요.');
  const umbrella=event(createLife({npcIds:['n','other']}),n,p,'파란 우산');
  assert.equal(namedQuery(umbrella,'내 파란 우산! 네가 찾아서 돌려준 거야?'),'내 기억엔 내가 네 파란 우산을 주워줬어.');
  for(const text of ['민수가 초록 수첩 주워 왔는데 서윤님 물건인가요?','그 수첩 누가 누구 물건을 돌려준 거였죠?','내일 그 초록 수첩 돌려준 거였죠?']) assert.equal(namedQuery(notebook,text,'polite'),null,text);
  const novel=event(createLife({npcIds:['n','other']}),p,n,'연두색 파일');
  assert.equal(namedQuery(novel,'이 연두색 파일 주워 왔는데 서윤님 물건인가요?','polite'),'제 연두색 파일은 준호 님이 주워주셨어요.');
  const other=applyAction(notebook,{type:'important_event',detail:'누군가 초록 수첩을 옮겼다.',observers:['n']});
  assert.equal(namedQuery(other,'이 초록 수첩 주워 왔는데 서윤님 물건인가요?','polite'),null);
});

test('Explicit natural item-role questions use the verified event, including false claims',()=>{
  const q=(state,text,speech='casual',npcId='n')=>answerConfirmedReturn({lifeState:state,npc:{id:npcId,name:'서빈'},player:{id:'p',name:'지후'},playerText:text,speech});
  const scarf=event(createLife({npcIds:['n','other']}),p,n,'연두색 목도리');
  assert.equal(q(scarf,'이 연두색 목도리 주웠어요. 서빈님 것 맞나요?','polite'),'제 연두색 목도리는 지후 님이 주워주셨어요.');
  assert.equal(q(scarf,'이 연두색 목도리 주웠어요. 서빈님 것 맞나요?','polite','other'),null);
  const nextDay=applyAction(scarf,{type:'sleep'});
  assert.equal(q(nextDay,'어제 연두색 목도리를 찾아 돌려준 건 누구였죠?','polite'),'제 연두색 목도리는 지후 님이 주워주셨어요.');
  assert.equal(q(scarf,'어제 연두색 목도리를 찾아 돌려준 건 누구였죠?','polite'),null);
  const keyring=event(createLife({npcIds:['n']}),n,p,'남색 열쇠고리');
  assert.equal(q(keyring,'이 남색 열쇠고리, 네가 주워서 내게 돌려준 거지?'),'내 기억엔 내가 네 남색 열쇠고리를 주워줬어.');
  assert.equal(q(createLife({npcIds:['n']}),'이 남색 열쇠고리, 네가 주워서 내게 돌려준 거지?'),null);
  assert.equal(q(keyring,'이 남색 열쇠고리, 민수가 주워서 내게 돌려준 거지?'),null);
  assert.equal(q(event(keyring,p,n,'남색 열쇠고리'),'이 남색 열쇠고리, 네가 주워서 내게 돌려준 거지?'),null);
});

test('Unique short item references answer only the participant-visible record',()=>{
  const q=(state,text,npcId='n')=>answerConfirmedReturn({lifeState:state,npc:{id:npcId,name:'라은'},player:{id:'p',name:'도윤'},playerText:text,speech:npcId==='n'?'polite':'casual'});
  const flashlight=event(createLife({npcIds:['n','other']}),n,p,'검정 손전등');
  assert.equal(q(flashlight,'제가 손전등을 찾아서 라은님께 돌려드린 거였죠?'),'제 기억에는 제가 도윤 님의 검정 손전등을 주워드렸어요.');
  const nextDay=applyAction(flashlight,{type:'sleep'});
  assert.equal(q(nextDay,'어제 손전등은 누가 찾아 누구에게 돌려줬나요?'),'제 기억에는 제가 도윤 님의 검정 손전등을 주워드렸어요.');
  assert.equal(q(flashlight,'어제 손전등은 누가 찾아 누구에게 돌려줬나요?'),null);
  assert.equal(q(nextDay,'어제 손전등은 누가 찾아 누구에게 돌려줬나요?','other'),null);
  const notebook=event(createLife({npcIds:['n']}),p,n,'녹색 수첩');
  assert.equal(q(notebook,'그 수첩은 네가 찾아서 내게 돌려준 거 맞지?'),'제 녹색 수첩은 도윤 님이 주워주셨어요.');
  assert.equal(q(event(flashlight,p,n,'빨강 손전등'),'제가 손전등을 찾아서 라은님께 돌려드린 거였죠?'),null);
  const unrelated=applyAction(flashlight,{type:'important_event',detail:'다른 손전등을 보관했다.',observers:['n']});
  assert.equal(q(unrelated,'제가 손전등을 찾아서 라은님께 돌려드린 거였죠?'),null);
});
