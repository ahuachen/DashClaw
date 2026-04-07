import {
  ACTION_RECORDS_RUNTIME_COLUMNS,
  ACTION_RECORDS_RUNTIME_INDEXES,
} from '../../../app/lib/setup/action-records-runtime-schema.mjs';

export async function checkSchemaSetup(contracts, runtimeSetup = null) {
  const findings = [];
  const schema = contracts.schema['action-records'];
  const setupContract = contracts.setup['runtime-migration']?.tables?.action_records;
  const runtime = runtimeSetup || {
    reconciled_columns: ACTION_RECORDS_RUNTIME_COLUMNS,
    reconciled_indexes: ACTION_RECORDS_RUNTIME_INDEXES,
  };

  for (const column of schema.required_columns || []) {
    if (!(setupContract?.reconciled_columns || []).includes(column.name)) {
      findings.push({
        code: 'missing_setup_column_reconciliation',
        message: `setup contract does not declare reconciliation for action_records.${column.name}`,
      });
    }
    if (!(runtime?.reconciled_columns || []).includes(column.name)) {
      findings.push({
        code: 'missing_runtime_column_reconciliation',
        message: `setup route does not reconcile action_records.${column.name}`,
      });
    }
  }

  for (const index of schema.required_indexes || []) {
    if (!(setupContract?.reconciled_indexes || []).includes(index.name)) {
      findings.push({
        code: 'missing_setup_index_reconciliation',
        message: `setup contract does not declare reconciliation for ${index.name}`,
      });
    }
    if (!(runtime?.reconciled_indexes || []).includes(index.name)) {
      findings.push({
        code: 'missing_runtime_index_reconciliation',
        message: `setup route does not reconcile ${index.name}`,
      });
    }
  }

  for (const column of runtime?.reconciled_columns || []) {
    if (!(setupContract?.reconciled_columns || []).includes(column)) {
      findings.push({
        code: 'undeclared_runtime_column_reconciliation',
        message: `setup route reconciles action_records.${column} but contracts/setup/runtime-migration.json does not declare it`,
      });
    }
  }

  for (const index of runtime?.reconciled_indexes || []) {
    if (!(setupContract?.reconciled_indexes || []).includes(index)) {
      findings.push({
        code: 'undeclared_runtime_index_reconciliation',
        message: `setup route reconciles ${index} but contracts/setup/runtime-migration.json does not declare it`,
      });
    }
  }

  return { ok: findings.length === 0, findings };
}
