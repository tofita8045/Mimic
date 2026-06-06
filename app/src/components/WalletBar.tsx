import type { Address } from "../contract";

interface Props {
  address: Address | null;
  score: number;
  onConnect: () => void;
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletBar({ address, score, onConnect }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="dot" />
        <span className="name">Mimic</span>
        <span className="by">· Human or AI? on GenLayer</span>
      </div>
      {address ? (
        <div className="wallet">
          <span className="addr" title={address}>{shorten(address)}</span>
          <span className="score-pill">{score} pts</span>
        </div>
      ) : (
        <button onClick={onConnect}>Connect wallet</button>
      )}
    </header>
  );
}
