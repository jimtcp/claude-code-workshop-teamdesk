import { BOOKING_TITLE_MAX_LENGTH } from "@repo/db/shared";
import { type FormEvent, useCallback } from "react";
import FormError from "#/components/form-error";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { isoFromDayAndTime } from "#/lib/datetime";

export interface BookingDraft {
  attendees: number;
  endsAt: string;
  startsAt: string;
  title: string;
}

/** Values the assistant fills in; remount the form (via `key`) to apply. */
export interface BookingPrefill {
  attendees: number;
  endTime: string;
  startTime: string;
}

interface BookingFormProps {
  capacity: number;
  /** The chosen UTC day, YYYY-MM-DD. */
  day: string;
  error: string | null;
  onSubmit: (draft: BookingDraft) => Promise<boolean>;
  pending: boolean;
  prefill: BookingPrefill;
}

export default function BookingForm({
  capacity,
  day,
  error,
  onSubmit,
  pending,
  prefill,
}: BookingFormProps) {
  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const ok = await onSubmit({
        attendees: Number(data.get("attendees")),
        endsAt: isoFromDayAndTime(day, String(data.get("endsAt"))),
        startsAt: isoFromDayAndTime(day, String(data.get("startsAt"))),
        title: String(data.get("title") ?? ""),
      });
      if (ok) {
        form.reset();
      }
    },
    [day, onSubmit]
  );

  return (
    <form className="island-shell p-6 sm:p-8" onSubmit={handleSubmit}>
      <p className="island-kicker mb-3">New booking on {day} (times in UTC)</p>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm" htmlFor="booking-title">
          Title
          <Input
            id="booking-title"
            maxLength={BOOKING_TITLE_MAX_LENGTH}
            name="title"
            required
          />
        </label>
        <label className="grid gap-1 text-sm" htmlFor="booking-start">
          Start
          <Input
            defaultValue={prefill.startTime}
            id="booking-start"
            name="startsAt"
            required
            step={900}
            type="time"
          />
        </label>
        <label className="grid gap-1 text-sm" htmlFor="booking-end">
          End
          <Input
            defaultValue={prefill.endTime}
            id="booking-end"
            name="endsAt"
            required
            step={900}
            type="time"
          />
        </label>
        <label className="grid gap-1 text-sm" htmlFor="booking-attendees">
          Attendees
          <Input
            defaultValue={prefill.attendees}
            id="booking-attendees"
            max={capacity}
            min={1}
            name="attendees"
            required
            type="number"
          />
        </label>
        <Button disabled={pending} type="submit">
          {pending ? "Booking…" : "Book"}
        </Button>
      </div>
      <FormError message={error} />
    </form>
  );
}
