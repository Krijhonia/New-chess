const ai = (aiTurn) => {
    const ranks = { 
        pawn: 1, 
        king: 100, 
        bishop: 3.3, 
        knight: 3.2, 
        rook: 5.1, 
        queen: 9.5 
    };

    const simulationGame = new SimulationGame([], 'white');
    const humanTurn = aiTurn === 'white' ? 'black' : 'white';

    // Extra hard difficulty settings
    const difficultySettings = {
        depth: 5,                  // Deep search (increase for even harder, but slower)
        centerBonus: 1.1,
        widerCenterBonus: 1.04,
        kingSafetyWeight: 3,
        developmentWeight: 2,
        timeLimit: 2000,           // 2 seconds per move
        mobilityWeight: 0.2,
        pawnStructureWeight: 1.2,
        bishopPairWeight: 0.5,
        rookOpenFileWeight: 0.4,
        passedPawnWeight: 0.7
    };

    // Center squares
    const centerSquares = {
        primary: {44: 1.2, 45: 1.2, 54: 1.2, 55: 1.2},
        secondary: {33: 0.8, 36: 0.8, 63: 0.8, 66: 0.8},
        wider: {43: 0.5, 46: 0.5, 53: 0.5, 56: 0.5, 34: 0.5, 35: 0.5, 64: 0.5, 65: 0.5}
    };

    const getCenterWeight = (position) => {
        for (const area in centerSquares) {
            if (centerSquares[area][position]) {
                return centerSquares[area][position];
            }
        }
        return 0;
    };

    // Pawn structure evaluation
    const evaluatePawnStructure = (pieces, color) => {
        let score = 0;
        const pawns = pieces.filter(p => p.rank === 'pawn' && p.color === color);
        const files = {};
        pawns.forEach(pawn => {
            const file = pawn.position % 10;
            files[file] = (files[file] || 0) + 1;
        });
        // Doubled pawns
        for (const file in files) {
            if (files[file] > 1) {
                score -= 0.5 * (files[file] - 1) * difficultySettings.pawnStructureWeight;
            }
        }
        // Isolated pawns
        for (const file in files) {
            if (!files[+file - 1] && !files[+file + 1]) {
                score -= 0.5 * difficultySettings.pawnStructureWeight;
            }
        }
        // Passed pawns
        for (const pawn of pawns) {
            let passed = true;
            for (const opp of pieces.filter(p => p.rank === 'pawn' && p.color !== color)) {
                if (Math.abs((opp.position % 10) - (pawn.position % 10)) <= 1) {
                    if ((color === 'white' && opp.position < pawn.position) ||
                        (color === 'black' && opp.position > pawn.position)) {
                        passed = false;
                        break;
                    }
                }
            }
            if (passed) score += 0.7 * difficultySettings.passedPawnWeight;
        }
        return score;
    };

    // Bishop pair bonus
    const hasBishopPair = (pieces, color) => {
        return pieces.filter(p => p.rank === 'bishop' && p.color === color).length >= 2;
    };

    // Rook on open file bonus
    const rookOpenFileBonus = (pieces, color) => {
        let bonus = 0;
        const rooks = pieces.filter(p => p.rank === 'rook' && p.color === color);
        const pawns = pieces.filter(p => p.rank === 'pawn');
        for (const rook of rooks) {
            const file = rook.position % 10;
            const filePawns = pawns.filter(p => (p.position % 10) === file && p.color !== color);
            if (filePawns.length === 0) {
                bonus += 0.4 * difficultySettings.rookOpenFileWeight;
            }
        }
        return bonus;
    };

    // Enhanced scoring function
    const score = (pieces, turn) => {
        let materialScore = 0;
        let developmentScore = 0;
        let kingSafetyScore = 0;
        let centerControlScore = 0;
        let mobilityScore = 0;
        let bishopPairScore = 0;
        let rookOpenScore = 0;

        for (const piece of pieces) {
            const pieceValue = ranks[piece.rank] * (piece.color === aiTurn ? 1 : -1);
            materialScore += pieceValue;

            if (piece.color === aiTurn) {
                // Center control
                centerControlScore += getCenterWeight(piece.position) *
                    (piece.rank === 'pawn' ? 0.5 : 1) * difficultySettings.centerBonus;

                // Development
                if ((piece.rank === 'knight' || piece.rank === 'bishop') &&
                    piece.position !== piece.initialPosition) {
                    developmentScore += 0.2 * difficultySettings.developmentWeight;
                }

                // Mobility
                const moves = simulationGame.getPieceAllowedMoves(piece.name);
                mobilityScore += moves.length * 0.02 * difficultySettings.mobilityWeight;
            }

            // King safety
            if (piece.rank === 'king' && piece.color === aiTurn) {
                const kingFile = piece.position % 10;
                if (kingFile > 3 && kingFile < 6) {
                    kingSafetyScore += 0.5 * difficultySettings.kingSafetyWeight;
                }
            }
        }

        // Bishop pair
        if (hasBishopPair(pieces, aiTurn)) bishopPairScore += 0.5 * difficultySettings.bishopPairWeight;
        if (hasBishopPair(pieces, humanTurn)) bishopPairScore -= 0.5 * difficultySettings.bishopPairWeight;

        // Rook open file
        rookOpenScore += rookOpenFileBonus(pieces, aiTurn);
        rookOpenScore -= rookOpenFileBonus(pieces, humanTurn);

        // Pawn structure
        const pawnStructureScore = evaluatePawnStructure(pieces, aiTurn) -
                                  evaluatePawnStructure(pieces, humanTurn);

        return materialScore + centerControlScore + developmentScore +
               kingSafetyScore + mobilityScore + bishopPairScore +
               rookOpenScore + pawnStructureScore;
    };

    // Improved minimax with move ordering and alpha-beta pruning
    const minimax = (pieces, turn, depth = 0, alpha = -Infinity, beta = Infinity, startTime) => {
        simulationGame.startNewGame(pieces, turn);

        // Terminal states
        if (!simulationGame.getPieceByName(humanTurn + 'King') || simulationGame.king_dead(humanTurn)) {
            return { score: Infinity - depth, depth };
        }
        if (!simulationGame.getPieceByName(aiTurn + 'King') || simulationGame.king_dead(aiTurn)) {
            return { score: -Infinity + depth, depth };
        }

        // Time limit
        if (Date.now() - startTime > difficultySettings.timeLimit) {
            return { score: score(pieces, turn), depth };
        }

        // Leaf node or max depth
        if (depth >= difficultySettings.depth) {
            return { 
                score: score(pieces, turn), 
                depth,
                move: null 
            };
        }

        let bestPlay = { 
            move: null, 
            score: turn === aiTurn ? -Infinity : Infinity,
            depth: depth
        };

        // Get all pieces for current turn and sort by value
        const currentPieces = pieces.filter(p => p.color === turn);
        currentPieces.sort((a, b) => ranks[b.rank] - ranks[a.rank]);

        for (const piece of currentPieces) {
            let allowedMoves = simulationGame.getPieceAllowedMoves(piece.name);

            // Sort moves by capture potential and center control
            allowedMoves.sort((a, b) => {
                const aPiece = simulationGame.getPieceByPos(a);
                const bPiece = simulationGame.getPieceByPos(b);
                const aValue = aPiece ? ranks[aPiece.rank] : 0;
                const bValue = bPiece ? ranks[bPiece.rank] : 0;
                const aCenter = getCenterWeight(a);
                const bCenter = getCenterWeight(b);
                return (bValue + bCenter) - (aValue + aCenter);
            });

            // Limit number of moves to consider at deeper levels
            if (depth > 2) {
                allowedMoves = allowedMoves.slice(0, 10);
            }

            for (const move of allowedMoves) {
                const currentState = JSON.parse(JSON.stringify(simulationGame.pieces));
                simulationGame.movePiece(piece.name, move);

                let result;
                if (depth === difficultySettings.depth - 1) {
                    result = { 
                        score: score(simulationGame.pieces, turn), 
                        depth: depth + 1,
                        move: { pieceName: piece.name, position: move }
                    };
                } else {
                    result = minimax(
                        simulationGame.pieces, 
                        turn === aiTurn ? humanTurn : aiTurn, 
                        depth + 1, 
                        alpha, 
                        beta,
                        startTime
                    );
                    result.move = { pieceName: piece.name, position: move };
                }

                // Restore game state
                simulationGame.startNewGame(currentState, turn);

                // Update best play
                if (turn === aiTurn) {
                    if (result.score > bestPlay.score || 
                       (result.score === bestPlay.score && result.depth > bestPlay.depth)) {
                        bestPlay = result;
                        alpha = Math.max(alpha, result.score);
                    }
                } else {
                    if (result.score < bestPlay.score || 
                       (result.score === bestPlay.score && result.depth > bestPlay.depth)) {
                        bestPlay = result;
                        beta = Math.min(beta, result.score);
                    }
                }

                // Alpha-beta pruning
                if (beta <= alpha) {
                    break;
                }
            }
        }

        return bestPlay;
    };

    // AI play function with iterative deepening
    const play = (pieces, callback) => {
        const startTime = Date.now();
        setTimeout(() => {
            let bestMove = null;
            let currentDepth = 1;
            // Iterative deepening within time limit
            while (Date.now() - startTime < difficultySettings.timeLimit &&
                   currentDepth <= difficultySettings.depth + 2) {
                const result = minimax(pieces, aiTurn, 0, -Infinity, Infinity, startTime);
                if (result.move) {
                    bestMove = result;
                }
                currentDepth++;
            }
            if (bestMove) {
                callback(bestMove);
                // Log AI thinking information
                console.group(`AI Move (${aiTurn})`);
                console.log(`Piece: ${bestMove.move.pieceName}`);
                console.log(`To: ${bestMove.move.position}`);
                console.log(`Score: ${bestMove.score.toFixed(2)}`);
                console.log(`Depth: ${bestMove.depth}`);
                console.log(`Time: ${Date.now() - startTime}ms`);
                console.groupEnd();
            }
        }, 50); // Small delay to allow UI updates
    };

    return {
        play,
        setDifficulty: (settings) => {
            Object.assign(difficultySettings, settings);
            console.log(`AI difficulty updated:`, difficultySettings);
        },
        getDifficulty: () => ({ ...difficultySettings })
    };
};