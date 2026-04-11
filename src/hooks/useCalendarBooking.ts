import { useState, useCallback } from "react";
import { useMsalAuth } from "./useMsalAuth";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, startOfDay, isWeekend, setHours, setMinutes } from "date-fns";

export interface TimeSlot {
  date: Date;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  isFree: boolean;
}

export interface CalendarBookingState {
  isLoadingSlots: boolean;
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  isCreatingEvent: boolean;
  eventId: string | null;
  bookingConfirmed: boolean;
  error: string | null;
}

interface CandidateInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
}

const SLOT_DURATION_MINUTES = 30;
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const LOOKAHEAD_DAYS = 14;

/**
 * Hook for calendar booking with Microsoft Graph API.
 * Handles free/busy lookup, event creation, rescheduling, and post-booking actions.
 * Standalone — not connected to any flow yet.
 */
export function useCalendarBooking() {
  const { callGraphApi, isConfigured, isAuthenticated, error: authError } = useMsalAuth();

  const [state, setState] = useState<CalendarBookingState>({
    isLoadingSlots: false,
    slots: [],
    selectedSlot: null,
    isCreatingEvent: false,
    eventId: null,
    bookingConfirmed: false,
    error: null,
  });

  // Fetch free/busy slots for the next 14 weekdays
  const fetchAvailability = useCallback(
    async (recruiterEmail?: string) => {
      setState(prev => ({ ...prev, isLoadingSlots: true, error: null, slots: [] }));

      try {
        const now = new Date();
        const startDate = startOfDay(now);
        const endDate = addDays(startDate, LOOKAHEAD_DAYS);

        const scheduleRequest = {
          schedules: recruiterEmail ? [recruiterEmail] : [],
          startTime: {
            dateTime: startDate.toISOString(),
            timeZone: "Europe/Copenhagen",
          },
          endTime: {
            dateTime: endDate.toISOString(),
            timeZone: "Europe/Copenhagen",
          },
          availabilityViewInterval: SLOT_DURATION_MINUTES,
        };

        const response = await callGraphApi("/me/calendar/getSchedule", {
          method: "POST",
          body: JSON.stringify(scheduleRequest),
        });

        // Parse availabilityView string - each char represents a 30-min slot
        // 0 = free, 1 = tentative, 2 = busy, 3 = out of office, 4 = working elsewhere
        const schedule = response.value?.[0];
        const availabilityView: string = schedule?.availabilityView || "";

        const slots: TimeSlot[] = [];
        let slotIndex = 0;
        let currentDate = new Date(startDate);

        for (let day = 0; day < LOOKAHEAD_DAYS; day++) {
          const date = addDays(startDate, day);
          
          // Skip weekends
          if (isWeekend(date)) {
            // Still need to advance slotIndex for weekend slots
            const slotsPerDay = ((24 * 60) / SLOT_DURATION_MINUTES);
            slotIndex += slotsPerDay;
            continue;
          }

          // Generate work hour slots for this day
          for (let hour = WORK_START_HOUR; hour < WORK_END_HOUR; hour++) {
            for (let min = 0; min < 60; min += SLOT_DURATION_MINUTES) {
              const slotTime = setMinutes(setHours(date, hour), min);
              const dayStartSlotIndex = day * (24 * 60 / SLOT_DURATION_MINUTES);
              const timeSlotIndex = dayStartSlotIndex + (hour * 60 + min) / SLOT_DURATION_MINUTES;
              
              const availChar = availabilityView[Math.floor(timeSlotIndex)] || "0";
              const isFree = availChar === "0";

              const endMin = min + SLOT_DURATION_MINUTES;
              const endHour = hour + Math.floor(endMin / 60);
              const endMinute = endMin % 60;

              slots.push({
                date: new Date(date),
                startTime: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
                endTime: `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`,
                isFree,
              });
            }
          }
        }

        setState(prev => ({ ...prev, isLoadingSlots: false, slots }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Kunne ikke hente kalender";
        setState(prev => ({ ...prev, isLoadingSlots: false, error: message }));
      }
    },
    [callGraphApi]
  );

  // Create calendar event in Outlook
  const createEvent = useCallback(
    async (slot: TimeSlot, candidate: CandidateInfo, recruiterName: string) => {
      if (!candidate.email) {
        setState(prev => ({ ...prev, error: "Tilføj kandidatens email for at sende invitation" }));
        return null;
      }

      setState(prev => ({ ...prev, isCreatingEvent: true, error: null }));

      try {
        const candidateName = `${candidate.firstName} ${candidate.lastName}`;
        const startDateTime = `${format(slot.date, "yyyy-MM-dd")}T${slot.startTime}:00`;
        const endDateTime = `${format(slot.date, "yyyy-MM-dd")}T${slot.endTime}:00`;

        const eventPayload = {
          subject: `Telefonsamtale — ${candidateName} · ${candidate.role}`,
          start: {
            dateTime: startDateTime,
            timeZone: "Europe/Copenhagen",
          },
          end: {
            dateTime: endDateTime,
            timeZone: "Europe/Copenhagen",
          },
          location: {
            displayName: "Telefonopkald — vi ringer til dig",
          },
          attendees: [
            {
              emailAddress: {
                address: candidate.email,
                name: candidateName,
              },
              type: "required",
            },
          ],
          body: {
            contentType: "HTML",
            content: `<p>Hej ${candidate.firstName},</p>
<p>Vi ringer dig op på dit registrerede telefonnummer til samtalen om stillingen som ${candidate.role}.</p>
<p>Samtalen varer 15–30 minutter.</p>
<p>Venlig hilsen,<br/>${recruiterName}</p>`,
          },
        };

        const response = await callGraphApi("/me/events", {
          method: "POST",
          body: JSON.stringify(eventPayload),
        });

        const eventId = response.id;

        setState(prev => ({
          ...prev,
          isCreatingEvent: false,
          eventId,
          bookingConfirmed: true,
          selectedSlot: slot,
        }));

        return eventId;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Kunne ikke oprette møde — prøv igen";
        setState(prev => ({ ...prev, isCreatingEvent: false, error: message }));
        return null;
      }
    },
    [callGraphApi]
  );

  // Delete existing event (for rescheduling)
  const deleteEvent = useCallback(
    async (eventId: string) => {
      try {
        await callGraphApi(`/me/events/${eventId}`, { method: "DELETE" });
        setState(prev => ({ ...prev, eventId: null, bookingConfirmed: false }));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Kunne ikke slette møde";
        setState(prev => ({ ...prev, error: message }));
        return false;
      }
    },
    [callGraphApi]
  );

  // Post-booking actions: update status, send SMS, log touchpoint
  const executePostBookingActions = useCallback(
    async (
      candidate: CandidateInfo,
      slot: TimeSlot,
      eventId: string
    ) => {
      const dateStr = format(slot.date, "d. MMMM", { locale: undefined });
      const timeStr = slot.startTime;

      // 1. Update candidate status to interview_scheduled
      const statusPromise = supabase
        .from("candidates")
        .update({ status: "interview_scheduled" })
        .eq("id", candidate.id);

      // 2. Send confirmation SMS
      const smsMessage = `Hej ${candidate.firstName}, din telefonsamtale om ${candidate.role} er bekræftet ${dateStr} kl. ${timeStr}. Vi ringer dig op — bare sørg for at være tilgængelig. Glæder os til at tale med dig!`;

      const smsPromise = candidate.phone
        ? supabase.functions.invoke("send-recruitment-sms", {
            body: {
              phoneNumber: candidate.phone,
              message: smsMessage,
              candidateId: candidate.id,
            },
          })
        : Promise.resolve(null);

      // 3. Log touchpoint in booking flow
      const touchpointPromise = supabase
        .from("booking_flow_touchpoints")
        .insert({
          enrollment_id: "", // Will be filled when connected
          day: 0,
          channel: "calendar",
          scheduled_at: new Date().toISOString(),
          status: "sent",
          template_key: "calendar_booking",
        });

      // Execute all three in parallel
      const [statusResult, smsResult] = await Promise.allSettled([
        statusPromise,
        smsPromise,
        touchpointPromise,
      ]);

      return {
        statusUpdated: statusResult.status === "fulfilled",
        smsSent: smsResult.status === "fulfilled",
      };
    },
    []
  );

  // Send reschedule SMS
  const sendRescheduleSms = useCallback(
    async (candidate: CandidateInfo, newSlot: TimeSlot) => {
      if (!candidate.phone) return;

      const dateStr = format(newSlot.date, "d. MMMM");
      const timeStr = newSlot.startTime;
      const message = `Hej ${candidate.firstName}, din telefonsamtale er rykket til ${dateStr} kl. ${timeStr}. Du modtager en opdateret kalenderinvitation. Vi ringer dig op på det nye tidspunkt.`;

      await supabase.functions.invoke("send-recruitment-sms", {
        body: {
          phoneNumber: candidate.phone,
          message,
          candidateId: candidate.id,
        },
      });
    },
    []
  );

  const selectSlot = useCallback((slot: TimeSlot | null) => {
    setState(prev => ({ ...prev, selectedSlot: slot, error: null }));
  }, []);

  const resetBooking = useCallback(() => {
    setState({
      isLoadingSlots: false,
      slots: [],
      selectedSlot: null,
      isCreatingEvent: false,
      eventId: null,
      bookingConfirmed: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    isConfigured,
    isAuthenticated,
    authError,
    fetchAvailability,
    createEvent,
    deleteEvent,
    executePostBookingActions,
    sendRescheduleSms,
    selectSlot,
    resetBooking,
  };
}
