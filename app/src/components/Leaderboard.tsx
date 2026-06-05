import type { Address, LeaderboardRow } from "../contract";

interface Props {
  rows: LeaderboardRow[];
  me: Address | null;
}

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Leaderboard({ rows, me }: Props) {
  return (
    <section className="surface lb">
      <h2>Leaderboard</h2>
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No rounds played yet — be the first.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th style={{ textAlign: "right" }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isMe = me && row.player.toLowerCase() === me.toLowerCase();
              return (
                <tr key={row.player} className={isMe ? "me" : ""}>
                  <td>{i + 1}</td>
                  <td className="mono">{shorten(row.player)}{isMe ? " · you" : ""}</td>
                  <td className="score">{row.score}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
