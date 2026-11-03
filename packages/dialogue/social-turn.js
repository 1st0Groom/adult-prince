import {resolveSpeech} from '../simulation/speech-policy.js';
import {generateSpeechResponse} from './speech-response.js';
// speechAction comes from the game or a separately validated classifier.
// Unknown free text must not silently become a rude action.
export async function generateSocialTurn({state,speechAction,style='firm',playerText}, {selectExpression,freeDialogue}) {
 const decision=resolveSpeech(state,speechAction);
 const reply=await generateSpeechResponse({reaction:decision.reaction,style,playerText},selectExpression);
 if(reply.mode==='free-dialogue') {
  return {state:decision.state,reaction:decision.reaction,mode:reply.mode,text:await freeDialogue(playerText),fallback:false};
 }
 return {state:decision.state,reaction:decision.reaction,...reply};
}
