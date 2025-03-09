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
- **Security**: Input sanitization to prevent XSS attacks
- **Dynamic Balancing**: Treasure values scale based on the number of players
- **Player Limit Options**: Choose between unlimited players or set a specific player cap

## Game Mechanics

- The game consists of 5 rounds of cave exploration
- Players automatically continue exploring unless they choose to leave
- The first card revealed in each round is always a treasure card (never a trap)
- Treasure values dynamically scale based on player count:
  - Minimum treasure value = 40% of player count (at least 1)
  - Maximum treasure value = 2x player count (at least 5)
  - Values are distributed evenly between min and max
- **Treasure Collection System**:
  - When a treasure card is revealed, its value is immediately divided among players in the cave
  - Each player gets an equal share (rounded down), and any remainder stays on the card
  - For example, if 3 players find 10 treasure, each player gets 3 and 1 remains on the card
  - When players leave the cave (roach), they keep their collected treasure plus a share of any remaining treasure on the path
  - If multiple players leave at once, they divide the remaining treasure equally
  - Cards show both the original treasure value and the current remaining value
- When identical traps appear twice, everyone still in the cave loses all treasures collected in that round

## How to Play

### For Viewers

1. Type `!join` in the Twitch chat during the joining phase to enter the game
2. You will automatically continue exploring deeper into the cave
3. Type `!roach` to leave the cave with your treasures
4. If the same trap appears twice, everyone still in the cave loses all treasures collected in that round
5. The game lasts 5 rounds - the player with the most rubies at the end wins!

### For Streamers

1. Click "Start New Game" to begin a new game session
2. Choose whether to allow unlimited players or set a specific player limit
3. The game will automatically handle the joining phase and start the first round
4. Use "Force Start Game" to skip the joining timer and start immediately (optional)
5. Use "Reveal Next Card" to manually reveal the next card (optional)
6. Use "Start Decision Phase" to manually start a decision phase (optional)
7. Use "Force End Decisions" to skip the decision timer and process decisions immediately (optional)
8. The game will automatically progress through rounds and end after 5 rounds

## Setup

1. Make sure you have Node.js installed
2. Install dependencies with `npm install`
3. Update the Twitch channel name in `server.js` to your channel
4. Start the server with `node server.js`
5. Open `http://localhost:3001` in your browser

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