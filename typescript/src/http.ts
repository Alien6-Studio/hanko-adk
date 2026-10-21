export type HankoFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface HankoHttpOptions {
  readonly fetch?: HankoFetch;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
}

/** Bound the complete request, including streamed response consumption. */
export async function requestHankoJson<T>(
  input: string | URL,
  init: RequestInit,
  options: HankoHttpOptions,
  expected: readonly number[] = [200],
): Promise<T> {
  const timeout = options.timeoutMs ?? 5_000;
  const limit = options.maxResponseBytes ?? 1_048_576;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60_000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 1_048_576) {
    throw new Error("Invalid Hanko HTTP limits");
  }
  const controller = new AbortController();
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const aborted = new Promise<never>((_, reject) => {
    if (signal.aborted) reject(new Error("Hanko HTTP request aborted"));
    else signal.addEventListener("abort", () => reject(new Error("Hanko HTTP request aborted")), { once: true });
  });
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await Promise.race([aborted, (async (): Promise<T> => {
      const response = await (options.fetch ?? globalThis.fetch)(input, { ...init, redirect: "error", signal });
      signal.throwIfAborted();
      if (response.redirected || !expected.includes(response.status)) {
        void response.body?.cancel().catch(() => undefined);
        throw new Error(`Hanko HTTP request returned status ${response.status}`);
      }
      if (response.status === 204 || response.status === 404) {
        void response.body?.cancel().catch(() => undefined);
        return undefined as T;
      }
      if (Number(response.headers.get("Content-Length")) > limit) {
        void response.body?.cancel().catch(() => undefined);
        throw new Error("Hanko HTTP response exceeds its byte limit");
      }
      reader = response.body?.getReader();
      if (!reader) throw new Error("Hanko HTTP response is empty");
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        signal.throwIfAborted();
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > limit) throw new Error("Hanko HTTP response exceeds its byte limit");
        chunks.push(part.value);
      }
      const data = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data)) as T;
    })()]);
  } finally {
    clearTimeout(timer);
    controller.abort();
    void reader?.cancel().catch(() => undefined);
  }
}
