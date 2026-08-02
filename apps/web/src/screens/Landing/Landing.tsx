import { AuthForm } from "../../components/AuthForm";

export default function Landing() {
  return (
    <div>
      <div className="landing-hero">
        <p className="kicker">INFORMATION, NOT INSTRUCTIONS</p>
        <h1>Understand your own discharge paperwork</h1>
        <p className="gloss measure" style={{ margin: "0 auto" }}>
          AfterCare takes the discharge summary, medication list, or doctor's report you already have and
          turns it into a plain-language, read-aloud guide — so you always know what you are and aren't
          supposed to do. It's built for anyone: patients, caregivers, family, any age, any care situation.
          It doesn't guess, and it doesn't replace your care team.
        </p>
      </div>
      <AuthForm />
      <p className="gloss" style={{ textAlign: "center", marginTop: "var(--sp6)" }}>
        By continuing you agree that AfterCare shows you information drawn only from documents you provide,
        and is not a substitute for professional medical advice.
      </p>
    </div>
  );
}
