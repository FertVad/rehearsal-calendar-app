import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';

const visibleLog: boolean[] = [];

// Stand-in for <Modal visible={...}>: records every value the native side sees.
function FakeModal({ visible }: { visible: boolean }) {
  useEffect(() => {
    visibleLog.push(visible);
  }, [visible]);
  return <Text>{String(visible)}</Text>;
}

const REHEARSALS = [{ id: 'R1' }, { id: 'R2' }];

// Verbatim copy of the effect in CalendarScreen.tsx lines 131-165.
function Screen() {
  const [wantedRehearsalId, setWantedRehearsalId] = useState<string | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(true);
  const [selectedRehearsalForDetails, setSelectedRehearsalForDetails] = useState<any>(REHEARSALS[0]);
  const [detailsDismissals, setDetailsDismissals] = useState(0);
  const rehearsals = REHEARSALS;

  (global as any).__setWanted = setWantedRehearsalId;

  useEffect(() => {
    if (!wantedRehearsalId) return;
    const target = rehearsals.find((r) => String(r.id) === String(wantedRehearsalId));
    if (!target) {
      const giveUp = setTimeout(() => setWantedRehearsalId(null), 10000);
      return () => clearTimeout(giveUp);
    }
    if (detailsModalVisible) {
      if (String(selectedRehearsalForDetails?.id) === String(target.id)) {
        setWantedRehearsalId(null);
        return;
      }
      setDetailsModalVisible(false);
      const fallback = setTimeout(() => setDetailsDismissals((n) => n + 1), 600);
      return () => clearTimeout(fallback);
    }
    setSelectedRehearsalForDetails(target);
    setDetailsModalVisible(true);
    setWantedRehearsalId(null);
  }, [wantedRehearsalId, rehearsals, detailsModalVisible, selectedRehearsalForDetails, detailsDismissals]);

  return <FakeModal visible={detailsModalVisible} />;
}

test('visible flips false then true without any onDismiss', () => {
  jest.useFakeTimers();
  render(<Screen />);
  visibleLog.length = 0;

  // The pendingRehearsal subscriber firing for a DIFFERENT rehearsal.
  act(() => {
    (global as any).__setWanted('R2');
  });

  // Nothing advances the clock, no onDismiss is ever delivered.
  console.log('VISIBLE PROP SEQUENCE AFTER TAP:', JSON.stringify(visibleLog));
  expect(visibleLog).toEqual([false, true]);
});
