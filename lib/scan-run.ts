// A result belongs only to the file/submission that started it.
export function createScanRun() {
  let generation = 0;
  let controller: AbortController | null = null;
  function invalidate() { generation++; controller?.abort(); }
  return {
    invalidate,
    begin() {
      invalidate();
      controller = new AbortController();
      const current = generation;
      return { signal: controller.signal, active: () => generation === current };
    }
  };
}
