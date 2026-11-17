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

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The correct answer for "room for 6 tomorrow 2-3pm", so the model copies real dates. */
const exampleSlot = (now: Date) => {
  const day = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);
  return {
    attendees: 6,
    endsAt: `${day}T15:00:00.000Z`,
    startsAt: `${day}T14:00:00.000Z`,
  };
};

const systemPrompt = (now: Date) =>
  [
    "You turn a room booking request into JSON.",
    `The current time is ${now.toISOString()} (a ${WEEKDAYS[now.getUTCDay()]}). All times are UTC.`,
    "Return only a JSON object with startsAt and endsAt as ISO 8601 UTC",
    "datetimes (like 2026-10-23T14:00:00.000Z) and attendees as an integer.",
    "Use 1 for attendees if the request does not say.",
    "Resolve today, tomorrow and weekday names from the current date;",
    "a weekday name means its next occurrence after today.",
    "Times without am or pm in a range like 10-11 are morning hours;",
    "2-3pm means 14:00 to 15:00.",
    "The request must give both a start and an end time.",
    "If it gives no day, or no start and end time, return exactly {}.",
    "Never guess or invent a time that was not asked for.",
    "Reply with the JSON object only, no other text.",
    "Examples, using the current time above:",
    '"room for 6 tomorrow 2-3pm" ->',
    JSON.stringify(exampleSlot(now)),
    '"book something nice" -> {}',
    '"a room at 5pm" -> {}',
    '"room tomorrow" -> {}',
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
