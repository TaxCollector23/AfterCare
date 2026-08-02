import { Router } from "express";
import { z } from "zod";
import { accessibilityPreferences } from "../db/schema.js";

const defaults = {
  textSize: "large" as const,
  darkMode: false,
  highContrast: false,
  reduceMotion: false,
  voiceReading: false
};
const preferencesSchema = z.object({
  textSize: z.enum(["large", "very_large"]),
  darkMode: z.boolean(),
  highContrast: z.boolean(),
  reduceMotion: z.boolean(),
  voiceReading: z.boolean()
});

export const accessibilityRouter = Router();
accessibilityRouter.get("/prefs", (req, res) => {
  res.json(accessibilityPreferences.get(req.userId) ?? defaults);
});
accessibilityRouter.post("/prefs", (req, res) => {
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid accessibility preferences" });
    return;
  }
  accessibilityPreferences.set(req.userId, parsed.data);
  res.json(parsed.data);
});
