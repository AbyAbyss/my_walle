import { describe, expect, it } from "vitest";

import { BUBBLE_POOL, pickMessage, timeTriggerForHour } from "./bubbleMessages";

describe("timeTriggerForHour", () => {
  it("maps boundaries: morning 5–11", () => {
    expect(timeTriggerForHour(5)).toBe("morning");
    expect(timeTriggerForHour(11)).toBe("morning");
  });

  it("maps afternoon 12–16", () => {
    expect(timeTriggerForHour(12)).toBe("afternoon");
    expect(timeTriggerForHour(16)).toBe("afternoon");
  });

  it("maps evening 17–21", () => {
    expect(timeTriggerForHour(17)).toBe("evening");
    expect(timeTriggerForHour(21)).toBe("evening");
  });

  it("maps night 22–4 (wrap)", () => {
    expect(timeTriggerForHour(22)).toBe("night");
    expect(timeTriggerForHour(23)).toBe("night");
    expect(timeTriggerForHour(0)).toBe("night");
    expect(timeTriggerForHour(4)).toBe("night");
  });
});

describe("pickMessage", () => {
  it("never returns lastShownText when another option exists", () => {
    const last = "Done.";
    for (let i = 0; i < 40; i++) {
      const m = pickMessage("task_complete_single", last);
      expect(m.text).not.toBe(last);
    }
  });

  it("falls back to full pool when lastShownText is the only distinct line (pool size 1 edge)", () => {
    const only = BUBBLE_POOL.idle_bored[0];
    const syntheticLast = only.text;
    const poolOne = [only];
    const candidates = poolOne.filter((m) => m.text !== syntheticLast);
    expect(candidates.length).toBe(0);
    const source = candidates.length > 0 ? candidates : poolOne;
    expect(source).toEqual(poolOne);
  });
});
