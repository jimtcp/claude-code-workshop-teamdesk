// The only code that calls Workers AI. Turns a booking request into raw slot
// JSON; the assistant service validates whatever comes back.
import type { SlotParser } from "@repo/services/assistant";

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

const systemPrompt = (now: Date) =>
  [
    "You turn a room booking request into JSON.",
    `The current time is ${now.toISOString()}. All times are UTC.`,
    "Return only a JSON object with startsAt and endsAt as ISO 8601 UTC",
    "datetimes (like 2026-10-23T14:00:00.000Z) and attendees as an integer.",
    "Use 1 for attendees if the request does not say.",
    "Resolve words like today and tomorrow from the current time.",
    "If the request gives no day or no time range, return an empty object {}.",
    "Never guess a time that was not asked for.",
  ].join(" ");

/** Builds the parser from the Workers AI binding. */
export const createWorkersAiParser =
  (ai: Ai): SlotParser =>
  async (text, now) => {
    try {
      const output = (await ai.run(MODEL, {
        messages: [
          { content: systemPrompt(now), role: "system" },
          { content: text, role: "user" },
        ],
      })) as { response?: unknown };
      return extractJson(output.response);
    } catch (error) {
      // The service turns this into a friendly message; keep the cause visible.
      console.error("assistant: model call failed", error);
      throw error;
    }
  };
