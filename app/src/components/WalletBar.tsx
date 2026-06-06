import type { Address } from "../contract";

interface Props {
  address: Address | null;
  score: number;
  onNewIdentity: () => void;
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletBar({ address, score, onNewIdentity }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="dot" />
        <span className="name">Mimic</span>
        <span className="by">· Human or AI? on GenLayer</span>
      </div>
      <div className="wallet">
        {address && <span className="addr" title={address}>{shorten(address)}</span>}
        <span className="score-pill">{score} pts</span>
        <button className="ghost" onClick={onNewIdentity} title="Start fresh with a new local identity">
          New identity
        </button>
      </div>
    </header>
  );
}
