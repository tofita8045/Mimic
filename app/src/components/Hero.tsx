interface Props {
  onStart: () => void;
  busy: boolean;
  ctaLabel?: string;
  disabled?: boolean;
}

export default function Hero({ onStart, busy, ctaLabel, disabled }: Props) {
  return (
    <section className="hero">
      <div className="avatar" aria-hidden>👀</div>
      <h1>Mimic</h1>
      <p>
        Chat with a stranger for a few seconds, then guess: human, or an AI mimicking one?
        Your score and the leaderboard live entirely on-chain on GenLayer.
      </p>
      <button className="cta" onClick={onStart} disabled={busy || disabled}>
        {busy ? <span className="spinner" /> : null}
        {ctaLabel ?? "Start Game"}
      </button>
      <div className="meta">
        <span className="pulse" />
        Live on GenLayer Studionet · trustless AI consensus
      </div>
    </section>
  );
}
