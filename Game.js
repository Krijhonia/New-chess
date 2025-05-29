class Game {
    constructor(pieces, turn = 'white') {
        this.startNewGame(pieces, turn);
    }

    startNewGame(pieces, turn) {
        this._setPieces(pieces);
        this.turn = turn;
        this.clickedPiece = null;
        this.gameState = 'ongoing';
        this.moveHistory = [];
        this.lastMove = null;
        this.gameStartTime = Date.now();
        this.isInCheck = false;
        this.winner = null;

        this._events = {
            pieceMove: [],
            kill: [],
            check: [],
            promotion: [],
            checkMate: [],
            turnChange: [],
            gameReset: [],
            castling: []
        };

        this.history = new History();
    }

    _setPieces(pieces) {
        // Deep copy pieces to avoid reference issues
        this.pieces = pieces.map(piece => ({ 
            rank: piece.rank, 
            position: piece.position, 
            color: piece.color, 
            name: piece.name, 
            ableToCastle: piece.ableToCastle,
            initialPosition: piece.initialPosition 
        }));

        // Create lookup maps for faster access
        this.playerPieces = {
            white: this.pieces.filter(piece => piece.color === 'white'),
            black: this.pieces.filter(piece => piece.color === 'black')
        };

        this.piecesByPosition = new Map();
        this.piecesByName = new Map();
        this.pieces.forEach(piece => {
            this.piecesByPosition.set(piece.position, piece);
            this.piecesByName.set(piece.name, piece);
        });
    }

    _removePiece(piece) {
        const index = this.pieces.indexOf(piece);
        if (index !== -1) {
            this.pieces.splice(index, 1);
            this.playerPieces[piece.color] = this.playerPieces[piece.color].filter(p => p !== piece);
            this.piecesByPosition.delete(piece.position);
            this.piecesByName.delete(piece.name);
        }
    }

    _addPiece(piece) {
        this.pieces.push(piece);
        this.playerPieces[piece.color].push(piece);
        this.piecesByPosition.set(piece.position, piece);
        this.piecesByName.set(piece.name, piece);
    }

    saveHistory() {
        this.history.save();
    }

    addToHistory(move) {
        this.history.add(move);
        this.moveHistory.push({
            ...move,
            timestamp: Date.now() - this.gameStartTime,
            turn: this.turn,
            notation: this._getMoveNotation(move)
        });
    }

    _getMoveNotation(move) {
        const piece = move.piece;
        const from = move.from;
        const to = move.to;
        const isCapture = this.piecesByPosition.has(to);
        
        let notation = '';
        
        // Handle castling
        if (move.castling) {
            return to - from > 0 ? 'O-O' : 'O-O-O';
        }
        
        // Add piece letter for non-pawns
        if (piece.rank !== 'pawn') {
            notation += piece.rank === 'knight' ? 'N' : piece.rank[0].toUpperCase();
        }
        
        // Add capture notation
        if (isCapture) {
            if (piece.rank === 'pawn') {
                notation += String.fromCharCode(96 + (from % 10));
            }
            notation += 'x';
        }
        
        // Add destination square
        notation += String.fromCharCode(96 + (to % 10)) + Math.floor(to / 10);
        
        // Add check/checkmate symbol
        if (this.isInCheck) {
            notation += this.winner ? '#' : '+';
        }
        
        return notation;
    }

    clearEvents() {
        this._events = {};
    }

    undo() {
        const step = this.history.pop();
        if (!step) return false;

        for (const subStep of step) {
            const piece = subStep.piece;
            
            if (subStep.from !== 0) {
                // Moving piece back
                if (subStep.to === 0) {
                    this._addPiece(piece);
                } else {
                    if (subStep.castling) {
                        piece.ableToCastle = true;
                    }
                    this._updatePiecePosition(piece, subStep.from);
                }
                this.triggerEvent('pieceMove', subStep);
            } else {
                // Removing piece that was added
                this._removePiece(piece);
                this.triggerEvent('kill', piece);
            }

            if (subStep.from !== 0 && subStep.to !== 0 && (!subStep.castling || piece.rank === 'king')) {
                this.softChangeTurn();
            }
        }

        // Update game state after undo
        this.isInCheck = this.king_checked(this.turn);
        return true;
    }

    on(eventName, callback) {
        if (this._events[eventName] && typeof callback === 'function') {
            this._events[eventName].push(callback);
        }
    }

    triggerEvent(eventName, params) {
        if (this._events[eventName]) {
            this._events[eventName].forEach(callback => callback(params));
        }
    }

    softChangeTurn() {
        this.turn = this.turn === 'white' ? 'black' : 'white';
        this.triggerEvent('turnChange', this.turn);
    }

    changeTurn() {
        this.softChangeTurn();
        this.saveHistory();
    }

    getPiecesByColor(color) {
        return this.playerPieces[color];
    }

    getPlayerPositions(color) {
        return this.playerPieces[color].map(piece => piece.position);
    }

    filterPositions(positions) {
        return positions.filter(pos => {
            const x = pos % 10;
            return pos > 10 && pos < 89 && x !== 9 && x !== 0;
        });
    }

    unblockedPositions(piece, allowedPositions, checking = true) {
        const unblockedPositions = [];
        const myColor = piece.color;
        const otherColor = myColor === 'white' ? 'black' : 'white';
        const myPositions = new Set(this.getPlayerPositions(myColor));
        const otherPositions = new Set(this.getPlayerPositions(otherColor));

        if (piece.rank === 'pawn') {
            // Attack moves
            for (const move of allowedPositions[0]) {
                if (checking && this.myKingChecked(move)) continue;
                if (otherPositions.has(move)) unblockedPositions.push(move);
            }

            // Forward moves
            for (const move of allowedPositions[1]) {
                if (myPositions.has(move) || otherPositions.has(move)) continue;
                if (checking && this.myKingChecked(move, false)) continue;
                
                // For two-step moves, check if the intermediate square is blocked
                if (Math.abs(move - piece.position) === 20) {
                    const intermediateSquare = (move + piece.position) / 2;
                    if (myPositions.has(intermediateSquare) || otherPositions.has(intermediateSquare)) continue;
                }
                
                unblockedPositions.push(move);
            }
        } else {
            // Other pieces
            for (const moveGroup of allowedPositions) {
                for (const move of moveGroup) {
                    if (myPositions.has(move)) break;
                    if (checking && this.myKingChecked(move)) {
                        if (otherPositions.has(move)) break;
                        continue;
                    }
                    unblockedPositions.push(move);
                    if (otherPositions.has(move)) break;
                }
            }
        }

        return this.filterPositions(unblockedPositions);
    }

    getPieceAllowedMoves(pieceName) {
        const piece = this.getPieceByName(pieceName);
        if (!piece || this.turn !== piece.color) return [];

        this.setClickedPiece(piece);
        let pieceAllowedMoves = getAllowedMoves(piece);
        
        if (piece.rank === 'king' && piece.ableToCastle) {
            pieceAllowedMoves = this.getCastlingSquares(piece, pieceAllowedMoves);
        }
        
        return this.unblockedPositions(piece, pieceAllowedMoves, true);
    }

    getCastlingSquares(king, allowedMoves) {
        if (!king.ableToCastle || this.isInCheck) return allowedMoves;

        const rook1 = this.getPieceByName(king.color + 'Rook1');
        const rook2 = this.getPieceByName(king.color + 'Rook2');
        
        // Queenside castling
        if (rook1?.ableToCastle) {
            const castlingPosition = rook1.position + 2;
            if (this._canCastle(king, castlingPosition, -1)) {
                allowedMoves[1].push(castlingPosition);
            }
        }

        // Kingside castling
        if (rook2?.ableToCastle) {
            const castlingPosition = rook2.position - 1;
            if (this._canCastle(king, castlingPosition, 1)) {
                allowedMoves[0].push(castlingPosition);
            }
        }

        return allowedMoves;
    }

    _canCastle(king, castlingPosition, direction) {
        // Check if squares between king and rook are empty and safe
        const start = direction > 0 ? castlingPosition - 1 : king.position + 1;
        const end = direction > 0 ? king.position - 1 : castlingPosition;
        
        for (let pos = start; direction > 0 ? pos >= end : pos <= end; pos += direction) {
            if (this.piecesByPosition.has(pos) || this.myKingChecked(pos, true)) {
                return false;
            }
        }
        
        return true;
    }

    getPieceByName(piecename) {
        return this.piecesByName.get(piecename);
    }

    getPieceByPos(position) {
        return this.piecesByPosition.get(position);
    }

    setClickedPiece(piece) {
        this.clickedPiece = piece;
    }

    _updatePiecePosition(piece, newPosition) {
        this.piecesByPosition.delete(piece.position);
        piece.position = newPosition;
        this.piecesByPosition.set(newPosition, piece);
    }

    movePiece(pieceName, position) {
        const piece = this.getPieceByName(pieceName);
        if (!piece) return false;

        position = parseInt(position);
        const allowedMoves = this.getPieceAllowedMoves(pieceName);
        
        if (!allowedMoves.includes(position)) return false;

        const prevPosition = piece.position;
        const capturedPiece = this.getPieceByPos(position);
        const isCastling = !capturedPiece && piece.rank === 'king' && piece.ableToCastle;

        // Handle capture
        if (capturedPiece) {
            this.kill(capturedPiece);
        }

        // Handle castling
        if (isCastling) {
            const isKingside = position - prevPosition > 0;
            const rookName = piece.color + 'Rook' + (isKingside ? '2' : '1');
            this.castleRook(rookName);
            piece.ableToCastle = false;
        }

        // Move piece
        this._updatePiecePosition(piece, position);

        // Record move
        const move = { 
            from: prevPosition, 
            to: position, 
            piece: piece, 
            castling: isCastling
        };
        
        this.lastMove = move;
        this.addToHistory(move);
        this.triggerEvent('pieceMove', move);

        // Handle pawn promotion
        if (piece.rank === 'pawn' && (position > 80 || position < 20)) {
            this.promote(piece);
        }

        this.changeTurn();

        // Check for check/checkmate
        this.isInCheck = this.king_checked(this.turn);
        if (this.isInCheck) {
            this.triggerEvent('check', this.turn);
            if (this.king_dead(this.turn)) {
                this.checkmate(piece.color);
            }
        }

        return true;
    }

    kill(piece) {
        this._removePiece(piece);
        this.addToHistory({ from: piece.position, to: 0, piece: piece });
        this.triggerEvent('kill', piece);
    }

    castleRook(rookName) {
        const rook = this.getPieceByName(rookName);
        if (!rook) return;

        const prevPosition = rook.position;
        const newPosition = rookName.includes('Rook2') ? prevPosition - 2 : prevPosition + 3;

        this._updatePiecePosition(rook, newPosition);
        const move = { from: prevPosition, to: newPosition, piece: rook, castling: true };
        this.triggerEvent('pieceMove', move);
        this.addToHistory(move);
        this.triggerEvent('castling', { rook, from: prevPosition, to: newPosition });
    }

    promote(pawn) {
        const oldName = pawn.name;
        pawn.name = pawn.name.replace('Pawn', 'Queen');
        pawn.rank = 'queen';
        
        // Update piece maps
        this.piecesByName.delete(oldName);
        this.piecesByName.set(pawn.name, pawn);
        
        this.addToHistory({ from: 0, to: pawn.position, piece: pawn });
        this.triggerEvent('promotion', pawn);
    }

    myKingChecked(pos, kill = true) {
        const piece = this.clickedPiece;
        if (!piece) return false;

        const originalPosition = piece.position;
        const otherPiece = this.getPieceByPos(pos);
        const shouldKillOtherPiece = kill && otherPiece && otherPiece.rank !== 'king';
        
        // Temporarily move piece
        this._updatePiecePosition(piece, pos);
        if (shouldKillOtherPiece) {
            this._removePiece(otherPiece);
        }
        
        const isChecked = this.king_checked(piece.color);
        
        // Restore position
        this._updatePiecePosition(piece, originalPosition);
        if (shouldKillOtherPiece) {
            this._addPiece(otherPiece);
        }
        
        return isChecked;
    }

    king_dead(color) {
        const pieces = this.getPiecesByColor(color);
        const originalPiece = this.clickedPiece;
        
        for (const piece of pieces) {
            this.setClickedPiece(piece);
            const allowedMoves = this.unblockedPositions(piece, getAllowedMoves(piece), true);
            if (allowedMoves.length) {
                this.setClickedPiece(originalPiece);
                return false;
            }
        }
        
        this.setClickedPiece(originalPiece);
        return true;
    }

    king_checked(color) {
        const originalPiece = this.clickedPiece;
        const king = this.getPieceByName(color + 'King');
        if (!king) return true;

        const enemyColor = color === 'white' ? 'black' : 'white';
        const enemyPieces = this.getPiecesByColor(enemyColor);
        
        for (const enemyPiece of enemyPieces) {
            this.setClickedPiece(enemyPiece);
            const allowedMoves = this.unblockedPositions(enemyPiece, getAllowedMoves(enemyPiece), false);
            if (allowedMoves.includes(king.position)) {
                this.setClickedPiece(originalPiece);
                return true;
            }
        }
        
        this.setClickedPiece(originalPiece);
        return false;
    }

    checkmate(winnerColor) {
        this.gameState = 'checkmate';
        this.winner = winnerColor;
        this.triggerEvent('checkMate', {
            winner: winnerColor,
            moveHistory: this.moveHistory,
            duration: Date.now() - this.gameStartTime
        });
    }

    getGameStatus() {
        return {
            turn: this.turn,
            moveHistory: [...this.moveHistory],
            lastMove: this.lastMove,
            whitePieces: this.playerPieces.white.length,
            blackPieces: this.playerPieces.black.length,
            isInCheck: this.isInCheck,
            gameState: this.gameState,
            winner: this.winner,
            gameTime: Date.now() - this.gameStartTime
        };
    }

    fullReset() {
        this.startNewGame(this.pieces, 'white');
        this.triggerEvent('gameReset');
    }
}