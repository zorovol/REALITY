/** Strip emoji from server-generated strings so the UI stays emoji-free. */
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu;

export function stripEmoji(text) {
  if (!text || typeof text !== 'string') return text ?? '';
  return text.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
}
