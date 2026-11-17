# Add a booking assistant that suggests free rooms from plain text

## Summary

Adds a request box above the booking form on `/bookings`. A member types something like "room for 6 tomorrow 2-3pm", the server asks a Workers AI model to turn that into a UTC slot, and the free rooms for that slot are listed. Clicking a room prefills the existing booking form; the assistant never books anything itself. Spec: `docs/specs/booking-assistant.md`.

## What changed

- **Service** (`packages/services/src/assistant.ts`, exported as `@repo/services/assistant`)
  - `createAssistantService(db, parseSlot, now)` takes the parser as a parameter, so the service never reads `env`.
  - `suggest({ text })` validates the input, calls the parser, re-validates the model output with zod (`attendees` defaults to 1, `startsAt`/`endsAt` must be ISO datetimes), rejects an end at or before the start, and then calls `availability.freeRooms`.
  - Returns `{ ok: true, slot, rooms }` or `{ ok: false, error }`. A throwing parser becomes the friendly "couldn't understand" message instead of an exception.
- **Model adapter** (`apps/web/src/server/assistant-model.ts`)
  - `createWorkersAiParser(ai)` is the only code that calls `env.AI.run`, using `@cf/meta/llama-3.1-8b-instruct-fp8`. The model only extracts literal fields (`attendees`, `day` as written, `start`, `end` as `HH:MM`) and does no date math; it returns null for anything not stated.
  - Pulls the first `{...}` object out of the reply, so JSON wrapped in prose or a code fence still parses. Anything else throws, and the service maps that to the friendly error.
- **Slot resolver** (`packages/services/src/assistant-slot.ts`, exported as `@repo/services/assistant-slot`)
  - `resolveSlot(fields, now)` turns the extracted fields into `{ attendees, startsAt, endsAt }` in UTC: today, tomorrow, the next occurrence of a weekday, or a `YYYY-MM-DD` date. It returns null when the day, start or end is missing, so a request without an end time is rejected rather than guessed. The service contract is unchanged.
- **Wiring**
  - `apps/web/src/server/trpc/context.ts` builds the assistant service from `bindings.AI`, the one place bindings are read.
  - `apps/web/wrangler.jsonc` adds `"ai": { "binding": "AI" }`.
  - `packages/db/src/shared.ts` exports the input length limit and any type the UI needs.
  - `packages/services/package.json` adds the `./assistant` export.
- **Router** (`apps/web/src/server/trpc/routers/assistant.ts`, registered in `router.ts`)
  - One `suggest` query. The input schema comes from the service, and the router makes one service call.
- **UI**
  - New `apps/web/src/components/bookings/AssistantBox.tsx`: text input, "Ask" button, the free-room list, the parsed slot when nothing is free, and errors through `FormError`.
  - `bookings.tsx` sets the room and day through `navigate`, and passes the prefill (start, end, attendees) into the existing `BookingForm`.
  - `BookingForm.tsx` accepts that prefill. Submitting still goes through the normal validation and daily booking limit.
- **Tests**
  - `packages/services/src/assistant.test.ts` uses `createTestDatabase()`, the shared fixtures, and a fake parser. It covers a valid slot with a booked room excluded, a room under the attendee count excluded, garbage output, a missing time, an end before the start, and a throwing parser.
- **Dev tooling**
  - `.claude/launch.json` adds a dev server configuration.

## Testing

- `bun test`: 72 pass, 1 skip, 0 fail (includes tests for the slot resolver).
- `bun run check`: passes (lint and typecheck in every package).
- Manual check on `bun run dev`:
  - Request: a request such as "room for 4 tomorrow 10-11" lists free rooms for that slot.
  - Room prefill: clicking a room sets the room, day, start, end and attendees in the form.
  - Booking: submitting the prefilled form books through the existing flow.
  - Bad request: an unparseable request shows a clear message.

## Notes for reviewers

- Workers AI calls work locally only after `wrangler login`, and each call may incur usage on the Cloudflare account. The model adapter is not unit-tested; it is checked by hand only, per the spec.
- Small models can return refusals or malformed JSON. The zod check in the service and the friendly "couldn't understand" error cover both. A reply of `{}` (no time given) is rejected by the same check and shows "Tell me a day and a time range."
- The adapter pulls the first `{...}` object out of the reply, so a model that wraps its JSON in prose still works. If a reply contains more than one object, only the first is used.
- The first version asked the model for ISO datetimes. Testing on the dev server showed the 8B model resolving "next Monday" to a Saturday and guessing an end time for "at 5pm". Dates are now resolved in code (see the slot resolver). Checked by hand, 5 runs each: "room for 4 tomorrow 10-11", "room for 6 tomorrow 2-3pm", "a room next Monday 9 to 10am" and "room on Friday 1 to 2pm" all resolved correctly; "room for 3 at 5pm" and "book something nice" were rejected every time. The model can still occasionally return a non-JSON reply, which shows the friendly error.
- Times are UTC throughout, as elsewhere in the app. Time zones other than UTC, booking from the assistant, multi-turn chat, and suggesting alternative times are out of scope.
- No rate limiting, streaming, or saved request history yet.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
