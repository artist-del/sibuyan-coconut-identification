// Retry only cache/serialized-model failures. Do not disguise memory, network,
// or unsupported-browser errors by repeating an expensive model initialization.
export function isModelCacheFailure(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : "";
  return /QuotaExceededError|CacheStorage|cache\.match|cache\.put|cache storage|protobuf|invalid protobuf|failed to decode.*model/i.test(message);
}
export async function loadWithCacheRecovery<T>(load: (cache: boolean) => Promise<T>) {
  try { return await load(true); }
  catch (error) {
    if (!isModelCacheFailure(error)) throw error;
    return load(false);
  }
}
