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

          <div className="judge">
            <div className="judge-head">⚖️ Judged by GenLayer</div>
            <p>
              {correct
                ? `GenLayer's AI validators secretly set this stranger's persona to "${wasLabel}" at the start of the round, reaching consensus through Optimistic Democracy. The value was sealed on-chain — and your read was right.`
                : `GenLayer's AI validators secretly set this stranger's persona to "${wasLabel}" at the start of the round and made every reply stay in character. The verdict was decided on-chain by validator consensus, not by any server — and this time the mimic won.`}
            </p>
            <p className="judge-tech">
              persona pick &amp; replies → <code>gl.nondet.exec_prompt</code> · consensus →
              <code> gl.vm.run_nondet_unsafe</code> · scoring &amp; result → on-chain, tamper-proof
            </p>
          </div>
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
