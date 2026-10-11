/**
 * AI Gesture Runner 3D - GameStateMachine
 * Enforces valid state transitions across application lifecycle.
 */

import { GlobalEvents, EVENTS } from './EventBus.js';

export const GAME_STATES = {
  LOADING: 'LOADING',
  MENU: 'MENU',
  CAMERA_SETUP: 'CAMERA_SETUP',
  TUTORIAL: 'TUTORIAL',
  COUNTDOWN: 'COUNTDOWN',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  RESULTS: 'RESULTS'
};

export class GameStateMachine {
  constructor(initialState = GAME_STATES.LOADING) {
    this.currentState = initialState;
    this.previousState = null;

    // Transition graph for strict safety
    this.allowedTransitions = {
      [GAME_STATES.LOADING]: [GAME_STATES.MENU, GAME_STATES.CAMERA_SETUP],
      [GAME_STATES.MENU]: [GAME_STATES.CAMERA_SETUP, GAME_STATES.TUTORIAL, GAME_STATES.RESULTS, GAME_STATES.COUNTDOWN],
      [GAME_STATES.CAMERA_SETUP]: [GAME_STATES.MENU, GAME_STATES.TUTORIAL, GAME_STATES.COUNTDOWN],
      [GAME_STATES.TUTORIAL]: [GAME_STATES.MENU, GAME_STATES.CAMERA_SETUP, GAME_STATES.COUNTDOWN],
      [GAME_STATES.COUNTDOWN]: [GAME_STATES.RUNNING, GAME_STATES.MENU],
      [GAME_STATES.RUNNING]: [GAME_STATES.PAUSED, GAME_STATES.GAME_OVER],
      [GAME_STATES.PAUSED]: [GAME_STATES.RUNNING, GAME_STATES.MENU, GAME_STATES.COUNTDOWN],
      [GAME_STATES.GAME_OVER]: [GAME_STATES.COUNTDOWN, GAME_STATES.MENU, GAME_STATES.RESULTS],
      [GAME_STATES.RESULTS]: [GAME_STATES.MENU, GAME_STATES.COUNTDOWN, GAME_STATES.CAMERA_SETUP]
    };
  }

  getState() {
    return this.currentState;
  }

  canTransitionTo(nextState) {
    const allowed = this.allowedTransitions[this.currentState];
    return allowed && allowed.includes(nextState);
  }

  transition(nextState, context = {}) {
    if (this.currentState === nextState) return true;

    if (!this.canTransitionTo(nextState)) {
      console.warn(`[GameStateMachine] Invalid transition from ${this.currentState} to ${nextState}`);
      return false;
    }

    this.previousState = this.currentState;
    this.currentState = nextState;

    console.log(`[GameStateMachine] State Changed: ${this.previousState} -> ${this.currentState}`);
    GlobalEvents.emit(EVENTS.STATE_CHANGED, {
      from: this.previousState,
      to: this.currentState,
      context
    });

    return true;
  }
}
