const TAG_RE = /<[a-zA-Z/!][^>]{0,2000}>/g;

export function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  const noTags = input.replaceAll(TAG_RE, ' ');
  const decoded = noTags
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
  return decoded.replaceAll(/\s+/g, ' ').trim();
}
