# Diamant (Diamond) Twitch Chat Game

A browser-based implementation of the popular push-your-luck board game Diamant (also known as Diamond), integrated with Twitch chat.

## Game Overview

Diamant is a push-your-luck cave exploration game where players explore a cave over 5 rounds, deciding when to continue deeper or exit safely. The deeper they go, the more treasures they can find, but also more risks. When identical traps appear twice, everyone still in the cave loses all collected treasures.

## Features

- **Twitch Chat Integration**: Viewers can join and play directly from Twitch chat
- **Real-time Gameplay**: Game state updates in real-time as players make decisions
- **Visual Feedback**: Cards are displayed visually with animations
- **Sound Effects**: Audio cues for key game events (can be toggled on/off)
- **Game Log**: Detailed log of game events
- **Scoreboard**: Real-time tracking of player scores
- **Streamer Controls**: Simple controls for the streamer to manage the game

## How to Play

### For Viewers

1. Type `!join` in the Twitch chat during the joining phase to enter the game
2. When in the cave, type `!continue` to explore deeper or `!exit` to leave with your treasures
3. If the same trap appears twice, everyone still in the cave loses all treasures collected in that round
4. The game lasts 5 rounds - the player with the most rubies at the end wins!

### For Streamers

1. Click "Start New Game" to begin a new game session
2. The game will automatically handle the joining phase and start the first round
3. Use "Reveal Next Card" to manually reveal the next card (optional)
4. Use "Start Decision Phase" to manually start a decision phase (optional)
5. The game will automatically progress through rounds and end after 5 rounds

## Setup

1. Make sure you have Node.js installed
2. Install dependencies with `npm install`
3. Update the Twitch channel name in `server.js` to your channel
4. Start the server with `node server.js`
5. Open `http://localhost:3000` in your browser

## Technologies Used

- Node.js
- Express
- Socket.io
- tmi.js (Twitch Messaging Interface)
- HTML5/CSS3/JavaScript

## License

This project is open source and available under the MIT License.

## Credits

- Sound effects from Mixkit
- Game design based on the board game Diamant/Diamond by Bruno Faidutti and Alan R. Moon 