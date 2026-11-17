import { ASSISTANT_TEXT_MAX_LENGTH } from "@repo/db/shared";
import { type FormEvent, useCallback, useState } from "react";
import FormError from "#/components/form-error";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { getTrpc } from "#/integrations/trpc/client";
import { formatUtcRange } from "#/lib/datetime";

type Suggestion = Extract<
  Awaited<
    ReturnType<ReturnType<typeof getTrpc>["assistant"]["suggest"]["query"]>
  >,
  { ok: true }
>;

interface AssistantBoxProps {
  /** Called when the member picks a suggested room. */
  onPick: (roomId: string, slot: Suggestion["slot"]) => void;
}

interface RoomChoiceProps {
  onPick: AssistantBoxProps["onPick"];
  room: Suggestion["rooms"][number];
  slot: Suggestion["slot"];
}

function RoomChoice({ onPick, room, slot }: RoomChoiceProps) {
  const handleClick = useCallback(
    () => onPick(room.id, slot),
    [onPick, room.id, slot]
  );
  return (
    <Button onClick={handleClick} type="button" variant="outline">
      {room.name} (seats {room.capacity})
    </Button>
  );
}

export default function AssistantBox({ onPick }: AssistantBoxProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const text = String(
        new FormData(event.currentTarget).get("request") ?? ""
      );
      setPending(true);
      setError(null);
      try {
        const result = await getTrpc().assistant.suggest.query({ text });
        if (result.ok) {
          setSuggestion(result);
        } else {
          setSuggestion(null);
          setError(result.error);
        }
      } catch (err) {
        setSuggestion(null);
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setPending(false);
      }
    },
    []
  );

  return (
    <section className="island-shell p-6 sm:p-8">
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <Input
          aria-label="Ask the booking assistant"
          maxLength={ASSISTANT_TEXT_MAX_LENGTH}
          name="request"
          placeholder="e.g. room for 6 tomorrow 2-3pm"
          required
        />
        <Button disabled={pending} type="submit">
          {pending ? "Asking…" : "Ask"}
        </Button>
      </form>
      <FormError message={error} />
      {suggestion ? (
        <div className="mt-4">
          <p className="mb-2 text-muted-foreground text-sm">
            {formatUtcRange(suggestion.slot.startsAt, suggestion.slot.endsAt)}{" "}
            on {suggestion.slot.startsAt.slice(0, 10)}, for{" "}
            {suggestion.slot.attendees}
          </p>
          {suggestion.rooms.length === 0 ? (
            <p className="text-sm">No rooms are free for that slot.</p>
          ) : (
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {suggestion.rooms.map((room) => (
                <li key={room.id}>
                  <RoomChoice
                    onPick={onPick}
                    room={room}
                    slot={suggestion.slot}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
