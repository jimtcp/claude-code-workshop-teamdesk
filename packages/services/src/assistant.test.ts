import { beforeEach, describe, expect, test } from "bun:test";
import { insertBooking } from "@repo/db/bookings";
import {
  type AssistantService,
  createAssistantService,
  type SlotParser,
} from "./assistant.ts";
import { at, createTeam, type Team } from "./fixtures.ts";

let team: Team;

const build = (parse: SlotParser): AssistantService =>
  createAssistantService(team.db, parse, () => new Date(at("08:00")));

beforeEach(async () => {
  team = await createTeam();
});

describe("assistant service", () => {
  test("returns the free rooms for the parsed slot", async () => {
    await insertBooking(team.db, {
      attendees: 2,
      endsAt: at("10:00"),
      memberId: team.ana.id,
      roomId: team.bigRoom.id,
      startsAt: at("09:00"),
      title: "Planning",
    });
    const assistant = build(() =>
      Promise.resolve({ endsAt: at("10:00"), startsAt: at("09:00") })
    );

    const result = await assistant.suggest({ text: "a room at nine" });

    expect(result.ok && result.rooms.map((r) => r.name)).toEqual(["Bridge"]);
    expect(result.ok && result.slot.attendees).toBe(1);
  });

  test("leaves out rooms too small for the group", async () => {
    const assistant = build(() =>
      Promise.resolve({
        attendees: 5,
        endsAt: at("10:00"),
        startsAt: at("09:00"),
      })
    );

    const result = await assistant.suggest({ text: "5 people at nine" });

    expect(result.ok && result.rooms.map((r) => r.name)).toEqual(["Harbour"]);
  });

  test("passes the current time to the parser", async () => {
    let seen: Date | undefined;
    const assistant = build((_text, now) => {
      seen = now;
      return Promise.resolve({ endsAt: at("10:00"), startsAt: at("09:00") });
    });

    await assistant.suggest({ text: "tomorrow" });

    expect(seen?.toISOString()).toBe(at("08:00"));
  });

  test("garbage model output is an error", async () => {
    const assistant = build(() => Promise.resolve({ nonsense: true }));

    const result = await assistant.suggest({ text: "hello" });

    expect(result).toEqual({
      error: "Tell me a day and a time range.",
      ok: false,
    });
  });

  test("an end before the start is an error", async () => {
    const assistant = build(() =>
      Promise.resolve({ endsAt: at("09:00"), startsAt: at("10:00") })
    );

    const result = await assistant.suggest({ text: "backwards" });

    expect(result.ok).toBe(false);
  });

  test("a throwing parser gives the friendly error", async () => {
    const assistant = build(() => Promise.reject(new Error("model down")));

    const result = await assistant.suggest({ text: "a room" });

    expect(result.ok === false && result.error).toContain(
      "couldn't understand"
    );
  });

  test("empty text is an error", async () => {
    const assistant = build(() => Promise.resolve({}));

    const result = await assistant.suggest({ text: "   " });

    expect(result.ok).toBe(false);
  });
});
