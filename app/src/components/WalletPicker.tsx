import type { DetectedWallet } from "../genlayer";

interface Props {
  wallets: DetectedWallet[];
  onPick: (w: DetectedWallet) => void;
  onClose: () => void;
}

export default function WalletPicker({ wallets, onPick, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Connect a wallet</h3>
        {wallets.length === 0 ? (
          <p className="muted">
            No wallet detected. Install MetaMask, OKX, Rabby, or any EIP-1193 wallet, then
            reload.
          </p>
        ) : (
          <div className="wallet-list">
            {wallets.map((w) => (
              <button key={w.info.uuid} className="wallet-option" onClick={() => onPick(w)}>
                {w.info.icon ? (
                  <img src={w.info.icon} alt="" width={24} height={24} />
                ) : (
                  <span className="wallet-fallback">👛</span>
                )}
                <span>{w.info.name}</span>
              </button>
            ))}
          </div>
        )}
        <button className="ghost" style={{ marginTop: 12 }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
