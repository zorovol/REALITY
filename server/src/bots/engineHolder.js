/** @type {import('./engine.js').UserBotEngine | null} */
let engine = null;

export function setUserBotEngine(instance) {
  engine = instance;
}

export function getUserBotEngine() {
  return engine;
}
