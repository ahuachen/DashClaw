import { describe, expect, it } from 'vitest';
import { checkSchemaSetup } from '../../scripts/lib/contracts/check-schema-setup.mjs';
import {
  ACTION_RECORDS_RUNTIME_COLUMNS,
  ACTION_RECORDS_RUNTIME_INDEXES,
} from '../../app/lib/setup/action-records-runtime-schema.mjs';

describe('checkSchemaSetup', () => {
  it('fails when required action_records columns are not reconciled by setup migration', async () => {
    const result = await checkSchemaSetup({
      schema: {
        'action-records': {
          table: 'action_records',
          required_columns: [{ name: 'timestamp_start', type: 'text' }],
          required_indexes: [{ name: 'action_records_org_timestamp_idx', columns: ['org_id', 'timestamp_start'] }],
        },
      },
      setup: {
        'runtime-migration': {
          tables: {
            action_records: {
              reconciled_columns: [],
              reconciled_indexes: [],
            },
          },
        },
      },
    }, {
      reconciled_columns: [],
      reconciled_indexes: [],
    });

    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => /timestamp_start/i.test(finding.message))).toBe(true);
    expect(result.findings.some((finding) => /action_records_org_timestamp_idx/i.test(finding.message))).toBe(true);
  });

  it('passes when runtime migration constants cover the contract requirements', async () => {
    const result = await checkSchemaSetup({
      schema: {
        'action-records': {
          table: 'action_records',
          required_columns: ACTION_RECORDS_RUNTIME_COLUMNS.map((name) => ({ name, type: 'text' })),
          required_indexes: ACTION_RECORDS_RUNTIME_INDEXES.map((name) => ({ name, columns: [] })),
        },
      },
      setup: {
        'runtime-migration': {
          tables: {
            action_records: {
              reconciled_columns: ACTION_RECORDS_RUNTIME_COLUMNS,
              reconciled_indexes: ACTION_RECORDS_RUNTIME_INDEXES,
            },
          },
        },
      },
    }, {
      reconciled_columns: ACTION_RECORDS_RUNTIME_COLUMNS,
      reconciled_indexes: ACTION_RECORDS_RUNTIME_INDEXES,
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });
});
