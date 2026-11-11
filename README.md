# Blackjack Trainer

## Project Description

Blackjack Trainer is a web app for learning to play blackjack. You play hands against a computer dealer in your browser. Over the semester it will also teach basic strategy and card counting.

## Installation Instructions

1. Install [Node.js](https://nodejs.org/) version 20.19 or newer. npm comes with it.
2. Download the project and install its dependencies:

   ```bash
   git clone https://github.com/cis3296-f26/blackjack-trainer.git
   cd blackjack-trainer
   npm install
   ```

## Build Instructions

```bash
npm run build
```

This checks the code for errors and creates a ready-to-host website in the `dist/` folder.

## Run Instructions

Start the app:

```bash
npm run dev
```

Then open the address it prints (usually http://localhost:5173) in your browser.

How to play:

1. Click Deal to start a hand.
2. Click Hit to take another card, or Stand to keep your hand.
3. The dealer then reveals their hidden card and draws until reaching 17 or more.
4. The result appears: win, lose, push (tie), or blackjack. Click New Hand to play again.

When your first two cards have the same value, click Split to play two hands with matching bets. Your bankroll must cover the additional bet; splitting also works in Free Play. Play the highlighted hand first, then the second hand. You can double on either hand, but you can only split once per round. Split aces receive one card each and stand automatically. A split hand totaling 21 pays as a regular win, not a blackjack. Each hand shows its own result; the round banner reflects the combined outcome. Strategy hints still evaluate hit, stand, and double only; they do not recommend splitting yet.

To match the rules of a particular casino, click the ⚙ (House Settings) button in the top-left corner between hands. There you can choose the number of decks (1, 2, 4, 6, or 8) and how deep the dealer deals into the shoe before reshuffling. The panel also lists the table rules that are currently fixed.
