const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function normalizeUsage(value) {
  const input_tokens = count(value?.input_tokens) ?? count(value?.prompt_tokens);
  const output_tokens = count(value?.output_tokens) ?? count(value?.completion_tokens);
  const total_tokens = count(value?.total_tokens) ?? (input_tokens !== null && output_tokens !== null ? count(input_tokens + output_tokens) : null);
  if (input_tokens === null && output_tokens === null && total_tokens === null) return null;
  return { input_tokens, output_tokens, total_tokens };
}

// Older saved runs keep usage inside data; new responses preserve it separately,
// including moderation responses whose data contains only boolean decisions.
export const responseUsage = response => normalizeUsage(response?.usage) || normalizeUsage(response?.data?.usage);

export function summarizeUsage(entries) {
  const finished = entries.filter(entry => ['success', 'error', 'cancelled'].includes(entry.status));
  const usage = finished.map(entry => responseUsage(entry.response));
  const reported = {};
  const totals = {};
  for (const field of ['input_tokens', 'output_tokens', 'total_tokens']) {
    const values = usage.map(item => item?.[field]).filter(value => value !== null && value !== undefined);
    reported[field] = values.length;
    totals[field] = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }
  return { totals, reported, finished: finished.length, partial: finished.length > 0 && Object.values(reported).some(value => value < finished.length) };
}
