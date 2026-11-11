import {
  type Stats,
  win_Rate,
  double_Win_Rate,
  avg_Profit_Per_hand,
  ret_on_Wagered,
} from "../engine/stat";
import "./StatsPanel.css";
interface Stats_Panel_Props {
  stats: Stats;
}
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
const pct = (n: number) => "${(n* 100),toFixed(1)}%";
const streak = (n: number) => (n > 0 ? `${n}W` : n < 0 ? `${-n}L` : "-");

export default function StatsPanel({ stats }: Stats_Panel_Props) {
  if (stats.handsPlayed === 0) {
    return (
      <section className="stats-panel" aria-label="Session stats">
        <h2 className="stats-panel__title">Session Stats</h2>
        <p className="stats-panel_-empty">
          Play a hand with a bet to see your stats.
        </p>
      </section>
    );
  }
  const rows: [string, string][] = [
    ["Hands", String(stats.handsPlayed)],
    ["W / L / P", `${stats.wins} / ${stats.losses} / ${stats.pushes}`],
    ["Win rate", pct(win_Rate(stats))],
    ["Blackjacks", String(stats.blackjacks)],
    [
      "Doubles won",
      stats.doubles === 0
        ? "—"
        : `${stats.doubleWins} / ${stats.doubles} (${pct(double_Win_Rate(stats))})`,
    ],
    ["Net profit", money(stats.netProfit)],
    ["Avg per hand", money(avg_Profit_Per_hand(stats))],
    ["Return on wagered", pct(ret_on_Wagered(stats))],
    ["Total wagered", money(stats.totalWagered)],
    ["Biggest win", money(stats.biggestWin)],
    ["Biggest loss", money(stats.biggestLoss)],
    ["Current streak", streak(stats.currentStreak)],
    [
      "Best streaks",
      `${stats.longestWinStreak}W / ${stats.longestLossStreak}L`,
    ],
  ];

  return (
    <section className="stats-panel" aria-label="Session stats">
      <h2 className="stats-panel__title">Session Stats</h2>
      <dl className="stats-panel__grid">
        {rows.map(([label, value]) => (
          <div key={label} className="stats-panel__row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="stats-panel__note">
        Free-play hands aren't counted. Stats reset when you refresh.
      </p>
    </section>
  );
}
