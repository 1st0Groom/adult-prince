import { createLife, applyAction } from '../packages/simulation/index.js';
import { npcDialogueMemories, selectNpcDialogueMemories } from '../packages/simulation/dialogue-memory.js';
const cases = [
 ['exact','유나는 민수에게 우산을 빌렸다.','오늘 우산은 어디 있어?'],
 ['exact','유나는 도서관에서 책을 골랐다.','오늘 도서관에 갔어?'],
 ['exact','유나는 농구 연습을 했다.','오늘 농구는 재밌었어?'],
 ['exact','유나는 민수와 공원에서 만났다.','오늘 공원에 갔었어?'],
 ['paraphrase','유나는 민수에게 우산을 빌렸다.','오늘 비를 막는 물건을 빌린 거 기억해?'],
 ['paraphrase','유나는 도서관에서 책을 골랐다.','오늘 책 빌리는 곳에 갔어?'],
 ['paraphrase','유나는 농구 연습을 했다.','오늘 공을 골대에 넣는 운동 했어?'],
 ['paraphrase','유나는 제과점에서 빵을 샀다.','오늘 베이커리에 들렀어?'],
 ['implicit','유나는 민수에게 우산을 빌렸다.','오늘 그거 빌린 거 기억해?'],
 ['implicit','유나는 도서관에서 책을 골랐다.','오늘 거기 갔다 왔어?'],
 ['implicit','유나는 농구 연습을 했다.','오늘 그거 해봤어?'],
 ['implicit','유나는 제과점에서 빵을 샀다.','오늘 그거 샀어?']
];
function previous(state, query) {
 const memories=npcDialogueMemories(state,'yuna');
 const terms=[...new Set((query.toLowerCase().match(/[가-힣a-z0-9]+/g)??[]).map(x=>x.replace(/(에서|에게|한테|으로|은|는|이|가|을|를|에|과|와|도|만|의)$/,'')).filter(x=>x.length>=2))];
 const selected=new Set([memories.length-2,memories.length-1]);
 const ranked=memories.map((m,index)=>({index,score:terms.filter(t=>m.text.toLowerCase().includes(t)).length})).sort((a,b)=>b.score-a.score||b.index-a.index);
 for(const candidate of ranked){if(selected.size>=4)break;selected.add(candidate.index);}
 return [...selected].map(i=>memories[i]);
}
for(const [category,detail,query] of cases){
 let state=createLife({npcIds:['yuna']});
 state=applyAction(state,{type:'npc_activity',npcId:'yuna',detail,observers:[]});
 const target=state.npcs.yuna.memories[0].eventId;
 for(let i=0;i<12;i++)state=applyAction(state,{type:'npc_activity',npcId:'yuna',detail:`유나는 일상 활동 ${i}를 했다.`,observers:[]});
 const old=previous(state,query).some(x=>x.id===target);
 const now=selectNpcDialogueMemories(state,'yuna',query,{limit:4,recent:2}).some(x=>x.id===target);
 console.log(JSON.stringify({category,query,old,now}));
}
