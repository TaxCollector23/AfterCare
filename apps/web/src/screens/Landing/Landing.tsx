import { AuthForm } from "../../components/AuthForm";

export default function Landing() {
  return (
    <div>
      <div className="landing-hero">
        <p className="kicker">YOUR RECOVERY, EXPLAINED</p>
        <h1>Understand your own discharge paperwork</h1>
        <p className="gloss measure" style={{ margin: "0 auto" }}>
          AfterCare takes the discharge summary, medication list, or doctor's report you already have and
          turns it into a plain-language, read-aloud guide — built for anyone, any age, any care situation.
        </p>
      </div>
      <AuthForm />
    </div>
  );
}
