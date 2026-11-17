// The only code that calls Workers AI. The model only extracts literal fields
// from the request; dates are resolved in code (assistant-slot.ts), because
// the small model does unreliable date math.
import type { SlotParser } from "@repo/services/assistant";
import { resolveSlot, type SlotFields } from "@repo/services/assistant-slot";

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

const JSON_OBJECT = /\{[\s\S]*\}/;

/** Models may wrap the JSON in prose or a code fence; take the object. */
const extractJson = (response: unknown): unknown => {
  if (typeof response !== "string") {
    return response;
  }
  const match = JSON_OBJECT.exec(response);
  if (!match) {
    throw new Error(`No JSON in model reply: ${response.slice(0, 200)}`);
  }
  return JSON.parse(match[0]);
};

const SYSTEM_PROMPT = [
  "You extract literal fields from a room booking request. Do no date math.",
  "Return only a JSON object with exactly these keys:",
  "attendees (integer or null), day (string or null),",
  "start (HH:MM 24-hour string or null), end (HH:MM 24-hour string or null).",
  "day is copied exactly as written: today, tomorrow, a weekday name",
  "(like monday), or a YYYY-MM-DD date. Drop words like next or on.",
  "start and end are the times the request states, converted to 24-hour HH:MM.",
  "In a range like 10-11 without am or pm, use morning hours; 2-3pm is 14:00 and 15:00.",
  "Use null for anything the request does not state.",
  "Never infer or invent an end time: a request with only one time has end null.",
  "Extract times exactly in the order and with the values written: the first time is start, the second is end.",
  "Never swap, reorder, correct or reinterpret times, even when the end is earlier than the start (a reversed range is returned as written; code rejects it later).",
  "Reply with the JSON object only, no other text.",
  "Examples:",
  '"tomorrow 3-2pm" -> {"attendees":null,"day":"tomorrow","start":"15:00","end":"14:00"}',
  '"tomorrow 11-10am" -> {"attendees":null,"day":"tomorrow","start":"11:00","end":"10:00"}',
  '"room for 6 tomorrow 2-3pm" -> {"attendees":6,"day":"tomorrow","start":"14:00","end":"15:00"}',
  '"a room next Monday 9 to 10am" -> {"attendees":null,"day":"monday","start":"09:00","end":"10:00"}',
  '"room on Friday 1 to 2pm" -> {"attendees":null,"day":"friday","start":"13:00","end":"14:00"}',
  '"room for 3 at 5pm" -> {"attendees":3,"day":null,"start":"17:00","end":null}',
  '"room for 2 today at 4pm" -> {"attendees":2,"day":"today","start":"16:00","end":null}',
  '"book something nice" -> {"attendees":null,"day":null,"start":null,"end":null}',
].join(" ");

/** Builds the parser from the Workers AI binding. */
export const createWorkersAiParser =
  (ai: Ai): SlotParser =>
  async (text, now) => {
    try {
      const output = (await ai.run(MODEL, {
        messages: [
          { content: SYSTEM_PROMPT, role: "system" },
          { content: text, role: "user" },
        ],
      })) as { response?: unknown };
      const fields = extractJson(output.response) as SlotFields;
      // {} makes the service answer "Tell me a day and a time range."
      return resolveSlot(fields, now) ?? {};
    } catch (error) {
      // The service turns this into a friendly message; keep the cause visible.
      console.error("assistant: model call failed", error);
      throw error;
    }
  };
