import { Router } from "express";
import { repository } from "../db/repository.js";

export const appointmentsRouter = Router();

appointmentsRouter.get("/", (req, res) => {
  const documentId = String(req.query.documentId ?? "");
  const appointments = repository.listAppointments(documentId, req.userId!);
  if (!appointments) {
    res.status(404).json({ error: "Recovery plan not found" });
    return;
  }
  res.json({ data: appointments });
});

appointmentsRouter.post("/:appointmentId/calendar", (req, res) => {
  const appointment = repository.findAppointment(
    req.params.appointmentId,
    req.userId!,
  );
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }
  if (!appointment.date) {
    res.status(422).json({
      error: "Appointment does not have a confirmed calendar date",
      code: "APPOINTMENT_DATE_UNCONFIRMED",
    });
    return;
  }

  const date = appointment.date.replaceAll(/[-:]/g, "").replace(".000Z", "Z");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DischargeGuide//EN",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@dischargeguide`,
    `DTSTART:${date}`,
    `SUMMARY:${appointment.specialty} appointment`,
    `LOCATION:${appointment.location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  res.type("text/calendar").attachment("appointment.ics").send(ics);
});
