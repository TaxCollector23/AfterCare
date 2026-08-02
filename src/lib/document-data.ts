export interface DocSection {
  id: string;
  original: string;
  explanation: string;
  tag: string;
}

export const docSections: DocSection[] = [
  {
    id: "d1",
    tag: "Diagnosis",
    original: "PRIMARY DIAGNOSIS: S72.001A Fracture of unspecified part of neck of right femur, initial encounter.",
    explanation:
      "You broke the neck of your right thigh bone (femur), close to the hip joint. “Initial encounter” simply means this is the first time this fracture is being treated.",
  },
  {
    id: "d2",
    tag: "Procedure",
    original: "PROCEDURE PERFORMED: Open reduction and internal fixation (ORIF) of right femoral neck fracture with cannulated screws.",
    explanation:
      "Surgeons realigned the broken bone and secured it in place using several small screws inserted through tiny incisions, so it can heal in the correct position.",
  },
  {
    id: "d3",
    tag: "Medication",
    original: "DISCHARGE MEDICATIONS: Amoxicillin 500mg PO TID x7 days; Oxycodone 5mg PO q6h PRN pain; Docusate sodium 100mg PO daily; ASA 81mg PO daily.",
    explanation:
      "You're going home with an antibiotic to prevent infection, a pain reliever to take only when needed, a stool softener (pain medication can cause constipation), and a low-dose aspirin to help prevent blood clots.",
  },
  {
    id: "d4",
    tag: "Activity",
    original: "ACTIVITY: Weight-bearing as tolerated with walker. No lifting > 10 lbs. Ambulate 3x daily. No driving until cleared by surgeon.",
    explanation:
      "You can put as much weight on your leg as feels comfortable while using your walker. Avoid lifting anything heavier than a gallon of milk, take a short walk three times a day, and don't drive until your surgeon says it's safe.",
  },
  {
    id: "d5",
    tag: "Follow-up",
    original: "FOLLOW-UP: Orthopedic clinic in 14 days for wound check and radiographs. Return to ED for fever >101.5F, uncontrolled pain, or wound drainage.",
    explanation:
      "See your orthopedic surgeon in two weeks so they can check your incision and take new X-rays. Go back to the emergency room right away if you develop a fever over 101.5°F, pain that medication doesn't control, or fluid leaking from your incision.",
  },
];
