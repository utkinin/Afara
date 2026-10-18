// Stable snapshots compare stored content independently of object key order.
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]))
  return value
}
export const canonicalContent = (value: unknown) => JSON.stringify(ordered(value))
export const sameContent = (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b)
