import { z } from 'zod';
import { InstantSchema } from './primitives';

/**
 * Runtime validator for temporal validity
 * (contracts/world/src/validity.ts).
 */

export const ValiditySchema = z
  .strictObject({
    from: InstantSchema.optional(),
    to: InstantSchema.optional(),
  })
  .readonly()
  .superRefine((value, ctx) => {
    if (value.from !== undefined && value.to !== undefined && Date.parse(value.to) <= Date.parse(value.from)) {
      ctx.addIssue({ code: 'custom', message: 'validity.to must be strictly after validity.from' });
    }
  })
  .meta({
    id: 'urn:epoch:contracts:world:validity',
    title: 'Validity',
    description: 'Temporal validity interval; from is inclusive, to is exclusive.',
  });
