import test from 'node:test';
import assert from 'node:assert/strict';
import { compareClaim } from './claims.js';
const fact={id:'book',key:'book-picker',value:'player',text:'상대가 내 책을 주워줬다',knownBy:['npc']};
test('claim checks distinguish known conflict, agreement and unknown',()=>{
 assert.equal(compareClaim('npc',{key:'book-picker',value:'npc'},[fact]).status,'conflict');
 assert.equal(compareClaim('npc',{key:'book-picker',value:'player'},[fact]).status,'consistent');
 assert.deepEqual(compareClaim('other',{key:'book-picker',value:'npc'},[fact]),{status:'unknown'});
 assert.deepEqual(compareClaim('npc',{key:'book-picker',value:'npc'},[{...fact,sensitive:true}]),{status:'unknown'});
});
test('conflicting records do not establish a single truth',()=>{
 assert.equal(compareClaim('npc',{key:'book-picker',value:'npc'},[fact,{...fact,value:'other'}]).status,'ambiguous');
});
