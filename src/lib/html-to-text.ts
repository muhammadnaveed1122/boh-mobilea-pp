/**
 * Minimal HTML → plain text for read-only content (listing rich fields, inbound
 * email bodies). Mobile has no HTML renderer, so we strip tags to plain text.
 * Rich formatting (bold, lists, links) is intentionally dropped.
 */
export function htmlToText(input?: string | null): string {
  if (!input) return '';
  return (
    input
      // drop document head — its <style>/<meta> contents are not body text
      .replace(/<head[\s\S]{0,20000}?<\/head>/gi, '')
      .replace(/<style[\s\S]{0,20000}?<\/style>/gi, '')
      // block-ish tags → newlines so paragraphs/list items stay separated
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // drop every remaining tag (bounded length — avoids super-linear backtracking)
      .replace(/<[^>]{0,4000}>/g, '')
      // decode the few entities that actually show up
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      // collapse runaway whitespace / blank lines
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  );
}
