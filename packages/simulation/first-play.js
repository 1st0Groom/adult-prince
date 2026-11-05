import { applyAction, createLife } from './index.js';
import { updateSocialState } from './social-state.js';
import { applyTrainingAction, createTraining, getTrainingContext } from './training.js';

const dayMinutes = 1440;
const arrivalWindow = 30;
const center = 'training-center';
const locations = ['home', 'school', center];
const placeName = '교육장';
const slotTimes = new Map([['morning', 600], ['afternoon', 840]]);
const clock = at => [Math.floor(at % dayMinutes / 60), at % 60].map(n => String(n).padStart(2, '0')).join(':');
const scheduled = state => state.life.appointments.find(row => row.status === 'pending') ?? null;

export function createFirstPlay() {
  return { version: 1, life: createLife({ npcIds: ['friend', 'mentor'] }),
    place: 'home', invitation: 'unseen', offerDay: null, social: null, training: null };
}

export function getFirstPlayContext(state) {
  return {
    place: state.place, invitation: state.invitation,
    appointment: structuredClone(scheduled(state)),
    slots: state.invitation === 'offered' || state.invitation === 'confirmed'
      ? [...slotTimes].map(([id, minute]) => ({ id, at: state.offerDay * dayMinutes + minute, time: clock(minute) }))
        .filter(slot => slot.at > state.life.minute)
      : [],
    original: state.social ? structuredClone(state.social.originalAgreement) : null,
    belief: state.social ? structuredClone(state.social.belief) : null,
    training: state.training ? getTrainingContext(state.training) : null,
  };
}

export function applyFirstPlayAction(state, action) {
  if (!action || typeof action.type !== 'string') throw new Error('Invalid first-play action');
  const next = structuredClone(state);
  const appointment = scheduled(next);
  switch (action.type) {
    case 'ask-about-experience':
      if (next.training) throw new Error('Training already started');
      if (appointment && next.life.minute < appointment.at + arrivalWindow) return next;
      if (appointment) appointment.status = 'missed';
      next.invitation = 'offered';
      next.offerDay = Math.floor(next.life.minute / dayMinutes) + 1;
      break;
    case 'decline':
    case 'defer':
      if (next.invitation !== 'offered') throw new Error('No open offer');
      next.invitation = action.type === 'decline' ? 'declined' : 'deferred';
      break;
    case 'confirm-slot': {
      if (!['offered', 'confirmed'].includes(next.invitation) || next.training || !slotTimes.has(action.slot)) {
        throw new Error('No selectable slot');
      }
      const at = next.offerDay * dayMinutes + slotTimes.get(action.slot);
      if (at === appointment?.at && at > next.life.minute) return next;
      if (at <= next.life.minute) throw new Error('Slot has passed');
      if (appointment) appointment.status = 'replaced';
      next.life = applyAction(next.life, { type: 'appointment', id: `training-${next.life.events.length + 1}`,
        npcId: 'friend', at, place: placeName });
      const agreement = { time: clock(at), place: placeName };
      next.social = next.social
        ? updateSocialState(next.social, { type: 'agree', ...agreement, playerAccepted: true, npcAccepted: true })
        : { originalAgreement: agreement, agreement, belief: { time: agreement.time, source: 'original-agreement', confidence: 'high' }, history: [] };
      next.invitation = 'confirmed';
      break;
    }
    case 'report-calendar':
      if (!appointment || !next.social) throw new Error('No appointment to discuss');
      next.social = updateSocialState(next.social, { type: 'believe-player', time: action.time, source: 'player-calendar-claim' });
      break;
    case 'cancel':
      if (!appointment || next.training) throw new Error('No pending appointment');
      appointment.status = 'cancelled';
      next.invitation = 'cancelled';
      break;
    case 'move':
      if (!locations.includes(action.place)) throw new Error('Unknown location');
      next.place = action.place;
      break;
    case 'wait':
      if (!Number.isSafeInteger(action.minutes) || action.minutes <= 0) throw new Error('Invalid wait duration');
      next.life = applyAction(next.life, { type: 'activity', activityId: 'wait', minutes: action.minutes });
      if (appointment && next.life.minute >= appointment.at + arrivalWindow) {
        scheduled(next).status = 'missed';
        next.invitation = 'missed';
      }
      break;
    case 'enter-training':
      if (next.training || next.place !== center || !appointment ||
          next.life.minute < appointment.at || next.life.minute >= appointment.at + arrivalWindow) {
        throw new Error('Training requires an active reservation, its arrival window and the training center');
      }
      appointment.status = 'attended';
      next.life = applyAction(next.life, { type: 'visit', npcId: 'mentor' });
      next.training = createTraining();
      next.invitation = 'attended';
      break;
    case 'training-action':
      if (!next.training || next.place !== center) throw new Error('Training is unavailable here');
      next.training = applyTrainingAction(next.training, action.action);
      break;
    default:
      throw new Error('Unsupported first-play action');
  }
  return next;
}
