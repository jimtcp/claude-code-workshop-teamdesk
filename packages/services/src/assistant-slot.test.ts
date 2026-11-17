import { describe, expect, test } from "bun:test";
import { resolveSlot } from "./assistant-slot.ts";

// Tuesday.
const now = new Date("2026-11-17T08:30:00.000Z");

describe("resolveSlot", () => {
  test("next Monday from a Tuesday is the following week", () => {
    expect(
      resolveSlot({ day: "Monday", end: "10:00", start: "09:00" }, now)
    ).toEqual({
      attendees: 1,
      endsAt: "2026-11-23T10:00:00.000Z",
      startsAt: "2026-11-23T09:00:00.000Z",
    });
  });

  test("the same weekday as today means a week later", () => {
    expect(
      resolveSlot({ day: "tuesday", end: "10:00", start: "09:00" }, now)
        ?.startsAt
    ).toBe("2026-11-24T09:00:00.000Z");
  });

  test("tomorrow", () => {
    expect(
      resolveSlot(
        { attendees: 6, day: "tomorrow", end: "15:00", start: "14:00" },
        now
      )
    ).toEqual({
      attendees: 6,
      endsAt: "2026-11-18T15:00:00.000Z",
      startsAt: "2026-11-18T14:00:00.000Z",
    });
  });

  test("today", () => {
    expect(
      resolveSlot({ day: "today", end: "17:30", start: "16:00" }, now)
    ).toEqual({
      attendees: 1,
      endsAt: "2026-11-17T17:30:00.000Z",
      startsAt: "2026-11-17T16:00:00.000Z",
    });
  });

  test("an ISO date", () => {
    expect(
      resolveSlot({ day: "2026-12-01", end: "11:00", start: "10:00" }, now)
        ?.startsAt
    ).toBe("2026-12-01T10:00:00.000Z");
  });

  test("a missing end, start or day is null", () => {
    expect(resolveSlot({ day: "today", end: null, start: "17:00" }, now)).toBe(
      null
    );
    expect(resolveSlot({ day: "today", end: "18:00", start: null }, now)).toBe(
      null
    );
    expect(resolveSlot({ day: null, end: "18:00", start: "17:00" }, now)).toBe(
      null
    );
  });

  test("unresolvable values are null", () => {
    expect(
      resolveSlot({ day: "someday", end: "18:00", start: "17:00" }, now)
    ).toBe(null);
    expect(
      resolveSlot({ day: "2026-02-31", end: "18:00", start: "17:00" }, now)
    ).toBe(null);
    expect(
      resolveSlot({ day: "today", end: "18:00", start: "25:00" }, now)
    ).toBe(null);
  });

  test("an end before the start is returned as is, for the service to reject", () => {
    const slot = resolveSlot(
      { day: "today", end: "09:00", start: "10:00" },
      now
    );
    expect(slot && slot.endsAt < slot.startsAt).toBe(true);
  });

  test("attendees default to 1 when missing or invalid", () => {
    const base = { day: "today", end: "18:00", start: "17:00" };
    expect(resolveSlot({ ...base, attendees: null }, now)?.attendees).toBe(1);
    expect(resolveSlot({ ...base, attendees: 0 }, now)?.attendees).toBe(1);
    expect(resolveSlot({ ...base, attendees: 4 }, now)?.attendees).toBe(4);
  });
});
