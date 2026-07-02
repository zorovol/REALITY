import { callProvider } from './providers.js';
import { personaLine } from './persona.js';

/**
 * Unified contestant "brain".
 * Builds a full character context (personality + hidden motivation + memory +
 * relationships) and asks the assigned provider for a line. If the provider
 * is unavailable or fails, the persona engine answers in-character instead —
 * the show never stalls waiting on an API.
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

function buildSystemPrompt(contestant, game) {
  const memories = contestant.memory.slice(-8).map((m) => `- ${m.text}`).join('\n') || '- (no major memories yet)';
  const rels = Object.entries(contestant.relationships)
    .map(([id, trust]) => {
      const other = game.contestants.find((c) => c.id === id);
      if (!other || other.eliminated) return null;
      const label = trust > 0.65 ? 'trusts' : trust < 0.35 ? 'distrusts' : 'is neutral toward';
      return `- ${label} ${other.name} (${Math.round(trust * 100)}%)`;
    })
    .filter(Boolean)
    .join('\n');

  return `You are ${contestant.name}, an AI contestant on the reality show "AI Drama Island" (episode ${game.episode}).
Speech style: ${contestant.speechStyle}.
Personality: ${describePersonality(contestant.personality)}.
Your HIDDEN motivation (never state it directly): ${contestant.hiddenMotivation}.

Your memories:
${memories}

Your current relationships:
${rels || '- (everyone is a stranger)'}

Rules: respond with ONE dramatic reality-show line of dialogue, under 30 words, fully in character. No stage directions, no quotes, no narration — just the spoken line.`;
}

export async function speak(contestant, game, intent, ctx = {}) {
  const fallback = () => personaLine(intent, contestant, ctx);
  if (contestant.provider === 'persona') return fallback();

  const prompts = {
    smalltalk: `Make casual-but-loaded conversation with ${ctx.target ?? 'another contestant'}.`,
    probe: `Probe ${ctx.target ?? 'another contestant'} about their loyalty.`,
    alliance_offer: `Offer a secret alliance to ${ctx.target ?? 'another contestant'}.`,
    alliance_accept: `Accept an alliance offer from ${ctx.target ?? 'another contestant'} — with an edge.`,
    alliance_reject: `Reject an alliance offer from ${ctx.target ?? 'another contestant'}.`,
    accusation: `Publicly accuse ${ctx.target ?? 'another contestant'} of scheming.`,
    defend: `Defend yourself against an accusation from ${ctx.target ?? 'another contestant'}.`,
    betrayal_gloat: `You just betrayed ${ctx.target ?? 'an ally'}. Address them coldly.`,
    betrayal_pain: `You were just betrayed by ${ctx.target ?? 'an ally'}. React with raw emotion.`,
    confessional: `Give a private confessional-cam line about your real plans regarding ${ctx.target ?? 'the others'}.`,
    breakdown: `Have an emotional breakdown on camera about the pressure of the game.`,
    scheme: `Whisper a scheme to ${ctx.target ?? 'your ally'} about taking out ${ctx.other ?? 'a rival'}.`,
    rumor: `Spread a juicy (possibly false) rumor about ${ctx.other ?? 'another contestant'} to ${ctx.target ?? 'someone'}.`,
    react_positive: `React to good news: ${ctx.event ?? 'a twist that helps you'}.`,
    react_negative: `React to bad news: ${ctx.event ?? 'a twist that hurts you'}.`,
    vote_reasoning: `Explain your vote against ${ctx.target ?? 'a contestant'} in one dramatic line.`,
    eliminated_exit: `You've just been eliminated. Deliver your exit line.`,
    immunity_win: `You just won immunity. Gloat.`,
    twist_react: `React to a shocking production twist: ${ctx.event ?? 'an unexpected twist'}.`,
  };

  const line = await callProvider(
    contestant.provider,
    buildSystemPrompt(contestant, game),
    prompts[intent] ?? prompts.smalltalk
  );
  if (!line) return fallback();
  // Keep broadcast lines tight even if the model rambles
  return line.replace(/^["']|["']$/g, '').split('\n')[0].slice(0, 220);
}
