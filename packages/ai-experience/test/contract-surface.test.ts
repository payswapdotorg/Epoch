// Contract surface integrity: the schema surface registry is complete,
// unique, and matches the published type surface of the package index.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as api from '../src/index';
import { AI_EXPERIENCE_SCHEMA_SURFACE } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const INDEX = readFileSync(path.resolve(here, '..', 'src', 'index.ts'), 'utf8');

describe('the AI-experience schema surface registry', () => {
  it('is sorted and duplicate-free by type name', () => {
    const names = AI_EXPERIENCE_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(names).toEqual([...names].sort());
    expect(new Set(names).size).toBe(names.length);
  });

  it('declares the contract-critical types', () => {
    const names = new Set(AI_EXPERIENCE_SCHEMA_SURFACE.map((entry) => entry.type));
    for (const expected of [
      'AiSessionDescriptor',
      'ParticipantRoleDescriptor',
      'InteractionIntent',
      'AiCollaborationEvent',
      'ControlAuthority',
      'ControlProvenance',
      'ControlRejection',
      'EngineeringMomentContent',
      'EngineeringMomentRecord',
      'MirroredCollaborationEventRecord',
      'TimelinePosition',
    ]) {
      expect(names.has(expected), `surface must declare ${expected}`).toBe(true);
    }
  });

  it('every surface validator is exported from the package index', () => {
    for (const entry of AI_EXPERIENCE_SCHEMA_SURFACE) {
      // The index re-exports every schema it publishes.
      expect(INDEX).toContain(entry.type);
      expect(typeof entry.schema).toBe('object');
    }
  });

  it('the published API exposes the versioned constants', () => {
    expect(api.AI_EXPERIENCE_CONTRACT_VERSION).toBe('1.0.0');
    expect(api.AI_EXPERIENCE_RECORD_VERSION).toBe(1);
    expect(api.AI_EVENT_NAMESPACE).toBe('ai');
    expect(api.INTERACTION_INTENT_KINDS).toHaveLength(16);
    expect(api.AI_EXPERIENCE_ERROR_CODES).toHaveLength(11);
  });

  it('the published API exposes the total entry points', () => {
    expect(typeof api.admitIntent).toBe('function');
    expect(typeof api.captureEngineeringMoment).toBe('function');
    expect(typeof api.projectCollaboration).toBe('function');
    expect(typeof api.fromEventLogRecord).toBe('function');
    expect(typeof api.fromCollaborationEventRecord).toBe('function');
    expect(typeof api.buildEventLogContent).toBe('function');
    expect(typeof api.sealMoment).toBe('function');
    expect(typeof api.verifyMomentDigest).toBe('function');
    expect(typeof api.presenceSeatNode).toBe('function');
    expect(typeof api.buildPresenceGraphContent).toBe('function');
    expect(typeof api.renderAiExperienceContractFiles).toBe('function');
  });
});
