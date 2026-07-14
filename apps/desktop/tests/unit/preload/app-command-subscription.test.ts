/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import { createBufferedSubscription } from "../../../src/preload/app-command-subscription";

describe("createBufferedSubscription", () => {
  it("replays commands received before the renderer subscribes", () => {
    const subscription = createBufferedSubscription<number>();
    const listener = vi.fn();

    subscription.publish(1);
    subscription.publish(2);
    subscription.subscribe(listener);

    expect(listener.mock.calls.map(([value]) => value)).toEqual([1, 2]);
  });

  it("delivers live commands to every subscriber and honors unsubscribe", () => {
    const subscription = createBufferedSubscription<string>();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscription.subscribe(first);
    subscription.subscribe(second);

    subscription.publish("first");
    unsubscribeFirst();
    subscription.publish("second");

    expect(first).toHaveBeenCalledOnce();
    expect(second.mock.calls.map(([value]) => value)).toEqual([
      "first",
      "second",
    ]);
  });

  it("bounds pending commands and rejects an invalid capacity", () => {
    const subscription = createBufferedSubscription<number>(2);
    const listener = vi.fn();
    subscription.publish(1);
    subscription.publish(2);
    subscription.publish(3);
    subscription.subscribe(listener);

    expect(listener.mock.calls.map(([value]) => value)).toEqual([2, 3]);
    expect(() => createBufferedSubscription(0)).toThrow(
      "maxPending must be a positive integer",
    );
    expect(() => createBufferedSubscription(1.5)).toThrow(
      "maxPending must be a positive integer",
    );
  });
});
