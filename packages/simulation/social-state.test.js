import test from 'node:test';
import assert from 'node:assert/strict';
import {createSocialState,updateSocialState} from './social-state.js';
test('Believing a player preserves original facts and does not reschedule',()=>{
 const original=createSocialState();
 const next=updateSocialState(original,{type:'believe-player',time:'15:00',source:'player-calendar-claim'});
 assert.equal(next.belief.time,'15:00'); assert.equal(next.agreement.time,'16:00');
 assert.deepEqual(next.originalAgreement,original.originalAgreement);assert.equal(original.belief.time,'16:00');
 assert.deepEqual(JSON.parse(JSON.stringify(next)),next);
});
test('Only mutual agreement reschedules; saved provenance survives reload',()=>{
 const original=createSocialState();
 assert.throws(()=>updateSocialState(original,{type:'agree',time:'15:00',place:'공원 입구',playerAccepted:true}));
 const saved=JSON.parse(JSON.stringify(updateSocialState(original,{type:'agree',time:'15:00',place:'공원 입구',playerAccepted:true,npcAccepted:true})));
 assert.equal(saved.agreement.time,'15:00');assert.equal(saved.originalAgreement.time,'16:00');
 assert.equal(saved.belief.source,'new-mutual-agreement');assert.equal(saved.history.length,1);
});
