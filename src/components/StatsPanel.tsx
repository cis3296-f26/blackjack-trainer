import type { AccountStats, Stats } from "../engine/stat";
import type { StatsStatus } from "../useAccountStats";
import "./StatsPanel.css";

type Row = [label: string, value: string];

const pct = (part: number, whole: number) =>
  whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;
const money = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}$${Math.abs(n)}`;
const streak = (n: number) => (n > 0 ? `${n} won` : n < 0 ? `${-n} lost` : "—");

// Stats shown for both Betting and Free Play
const handRows = (s: Stats): Row[] => [
  ["Hands played", String(s.handsPlayed)],
  ["Win rate", pct(s.wins, s.handsPlayed)],
  ["Won · Lost · Pushed", `${s.wins} · ${s.losses} · ${s.pushes}`],
  ["Blackjacks", String(s.blackjacks)],
  ["Doubles won", `${s.doubleWins} of ${s.doubles}`],
  ["Splits", String(s.splits)],
  ["Surrenders", String(s.surrenders)],
  ["Current streak", streak(s.currentStreak)],
  ["Longest win streak", String(s.longestWinStreak)],
  ["Longest losing streak", String(s.longestLossStreak)],
];

// Money stats, shown only for Betting
const moneyRows = (s: Stats): Row[] => [
  ["Net profit", money(s.netProfit)],
  ["Total wagered", `$${s.totalWagered}`],
  ["Biggest win", `$${s.biggestWin}`],
  ["Biggest loss", `$${s.biggestLoss}`],
];

function StatGrid({ rows }: { rows: Row[] }) {
  return (
    <dl className="stats-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface StatsPanelProps {
  stats: AccountStats;
  status: StatsStatus;
  onReset: () => void;
}

export default function StatsPanel({
  stats,
  status,
  onReset,
}: StatsPanelProps) {
  const loaded = status === "ready" || status === "saveError";
  return (
    <div className="stats-panel">
      <div className="stats-panel__card">
        <h1 className="stats-panel__title">Your Stats</h1>
        {status === "loading" && <p role="status">Loading your stats…</p>}
        {status === "loadError" && (
          <p role="alert">
            Could not load your saved stats. Check your connection and reload
            the page.
          </p>
        )}
        {status === "saveError" && (
          <p role="alert">
            Your latest hand was not saved. It will be saved with your next
            hand.
          </p>
        )}
        {loaded && (
          <>
            <section aria-labelledby="stats-betting">
              <h2 id="stats-betting">Betting</h2>
              <StatGrid
                rows={[...moneyRows(stats.betting), ...handRows(stats.betting)]}
              />
            </section>
            <section aria-labelledby="stats-free">
              <h2 id="stats-free">Free Play</h2>
              <StatGrid rows={handRows(stats.freePlay)} />
            </section>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                if (
                  window.confirm("Reset all your stats? This cannot be undone.")
                )
                  onReset();
              }}
            >
              Reset stats
            </button>
          </>
        )}
      </div>
    </div>
  );
}
