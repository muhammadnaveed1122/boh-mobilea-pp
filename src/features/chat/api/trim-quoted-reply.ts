/**
 * Trim quoted reply history from an email body (already HTML-stripped plain
 * text). Email clients append the prior thread plus a signature; in a unified
 * chat thread every prior message is already its own bubble, so the quote is
 * pure clutter. Cut everything from the first quote/signature marker on.
 *
 * Conservative: only trims when a marker is found, and never returns empty —
 * if the marker sits at the very top (whole body is a quote) we keep the
 * original so we don't blank the bubble.
 */

// Each matches the START of a line. First hit wins → everything after is dropped.
const QUOTE_MARKERS: RegExp[] = [
  /^_{5,}\s*$/m, // Outlook's horizontal-rule separator
  /^-{2,}\s*Original Message\s*-{2,}/im, // "----- Original Message -----"
  /^On\s.+\swrote:\s*$/im, // Gmail/Apple "On <date>, X wrote:"
  /^From:\s.+$/im, // Outlook quoted-header block ("From: ... Sent: ... To:")
  /^Get Outlook for\s/im, // Outlook mobile signature
  /^Sent from my\s/im, // generic mobile signature
];

export function trimQuotedReply(input: string): string {
  if (!input) return input;

  let cut = -1;
  for (const re of QUOTE_MARKERS) {
    const m = re.exec(input);
    if (m && (cut === -1 || m.index < cut)) cut = m.index;
  }
  if (cut === -1) return input.trim();

  const head = input.slice(0, cut).trim();
  // Marker at the very top → whole body is quoted; keep original rather than blank.
  return head === '' ? input.trim() : head;
}
