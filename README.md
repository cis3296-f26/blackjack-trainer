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

1. Log in or create an account, then select chips and click **Deal $amount**. Choose **Free Play** between hands to practice without betting.
2. **Hit** takes another card; **Stand** lets the dealer play. **Double** adds the same wager, takes one final card, and stands. It is available on the first two cards when you have enough chips (or without chips in Free Play).
3. Open **Show hint** for a recommendation. **Compare moves** explains the expected return and outcome probabilities. Hints start hidden each hand.
4. The result explains what happened and shows the bet, returned chips, and net gain/loss. **Rebet $amount & deal** repeats your opening wager, excluding any doubling. Use **Change bet** to choose a different amount, or **Next hand** in Free Play.

Open **Table rules** to choose 1, 2, 4, 6, or 8 decks and how much of the shoe is dealt before reshuffling. Settings save on this device and can be changed between hands; changing decks starts a fresh shoe. The dealer stands on all 17s, blackjack pays 3:2, and splitting, surrender, and insurance are not offered.

On desktop, the table and a compact control column share the available browser height, keeping betting and play actions on screen. Expanded guidance scrolls within its own panel. The table adapts to phones with readable cards and a sticky action area. Long hands scroll horizontally; focus a hand and use the arrow keys to see additional cards. **How to play** explains actions and hand totals. **Account** contains your name and Log out.

## Checks

```bash
npm test
npm run build
npm run lint
```

Tests cover strategy recommendations, settlement summaries, rebet guards and doubled wagers, free play, and shoe indicators for each deck setting.
