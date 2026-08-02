import { Router } from "express";
import { documents, findAppointment } from "../db/schema.js";

export const appointmentsRouter = Router();

appointmentsRouter.get("/", (req, res) => {
  const documentId = String(req.query.documentId ?? "");
  const document = documents.get(documentId);
  if (!document || document.userId !== req.userId) {
    res.status(404).json({ error: "Recovery plan not found" });
    return;
  }
  res.json({ data: document.plan.appointments, isPlaceholder: document.plan.isPlaceholder });
});

appointmentsRouter.post("/:appointmentId/calendar", (req, res) => {
  const appointment = findAppointment(req.params.appointmentId, req.userId);
  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
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
    "END:VCALENDAR"
  ].join("\r\n");
  res.type("text/calendar").attachment("appointment.ics").send(ics);
});
