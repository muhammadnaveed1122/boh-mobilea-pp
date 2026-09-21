import { Fragment, useMemo } from 'react';
import { Linking } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

/** Non-whitespace runs — each is tested for link-ness without a scanning regex. */
const TOKEN_PATTERN = /\S+/g;

const TRAILING_PUNCTUATION = '.,;:!?)]\'"';

function isUrl(token: string): boolean {
  const lower = token.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('www.');
}

/** `name@host.tld` — one `@`, a dotted domain, and an alphabetic TLD. */
function isEmail(token: string): boolean {
  const at = token.indexOf('@');
  if (at <= 0 || at !== token.lastIndexOf('@')) return false;
  const domain = token.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  if (dot <= 0) return false;
  const tld = domain.slice(dot + 1);
  return tld.length >= 2 && /^[a-z]+$/i.test(tld);
}

/** Trailing sentence punctuation shouldn't be swallowed into the link. */
function splitTrailingPunctuation(raw: string): [string, string] {
  let end = raw.length;
  while (end > 0 && TRAILING_PUNCTUATION.includes(raw[end - 1])) end -= 1;
  return [raw.slice(0, end), raw.slice(end)];
}

function toHref(value: string): string {
  if (!isUrl(value)) return `mailto:${value}`;
  return value.toLowerCase().startsWith('www.') ? `https://${value}` : value;
}

interface Segment {
  key: string;
  text: string;
  href?: string;
}

function segment(text: string): Segment[] {
  const parts: Segment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    const [value, trailing] = splitTrailingPunctuation(match[0]);
    if (!value || (!isUrl(value) && !isEmail(value))) continue;
    if (start > cursor) {
      parts.push({ key: `t${cursor}`, text: text.slice(cursor, start) });
    }
    parts.push({ key: `l${start}`, text: value, href: toHref(value) });
    if (trailing) parts.push({ key: `p${start}`, text: trailing });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ key: `t${cursor}`, text: text.slice(cursor) });
  return parts;
}

/**
 * Message text with URLs and email addresses rendered as tappable blue links.
 * Plain text falls through to a single `<Text>` so the common case costs
 * nothing extra.
 */
export function LinkedText({ text, className }: Readonly<{ text: string; className?: string }>) {
  const linkColor = useThemeColor('--info');
  const segments = useMemo(() => segment(text), [text]);
  const hasLink = segments.some((s) => s.href);

  if (!hasLink) return <Text className={className}>{text}</Text>;

  return (
    <Text className={className}>
      {segments.map((s) =>
        s.href ? (
          <Text
            key={s.key}
            accessibilityRole="link"
            className={className}
            style={{ color: linkColor, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL(s.href as string).catch(() => {})}
            suppressHighlighting
          >
            {s.text}
          </Text>
        ) : (
          <Fragment key={s.key}>{s.text}</Fragment>
        ),
      )}
    </Text>
  );
}
