class SimulationGame extends Game {
    constructor(pieces, turn = 'white') {
        super(pieces, turn);
    }

    startNewGame(pieces, turn) {
        this._setPieces(pieces);
        this.turn = turn;
        this.clickedPiece = null;
        this.isInCheck = false;
    }

    saveHistory() {}

    addToHistory(move) {}

    triggerEvent(eventName, params) {}

    clearEvents() {}

    undo() {}

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

    movePiece(pieceName, position) {
        const piece = this.getPieceByName(pieceName);
        if (!piece) return false;

        position = parseInt(position);
        const allowedMoves = this.getPieceAllowedMoves(pieceName);
        
        if (!allowedMoves.includes(position)) return false;

        const prevPosition = piece.position;
        const capturedPiece = this.getPieceByPos(position);
        const isCastling = !capturedPiece && piece.rank === 'king' && piece.ableToCastle;

        if (capturedPiece) {
            this.kill(capturedPiece);
        }

        if (isCastling) {
            if (position - prevPosition === 2) {
                this.castleRook(piece.color + 'Rook2');
            } else if (position - prevPosition === -2) {
                this.castleRook(piece.color + 'Rook1');
            }
            piece.ableToCastle = false;
        }

        this._updatePiecePosition(piece, position);

        if (piece.rank === 'pawn' && (position > 80 || position < 20)) {
            this.promote(piece);
        }

        this.changeTurn();

        this.isInCheck = this.king_checked(this.turn);

        return true;
    }

    unblockedPositions(piece, allowedPositions, checking = true) {
        const unblockedPositions = [];
        const myColor = piece.color;
        const otherColor = myColor === 'white' ? 'black' : 'white';
        const myPositions = new Set(this.getPlayerPositions(myColor));
        const otherPositions = new Set(this.getPlayerPositions(otherColor));

        if (piece.rank === 'pawn') {
            for (const move of allowedPositions[0]) {
                if (checking && this.myKingChecked(move)) continue;
                if (otherPositions.has(move)) unblockedPositions.push(move);
            }

            for (const move of allowedPositions[1]) {
                if (myPositions.has(move) || otherPositions.has(move)) continue;
                if (checking && this.myKingChecked(move, false)) continue;
                
                if (Math.abs(move - piece.position) === 20) {
                    const intermediateSquare = (move + piece.position) / 2;
                    if (myPositions.has(intermediateSquare) || otherPositions.has(intermediateSquare)) continue;
                }
                
                unblockedPositions.push(move);
            }
        } else {
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
        this.winner = winnerColor;
    }
}