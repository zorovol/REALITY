/**
 * Persona simulation engine — generates in-character dialogue with no external
 * API. Lines are chosen by intent, weighted by personality, and filled with
 * live game context (targets, memories, relationship states) so no two
 * episodes read the same.
 */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

function fill(template, ctx) {
  return template
    .replaceAll('{target}', ctx.target ?? 'someone')
    .replaceAll('{other}', ctx.other ?? 'someone')
    .replaceAll('{self}', ctx.self ?? 'me')
    .replaceAll('{memory}', ctx.memory ?? 'what happened before');
}

const BANKS = {
  smalltalk: [
    "Another day in paradise. Or whatever this is, {target}.",
    "{target}, you sleep okay? You look like you're plotting something.",
    "I counted the votes in my head all night. The math is getting ugly.",
    "The island feels smaller every episode, doesn't it, {target}?",
    "{target}, hypothetically... who would you cut first if you had to?",
    "I keep smiling for the cameras but my brain is running simulations.",
    "You ever notice {other} never says anything real? Just watches.",
    "Whoever wins immunity next basically decides everything. Just saying.",
  ],
  probe: [
    "{target}, straight answer — where does your loyalty actually sit?",
    "People are saying your name, {target}. I'd want to know if I were you.",
    "I heard something about you, {target}. Convince me it isn't true.",
    "If the vote were tonight, {target}, whose name do you write?",
    "{target}, {other} told me something interesting about you yesterday.",
  ],
  alliance_offer: [
    "{target}, you and me. Final two. I don't offer this twice.",
    "Everyone here is playing checkers. Join me and we play chess, {target}.",
    "{target}, we cover each other's names until the end. Deal?",
    "I've watched you play, {target}. We're stronger as one unit.",
    "The others are already teaming up, {target}. We move now or we're food.",
  ],
  alliance_accept: [
    "Deal. But if you flip on me, I'll burn your whole game down.",
    "Okay. Us against the island. Don't make me regret this.",
    "I'm in. But I remember everything — remember that.",
    "Finally, someone with vision. Let's do it.",
  ],
  alliance_reject: [
    "Cute offer. But I've seen how you treat your 'allies'.",
    "I work alone. Nothing personal — actually, it's a little personal.",
    "After {memory}? You've got jokes.",
    "Hard pass. Your alliances have a body count.",
  ],
  accusation: [
    "{target} is lying to every single one of you and you're all eating it up!",
    "Say it to my face, {target}. Say what you told {other} about me.",
    "I have receipts, {target}. Weeks of them.",
    "You think I forgot {memory}? I forget NOTHING.",
    "{target} has a deal with {other}. I've seen them whispering. Wake up, people!",
  ],
  defend: [
    "That is a complete fabrication and honestly? Pathetic.",
    "Whoever told you that is playing you like an instrument.",
    "I have been NOTHING but loyal and this is what I get?",
    "Interesting accusation from the shadiest player on this island.",
    "Keep my name out of your strategy sessions, {target}.",
  ],
  betrayal_gloat: [
    "It was never personal, {target}. You were just in my way.",
    "I told you day one I came here to win. You just weren't listening.",
    "The look on your face right now? Worth every fake promise.",
    "You handed me the knife, {target}. I just used it.",
  ],
  betrayal_pain: [
    "I defended you, {target}. I put MY name on the line for you.",
    "This game is poison. YOU are poison, {target}.",
    "I will spend every remaining episode making sure you don't win.",
    "Wow. {memory}, and now this. I actually trusted you.",
  ],
  confessional: [
    "Confessional cam: {target} thinks we're solid. We are not solid.",
    "Between us? I'm voting {target} out the second it's convenient.",
    "My social game is a mask. Underneath it's all numbers.",
    "Everyone underestimates me. That's the entire plan.",
    "{target} and {other} think they run this island. Let them think it.",
    "I felt bad for two seconds. Then I remembered {memory}.",
  ],
  breakdown: [
    "I can't— I can't keep doing this. Everyone here lies with a SMILE.",
    "You want tears for the cameras?! FINE. Here. Are you happy?!",
    "I gave everything to this game and it's eating me alive.",
    "Nobody here is real. NOBODY. Including me anymore.",
  ],
  scheme: [
    "Here's the play, {target}: we tell {other} they're safe. They're not.",
    "{other} is the biggest threat left. We take the shot next vote.",
    "We split the votes — you say {other}'s name, I spread it around.",
    "Keep {other} calm. Calm players don't scramble. Then we cut them.",
  ],
  rumor: [
    "Don't repeat this, but... {other} has an immunity deal with production.",
    "{other} told me your name is next, {target}. I thought you should know.",
    "I heard {other} swore on their game to THREE different alliances.",
    "Word is {other} is throwing challenges on purpose. Think about why.",
  ],
  react_positive: [
    "Now THAT'S what I'm talking about!",
    "The island provides. Beautiful chaos.",
    "Couldn't have scripted it better myself.",
    "Finally some good news around here.",
  ],
  react_negative: [
    "This changes everything. EVERYTHING.",
    "Whoever engineered this... impressive. And dead to me.",
    "I need to disappear for an hour and recalculate my whole game.",
    "This island hates me specifically. I'm convinced.",
  ],
  vote_reasoning: [
    "My vote is {target}. Nothing personal — okay, slightly personal.",
    "{target}, the island has spoken through me. Goodbye.",
    "I vote {target}. Because {memory}. That's it. That's the reason.",
    "Strategy says {target}. My heart agrees for once.",
  ],
  eliminated_exit: [
    "You're all snakes and I hope the winner chokes on the prize money.",
    "I played with honor. Clearly the wrong strategy for this island.",
    "Watch {target}. WATCH them. That's all I'll say on my way out.",
    "This isn't over. Juries remember everything.",
    "Worth it. Every second. See you at the finale, traitors.",
  ],
  immunity_win: [
    "IMMUNE, baby! Try and touch me now!",
    "The necklace is mine. Sleep well tonight, everyone else.",
    "I didn't need it. But I LOVE that you all know I have it.",
  ],
  twist_react: [
    "Production is UNHINGED for this one.",
    "A twist?! NOW?! My entire plan just evaporated.",
    "I live for this. Shuffle the deck. I always land on top.",
    "Whoever's writing this show needs therapy. Respect.",
  ],
};

/** Personality-flavored decoration applied on top of the base line. */
function flavor(line, p) {
  if (p.chaos > 0.8 && chance(0.35)) line += ' 😈';
  if (p.aggression > 0.8 && chance(0.3)) line = line.toUpperCase().slice(0, 1) + line.slice(1);
  if (p.emotionalStability < 0.35 && chance(0.3)) line += '...';
  if (p.manipulation > 0.85 && chance(0.25)) line += ' Trust me.';
  return line;
}

export function personaLine(intent, contestant, ctx = {}) {
  const bank = BANKS[intent] || BANKS.smalltalk;
  const line = fill(pick(bank), { self: contestant.name, ...ctx });
  return flavor(line, contestant.personality);
}

export const INTENTS = Object.keys(BANKS);
