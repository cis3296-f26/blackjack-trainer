import "./MainMenu.css";

interface MainMenuProps {
  onStartSimulation: () => void;
  onStartTrainer: () => void;
  onShowStats?: () => void;
}

export default function MainMenu({
  onStartSimulation,
  onStartTrainer,
  onShowStats,
}: MainMenuProps) {
  onShowStats;
  return (
    <div className="main-menu">
      <div className="main-menu__card">
        <h1 className="main-menu__title">Blackjack Trainer</h1>
        <button
          type="button"
          className="main-menu__button"
          onClick={onStartSimulation}
        >
          Simulation
        </button>
        <button
          type="button"
          className="main-menu__button"
          onClick={onStartTrainer}
        >
          Basic Strategy Trainer
        </button>
        {onShowStats && (
          <button
            type="button"
            className="main-menu__button"
            onClick={onShowStats}
          >
            Your Stats
          </button>
        )}
      </div>
    </div>
  );
}
