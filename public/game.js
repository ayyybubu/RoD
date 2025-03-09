/**
 * Diamant (Diamond) Game Logic
 * A push-your-luck cave exploration game for Twitch viewers
 */

// Game state
const gameState = {
    isActive: false,        // Whether a game is currently in progress
    currentRound: 0,        // Current round (1-5)
    currentPath: [],        // Cards revealed in the current path
    deck: [],               // Remaining cards in the deck
    players: {},            // Player data: {username: {score, inCave, roundTreasure}}
    revealedTraps: {},      // Count of each trap type revealed
    treasureOnPath: 0,      // Amount of treasure on the current path
    phase: 'waiting',       // Game phases: waiting, joining, deciding, revealing, roundEnd, gameEnd
    timer: null,            // Timer for decision phase
    timeRemaining: 0,       // Seconds remaining in current phase
    treasureValues: [],     // Treasure values for the current game
};

// Game configuration
const config = {
    maxRounds: 5,           // Number of rounds in a game
    decisionTime: 15,       // Seconds players have to decide continue/exit
    joinTime: 30,           // Seconds for join phase
    trapTypes: ['snake', 'spider', 'lava', 'rockfall', 'poison'],
    treasureCardCount: 5,   // Number of each treasure card value
    trapCardCount: 3,       // Number of each trap type
    minTreasureScale: 0.4,  // Minimum treasure value as a percentage of player count
    maxTreasureScale: 2.0,  // Maximum treasure value as a multiple of player count
};

// Sound effects
const sounds = {
    treasureReveal: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-coin-win-notification-1992.mp3'),
    trapReveal: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-negative-tone-interface-tap-2568.mp3'),
    trapActivated: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arcade-retro-game-over-213.mp3'),
    exitCave: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3'),
    roundEnd: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-completion-of-a-level-2063.mp3'),
    gameEnd: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3')
};

// Sound settings
let soundEnabled = true;

// Play a sound if sound is enabled
const playSound = (sound) => {
    if (soundEnabled && sounds[sound]) {
        sounds[sound].currentTime = 0;
        sounds[sound].play().catch(e => console.log("Error playing sound:", e));
    }
};

// Toggle sound on/off
const toggleSound = () => {
    soundEnabled = !soundEnabled;
    document.getElementById('sound-toggle').textContent = soundEnabled ? '🔊' : '🔇';
};

// Card types and distribution - now with dynamic treasure values
const createDeck = () => {
    const deck = [];
    
    // Calculate the number of players
    const playerCount = Object.keys(gameState.players).length;
    
    // Ensure at least 1 player for calculation purposes
    const effectivePlayerCount = Math.max(playerCount, 1);
    
    // Calculate min and max treasure values based on player count
    const minTreasureValue = Math.max(1, Math.floor(effectivePlayerCount * config.minTreasureScale));
    const maxTreasureValue = Math.max(5, Math.floor(effectivePlayerCount * config.maxTreasureScale));
    
    // Calculate step size for treasure values
    const valueRange = maxTreasureValue - minTreasureValue;
    const step = Math.max(1, Math.floor(valueRange / 4)); // 5 different treasure values
    
    // Generate treasure values
    const treasureValues = [];
    for (let i = 0; i < 5; i++) {
        const value = minTreasureValue + (i * step);
        treasureValues.push(value);
    }
    
    // Log the treasure values for debugging
    console.log(`Player count: ${effectivePlayerCount}, Treasure values: ${treasureValues.join(', ')}`);
    
    // Add treasure cards with scaled values
    for (let i = 0; i < treasureValues.length; i++) {
        const value = treasureValues[i];
        for (let j = 0; j < config.treasureCardCount; j++) {
            deck.push({ type: 'treasure', value });
        }
    }
    
    // Add trap cards (3 of each type)
    for (const trapType of config.trapTypes) {
        for (let i = 0; i < config.trapCardCount; i++) {
            deck.push({ type: 'trap', trapType });
        }
    }
    
    // Store the treasure values for display
    gameState.treasureValues = treasureValues;
    
    return shuffleDeck(deck);
};

// Fisher-Yates shuffle algorithm
const shuffleDeck = (deck) => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// Start a new game
const startGame = () => {
    // Reset game state
    gameState.isActive = true;
    gameState.currentRound = 1;
    gameState.currentPath = [];
    gameState.revealedTraps = {};
    gameState.treasureOnPath = 0;
    gameState.phase = 'joining';
    gameState.treasureValues = [];
    
    // Reset player scores for new game if needed
    Object.keys(gameState.players).forEach(player => {
        if (!gameState.players[player].score) {
            gameState.players[player].score = 0;
        }
        gameState.players[player].inCave = false;
        gameState.players[player].roundTreasure = 0;
    });
    
    // Start join timer
    startTimer(config.joinTime, () => {
        if (Object.keys(gameState.players).length > 0) {
            // Create the deck after the joining phase to account for player count
            gameState.deck = createDeck();
            startRound();
        } else {
            gameState.phase = 'waiting';
            gameState.isActive = false;
            updateUI();
        }
    });
    
    updateUI();
    displayMessage("A new game of Diamant is starting! Type !join to play!");
};

// Start a new round
const startRound = () => {
    gameState.currentPath = [];
    gameState.revealedTraps = {};
    gameState.treasureOnPath = 0;
    
    // Reset all players to be in the cave at the start of the round
    Object.keys(gameState.players).forEach(player => {
        gameState.players[player].inCave = true;
        gameState.players[player].roundTreasure = 0;
    });
    
    gameState.phase = 'revealing';
    displayMessage(`Round ${gameState.currentRound} begins! Everyone enters the cave...`);
    updateUI();
    
    // Reveal the first card automatically
    setTimeout(revealNextCard, 1500);
    
    // Display treasure values if first round
    if (gameState.currentRound === 1 && gameState.treasureValues && gameState.treasureValues.length > 0) {
        displayMessage(`Treasure values for this game: ${gameState.treasureValues.join(', ')} rubies`);
    }
};

// Reveal the next card from the deck
const revealNextCard = () => {
    if (gameState.deck.length === 0) {
        endRound("The deck is empty!");
        return;
    }
    
    const card = gameState.deck.pop();
    gameState.currentPath.push(card);
    
    if (card.type === 'treasure') {
        gameState.treasureOnPath += card.value;
        displayMessage(`Revealed: ${card.value} rubies!`);
        playSound('treasureReveal');
        startDecisionPhase();
    } else if (card.type === 'trap') {
        // Count this trap type
        gameState.revealedTraps[card.trapType] = (gameState.revealedTraps[card.trapType] || 0) + 1;
        
        // Check if this is the second trap of this type
        if (gameState.revealedTraps[card.trapType] >= 2) {
            displayMessage(`DANGER! A second ${card.trapType} trap appears!`);
            playSound('trapActivated');
            trapActivated(card.trapType);
        } else {
            displayMessage(`Revealed: A ${card.trapType} trap! Be careful...`);
            playSound('trapReveal');
            startDecisionPhase();
        }
    }
    
    updateUI();
};

// Handle trap activation (second trap of same type)
const trapActivated = (trapType) => {
    displayMessage(`The ${trapType} trap activates! All players still in the cave lose their treasures!`);
    
    // All players still in the cave lose their round treasures
    Object.keys(gameState.players).forEach(player => {
        if (gameState.players[player].inCave) {
            gameState.players[player].inCave = false;
            gameState.players[player].roundTreasure = 0;
        }
    });
    
    setTimeout(() => endRound(`The ${trapType} trap forced everyone to flee!`), 2000);
};

// Start the decision phase where players choose to continue or exit
const startDecisionPhase = () => {
    // Only start decision phase if there are players still in the cave
    const playersInCave = Object.keys(gameState.players).filter(p => gameState.players[p].inCave);
    
    if (playersInCave.length === 0) {
        endRound("No players left in the cave!");
        return;
    }
    
    gameState.phase = 'deciding';
    displayMessage(`Time to decide! Type !ditch to leave with your treasures or do nothing to continue exploring. ${config.decisionTime} seconds to decide...`);
    
    startTimer(config.decisionTime, () => {
        processDecisions();
    });
    
    updateUI();
};

// Process player decisions after the timer ends
const processDecisions = () => {
    const playersInCave = Object.keys(gameState.players).filter(p => gameState.players[p].inCave);
    
    if (playersInCave.length === 0) {
        endRound("All players have left the cave!");
        return;
    }
    
    // Calculate treasure distribution for players who are leaving
    const exitingPlayers = Object.keys(gameState.players).filter(p => 
        gameState.players[p].hasOwnProperty('decision') && 
        gameState.players[p].decision === 'exit' && 
        gameState.players[p].inCave
    );
    
    if (exitingPlayers.length > 0) {
        const treasurePerPlayer = Math.floor(gameState.treasureOnPath / exitingPlayers.length);
        const remainingTreasure = gameState.treasureOnPath % exitingPlayers.length;
        
        exitingPlayers.forEach(player => {
            gameState.players[player].inCave = false;
            gameState.players[player].roundTreasure += treasurePerPlayer;
            gameState.players[player].score += treasurePerPlayer;
            delete gameState.players[player].decision;
        });
        
        // Reduce treasure on path
        gameState.treasureOnPath = remainingTreasure;
        
        displayMessage(`${exitingPlayers.join(', ')} left the cave with ${treasurePerPlayer} rubies each!`);
        playSound('exitCave');
    }
    
    // Reset decisions for continuing players
    Object.keys(gameState.players).forEach(player => {
        if (gameState.players[player].inCave) {
            delete gameState.players[player].decision;
        }
    });
    
    // Check if anyone is still in the cave
    const remainingPlayers = Object.keys(gameState.players).filter(p => gameState.players[p].inCave);
    
    if (remainingPlayers.length === 0) {
        endRound("All players have left the cave!");
    } else {
        gameState.phase = 'revealing';
        updateUI();
        setTimeout(revealNextCard, 1500);
    }
};

// End the current round
const endRound = (message) => {
    displayMessage(`Round ${gameState.currentRound} ends! ${message}`);
    playSound('roundEnd');
    
    // Add round treasure to total score for players who exited safely
    Object.keys(gameState.players).forEach(player => {
        if (!gameState.players[player].inCave && gameState.players[player].roundTreasure > 0) {
            displayMessage(`${player} safely escaped with ${gameState.players[player].roundTreasure} rubies!`);
        }
        gameState.players[player].roundTreasure = 0;
    });
    
    gameState.phase = 'roundEnd';
    updateUI();
    
    // Check if this was the last round
    if (gameState.currentRound >= config.maxRounds) {
        setTimeout(endGame, 3000);
    } else {
        setTimeout(() => {
            gameState.currentRound++;
            startRound();
        }, 3000);
    }
};

// End the game and show final scores
const endGame = () => {
    gameState.phase = 'gameEnd';
    gameState.isActive = false;
    playSound('gameEnd');
    
    // Sort players by score
    const sortedPlayers = Object.keys(gameState.players).sort((a, b) => 
        gameState.players[b].score - gameState.players[a].score
    );
    
    let resultMessage = "Game Over! Final Scores:\n";
    sortedPlayers.forEach((player, index) => {
        resultMessage += `${index + 1}. ${player}: ${gameState.players[player].score} rubies\n`;
    });
    
    displayMessage(resultMessage);
    updateUI();
};

// Timer function for phases with time limits
const startTimer = (seconds, callback) => {
    clearInterval(gameState.timer);
    gameState.timeRemaining = seconds;
    
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.classList.remove('urgent');
    
    updateUI();
    
    gameState.timer = setInterval(() => {
        gameState.timeRemaining--;
        
        // Add urgent class when time is running out
        if (gameState.timeRemaining <= 5) {
            timerDisplay.classList.add('urgent');
        }
        
        updateUI();
        
        if (gameState.timeRemaining <= 0) {
            clearInterval(gameState.timer);
            timerDisplay.classList.remove('urgent');
            callback();
        }
    }, 1000);
};

// Sanitize text to prevent XSS
const sanitizeText = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Process chat commands from Twitch viewers
const processChatCommand = (username, message) => {
    // Sanitize inputs
    const sanitizedUsername = sanitizeText(username);
    const sanitizedMessage = sanitizeText(message);
    
    const command = sanitizedMessage.toLowerCase().trim();
    
    // Join command - only available during joining phase
    if (command === '!join' && gameState.phase === 'joining') {
        if (!gameState.players[sanitizedUsername]) {
            gameState.players[sanitizedUsername] = {
                score: 0,
                inCave: true,
                roundTreasure: 0
            };
            displayMessage(`${sanitizedUsername} joined the game!`);
            updateUI();
        }
    }
    
    // Ditch command (formerly exit) - only available during deciding phase
    if (gameState.phase === 'deciding' && gameState.players[sanitizedUsername] && gameState.players[sanitizedUsername].inCave) {
        if (command === '!ditch') {
            gameState.players[sanitizedUsername].decision = 'exit';
            displayMessage(`${sanitizedUsername} decides to leave the cave!`);
        }
    }
};

// Display a message in the game log
const displayMessage = (message) => {
    const gameLog = document.getElementById('game-log');
    const messageElement = document.createElement('div');
    messageElement.textContent = sanitizeText(message); // Sanitize the message
    messageElement.classList.add('log-message');
    gameLog.appendChild(messageElement);
    gameLog.scrollTop = gameLog.scrollHeight;
};

// Update the UI to reflect the current game state
const updateUI = () => {
    // Update phase display
    document.getElementById('game-phase').textContent = gameState.phase.charAt(0).toUpperCase() + gameState.phase.slice(1);
    
    // Update round display
    document.getElementById('round-display').textContent = gameState.isActive ? `Round ${gameState.currentRound}/${config.maxRounds}` : 'Not Active';
    
    // Update timer
    document.getElementById('timer-display').textContent = gameState.timeRemaining > 0 ? `${gameState.timeRemaining}s` : '';
    
    // Update treasure display
    document.getElementById('treasure-display').textContent = `Treasure on path: ${gameState.treasureOnPath}`;
    
    // Update path display (cards)
    const pathDisplay = document.getElementById('path-display');
    pathDisplay.innerHTML = '';
    
    gameState.currentPath.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');
        
        // Add animation delay based on card position
        cardElement.style.animationDelay = `${index * 0.1}s`;
        
        if (card.type === 'treasure') {
            cardElement.classList.add('treasure-card');
            cardElement.textContent = card.value;
        } else {
            cardElement.classList.add('trap-card');
            cardElement.classList.add(`trap-${card.trapType}`);
            
            // Add danger class if this is the second trap of this type
            if (gameState.revealedTraps[card.trapType] >= 2) {
                cardElement.classList.add('danger');
            }
            
            cardElement.textContent = card.trapType;
        }
        
        pathDisplay.appendChild(cardElement);
    });
    
    // Update player list and scores
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    const sortedPlayers = Object.keys(gameState.players).sort((a, b) => 
        gameState.players[b].score - gameState.players[a].score
    );
    
    sortedPlayers.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.classList.add('player');
        
        if (gameState.players[player].inCave) {
            playerElement.classList.add('in-cave');
        }
        
        playerElement.innerHTML = `
            <span class="player-name">${player}</span>
            <span class="player-score">${gameState.players[player].score}</span>
            ${gameState.players[player].inCave ? '<span class="player-status">In Cave</span>' : '<span class="player-status">Safe</span>'}
        `;
        
        playersList.appendChild(playerElement);
    });
    
    // Update buttons based on game state
    document.getElementById('start-game-btn').disabled = gameState.isActive;
    document.getElementById('next-card-btn').disabled = gameState.phase !== 'revealing';
    document.getElementById('start-decision-btn').disabled = gameState.phase !== 'revealing';
};

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Set up button event listeners
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('next-card-btn').addEventListener('click', revealNextCard);
    document.getElementById('start-decision-btn').addEventListener('click', startDecisionPhase);
    
    // Add sound toggle button
    const soundToggle = document.createElement('div');
    soundToggle.id = 'sound-toggle';
    soundToggle.className = 'sound-toggle';
    soundToggle.textContent = '🔊';
    soundToggle.addEventListener('click', toggleSound);
    document.body.appendChild(soundToggle);
    
    // Initialize UI
    updateUI();
    displayMessage("Welcome to Diamant! Press 'Start Game' to begin.");
    
    // Set up socket.io connection for Twitch chat
    const socket = io();
    
    socket.on("chatMessage", (data) => {
        // Process commands from chat
        processChatCommand(data.user, data.message);
    });
}); 