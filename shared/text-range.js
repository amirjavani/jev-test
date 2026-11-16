// Text numbers are one-based and both ends are inclusive. Blank bounds mean all.
export function selectTextRange(items, { start = '', end = '' } = {}) {
  if (!items.length) throw new Error('Add 1–500 texts.');
  const first = start === '' ? 1 : Number(start);
  const last = end === '' ? items.length : Number(end);
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > items.length) {
    throw new Error(`Enter a text range from 1 to ${items.length}, with From no greater than To.`);
  }
  return { items: items.slice(first - 1, last), first, last };
}
