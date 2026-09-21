import { Redirect, useLocalSearchParams } from 'expo-router';
import { AllLeadsScreen } from '@/features/leads/components/AllLeadsScreen';
import type { StatusPillValue } from '@/features/leads/components/LeadsStatusPills';
import { STATUS_FILTERS } from '@/features/leads/types';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

/** Coerce the `status` query param to a valid pill value, else 'All'. */
function parseStatus(raw: string | string[] | undefined): StatusPillValue {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'All') return 'All';
  return (STATUS_FILTERS as readonly string[]).includes(value ?? '')
    ? (value as StatusPillValue)
    : 'All';
}

export default function AllLeadsRoute() {
  const state = useRequirePermission([PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_READ_ALL]);
  const { status, dateFrom, dateTo } = useLocalSearchParams<{
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }>();
  if (state === 'loading') return null;
  if (state === 'denied') return <Redirect href="/" />;
  // Pushed route (no GlobalMainHeader) — don't reserve top header space.
  return (
    <AllLeadsScreen
      reserveMainHeaderSpace={false}
      initialStatus={parseStatus(status)}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  );
}
