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
