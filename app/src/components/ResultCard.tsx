import type { SessionView } from "../contract";

interface Props {
  session: SessionView | null;
  onPlayAgain: () => void;
  busy: boolean;
}

export default function ResultCard({ session, onPlayAgain, busy }: Props) {
  if (!session?.active || !session.resolved) return null;
  const correct = !!session.correct;
  const persona = session.persona === "human" ? "human" : "ai";
  const guess = session.guess === "human" ? "human" : "ai";
  const delta = correct ? "+10" : "−5";

  return (
    <section className="surface">
      <h2>Result</h2>
      <div className={`result ${correct ? "correct" : "wrong"}`}>
        <div className="big">{correct ? "You nailed it." : "You got fooled."}</div>
        <div style={{ flex: 1 }}>
          You guessed <span className={`tag ${guess}`}>{guess}</span>{" · "}
          opponent was <span className={`tag ${persona}`}>{persona}</span>.
        </div>
        <div className={`delta ${correct ? "pos" : "neg"}`}>{delta}</div>
      </div>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
        <button className="cta" onClick={onPlayAgain} disabled={busy}>
          {busy ? <span className="spinner" /> : null} Play again
        </button>
      </div>
    </section>
  );
}
