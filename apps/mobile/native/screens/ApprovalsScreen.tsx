/**
 * @epoch/mobile — the approvals screen (J04 approval subset: Action
 * Gateway approval).
 *
 * The approval surface is a STRICT SUBSET of the frozen gateway
 * vocabulary: action.submit / action.approve / action.status (asserted
 * by test/product/named-negatives.test.ts — `MobileFieldHost.
 * APPROVAL_OPERATIONS` covers exactly these). Approving happens ONLY
 * through the gateway's `action.approve` — there is no local approval
 * code path anywhere in the product (an approval can never bypass the
 * gateway).
 *
 * The screen: lists the pending actions (action.status), submits a field
 * review proposal (action.submit) and approves it (action.approve).
 */
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { MobileFieldHost } from '../../src/product/field-host';
import { layout } from '../theme';

interface ActionListItem {
  readonly actionId: string;
  readonly status: string;
}

export function ApprovalsScreen(props: {
  readonly host: MobileFieldHost;
  readonly onComplete: () => void;
}): React.JSX.Element {
  const host = props.host;
  const [actions, setActions] = useState<readonly ActionListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [proposalCounter, setProposalCounter] = useState(0);

  const refresh = async (): Promise<void> => {
    const status = await host.actionStatus();
    if (status.ok) {
      const value = status.value;
      const list = Array.isArray(value)
        ? (value as Array<Record<string, unknown>>).map((entry) => ({
            actionId: String(entry['actionId'] ?? ''),
            status: String(entry['status'] ?? ''),
          }))
        : [];
      setActions(list);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const submitReview = async (): Promise<void> => {
    setBusy(true);
    try {
      const now = host.currentSession?.issuedAt ?? '2026-03-02T12:00:00.000Z';
      const sequence = proposalCounter + 1;
      setProposalCounter(sequence);
      const { buildFieldReviewActionPayload } = await import('../../src/product/approval-pipeline');
      const result = await host.submitAction(
        buildFieldReviewActionPayload({
          actionId: `action:field-review-${sequence}`,
          messageId: `field-msg-${sequence}`,
          proposalId: `field-prop-${sequence}`,
          createdAt: now,
          proposedBy: 'agent:epoch-field-client',
          observationId: 'observation:field-capture',
          deliveryId: host.deliveryId,
          reviewKind: 'observation-acceptance',
          reviewer: host.currentSession?.principalId ?? 'principal:delivery-lead',
          justification: 'Field observation review from the mobile product.',
          evidenceDigests: ['81130ca4fb28e23dc47fd01a8318223710397dacba7461bb2b23f13f204d19b'],
          tenantId: host.tenantId,
          sessionId: host.currentSession?.sessionId ?? '',
          expiresAt: '2027-01-01T00:00:00.000Z',
          approvalDeadline: '2026-12-31T00:00:00.000Z',
        }),
      );
      if (result.ok) {
        Alert.alert('Proposal submitted', 'The proposal left through the Action Gateway (the only route).');
        await refresh();
        props.onComplete();
      } else {
        Alert.alert('Submit rejected', result.failure.error.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const approve = async (actionId: string): Promise<void> => {
    setBusy(true);
    try {
      const now = host.currentSession?.issuedAt ?? '2026-03-02T12:00:00.000Z';
      const result = await host.approveAction({
        actionId,
        decidedById: 'principal:chief-engineer',
        decidedByRole: 'human-approver',
        asRole: 'senior-structural-engineer',
        note: 'Field approval from the mobile product.',
        at: now,
      });
      if (result.ok) {
        Alert.alert('Approved through the gateway', 'The approval applied ONLY through the Action Gateway authority.');
        await refresh();
        props.onComplete();
      } else {
        Alert.alert('Approval rejected', result.failure.error.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={layout.section} testID="approvals-screen">
      <View style={layout.card} testID="approvals-notice">
        <Text style={layout.cardTitle}>Approval authority</Text>
        <Text style={layout.hint}>
          Approvals execute ONLY through the Action Gateway (action.submit → action.approve →
          action.status). The mobile surface holds no credentials and settles nothing locally.
        </Text>
      </View>

      <View style={layout.card} testID="approvals-list">
        <Text style={layout.cardTitle}>Pending actions</Text>
        {actions.length === 0 ? (
          <View style={layout.empty}>
            <Text style={layout.emptyText}>No actions yet — submit a field review proposal.</Text>
          </View>
        ) : (
          actions.map((action) => (
            <View key={action.actionId} style={[layout.rowSpace]} testID={`action-${action.actionId}`}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={layout.mono} numberOfLines={1}>
                  {action.actionId}
                </Text>
                <Text style={layout.hint}>{action.status}</Text>
              </View>
              <Pressable
                testID={`approve-${action.actionId}`}
                accessibilityLabel={`Approve ${action.actionId}`}
                accessibilityRole="button"
                style={[layout.button, { minHeight: 40, paddingHorizontal: 12 }]}
                onPress={() => {
                  void approve(action.actionId);
                }}
                disabled={busy}
              >
                <Text style={layout.buttonText}>Approve</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Pressable
        testID="approvals-submit-proposal"
        accessibilityLabel="Submit field review proposal"
        accessibilityRole="button"
        style={[layout.button, busy && { opacity: 0.6 }]}
        onPress={() => {
          void submitReview();
        }}
        disabled={busy}
      >
        <Text style={layout.buttonText}>Submit field review proposal</Text>
      </Pressable>
    </View>
  );
}
