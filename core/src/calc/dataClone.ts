/** JSON-only configuration factories must return fresh nested objects and arrays. */
export function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
