# Booking assistant

Status: draft. Scope: about 20 minutes to build.

## Goal

On the Bookings page, a member types a plain-language request such as "room for 6 tomorrow 2-3pm". The assistant works out the slot, shows which rooms are free, and lets the member pick one. Picking a room prefills the existing booking form. The assistant never books anything itself.

## Decisions (from the interview)

| Question | Decision |
| --- | --- |
| What does it do? | Suggest, then the member confirms. No booking, no cancelling. |
| Interface | One-shot request box. No chat history, no clarifying questions. |
| Model access | Cloudflare Workers AI binding (`AI`). No external API key. |
| Scope | Parse the request into one slot and list free rooms. No searching for alternative times. |
| Clicking a suggestion | Prefills the existing `BookingForm`. The member submits it normally. |

## Behaviour

1. A text input plus an "Ask" button sits above the booking form on `/bookings`.
2. On submit, the client sends `{ text }` to a new tRPC query. The server sends the text and the current time to the model, which returns structured JSON:
   `{ attendees: number, startsAt: ISO, endsAt: ISO }`.
3. The server validates that JSON with zod, then calls the existing `availability.freeRooms`.
4. The response is `{ ok: true, slot, rooms }` or `{ ok: false, error }`.
5. The UI lists each free room (name, seats). Clicking one sets the page's room and day to match the slot, and prefills the form's start time, end time and attendees. The member reviews and submits the form as usual, so the existing validation and the daily booking limit still apply.
6. If no rooms are free, the UI says so and shows the parsed slot, so the member can see what was understood.

Rules for the parser prompt:
- All times are UTC, as everywhere else in the app.
- "Now" is passed in by the caller, so relative words like "tomorrow" resolve deterministically.
- Missing attendees defaults to 1.
- A request with no usable time, or an end before the start, returns `ok: false` with a short message ("Tell me a day and a time range."). The model is not asked to guess.

## Design (follows the layering rules in CLAUDE.md)

- **Service**: new `packages/services/src/assistant.ts`, exported as `@repo/services/assistant` in `package.json` `exports`.
  - `createAssistantService(db, parseSlot)` where `parseSlot: (text: string, now: Date) => Promise<unknown>` is passed in. The service never reads `env`.
  - `suggest({ text })` re-parses its input with zod, validates the model's output, calls `availability.freeRooms`, and returns a result object like `availability.ts`.
  - Validation and business rules live here, not in the router.
- **Model adapter**: a small function in `apps/web/src/server/` that wraps `env.AI.run(...)` with the parser prompt and JSON-only output. This is the only code that touches the `AI` binding.
- **Wiring**: add the service in `apps/web/src/server/trpc/context.ts`, building `parseSlot` from `bindings.AI` in `createContext` (the one place bindings are read). Add `"ai": { "binding": "AI" }` to `apps/web/wrangler.jsonc`, then run `bun run cf-typegen`. Do not hand-edit `worker-configuration.d.ts`.
- **Router**: new thin `routers/assistant.ts` with one `suggest` query. The input schema comes from the service. Register it in `router.ts`.
- **UI**: a new `apps/web/src/components/bookings/AssistantBox.tsx`, used from `bookings.tsx`. The page wires the prefill into its existing route state: `navigate` for room and day, plus draft state for `BookingForm`. Only `@repo/db/shared` is imported from browser code. Put the result type there if the UI needs it.
- **Errors**: input problems return `{ ok: false, error }`. Model failures (the call throws, or the output is not valid JSON) become `ok: false, error: "The assistant couldn't understand that. Try again or use the form."`. The UI shows it through `FormError`.

## Out of scope

- Booking, rescheduling or cancelling from the assistant.
- Multi-turn chat or clarifying questions.
- Suggesting alternative times when nothing is free.
- Time zones other than UTC.
- Rate limiting, streaming and saved history.

## Tests

- `packages/services/src/assistant.test.ts` uses `createTestDatabase()` and `fixtures.ts`, with a fake `parseSlot` instead of the real model:
  - a valid parse returns the free rooms for the slot, and a booked room is excluded;
  - a room under the attendee count is excluded;
  - garbage model output, a missing time, or an end before the start gives `ok: false`;
  - a throwing parser gives the friendly error rather than a thrown exception.
- The model adapter is not unit-tested. Check it once by hand with `bun run dev` (Workers AI works locally only with a Cloudflare login; note this in the PR).
- `bun run check` passes.

## Done when

- Typing "room for 4 tomorrow 10-11" on `/bookings` lists the free rooms for that slot.
- Clicking a room prefills the form, and submitting books it through the existing flow.
- Bad or unparseable requests show a clear message.
- Service tests and `bun run check` pass.

## Risks to watch while building

- Workers AI small models can return malformed JSON. The zod check and the friendly error cover this, so keep the prompt strict and ask for JSON only.
- Local Workers AI calls need `wrangler login` and may incur usage. Mention this when running `bun run dev`.
