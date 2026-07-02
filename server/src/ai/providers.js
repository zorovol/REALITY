import { config } from '../config.js';

/**
 * Multi-provider AI abstraction.
 * Each contestant is assigned a provider slot; if that provider has no key
 * (or the call fails), the persona simulation engine takes over seamlessly.
 * On screen, contestants only ever show their fictional "neural core" label.
 */

const TIMEOUT_MS = 20_000;

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(system, user) {
  const data = await fetchJson('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      temperature: 1.05,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callAnthropic(system, user) {
  const data = await fetchJson('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 120,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  return data.content?.[0]?.text?.trim() || null;
}

async function callGemini(system, user) {
  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: 120, temperature: 1.05 },
      }),
    }
  );
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

const PROVIDERS = [
  { id: 'openai', hasKey: () => !!config.openaiKey, call: callOpenAI },
  { id: 'anthropic', hasKey: () => !!config.anthropicKey, call: callAnthropic },
  { id: 'gemini', hasKey: () => !!config.geminiKey, call: callGemini },
];

export function availableProviders() {
  return PROVIDERS.filter((p) => p.hasKey());
}

/** Assign a provider id (or 'persona') to each contestant index, round-robin over live keys. */
export function assignProvider(index) {
  const live = availableProviders();
  if (live.length === 0) return 'persona';
  return live[index % live.length].id;
}

export async function callProvider(providerId, system, user) {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider || !provider.hasKey()) return null;
  try {
    return await provider.call(system, user);
  } catch (err) {
    console.error(`[ai] ${providerId} call failed: ${err.message}`);
    return null;
  }
}
