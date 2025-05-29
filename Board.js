const startBoard = (game, options = { playAgainst: 'human', aiColor: 'black', aiLevel: 'medium' }) => {
    // Initialize game state and UI elements
    const aiPlayer = options.playAgainst === 'ai' ? ai(options.aiColor) : null;
    const board = document.getElementById('board');
    const squares = board.querySelectorAll('.square');
    const whiteSematary = document.getElementById('whiteSematary');
    const blackSematary = document.getElementById('blackSematary');
    const turnSign = document.getElementById('turn');
    const whiteTimer = document.getElementById('whiteTimer');
    const blackTimer = document.getElementById('blackTimer');
    
    let clickedPieceName = null;
    let gameState = 'white_turn';
    let timerInterval;
    let whiteTime = 600; // 10 minutes in seconds
    let blackTime = 600;
    let lastClickedSquare = null;

    // Timer functions
    const updateTimerDisplay = () => {
        whiteTimer.textContent = formatTime(whiteTime);
        blackTimer.textContent = formatTime(blackTime);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const startTimer = () => {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (gameState === 'white_turn' || 
               (gameState === 'ai_thinking' && options.aiColor === 'white')) {
                whiteTime--;
                if (whiteTime <= 0) handleTimeout('white');
            }
            else if (gameState === 'black_turn' || 
                    (gameState === 'ai_thinking' && options.aiColor === 'black')) {
                blackTime--;
                if (blackTime <= 0) handleTimeout('black');
            }
            updateTimerDisplay();
        }, 1000);
    };

    const handleTimeout = (color) => {
        clearInterval(timerInterval);
        game.emit('checkMate', color === 'white' ? 'black' : 'white');
    };

    const resetTimers = () => {
        clearInterval(timerInterval);
        whiteTime = 600;
        blackTime = 600;
        updateTimerDisplay();
    };

    // Board setup functions
    const resetBoard = () => {
        // Clear semataries
        whiteSematary.querySelectorAll('div').forEach(div => div.innerHTML = '');
        blackSematary.querySelectorAll('div').forEach(div => div.innerHTML = '');
        
        // Reset timers
        resetTimers();
        
        // Clear board
        squares.forEach(square => {
            square.innerHTML = '';
            square.classList.remove('allowed', 'clicked-square', 'last-move');
        });

        // Place pieces
        game.pieces.forEach(piece => {
            const square = document.getElementById(piece.position);
            if (square) {
                square.innerHTML = `<img class="piece ${piece.rank}" id="${piece.name}" src="img/${piece.color}-${piece.rank}.webp">`;
            }
        });

        // Hide end scene
        document.getElementById('endscene').classList.remove('show');
        
        // Reset game state
        gameState = 'white_turn';
        clickedPieceName = null;
        lastClickedSquare = null;
        updateTurnDisplay();
    };

    // Game state management
    const setGameState = (state) => {
        gameState = state;
        updateTurnDisplay();
    };

    const updateTurnDisplay = () => {
        if (gameState === 'ai_thinking') {
            turnSign.innerHTML = `${options.aiColor.charAt(0).toUpperCase() + 
                options.aiColor.slice(1)}'s Turn (AI thinking...)`;
        } else if (gameState === 'checkmate') {
            turnSign.innerHTML = "Game Over";
        } else {
            turnSign.innerHTML = gameState === 'white_turn' ? 
                "White's Turn" : "Black's Turn";
        }
    };

    // Square highlighting functions
    const setAllowedSquares = (pieceImg) => {
        clearSquares();
        
        clickedPieceName = pieceImg.id;
        const allowedMoves = game.getPieceAllowedMoves(clickedPieceName);
        
        if (allowedMoves && allowedMoves.length > 0) {
            const clickedSquare = pieceImg.parentNode;
            clickedSquare.classList.add('clicked-square');
            lastClickedSquare = clickedSquare;

            allowedMoves.forEach(allowedMove => {
                const square = document.getElementById(allowedMove);
                if (square) {
                    square.classList.add('allowed');
                }
            });
            return true;
        }
        
        clickedPieceName = null;
        return false;
    };

    const clearSquares = () => {
        board.querySelectorAll('.allowed').forEach(square => 
            square.classList.remove('allowed'));
        if (lastClickedSquare) {
            lastClickedSquare.classList.remove('clicked-square');
            lastClickedSquare = null;
        }
    };

    const setLastMoveSquares = (from, to) => {
        board.querySelectorAll('.last-move').forEach(square => 
            square.classList.remove('last-move'));
        from.classList.add('last-move');
        to.classList.add('last-move');
    };

    // Piece movement logic
    const movePiece = (square) => {
        if (gameState === 'ai_thinking' || gameState === 'checkmate') return;

        const position = square.getAttribute('id');
        const existedPiece = game.getPieceByPos(position);

        if (existedPiece && existedPiece.color === game.turn) {
            const pieceImg = document.getElementById(existedPiece.name);
            if (pieceImg) {
                setAllowedSquares(pieceImg);
            }
            return;
        }

        if (clickedPieceName) {
            const success = game.movePiece(clickedPieceName, position);
            if (success) {
                clearSquares();
                clickedPieceName = null;
                
                if (options.playAgainst === 'ai' && game.turn === options.aiColor) {
                    setGameState('ai_thinking');
                    aiPlayer.play(game.pieces, aiMove => {
                        game.movePiece(aiMove.move.pieceName, aiMove.move.position);
                        setGameState(options.aiColor === 'white' ? 'black_turn' : 'white_turn');
                    });
                }
            }
        }
    };

    // Event listeners
    squares.forEach(square => {
        square.addEventListener("click", function() {
            movePiece(this);
        });
        
        square.addEventListener("dragover", function(event) {
            event.preventDefault();
        });
        
        square.addEventListener("drop", function() {
            movePiece(this);
        });
    });

    // Piece drag and drop
    const setupPieceDragAndDrop = () => {
        document.querySelectorAll('img.piece').forEach(pieceImg => {
            pieceImg.setAttribute('draggable', true);
            
            pieceImg.addEventListener("dragstart", function(event) {
                if (gameState === 'ai_thinking' || gameState === 'checkmate') {
                    event.preventDefault();
                    return;
                }
                event.dataTransfer.setData("text", event.target.id);
                setAllowedSquares(event.target);
            });

            pieceImg.addEventListener("click", function(event) {
                if (gameState === 'ai_thinking' || gameState === 'checkmate') return;
                event.stopPropagation();
                setAllowedSquares(event.target);
            });
        });
    };

    // Game event handlers
    game.on('pieceMove', move => {
        const from = document.getElementById(move.from);
        const to = document.getElementById(move.piece.position);
        if (from && to) {
            const pieceImg = document.getElementById(move.piece.name);
            if (pieceImg) {
                to.appendChild(pieceImg);
                setLastMoveSquares(from, to);
            }
        }
    });

    game.on('turnChange', turn => {
        setGameState(turn + '_turn');
        startTimer();
    });

    game.on('promotion', queen => {
        const square = document.getElementById(queen.position);
        if (square) {
            square.innerHTML = `<img class="piece queen" id="${queen.name}" src="img/${queen.color}-queen.webp">`;
            setupPieceDragAndDrop();
        }
    });

    game.on('kill', piece => {
        const pieceImg = document.getElementById(piece.name);
        if (pieceImg) {
            pieceImg.remove();
            const sematary = piece.color === 'white' ? whiteSematary : blackSematary;
            sematary.querySelector('.' + piece.rank)?.appendChild(pieceImg);
        }
    });

    game.on('checkMate', winner => {
        clearInterval(timerInterval);
        const endScene = document.getElementById('endscene');
        const winningSign = endScene.querySelector('.winning-sign');
        if (winningSign) {
            winningSign.innerHTML = winner.winner + ' Wins!';
        }
        endScene.classList.add('show');
        setGameState('checkmate');
    });

    // Initialize board
    resetBoard();
    setupPieceDragAndDrop();
    startTimer();
};

// Initialize pieces
const pieces = [
    // White pieces
    { rank: 'rook', position: 11, color: 'white', name: 'whiteRook1', ableToCastle: true, initialPosition: 11 },
    { rank: 'knight', position: 12, color: 'white', name: 'whiteKnight1', initialPosition: 12 },
    { rank: 'bishop', position: 13, color: 'white', name: 'whiteBishop1', initialPosition: 13 },
    { rank: 'queen', position: 14, color: 'white', name: 'whiteQueen', initialPosition: 14 },
    { rank: 'king', position: 15, color: 'white', name: 'whiteKing', ableToCastle: true, initialPosition: 15 },
    { rank: 'bishop', position: 16, color: 'white', name: 'whiteBishop2', initialPosition: 16 },
    { rank: 'knight', position: 17, color: 'white', name: 'whiteKnight2', initialPosition: 17 },
    { rank: 'rook', position: 18, color: 'white', name: 'whiteRook2', ableToCastle: true, initialPosition: 18 },
    { rank: 'pawn', position: 21, color: 'white', name: 'whitePawn1', initialPosition: 21 },
    { rank: 'pawn', position: 22, color: 'white', name: 'whitePawn2', initialPosition: 22 },
    { rank: 'pawn', position: 23, color: 'white', name: 'whitePawn3', initialPosition: 23 },
    { rank: 'pawn', position: 24, color: 'white', name: 'whitePawn4', initialPosition: 24 },
    { rank: 'pawn', position: 25, color: 'white', name: 'whitePawn5', initialPosition: 25 },
    { rank: 'pawn', position: 26, color: 'white', name: 'whitePawn6', initialPosition: 26 },
    { rank: 'pawn', position: 27, color: 'white', name: 'whitePawn7', initialPosition: 27 },
    { rank: 'pawn', position: 28, color: 'white', name: 'whitePawn8', initialPosition: 28 },

    // Black pieces
    { rank: 'rook', position: 81, color: 'black', name: 'blackRook1', ableToCastle: true, initialPosition: 81 },
    { rank: 'knight', position: 82, color: 'black', name: 'blackKnight1', initialPosition: 82 },
    { rank: 'bishop', position: 83, color: 'black', name: 'blackBishop1', initialPosition: 83 },
    { rank: 'queen', position: 84, color: 'black', name: 'blackQueen', initialPosition: 84 },
    { rank: 'king', position: 85, color: 'black', name: 'blackKing', ableToCastle: true, initialPosition: 85 },
    { rank: 'bishop', position: 86, color: 'black', name: 'blackBishop2', initialPosition: 86 },
    { rank: 'knight', position: 87, color: 'black', name: 'blackKnight2', initialPosition: 87 },
    { rank: 'rook', position: 88, color: 'black', name: 'blackRook2', ableToCastle: true, initialPosition: 88 },
    { rank: 'pawn', position: 71, color: 'black', name: 'blackPawn1', initialPosition: 71 },
    { rank: 'pawn', position: 72, color: 'black', name: 'blackPawn2', initialPosition: 72 },
    { rank: 'pawn', position: 73, color: 'black', name: 'blackPawn3', initialPosition: 73 },
    { rank: 'pawn', position: 74, color: 'black', name: 'blackPawn4', initialPosition: 74 },
    { rank: 'pawn', position: 75, color: 'black', name: 'blackPawn5', initialPosition: 75 },
    { rank: 'pawn', position: 76, color: 'black', name: 'blackPawn6', initialPosition: 76 },
    { rank: 'pawn', position: 77, color: 'black', name: 'blackPawn7', initialPosition: 77 },
    { rank: 'pawn', position: 78, color: 'black', name: 'blackPawn8', initialPosition: 78 }
];

const startNewGame = () => {
    document.querySelectorAll('.scene').forEach(scene => scene.classList.remove('show'));

    const playAgainst = document.querySelector('input[name="oponent"]:checked').value;
    const humanColor = document.querySelector('input[name="human_color"]:checked')?.value;
    const aiColor = humanColor === 'white' ? 'black' : 'white';
    
    startBoard(game, { 
        playAgainst, 
        aiColor, 
        aiLevel: 'medium'
    });
};

const showColorSelect = () => document.querySelector('.select-color-container').style.display = 'block';
const hideColorSelect = () => document.querySelector('.select-color-container').style.display = 'none';

// Export the pieces array and functions
window.pieces = pieces;
window.startBoard = startBoard;
window.startNewGame = startNewGame;
window.showColorSelect = showColorSelect;
window.hideColorSelect = hideColorSelect;