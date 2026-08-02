export type Priority = "high" | "medium" | "low";

export interface Task {
  id: string;
  title: string;
  time: string;
  minutes: number;
  priority: Priority;
  icon: "pill" | "walk" | "bandage" | "droplet" | "moon" | "stethoscope";
  done: boolean;
}

export interface Medication {
  id: string;
  name: string;
  strength: string;
  purpose: string;
  color: string;
  schedule: { morning: boolean; afternoon: boolean; evening: boolean };
  food: string;
  sideEffects: string[];
  refillsLeft: number;
  nextDoseAt: string; // ISO
  history: { date: string; taken: boolean }[];
}

export interface Appointment {
  id: string;
  doctor: string;
  specialty: string;
  clinic: string;
  address: string;
  date: string;
  time: string;
}

export interface TimelineEvent {
  id: string;
  day: string;
  title: string;
  description: string;
  status: "done" | "current" | "upcoming";
}

export const tasks: Task[] = [
  {
    id: "t1",
    title: "Take morning medications",
    time: "8:00 AM",
    minutes: 5,
    priority: "high",
    icon: "pill",
    done: true,
  },
  {
    id: "t2",
    title: "Change incision dressing",
    time: "9:30 AM",
    minutes: 10,
    priority: "high",
    icon: "bandage",
    done: false,
  },
  {
    id: "t3",
    title: "Short walk around the house",
    time: "11:00 AM",
    minutes: 15,
    priority: "medium",
    icon: "walk",
    done: false,
  },
  {
    id: "t4",
    title: "Drink a glass of water",
    time: "1:00 PM",
    minutes: 2,
    priority: "low",
    icon: "droplet",
    done: false,
  },
  {
    id: "t5",
    title: "Rest — elevate leg for 30 minutes",
    time: "3:00 PM",
    minutes: 30,
    priority: "medium",
    icon: "moon",
    done: false,
  },
];

export const medications: Medication[] = [
  {
    id: "m1",
    name: "Amoxicillin",
    strength: "500 mg capsule",
    purpose: "Prevents infection at the surgical site",
    color: "blue",
    schedule: { morning: true, afternoon: true, evening: true },
    food: "Take with food to avoid an upset stomach",
    sideEffects: ["Mild nausea", "Diarrhea", "Headache"],
    refillsLeft: 2,
    nextDoseAt: new Date(Date.now() + 1000 * 60 * 95).toISOString(),
    history: [
      { date: "Aug 1", taken: true },
      { date: "Jul 31", taken: true },
      { date: "Jul 30", taken: true },
      { date: "Jul 29", taken: false },
    ],
  },
  {
    id: "m2",
    name: "Oxycodone",
    strength: "5 mg tablet",
    purpose: "Manages post-surgical pain",
    color: "amber",
    schedule: { morning: true, afternoon: false, evening: true },
    food: "Can be taken with or without food",
    sideEffects: ["Drowsiness", "Constipation", "Dizziness"],
    refillsLeft: 0,
    nextDoseAt: new Date(Date.now() + 1000 * 60 * 40).toISOString(),
    history: [
      { date: "Aug 1", taken: true },
      { date: "Jul 31", taken: true },
      { date: "Jul 30", taken: true },
      { date: "Jul 29", taken: true },
    ],
  },
  {
    id: "m3",
    name: "Docusate Sodium",
    strength: "100 mg capsule",
    purpose: "Stool softener to counter pain-medication constipation",
    color: "green",
    schedule: { morning: true, afternoon: false, evening: false },
    food: "Take with a full glass of water",
    sideEffects: ["Mild cramping"],
    refillsLeft: 3,
    nextDoseAt: new Date(Date.now() + 1000 * 60 * 60 * 18).toISOString(),
    history: [
      { date: "Aug 1", taken: true },
      { date: "Jul 31", taken: false },
      { date: "Jul 30", taken: true },
      { date: "Jul 29", taken: true },
    ],
  },
  {
    id: "m4",
    name: "Aspirin",
    strength: "81 mg tablet",
    purpose: "Low-dose blood thinner to prevent clots",
    color: "red",
    schedule: { morning: true, afternoon: false, evening: false },
    food: "Take with food",
    sideEffects: ["Stomach irritation", "Easy bruising"],
    refillsLeft: 5,
    nextDoseAt: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(),
    history: [
      { date: "Aug 1", taken: true },
      { date: "Jul 31", taken: true },
      { date: "Jul 30", taken: true },
      { date: "Jul 29", taken: true },
    ],
  },
];

export const appointments: Appointment[] = [
  {
    id: "a1",
    doctor: "Dr. Elena Marsh",
    specialty: "Orthopedic Surgeon — Follow-up",
    clinic: "Bayview Orthopedic Associates",
    address: "412 Harborview Dr, Suite 220",
    date: "Aug 9, 2026",
    time: "10:30 AM",
  },
  {
    id: "a2",
    doctor: "Dr. Rajiv Patel",
    specialty: "Physical Therapy — Initial Evaluation",
    clinic: "Cornerstone Physical Therapy",
    address: "88 Meadow Lane",
    date: "Aug 14, 2026",
    time: "2:00 PM",
  },
];

export const timeline: TimelineEvent[] = [
  {
    id: "tl1",
    day: "Day 1",
    title: "Surgery day",
    description: "Procedure completed successfully. Began initial recovery in hospital.",
    status: "done",
  },
  {
    id: "tl2",
    day: "Day 2",
    title: "Discharged home",
    description: "Vitals stable. Sent home with medication and care plan.",
    status: "done",
  },
  {
    id: "tl3",
    day: "Day 3",
    title: "Today — early recovery",
    description: "Focus on rest, gentle movement, and wound care.",
    status: "current",
  },
  {
    id: "tl4",
    day: "Day 7",
    title: "Suture check",
    description: "Nurse visit to check incision healing.",
    status: "upcoming",
  },
  {
    id: "tl5",
    day: "Day 14",
    title: "Follow-up appointment",
    description: "See Dr. Marsh to review progress and imaging.",
    status: "upcoming",
  },
];

export const foodsToEat = ["Lean protein (chicken, fish, eggs)", "Leafy greens", "Whole grains", "Fresh fruit", "Yogurt"];
export const foodsToAvoid = ["Alcohol", "Fried or greasy foods", "Excess salt", "Grapefruit (interacts with medication)"];

export const restrictions = [
  { icon: "weight", label: "No heavy lifting over 10 lbs" },
  { icon: "walk", label: "Walk 15 minutes, 3 times a day" },
  { icon: "car", label: "Do not drive until cleared by your doctor" },
  { icon: "shower", label: "No submerging incision — showers only" },
] as const;

export interface FaqItem {
  id: string;
  category: "Pain" | "Showering" | "Exercise" | "Driving" | "Diet" | "Medication";
  question: string;
  answer: string;
}

export const faqs: FaqItem[] = [
  {
    id: "f1",
    category: "Pain",
    question: "How much pain is normal after surgery?",
    answer:
      "Mild to moderate pain and swelling for the first 3–5 days is expected. Your pain should gradually improve each day. If pain suddenly worsens or is not controlled by your medication, call your care team.",
  },
  {
    id: "f2",
    category: "Pain",
    question: "Can I take ibuprofen with my prescribed pain medication?",
    answer:
      "Only if your care team has explicitly approved it — some pain medications should not be combined with over-the-counter NSAIDs. Check your medication list or ask your pharmacist before combining anything.",
  },
  {
    id: "f3",
    category: "Showering",
    question: "When can I shower after surgery?",
    answer:
      "You may take short showers starting 48 hours after surgery. Keep the incision out of direct water stream, pat dry gently afterward, and avoid baths, hot tubs, or pools until your doctor clears you.",
  },
  {
    id: "f4",
    category: "Showering",
    question: "Can I get my incision wet?",
    answer:
      "Brief exposure to clean shower water is fine after 48 hours, but avoid soaking or submerging the area. Do not scrub the incision — let water run over it and pat dry.",
  },
  {
    id: "f5",
    category: "Exercise",
    question: "When can I start exercising again?",
    answer:
      "Gentle walking is encouraged starting day 1 to prevent blood clots. Avoid strenuous exercise, running, or lifting until your follow-up appointment, where your doctor will advance your activity plan.",
  },
  {
    id: "f6",
    category: "Exercise",
    question: "Is it normal to feel tired during recovery?",
    answer:
      "Yes. Your body is using significant energy to heal. Rest when you need to, but continue short, regular walks to support circulation and lung function.",
  },
  {
    id: "f7",
    category: "Driving",
    question: "When can I drive again?",
    answer:
      "Do not drive while taking prescription pain medication or until you can comfortably and safely operate a vehicle, including sudden braking. Most patients are cleared at their first follow-up visit.",
  },
  {
    id: "f8",
    category: "Diet",
    question: "What foods should I eat to help healing?",
    answer:
      "Focus on protein (chicken, fish, eggs, beans), fiber-rich foods, and plenty of water. These support tissue repair and help prevent constipation from pain medication.",
  },
  {
    id: "f9",
    category: "Diet",
    question: "Why am I constipated?",
    answer:
      "Pain medications commonly slow digestion. Stay hydrated, eat fiber-rich foods, and take your stool softener as prescribed. Contact your care team if you haven't had a bowel movement in 3+ days.",
  },
  {
    id: "f10",
    category: "Medication",
    question: "What if I miss a dose of my medication?",
    answer:
      "Take it as soon as you remember unless it is almost time for your next dose — in that case, skip the missed dose. Never take a double dose to catch up.",
  },
  {
    id: "f11",
    category: "Medication",
    question: "What side effects should worry me?",
    answer:
      "Contact your care team right away for difficulty breathing, chest pain, severe rash, confusion, or bleeding that won't stop. Mild nausea or drowsiness is common and usually not an emergency.",
  },
];
