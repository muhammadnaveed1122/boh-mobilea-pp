import { useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { CallRecord } from '../models/call-record';
import { displayNumber, outcomeBadge } from '../utils/call-format';

function toCsv(records: CallRecord[]): string {
  const header = [
    'Direction',
    'Contact',
    'Number',
    'Agent',
    'Department',
    'Source',
    'Outcome',
    'Date',
    'Duration(s)',
  ];
  const rows = records.map((r) => [
    r.direction ?? '',
    r.callerIdName ?? '',
    displayNumber(r.direction === 'outbound' ? r.destinationNumber : r.callerIdNumber),
    r.extension?.agentName ?? r.extensionNumber ?? '',
    r.extension?.department?.name ?? '',
    r.source ?? '',
    outcomeBadge(r.status).label,
    r.startTime ?? '',
    String(r.billsec || r.duration || 0),
  ]);
  return [header, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function useCallExport() {
  const [exporting, setExporting] = useState(false);

  const exportCsv = async (records: CallRecord[], stampIso: string): Promise<void> => {
    if (records.length === 0) return;
    setExporting(true);
    try {
      const name = `call-logs-${stampIso.slice(0, 10)}.csv`;
      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.create();
      file.write(toCsv(records));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export call logs',
          UTI: 'public.comma-separated-values-text',
        });
      }
    } finally {
      setExporting(false);
    }
  };

  return { exportCsv, exporting };
}
