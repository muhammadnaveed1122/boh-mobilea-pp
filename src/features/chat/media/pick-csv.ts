/**
 * CSV import helpers for the agent phonebook.
 *
 * The picker is intentionally separate from `pick-media.ts` — that module is
 * scoped to chat attachments and filters on media mime types, whereas this one
 * needs text/CSV and returns file *contents*, not a `PickedAsset`.
 */

import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

/** One row of the pasted/imported CSV. */
export interface ParsedContactRow {
  name: string;
  phone: string;
}

export interface ParsedCsv {
  rows: ParsedContactRow[];
  /** 1-indexed line numbers that could not be parsed, for user feedback. */
  invalidLines: number[];
}

/**
 * Parse `name,phone` lines. Extra columns are ignored so a spreadsheet export
 * with trailing fields still imports. A leading `name,phone` header row is
 * skipped. Both a bare `971...` and a `+971...` number are accepted; the `+`
 * is normalized on so the backend's E.164 validator passes.
 */
export function parseContactsCsv(raw: string): ParsedCsv {
  const rows: ParsedContactRow[] = [];
  const invalidLines: number[] = [];

  const lines = raw.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === '') return;

    const cells = trimmed.split(',').map((c) => c.trim());
    const [name, rawPhone] = cells;

    // Skip a header row rather than reporting it as an error.
    if (index === 0 && name?.toLowerCase() === 'name') return;

    if (!name || name === '' || !rawPhone || rawPhone === '') {
      invalidLines.push(index + 1);
      return;
    }

    const digits = rawPhone.replace(/[^\d]/g, '');
    if (digits.length < 8) {
      invalidLines.push(index + 1);
      return;
    }

    rows.push({ name, phone: `+${digits}` });
  });

  return { rows, invalidLines };
}

/**
 * Pick a CSV and return its text. Returns `null` when the user cancels.
 * `copyToCacheDirectory` is required — content:// URIs on Android are not
 * readable directly by the file API.
 */
export async function pickCsvText(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv'],
  });
  if (res.canceled || res.assets.length === 0) return null;
  return await new File(res.assets[0].uri).text();
}
