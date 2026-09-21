import { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { showToast } from '@/lib/toast/toast.store';
import type { CallRecord } from '../../models/call-record';
import { useCallback_ } from '../../hooks/use-callback';
import { useDncMutations } from '../../hooks/use-dnc-mutations';
import { displayNumber } from '../../utils/call-format';

type CbState = 'idle' | 'calling' | 'success' | 'error';

export function QuickActions({ call }: Readonly<{ call: CallRecord }>) {
  const inbound = call.direction === 'inbound';
  const contactNumber = inbound ? call.callerIdNumber : call.destinationNumber;
  const [cbState, setCbState] = useState<CbState>('idle');
  const [isDnc, setIsDnc] = useState(call.isDnc ?? false);
  const callback = useCallback_();
  const dnc = useDncMutations();

  const cbLabel =
    cbState === 'calling'
      ? 'Ringing…'
      : cbState === 'success'
        ? 'Call initiated ✓'
        : cbState === 'error'
          ? 'Failed — retry?'
          : 'Call back';

  const handleCallBack = () => {
    if (!contactNumber) return;
    if (!call.extensionNumber) {
      Linking.openURL(`tel:${displayNumber(contactNumber)}`).catch(() => {});
      return;
    }
    setCbState('calling');
    callback.mutate(
      {
        customerPhone: contactNumber,
        agentExtension: call.extensionNumber,
        agentName: call.extension?.agentName ?? undefined,
      },
      {
        onSuccess: () => {
          setCbState('success');
          setTimeout(() => setCbState('idle'), 3000);
        },
        onError: () => {
          setCbState('error');
          setTimeout(() => setCbState('idle'), 3000);
        },
      },
    );
  };

  const handleCopy = () => {
    if (!contactNumber) return;
    Clipboard.setStringAsync(displayNumber(contactNumber)).catch(() => {});
    showToast('success', 'Number copied');
  };

  const handleDnc = () => {
    if (!contactNumber) return;
    if (isDnc) {
      dnc.remove.mutate(contactNumber, { onSuccess: () => setIsDnc(false) });
    } else {
      dnc.add.mutate({ phone: contactNumber }, { onSuccess: () => setIsDnc(true) });
    }
  };

  return (
    <View className="flex-row gap-2 px-4 py-3">
      <Button className="flex-1" disabled={cbState === 'calling'} onPress={handleCallBack}>
        <Text>{cbLabel}</Text>
      </Button>
      <Button variant="outline" onPress={handleCopy}>
        <Text>Copy</Text>
      </Button>
      {contactNumber !== null ? (
        <Button
          variant={isDnc ? 'destructive' : 'outline'}
          disabled={dnc.add.isPending || dnc.remove.isPending}
          onPress={handleDnc}
        >
          <Text>{isDnc ? 'DNC ✕' : 'DNC'}</Text>
        </Button>
      ) : null}
    </View>
  );
}
