import type { RoundView } from "../contract";

interface Props {
  round: RoundView;
  busy: boolean;
  onNewGame: () => void;
}

export default function ResultScreen({ round, busy, onNewGame }: Props) {
  const correct = round.correct;
  const persona = round.persona === "human" ? "human" : "ai";
  const guess = round.guess === "human" ? "Human" : "AI";
  const wasLabel = persona === "human" ? "Human" : "AI";

  return (
    <section className="chat-card">
      <div className="chat-topbar">
        <div className="chat-id">
          <span className="chat-av">🕵️</span>
          <span>Stranger</span>
        </div>
        <span className="chat-timer done">0:00</span>
      </div>

      <div className="chat-body">
        <div className="chat-hint">You start the conversation</div>
        {round.messages.map((m, i) => (
          <div key={i} className={`chat-line ${m.role === "you" ? "you" : "them"}`}>
            {m.role === "them" && <span className="bot-ic">🤖</span>}
            <span className="chat-bubble">{m.text}</span>
            {m.role === "you" && <span className="you-ic">🙂</span>}
          </div>
        ))}

        <div className="chat-hint" style={{ marginTop: 14 }}>The round is over</div>

        <div className={`verdict ${correct ? "win" : "lose"}`}>
          <div className="verdict-line">
            It was <strong>{wasLabel}</strong>! You chose <strong>{guess}</strong>.
          </div>
          <div className={`verdict-face ${correct ? "win" : "lose"}`}>
            {correct ? "🎉" : "😞"}
          </div>
          <div className="verdict-score">{correct ? "+10 points" : "−5 points"}</div>
          <p className="verdict-why">
            {correct
              ? `You read the signals right. GenLayer's validators reached AI consensus to set the secret persona to "${wasLabel}" at round start — and your guess matched.`
              : `The mimic fooled you. At round start, GenLayer's validators reached consensus (Optimistic Democracy) on a secret persona of "${wasLabel}", and every reply stayed in character. That hidden value was on-chain the whole time — you just couldn't see it until now.`}
          </p>
        </div>
      </div>

      <div className="result-actions">
        <button className="cta" onClick={onNewGame} disabled={busy}>
          {busy ? <span className="spinner" /> : "＋ "}
          New Game (0.0001 GEN)
        </button>
      </div>
    </section>
  );
}
