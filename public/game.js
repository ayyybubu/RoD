// Game configuration
const config = {
    joinTime: 30,          // Seconds for joining phase
    decisionTime: 15,      // Seconds for decision phase
    maxRounds: 5,          // Number of rounds in a game
    minTreasureScale: 0.4, // Minimum treasure value as a percentage of player count
    maxTreasureScale: 2.0, // Maximum treasure value as a multiple of player count
    roundBreakTime: 5,     // Seconds between rounds
};

// Game state
const gameState = {
    isActive: false,
    phase: 'waiting',      // waiting, joining, revealing, deciding, roundEnd, gameEnd
    currentRound: 1,
    players: {},
    deck: [],
    currentPath: [],
    revealedTraps: {},
    treasureOnPath: 0,
    treasureValues: [],
    timer: null,
    timerRemaining: 0,
    timerDuration: 0,
    playerLimit: 0,        // 0 means no limit
};

// DOM elements map for quick access
const elementsMap = {
    startGameBtn: document.getElementById('start-game'),
    revealCardBtn: document.getElementById('reveal-card'),
    startDecisionBtn: document.getElementById('start-decision'),
    timerBar: document.getElementById('timer-bar'),
    timerText: document.getElementById('timer-text'),
    cavePath: document.getElementById('cave-path'),
    playersContainer: document.getElementById('players-container'),
    logContainer: document.getElementById('log-container'),
    gameMessage: document.getElementById('game-message'),
    currentRound: document.getElementById('current-round'),
    playerCount: document.getElementById('player-count'),
    activePlayers: document.getElementById('active-players'),
};

// Templates
const cardTemplate = document.getElementById('card-template');
const playerTemplate = document.getElementById('player-template');

// Initialize the game
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners
    elementsMap.startGameBtn.addEventListener('click', showPlayerLimitPrompt);
    elementsMap.revealCardBtn.addEventListener('click', revealNextCard);
    elementsMap.startDecisionBtn.addEventListener('click', startDecisionPhase);
    
    // Set up socket connection for chat messages
    const socket = io();
    socket.on('chatMessage', handleChatMessage);
    
    // Initialize game state
    updateGameMessage('Welcome to Diamant! Click "Start New Game" to begin.');
});

/**
 * Show the player limit prompt when starting a new game
 */
function showPlayerLimitPrompt() {
    // Create a modal dialog
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = 'Player Limit';
    modalContent.appendChild(title);
    
    // Add description
    const description = document.createElement('p');
    description.textContent = 'Enter the maximum number of players allowed to join (0 for no limit):';
    description.style.marginBottom = '15px';
    modalContent.appendChild(description);
    
    // Add input field
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100';
    input.value = '0';
    input.style.width = '100%';
    input.style.padding = '10px';
    input.style.marginBottom = '20px';
    input.style.borderRadius = '5px';
    input.style.border = '1px solid #444';
    input.style.backgroundColor = '#2a2a2a';
    input.style.color = '#fff';
    modalContent.appendChild(input);
    
    // Add buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'primary-btn';
    cancelButton.style.backgroundColor = '#555';
    cancelButton.style.flex = '1';
    
    const startButton = document.createElement('button');
    startButton.textContent = 'Start Game';
    startButton.className = 'primary-btn';
    startButton.style.flex = '1';
    
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(startButton);
    modalContent.appendChild(buttonContainer);
    
    // Add modal to the page
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Focus the input field
    input.focus();
    
    // Add event listeners
    cancelButton.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    startButton.addEventListener('click', () => {
        const limit = parseInt(input.value);
        gameState.playerLimit = isNaN(limit) ? 0 : limit;
        document.body.removeChild(modal);
        startGame();
    });
    
    // Allow pressing Enter to submit
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startButton.click();
        }
    });
}

/**
 * Start a new game
 */
function startGame() {
    console.log("Starting new game with player limit:", gameState.playerLimit);
    
    // Reset game state
    gameState.isActive = true;
    gameState.currentRound = 1;
    gameState.currentPath = [];
    gameState.revealedTraps = {};
    gameState.treasureOnPath = 0;
    gameState.phase = 'joining';
    gameState.treasureValues = [];
    gameState.players = {};
    
    // Update UI
    elementsMap.currentRound.textContent = gameState.currentRound;
    elementsMap.playerCount.textContent = '0';
    elementsMap.activePlayers.textContent = '0';
    elementsMap.cavePath.innerHTML = '';
    elementsMap.playersContainer.innerHTML = '';
    elementsMap.logContainer.innerHTML = '';
    
    // Disable controls during joining phase
    elementsMap.startGameBtn.disabled = true;
    elementsMap.revealCardBtn.disabled = true;
    elementsMap.startDecisionBtn.disabled = true;
    
    // Start join timer
    const limitMessage = gameState.playerLimit > 0 ? 
        `Joining phase! Type !join in chat to play. (Limited to ${gameState.playerLimit} players)` : 
        'Joining phase! Type !join in chat to play. (No player limit)';
    
    updateGameMessage(limitMessage);
    addLogEntry('A new game of Diamant is starting! Type !join to play!', 'highlight');
    
    if (gameState.playerLimit > 0) {
        addLogEntry(`Player limit set to ${gameState.playerLimit} players.`, 'highlight');
    } else {
        addLogEntry('No player limit set - unlimited players can join.', 'highlight');
    }
    
    startTimer(config.joinTime, () => {
        if (Object.keys(gameState.players).length > 0) {
            // Start the first round (deck will be created in startNextRound)
            startNextRound();
        } else {
            gameState.phase = 'waiting';
            gameState.isActive = false;
            updateGameMessage('No players joined. Game canceled.');
            elementsMap.startGameBtn.disabled = false;
        }
    });
}

/**
 * Create a deck of cards for the game
 */
function createDeck() {
    const deck = [];
    
    // Calculate treasure values based on player count
    const playerCount = Object.keys(gameState.players).length;
    
    // Calculate min and max treasure values
    const minTreasure = Math.max(1, Math.floor(playerCount * config.minTreasureScale));
    const maxTreasure = Math.max(5, Math.floor(playerCount * config.maxTreasureScale));
    
    // Generate treasure values if not already generated
    if (gameState.treasureValues.length === 0) {
        // Create an array of treasure values between min and max
        const range = maxTreasure - minTreasure;
        const step = range / 14; // 15 treasure cards
        
        for (let i = 0; i < 15; i++) {
            const value = Math.floor(minTreasure + (step * i));
            gameState.treasureValues.push(value);
        }
        
        // Log the treasure values for debugging
        console.log(`Treasure values (${playerCount} players): ${gameState.treasureValues.join(', ')}`);
    }
    
    // Add treasure cards
    gameState.treasureValues.forEach(value => {
        deck.push({ type: 'treasure', value });
    });
    
    // Add trap cards (3 of each type)
    const trapTypes = ['snake', 'spider', 'lava', 'rockfall', 'poison'];
    trapTypes.forEach(trapType => {
        for (let i = 0; i < 3; i++) {
            deck.push({ type: 'trap', trapType });
        }
    });
    
    // Shuffle the deck
    return shuffleDeck(deck);
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleDeck(deck) {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}

/**
 * Reveal the next card from the deck
 */
function revealNextCard() {
    console.log("Revealing next card...");
    
    if (gameState.deck.length === 0) {
        addLogEntry("The deck is empty!", "warning");
        startNextRound();
        return;
    }
    
    // Check if there are any players in the cave
    const playersInCave = Object.values(gameState.players).filter(p => p.inCave);
    if (playersInCave.length === 0) {
        addLogEntry("All players have left the cave!", "warning");
        startNextRound();
        return;
    }
    
    // Disable controls during card reveal
    elementsMap.revealCardBtn.disabled = true;
    elementsMap.startDecisionBtn.disabled = true;
    
    // Reveal the next card
    const card = gameState.deck.pop();
    gameState.currentPath.push(card);
    
    // Create and add the card element to the path
    const cardElement = createCardElement(card);
    elementsMap.cavePath.appendChild(cardElement);
    
    // Process the card effects
    processCardEffects(card);
}

/**
 * Process the effects of a revealed card
 */
function processCardEffects(card) {
    if (card.type === 'treasure') {
        // Count players in the cave
        const playersInCave = Object.values(gameState.players).filter(p => p.inCave);
        const playersCount = playersInCave.length;
        
        if (playersCount > 0) {
            // Calculate treasure per player
            const treasurePerPlayer = Math.floor(card.value / playersCount);
            
            // Calculate remaining treasure on the card
            const remainingTreasure = card.value % playersCount;
            
            // Update the card value to show only the remaining treasure
            card.originalValue = card.value;
            card.value = remainingTreasure;
            
            // Add treasure to each player in the cave
            playersInCave.forEach(player => {
                player.holding = (player.holding || 0) + treasurePerPlayer;
                updatePlayerElement(player);
            });
            
            // Update total treasure on path
            gameState.treasureOnPath = gameState.currentPath.reduce((total, c) => {
                return total + (c.type === 'treasure' ? c.value : 0);
            }, 0);
            
            addLogEntry(`Revealed: ${card.originalValue} rubies! Each player collects ${treasurePerPlayer}, leaving ${remainingTreasure} on the card.`, 'success');
        } else {
            // No players in cave, just add to path
            gameState.treasureOnPath += card.value;
            card.originalValue = card.value;
            addLogEntry(`Revealed: ${card.value} rubies!`, 'success');
        }
        
        // Enable decision phase button
        elementsMap.startDecisionBtn.disabled = false;
    } else if (card.type === 'trap') {
        // Count this trap type
        gameState.revealedTraps[card.trapType] = (gameState.revealedTraps[card.trapType] || 0) + 1;
        
        // Check if this is the second trap of this type
        if (gameState.revealedTraps[card.trapType] >= 2) {
            addLogEntry(`DANGER! A second ${card.trapType} trap appears!`, 'danger');
            
            // Activate the trap after a short delay
            setTimeout(() => {
                handleTrapSpring(card.trapType);
            }, 1500);
        } else {
            addLogEntry(`Revealed: A ${card.trapType} trap! Be careful...`, 'warning');
            
            // Enable decision phase button
            elementsMap.startDecisionBtn.disabled = false;
        }
    } else if (card.type === 'relic') {
        addLogEntry(`Revealed: A rare relic worth ${card.value} rubies!`, 'highlight');
        gameState.treasureOnPath += card.value;
        
        // Enable decision phase button
        elementsMap.startDecisionBtn.disabled = false;
    }
    
    // Update game message
    updateGameMessage(`Card revealed: ${getCardDescription(card)}`);
}

/**
 * Start the decision phase where players decide to continue or exit
 */
function startDecisionPhase() {
    console.log("Starting decision phase...");
    
    // Check if there are any players in the cave
    const playersInCave = Object.values(gameState.players).filter(p => p.inCave);
    console.log("Players in cave at decision phase:", playersInCave.length);
    
    if (playersInCave.length === 0) {
        console.log("No players in cave, ending round");
        startNextRound();
        return;
    }
    
    gameState.phase = 'deciding';
    
    // Disable controls during decision phase
    elementsMap.revealCardBtn.disabled = true;
    elementsMap.startDecisionBtn.disabled = true;
    
    updateGameMessage("Decision time! Type !roach to leave with your treasures, or do nothing to continue exploring.");
    addLogEntry("Decision time! Type !roach to leave with your treasures, or do nothing to continue exploring.", 'highlight');
    
    // Start timer for decision phase
    startTimer(config.decisionTime, () => {
        if (gameState.phase === 'deciding') {
            processDecisions();
        }
    });
}

/**
 * Process player decisions after the timer ends
 */
function processDecisions() {
    console.log("Processing decisions...");
    
    const playersInCave = Object.values(gameState.players).filter(p => p.inCave);
    console.log("Players in cave:", playersInCave.length);
    
    if (playersInCave.length === 0) {
        startNextRound();
        return;
    }
    
    // Calculate treasure distribution for players who are leaving
    const exitingPlayers = Object.values(gameState.players).filter(p => 
        p.decision === 'exit' && p.inCave
    );
    
    console.log("Exiting players:", exitingPlayers.length);
    
    if (exitingPlayers.length > 0) {
        // Calculate how many players are exiting
        const totalExitingPlayers = exitingPlayers.length;
        
        // Calculate total remaining treasure on the path to divide among exiting players
        const remainingPathTreasure = gameState.treasureOnPath;
        const treasurePerExitingPlayer = Math.floor(remainingPathTreasure / totalExitingPlayers);
        
        console.log("Remaining path treasure:", remainingPathTreasure);
        console.log("Treasure per exiting player:", treasurePerExitingPlayer);
        
        // Process each exiting player
        exitingPlayers.forEach(player => {
            // Get the treasure they've already collected while exploring
            const collectedTreasure = player.holding || 0;
            
            // Add their share of the remaining treasure on the path
            const totalTreasure = collectedTreasure + treasurePerExitingPlayer;
            
            console.log(`${player.username} collected: ${collectedTreasure}, share: ${treasurePerExitingPlayer}, total: ${totalTreasure}`);
            
            // Mark player as out of the cave
            player.inCave = false;
            player.status = 'exited';
            
            // Add their total treasure to their score
            player.chest = (player.chest || 0) + totalTreasure;
            player.holding = 0;
            
            // Clear their decision
            delete player.decision;
            
            // Update player element
            updatePlayerElement(player);
        });
        
        // Update the treasure on path - all treasure is taken by exiting players
        gameState.treasureOnPath = 0;
        
        // Update all card values to 0 as treasure is taken
        gameState.currentPath.forEach(card => {
            if (card.type === 'treasure' || card.type === 'relic') {
                card.value = 0;
                
                // Update card display
                const cardElement = elementsMap.cavePath.children[gameState.currentPath.indexOf(card)];
                const valueElement = cardElement.querySelector('.card-value');
                if (valueElement) {
                    valueElement.textContent = '0';
                }
            }
        });
        
        // Display message about players leaving
        if (exitingPlayers.length === 1) {
            const player = exitingPlayers[0];
            addLogEntry(`${player.username} left the cave with ${player.chest} rubies!`, 'success');
        } else {
            const treasureMessages = exitingPlayers.map(player => 
                `${player.username} (${player.chest})`
            ).join(', ');
            addLogEntry(`Players left the cave with their treasures: ${treasureMessages}`, 'success');
        }
        
        // Update game message
        updateGameMessage(`${exitingPlayers.length} player(s) left the cave.`);
        
        // Update active players count
        elementsMap.activePlayers.textContent = Object.values(gameState.players).filter(p => p.inCave).length;
        
        // Check if anyone is still in the cave after players have left
        const remainingPlayers = Object.values(gameState.players).filter(p => p.inCave);
        console.log("Remaining players after exits:", remainingPlayers.length);
        
        if (remainingPlayers.length === 0) {
            startNextRound();
        } else {
            // Continue the game with the next card
            gameState.phase = 'revealing';
            elementsMap.revealCardBtn.disabled = false;
            updateGameMessage("Ready to reveal the next card.");
        }
    } else {
        // Reset decisions for continuing players
        Object.values(gameState.players).forEach(player => {
            if (player.inCave) {
                delete player.decision;
            }
        });
        
        // Check if anyone is still in the cave
        const remainingPlayers = Object.values(gameState.players).filter(p => p.inCave);
        console.log("Remaining players (no exits):", remainingPlayers.length);
        
        if (remainingPlayers.length === 0) {
            startNextRound();
        } else {
            // Continue with next card
            gameState.phase = 'revealing';
            elementsMap.revealCardBtn.disabled = false;
            updateGameMessage("All players continue exploring. Ready to reveal the next card.");
        }
    }
}

/**
 * Handle a trap being sprung (second trap of same type)
 */
function handleTrapSpring(trapType) {
    addLogEntry(`The ${trapType} trap is sprung! All players in the cave lose their treasures!`, 'danger');
    updateGameMessage(`DANGER! The ${trapType} trap is sprung!`);
    
    // All players in the cave lose their treasures
    Object.values(gameState.players).forEach(player => {
        if (player.inCave) {
            player.holding = 0;
            player.status = 'out';
            player.inCave = false;
            updatePlayerElement(player);
        }
    });
    
    // Update active players count
    elementsMap.activePlayers.textContent = '0';
    
    // Start next round after a delay
    setTimeout(() => {
        startNextRound();
    }, 2000);
}

/**
 * Start the next round or end the game
 */
function startNextRound() {
    console.log(`Starting round ${gameState.currentRound + 1}`);
    
    // Check if this was the final round
    if (gameState.currentRound >= config.maxRounds) {
        endGame("Game over! All rounds completed.");
        return;
    }
    
    // Increment round counter
    gameState.currentRound++;
    elementsMap.currentRound.textContent = gameState.currentRound;
    
    // Reset path and traps for the new round
    gameState.currentPath = [];
    gameState.revealedTraps = {};
    gameState.treasureOnPath = 0;
    
    // Clear the cave path display
    elementsMap.cavePath.innerHTML = '';
    
    // Create a new deck for each round to ensure traps can appear again
    gameState.deck = createDeck();
    console.log(`Created new deck with ${gameState.deck.length} cards for round ${gameState.currentRound}`);
    
    // Reset all players to be in the cave at the start of the round
    Object.values(gameState.players).forEach(player => {
        player.inCave = true;
        player.status = 'in';
        player.holding = 0;
        updatePlayerElement(player);
    });
    
    // Update active players count
    elementsMap.activePlayers.textContent = Object.keys(gameState.players).length;
    
    gameState.phase = 'revealing';
    addLogEntry(`Round ${gameState.currentRound} begins! Everyone enters the cave...`, 'highlight');
    updateGameMessage(`Round ${gameState.currentRound} begins! Ready to reveal the first card.`);
    
    // Enable reveal card button
    elementsMap.revealCardBtn.disabled = false;
}

/**
 * End the game and show final scores
 */
function endGame(message) {
    gameState.phase = 'gameEnd';
    gameState.isActive = false;
    
    // Display end game message
    addLogEntry(message, 'highlight');
    addLogEntry("Final scores:", 'highlight');
    
    // Sort players by score
    const sortedPlayers = Object.values(gameState.players).sort((a, b) => b.chest - a.chest);
    
    // Display final scores
    sortedPlayers.forEach((player, index) => {
        addLogEntry(`${index + 1}. ${player.username}: ${player.chest} rubies`, index === 0 ? 'success' : '');
    });
    
    // Announce winner
    if (sortedPlayers.length > 0) {
        updateGameMessage(`Game over! ${sortedPlayers[0].username} wins with ${sortedPlayers[0].chest} rubies!`);
    } else {
        updateGameMessage("Game over! No players participated.");
    }
    
    // Enable start game button
    elementsMap.startGameBtn.disabled = false;
    elementsMap.revealCardBtn.disabled = true;
    elementsMap.startDecisionBtn.disabled = true;
}

/**
 * Handle a chat message from a user
 */
function handleChatMessage(data) {
    const username = data.user;
    const message = data.message.trim().toLowerCase();
    
    // Process commands
    if (message === '!join' && gameState.phase === 'joining') {
        addPlayer(username);
    } else if (message === '!roach' && gameState.phase === 'deciding') {
        playerDecision(username, 'exit');
    }
}

/**
 * Add a player to the game
 */
function addPlayer(username) {
    // Check if player already exists
    if (gameState.players[username]) {
        return;
    }
    
    // Check if player limit has been reached
    if (gameState.playerLimit > 0 && Object.keys(gameState.players).length >= gameState.playerLimit) {
        addLogEntry(`${username} tried to join, but the player limit (${gameState.playerLimit}) has been reached.`, 'warning');
        return;
    }
    
    // Create new player
    const player = {
        username,
        inCave: false,
        holding: 0,
        chest: 0,
        status: 'waiting'
    };
    
    // Add to game state
    gameState.players[username] = player;
    
    // Create player element
    const playerElement = createPlayerElement(player);
    elementsMap.playersContainer.appendChild(playerElement);
    
    // Update player count
    elementsMap.playerCount.textContent = Object.keys(gameState.players).length;
    
    // Log the join
    addLogEntry(`${username} joined the game!`, 'success');
}

/**
 * Record a player's decision
 */
function playerDecision(username, decision) {
    const player = gameState.players[username];
    
    // Check if player exists and is in the cave
    if (!player || !player.inCave) {
        return;
    }
    
    // Record decision
    player.decision = decision;
    
    // Log the decision
    if (decision === 'exit') {
        addLogEntry(`${username} decided to leave the cave!`);
    }
}

/**
 * Create a card element from a card object
 */
function createCardElement(card) {
    const clone = cardTemplate.content.cloneNode(true);
    const cardElement = clone.querySelector('.card');
    
    // Set card type class
    cardElement.classList.add(`${card.type}-card`);
    
    // Set card content
    const titleElement = cardElement.querySelector('.card-title');
    const imageElement = cardElement.querySelector('.card-image');
    const valueElement = cardElement.querySelector('.card-value');
    
    if (card.type === 'treasure') {
        titleElement.textContent = 'Treasure';
        valueElement.textContent = card.value;
    } else if (card.type === 'trap') {
        titleElement.textContent = `${card.trapType.charAt(0).toUpperCase() + card.trapType.slice(1)} Trap`;
        cardElement.classList.add(`trap-${card.trapType}`);
    } else if (card.type === 'relic') {
        titleElement.textContent = 'Relic';
        valueElement.textContent = card.value;
    }
    
    return cardElement;
}

/**
 * Create a player element from a player object
 */
function createPlayerElement(player) {
    const clone = playerTemplate.content.cloneNode(true);
    const playerElement = clone.querySelector('.player');
    
    // Set player data attribute for easy lookup
    playerElement.dataset.username = player.username;
    
    // Set player content
    playerElement.querySelector('.player-name').textContent = player.username;
    playerElement.querySelector('.player-status').textContent = player.status === 'in' ? 'In Cave' : 
                                                               player.status === 'exited' ? 'Exited' : 'Out';
    playerElement.querySelector('.player-holding').textContent = player.holding || 0;
    playerElement.querySelector('.player-chest').textContent = player.chest || 0;
    
    // Add status class
    if (player.status === 'exited') {
        playerElement.querySelector('.player-status').classList.add('exited');
    } else if (player.status === 'out') {
        playerElement.querySelector('.player-status').classList.add('out');
    }
    
    return playerElement;
}

/**
 * Update a player element with new data
 */
function updatePlayerElement(player) {
    const playerElement = elementsMap.playersContainer.querySelector(`.player[data-username="${player.username}"]`);
    
    if (!playerElement) return;
    
    // Update player content
    playerElement.querySelector('.player-status').textContent = player.inCave ? 'In Cave' : 
                                                               player.status === 'exited' ? 'Exited' : 'Out';
    playerElement.querySelector('.player-holding').textContent = player.holding || 0;
    playerElement.querySelector('.player-chest').textContent = player.chest || 0;
    
    // Update status class
    const statusElement = playerElement.querySelector('.player-status');
    statusElement.classList.remove('exited', 'out');
    
    if (player.status === 'exited') {
        statusElement.classList.add('exited');
    } else if (player.status === 'out') {
        statusElement.classList.add('out');
    }
}

/**
 * Add an entry to the game log
 */
function addLogEntry(message, className = '') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${className}`;
    logEntry.textContent = message;
    
    elementsMap.logContainer.appendChild(logEntry);
    elementsMap.logContainer.scrollTop = elementsMap.logContainer.scrollHeight;
    
    // Also log to console
    console.log(`[GAME LOG] ${message}`);
}

/**
 * Update the game message display
 */
function updateGameMessage(message) {
    elementsMap.gameMessage.textContent = message;
}

/**
 * Start a timer for a specific duration
 */
function startTimer(seconds, callback) {
    // Clear any existing timer
    if (gameState.timer) {
        clearInterval(gameState.timer);
    }
    
    // Set up timer state
    gameState.timerRemaining = seconds;
    gameState.timerDuration = seconds;
    
    // Update timer display
    elementsMap.timerText.textContent = `${seconds}s`;
    elementsMap.timerBar.style.transform = 'scaleX(1)';
    
    // Start the timer
    gameState.timer = setInterval(() => {
        gameState.timerRemaining--;
        
        // Update timer display
        elementsMap.timerText.textContent = `${gameState.timerRemaining}s`;
        elementsMap.timerBar.style.transform = `scaleX(${gameState.timerRemaining / gameState.timerDuration})`;
        
        if (gameState.timerRemaining <= 0) {
            clearInterval(gameState.timer);
            callback();
        }
    }, 1000);
}

/**
 * Get a readable description of a card
 */
function getCardDescription(card) {
    if (card.type === 'treasure') {
        return `Treasure (${card.value} rubies)`;
    } else if (card.type === 'trap') {
        return `${card.trapType} trap`;
    } else if (card.type === 'relic') {
        return `Relic (${card.value} rubies)`;
    }
    return 'Unknown card';
}