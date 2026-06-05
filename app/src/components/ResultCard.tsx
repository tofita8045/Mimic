import type { RoundView } from "../contract";

interface Props {
  round: RoundView | null;
  onPlayAgain: () => void;
  busy: boolean;
}

export default function ResultCard({ round, onPlayAgain, busy }: Props) {
  if (!round?.active || !round.resolved) return null;
  const correct = !!round.correct;
  const persona = round.persona === "human" ? "human" : "ai";
  const guess = round.guess === "human" ? "human" : "ai";
  const delta = correct ? "+10" : "−5";

  return (
    <section className="surface">
      <h2>Result</h2>

      <div className="quote subdued">
        <span className="quote-mark">“</span>
        <p>{round.sentence}</p>
      </div>

      <div className={`result ${correct ? "correct" : "wrong"}`} style={{ marginTop: 14 }}>
        <div className="big">{correct ? "You nailed it." : "You got fooled."}</div>
        <div style={{ flex: 1 }}>
          You guessed <span className={`tag ${guess}`}>{guess}</span>{" · "}
          it was <span className={`tag ${persona}`}>{persona}</span>.
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
