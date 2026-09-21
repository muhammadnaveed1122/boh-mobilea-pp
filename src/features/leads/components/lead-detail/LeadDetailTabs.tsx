/**
 * LeadDetailTabs — pill-style tab switcher for the Lead Detail screen.
 *
 * Three triggers: "Details", "Activity" and "Notes". Rendered as a rounded-full
 * bar sitting on top of the muted surface. The active trigger uses a white
 * card background with brand-coloured text; inactive triggers fade into the
 * bar with `text-muted-foreground` on transparent.
 *
 * Labels are kept short so all three triggers fit on a 375pt screen without
 * truncating.
 *
 * Children should be `<TabsContent value="details" />` / `"activity"` / `"notes"`
 * supplied by the caller — this component is just the trigger row + Tabs root.
 */

import type { ReactNode } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/atoms/Tabs';
import { Text } from '@/components/atoms/Text';

export type LeadDetailTabValue = 'details' | 'activity' | 'notes';

export interface LeadDetailTabsProps {
  value: LeadDetailTabValue;
  onValueChange: (next: LeadDetailTabValue) => void;
  children: ReactNode;
}

export function LeadDetailTabs({ value, onValueChange, children }: Readonly<LeadDetailTabsProps>) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as LeadDetailTabValue)}>
      <TabsList className="bg-muted">
        <TabsTrigger
          value="details"
          activeClassName="bg-card"
          activeTextClassName="text-brand"
          inactiveTextClassName="text-muted-foreground"
        >
          <Text>Details</Text>
        </TabsTrigger>
        <TabsTrigger
          value="activity"
          activeClassName="bg-card"
          activeTextClassName="text-brand"
          inactiveTextClassName="text-muted-foreground"
        >
          <Text>Activity</Text>
        </TabsTrigger>
        <TabsTrigger
          value="notes"
          activeClassName="bg-card"
          activeTextClassName="text-brand"
          inactiveTextClassName="text-muted-foreground"
        >
          <Text>Notes</Text>
        </TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}
