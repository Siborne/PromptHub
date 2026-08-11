import { vi } from "vitest";

export function createTransactionMock(getAllResult: unknown[] = []) {
  const transaction: {
    error: null;
    objectStore: (name: string) => {
      add: ReturnType<typeof vi.fn>;
      clear: ReturnType<typeof vi.fn>;
      getAll: ReturnType<typeof vi.fn>;
    };
    oncomplete: (() => void) | null;
    onerror: (() => void) | null;
  } = {
    error: null,
    objectStore: () => ({
      add: vi.fn(),
      clear: vi.fn(),
      getAll: vi.fn(() => {
        const request: {
          result?: unknown[];
          onsuccess: (() => void) | null;
          onerror: (() => void) | null;
        } = {
          result: getAllResult,
          onsuccess: null,
          onerror: null,
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      }),
    }),
    oncomplete: null,
    onerror: null,
  };

  queueMicrotask(() => transaction.oncomplete?.());
  return transaction;
}
