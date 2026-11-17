# Booking assistant: status

Written when development was stopped. Spec: [booking-assistant.md](./booking-assistant.md). Plan: [booking-assistant-plan.md](./booking-assistant-plan.md).

## Current state

- Branch `booking-assistant` at `dba6a5c`. `bun test`: 72 pass, 1 skip, 0 fail. `bun run check` passes.
- PR [#1](https://github.com/jimtcp/claude-code-workshop-teamdesk/pull/1) is open. Its head is `91289ee`; `dba6a5c` is local only and not pushed.
- The feature was first committed in `46a3dc9`, before this work started.

## Done

- Reviewed the backend and UI against the spec. Both matched, apart from the items below.
- Router now returns `{ ok, ... }` as spec step 4 says, and the UI reads `ok`/`error` (`c237f96`).
- Added a test for a request with a start but no end time (`dddff7d`).
- Moved date resolution out of the model. The model extracts `day`, `start`, `end` and `attendees` as written; `resolveSlot` in `packages/services/src/assistant-slot.ts` (tested) computes the UTC slot and rejects a missing day, start or end (`91289ee`).
- Prompt now tells the model not to reorder or correct times, with reversed-range examples (`dba6a5c`).
- Plan, PR description draft (`booking-assistant-pr.md`) and spec status committed.
- Hand-checked on `bun run dev`: request, room prefill, booking through the existing form, and an unparseable request.

## Known issues

- On `91289ee` (what the PR holds), "tomorrow 3-2pm" returned `ok:true` as 2-3pm in 4 of 10 calls instead of being rejected. `dba6a5c` fixes this (10 of 10 rejected in one sample of 10) but is not pushed.
- Valid requests occasionally return "The assistant couldn't understand that. Try again or use the form." when the model's reply has no usable JSON. This is the spec's handling for that failure, but it showed up in about 1 of 10 runs on "room for 6 tomorrow 2-3pm" (2 of 80 across the earlier sample).
- All model checks were small samples (10-15 calls) against one model, `@cf/meta/llama-3.1-8b-instruct-fp8`. Results vary between runs.
- The PR has no CI checks configured, so test results are from local runs only.
- The PR description says dates are verified 5 runs each; it does not mention the reversed-range fix or the flake above.

## Outstanding

1. Decide whether to push `dba6a5c` and this file to the PR branch.
2. Optional: retry the model call once when its reply has no usable JSON, to reduce the flake above. A first attempt was discarded unfinished: it passed tests but failed lint (`noAwaitInLoops`) and had not been re-checked, so nothing from it is in the repo.
3. Update the PR description for the reversed-range fix and the flake.
4. Re-run a larger sample on the dev server before merging (local Workers AI needs `wrangler login` and may incur usage).
5. Local `main` is ahead of `origin/main` with the same commits as the PR; reset it if unwanted.
