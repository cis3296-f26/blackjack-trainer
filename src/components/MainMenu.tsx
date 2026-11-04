import './MainMenu.css';

interface MainMenuProps {
  onStartSimulation: () => void;
  onStartTrainer: () => void;
}

export default function MainMenu({ onStartSimulation, onStartTrainer }: MainMenuProps) {
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
      </div>
    </div>
  );
}