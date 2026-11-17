// Booking assistant: turns a plain-language request into a slot and the rooms
// free for it. The model call is passed in, so this never touches bindings.
import type { Database } from "@repo/db";
import { ASSISTANT_TEXT_MAX_LENGTH, type Room } from "@repo/db/shared";
import { z } from "zod";
import { createAvailabilityService } from "./availability.ts";

export const suggestInput = z.object({
  text: z.string().trim().min(1).max(ASSISTANT_TEXT_MAX_LENGTH),
});

export type SuggestInput = z.input<typeof suggestInput>;

/** What the model must return. */
export const parsedSlot = z.object({
  attendees: z.int().min(1).default(1),
  endsAt: z.iso.datetime(),
  startsAt: z.iso.datetime(),
});

export interface SuggestedSlot {
  attendees: number;
  endsAt: string;
  startsAt: string;
}

export type SuggestResult =
  | { ok: true; rooms: Room[]; slot: SuggestedSlot }
  | { ok: false; error: string };

/** Reads a request and returns raw model output, validated by the service. */
export type SlotParser = (text: string, now: Date) => Promise<unknown>;

export interface AssistantService {
  /** Free rooms for the slot described in `text`. */
  suggest: (input: SuggestInput) => Promise<SuggestResult>;
}

const UNDERSTAND_ERROR =
  "The assistant couldn't understand that. Try again or use the form.";
const NEED_TIME_ERROR = "Tell me a day and a time range.";

export const createAssistantService = (
  db: Database,
  parseSlot: SlotParser,
  now: () => Date = () => new Date()
): AssistantService => {
  const availability = createAvailabilityService(db);
  return {
    suggest: async (input) => {
      const request = suggestInput.safeParse(input);
      if (!request.success) {
        return { error: "Describe the booking you need.", ok: false };
      }
      let raw: unknown;
      try {
        raw = await parseSlot(request.data.text, now());
      } catch {
        return { error: UNDERSTAND_ERROR, ok: false };
      }
      const slot = parsedSlot.safeParse(raw);
      if (!slot.success) {
        return { error: NEED_TIME_ERROR, ok: false };
      }
      const startsAt = new Date(slot.data.startsAt).toISOString();
      const endsAt = new Date(slot.data.endsAt).toISOString();
      if (endsAt <= startsAt) {
        return { error: NEED_TIME_ERROR, ok: false };
      }
      const free = await availability.freeRooms({
        attendees: slot.data.attendees,
        endsAt,
        startsAt,
      });
      if (!free.ok) {
        return { error: free.error, ok: false };
      }
      return {
        ok: true,
        rooms: free.rooms,
        slot: { attendees: slot.data.attendees, endsAt, startsAt },
      };
    },
  };
};
