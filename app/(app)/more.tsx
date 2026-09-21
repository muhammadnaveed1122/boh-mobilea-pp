import { MoreScreen } from '@/features/more/components/MoreScreen';

// Pushed over the tabs from the bottom bar's More button (replaces the old
// bottom sheet). Staff tab sets have no More route of their own, so this stays
// a stack screen and keeps a normal back stack for each destination.
export default function MoreRoute() {
  return <MoreScreen />;
}
