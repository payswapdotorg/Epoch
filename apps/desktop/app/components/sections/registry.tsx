'use client';

import type { ReactNode } from 'react';
import { J01ProjectSection } from './j01-project-section';
import { J02UnderstandSection } from './j02-understand-section';
import { J04ActionsSection } from './j04-actions-section';
import { J05ProgramSection } from './j05-program-section';
import { J06RealizeSection } from './j06-realize-section';
import { J07OfflineSection } from './j07-offline-section';
import { J08HandoffSection } from './j08-handoff-section';
import { J12RelaunchSection } from './j12-relaunch-section';
import type { WorkspaceContext } from './section-props';

/**
 * The journey section registry (W048): the left-rail navigation and the
 * main-pane screens. Every section drives the SAME product methods the
 * journey runner drives — one code path, visible.
 */
export type SectionId = 'j01' | 'j02' | 'j04' | 'j05' | 'j06' | 'j07' | 'j08' | 'j12';

export interface SectionDescriptor {
  readonly id: SectionId;
  readonly journey: string;
  readonly label: string;
  readonly title: string;
  readonly summary: string;
  readonly render: (ctx: WorkspaceContext) => ReactNode;
}

export const SECTIONS: readonly SectionDescriptor[] = [
  {
    id: 'j01',
    journey: 'J01',
    label: 'Project',
    title: 'Project entry',
    summary:
      'Onboard into the fixture project: resolve the tenancy context and the world snapshot (the registry-verified digest).',
    render: (ctx) => <J01ProjectSection ctx={ctx} />,
  },
  {
    id: 'j02',
    journey: 'J02',
    label: 'Understand',
    title: 'Understand / reconstruct',
    summary:
      'Inspect the world entities and the fixture evidence record; the view model separates knowns from known-unknowns.',
    render: (ctx) => <J02UnderstandSection ctx={ctx} />,
  },
  {
    id: 'j04',
    journey: 'J04',
    label: 'Actions',
    title: 'Action approval cycle',
    summary:
      'Paste an action proposal and run submit → human approval → execute → status through the Action Gateway (the execution authority).',
    render: (ctx) => <J04ActionsSection ctx={ctx} />,
  },
  {
    id: 'j05',
    journey: 'J05',
    label: 'Program',
    title: 'Program of work',
    summary:
      'Seal + approve the solution, fold the BOQ/schedule and the milestones; the procurement quote stays harness-scoped.',
    render: (ctx) => <J05ProgramSection ctx={ctx} />,
  },
  {
    id: 'j06',
    journey: 'J06',
    label: 'Realize',
    title: 'Realize and observe',
    summary:
      'Open the delivery, intake the field observation, roll the forecast, validate the chain and close the delivery.',
    render: (ctx) => <J06RealizeSection ctx={ctx} />,
  },
  {
    id: 'j07',
    journey: 'J07',
    label: 'Offline',
    title: 'Offline queue and reconnect',
    summary:
      'Go offline, enqueue pending projections, reconnect and drain them through the gateway with exactly-once semantics.',
    render: (ctx) => <J07OfflineSection ctx={ctx} />,
  },
  {
    id: 'j08',
    journey: 'J08',
    label: 'Handoff',
    title: 'Cross-device handoff',
    summary:
      'Resolve the same authoritative world digest as the web product, validate the session scope, admit the cached projection and export/import the descriptor.',
    render: (ctx) => <J08HandoffSection ctx={ctx} />,
  },
  {
    id: 'j12',
    journey: 'J12',
    label: 'Relaunch',
    title: 'Relaunch and update',
    summary:
      'Restore the persisted session, queue and projection cache; the protocol gate refuses incompatible update candidates.',
    render: (ctx) => <J12RelaunchSection ctx={ctx} />,
  },
];
