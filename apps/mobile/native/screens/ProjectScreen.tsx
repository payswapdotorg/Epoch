/**
 * @epoch/mobile — the project screen (J02 field subset:
 * understand/reconstruct, inspect known/unknowns).
 *
 * Renders the project context (context.resolve), the world digest (the
 * cross-device authority anchor), the program projections (work packages,
 * activities, milestones — the field "knowns"), and the schedule folds
 * (program.schedule). Load-on-focus: the screen refreshes its read
 * projections when mounted.
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { MobileFieldHost } from '../../src/product/field-host';
import { layout, palette } from '../theme';

interface ProjectState {
  readonly worldDigest: string;
  readonly entityCount: number;
  readonly workPackageCount: number;
  readonly activityCount: number;
}

export function ProjectScreen({ host }: { readonly host: MobileFieldHost }): React.JSX.Element {
  const [state, setState] = useState<ProjectState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const world = await host.worldSnapshot();
      const entities = await host.worldEntities();
      const projections = host.programProjections();
      if (cancelled) return;
      const entityCount = Array.isArray(entities.ok ? entities.value : null)
        ? (entities.ok ? (entities.value as unknown[]).length : 0)
        : 0;
      setState({
        worldDigest: world.ok ? world.value.digest : 'unavailable',
        entityCount,
        workPackageCount: projections.workPackages.length,
        activityCount: projections.activities.length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [host]);

  const projections = host.programProjections();

  return (
    <View style={layout.section} testID="project-screen">
      <View style={layout.card} testID="project-context">
        <Text style={layout.cardTitle}>Project context</Text>
        <Text style={layout.value} testID="project-delivery">
          {host.deliveryId}
        </Text>
        <Text style={layout.mono} testID="project-world-digest" numberOfLines={1} selectable>
          world {state?.worldDigest ?? '…'}
        </Text>
        <Text style={layout.hint} testID="project-counts">
          {state ? `${state.workPackageCount} work packages · ${state.activityCount} activities · ${state.entityCount} entities` : '…'}
        </Text>
      </View>

      <View style={layout.card} testID="project-work-packages">
        <Text style={layout.cardTitle}>Work packages (the field surface)</Text>
        {projections.workPackages.map((workPackage) => (
          <View key={workPackage.workPackageId} style={[layout.card, { backgroundColor: palette.surfaceMuted }]} testID={`work-package-${workPackage.workPackageId}`}>
            <Text style={layout.value}>{workPackage.title}</Text>
            <Text style={layout.mono}>{workPackage.workPackageId}</Text>
            <Text style={layout.hint}>
              {workPackage.activityIds.length} activities · {workPackage.responsibleActor}
            </Text>
          </View>
        ))}
      </View>

      <View style={layout.card} testID="project-unknowns">
        <Text style={layout.cardTitle}>Known / unknown</Text>
        <Text style={layout.hint}>
          Knowns: the sealed program (BOQ/schedule), the open delivery record, the evidence
          digests. Unknowns live in the observation uncertainty state — every capture carries
          provenance, freshness and confidence (never invented progress).
        </Text>
      </View>
    </View>
  );
}
