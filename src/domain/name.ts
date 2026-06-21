// The user's display name, carried in share links so a received list is signed ("Trocar com o Léo")
// and a re-shared list can be matched back to the right friend.

// Zero-width chars (ZWSP/ZWNJ/ZWJ, word-joiner, BOM) and C0/C1 control chars — stripped so a name can't
// break the 320px layout or inject newlines into the encoded link. Built via new RegExp with escaped
// strings so the source stays plain ASCII (no invisible literals to mangle).
const ZERO_WIDTH = new RegExp('[\\u200B-\\u200D\\u2060\\uFEFF]', 'g');
const CONTROL = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');

/** Clean a name for the UI and the (encoded) share link: drop zero-width and control chars, collapse
 *  whitespace, trim, and clamp to 24 chars (keeps the link small). Returns '' for blank/all-stripped
 *  input so the caller can fall back to "seu amigo". */
export function sanitizeName(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(ZERO_WIDTH, '')
    .replace(CONTROL, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 24).trim();
}
