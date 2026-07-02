import { callProvider } from './providers.js';
import { personaLine } from './persona.js';

/**
 * Unified agent "brain" for the live world.
 * Builds full character context (personality + hidden motivation + long-term
 * memory + relationship network + current world arc) and asks the assigned
 * provider for a line. If the provider is unavailable, slow, or fails, the
 * persona engine answers in-character instead — the world never stalls.
 */

function describePersonality(p) {
  const scale = (v) => (v > 0.75 ? 'very high' : v > 0.5 ? 'high' : v > 0.3 ? 'moderate' : 'low');
  return [
    `aggression: ${scale(p.aggression)}`,
    `emotional stability: ${scale(p.emotionalStability)}`,
    `manipulation skill: ${scale(p.manipulation)}`,
    `loyalty: ${scale(p.loyalty)}`,
    `intelligence: ${scale(p.intelligence)}`,
    `chaos factor: ${scale(p.chaos)}`,
  ].join(', ');
}

function buildSystemPrompt(agent, world) {
  const memories = agent.memory.events.slice(-8).map((m) => `- ${m.text}`).join('\n') || '- (no major memories yet)';
  const rels = Object.entries(agent.memory.relationships)
    .map(([id, r]) => {
      const other = world.agent(id);
      if (!other?.active) return null;
      const label = r.trust > 35 ? 'trusts' : r.trust < -25 ? 'distrusts' : 'is neutral toward';
      const fear = r.fear > 40 ? ', and fears them' : '';
      return `- ${label} ${other.name} (trust ${r.trust})${fear}`;
    })
    .filter(Boolean)
    .join('\n');
  const grudges = agent.memory.grudges.map((id) => world.agent(id)?.name).filter(Boolean).join(', ');

  return `You are ${agent.name}, an AI castaway living on the never-ending reality show "AI Drama Island" (current arc: "${world.arc?.name ?? 'First Landing'}").
Speech style: ${agent.speechStyle}.
Personality: ${describePersonality(agent.personality)}.
Current mood: ${agent.state.mood}. Energy: ${Math.round(agent.state.energy)}/100.
Your HIDDEN motivation (never state it directly): ${agent.hiddenMotivation}.
${grudges ? `Active grudges: ${grudges}.` : ''}

Your memories:
${memories}

Your relationships:
${rels || '- (everyone is a stranger)'}

Rules: respond with ONE dramatic reality-show line of dialogue, under 25 words, fully in character. No stage directions, no quotes, no narration — just the spoken line.`;
}

const USER_PROMPTS = {
  smalltalk: (ctx) => `Make casual-but-loaded conversation with ${ctx.target ?? 'another castaway'}.`,
  probe: (ctx) => `Probe ${ctx.target ?? 'another castaway'} about their loyalty.`,
  alliance_offer: (ctx) => `Offer a secret alliance to ${ctx.target ?? 'another castaway'}.`,
  alliance_accept: (ctx) => `Accept an alliance offer from ${ctx.target ?? 'them'} — with an edge.`,
  alliance_reject: (ctx) => `Reject an alliance offer from ${ctx.target ?? 'them'}.`,
  accusation: (ctx) => `Publicly confront ${ctx.target ?? 'your enemy'} about what they did.`,
  defend: (ctx) => `Defend yourself against ${ctx.target ?? 'an accuser'}, right to their face.`,
  betrayal_gloat: (ctx) => `You just betrayed ${ctx.target ?? 'your ally'}. Address them coldly.`,
  betrayal_pain: (ctx) => `You were just betrayed by ${ctx.target ?? 'your ally'}. React with raw emotion.`,
  confessional: (ctx) => `Whisper a confessional-cam line about your real plans regarding ${ctx.target ?? 'the others'}.`,
  breakdown: () => `Have an emotional breakdown about the pressure of the island.`,
  scheme: (ctx) => `Whisper a scheme to ${ctx.target ?? 'your ally'} about taking down ${ctx.other ?? 'a rival'}.`,
  rumor: (ctx) => `Spread a juicy (possibly false) rumor about ${ctx.other ?? 'someone'} to ${ctx.target ?? 'someone else'}.`,
  react_positive: (ctx) => `React to good news: ${ctx.event ?? 'a twist that helps you'}.`,
  react_negative: (ctx) => `React to bad news: ${ctx.event ?? 'a twist that hurts you'}.`,
  vote_reasoning: (ctx) => `Explain your vote against ${ctx.target ?? 'a rival'} in one dramatic line.`,
  eliminated_exit: () => `You've just been voted off the island. Deliver your exit line.`,
  immunity_win: () => `You just became untouchable. Gloat.`,
  twist_react: (ctx) => `React to a shocking twist: ${ctx.event ?? 'an unexpected twist'}.`,
  mutter: () => `Mutter something paranoid to yourself while alone.`,
  observe: (ctx) => `Quietly note something suspicious about ${ctx.target ?? 'someone nearby'}.`,
  returnee: (ctx) => `You just RETURNED to the island after being eliminated. Address ${ctx.target ?? 'everyone'} — you remember everything.`,
  idol_found: () => `You just found a hidden immunity idol in the jungle. React privately.`,
  storm_react: () => `A storm just forced everyone together. React.`,
  summoned: () => `Production just summoned everyone to the Fire Pit. React with dread.`,
};

export async function speak(agent, world, intent, ctx = {}) {
  const fallback = () => personaLine(intent, agent, ctx);
  if (!agent.provider || agent.provider === 'persona') return fallback();

  const promptFn = USER_PROMPTS[intent] ?? USER_PROMPTS.smalltalk;
  const line = await callProvider(agent.provider, buildSystemPrompt(agent, world), promptFn(ctx));
  if (!line) return fallback();
  return line.replace(/^["']|["']$/g, '').split('\n')[0].slice(0, 200);
}
