/**
 * Enhanced History Class for Chess Game
 * Tracks complete move history including:
 * - Raw move data
 * - Algebraic notation
 * - Timestamps
 * - Move durations
 */
class History {
    constructor() {
        // Current step being built (may contain multiple sub-moves like castling)
        this._currentStep = [];
        
        // Complete history of all moves
        this._history = [];
        
        // Algebraic notation for each move
        this._moveNotations = [];
        
        // Timestamps for each move
        this._timestamps = [];
        
        // Additional metadata about each move
        this._moveMetadata = [];
    }

    /**
     * Add a move to the current step
     * @param {Object} step - The move data to add
     * @param {string} [step.notation] - Algebraic notation of the move
     * @param {Object} step.piece - The piece being moved
     * @param {number} step.from - Starting position
     * @param {number} step.to - Ending position
     */
    add(step) {
        this._currentStep.push(step);
        
        if (step.notation) {
            this._moveNotations.push({
                turn: step.piece.color,
                notation: step.notation,
                piece: step.piece.name,
                from: step.from,
                to: step.to,
                isCapture: step.isCapture,
                isCastling: step.isCastling,
                isPromotion: step.isPromotion
            });
        }
    }

    /**
     * Save the current step to history
     */
    save() {
        if (this._currentStep.length > 0) {
            const now = Date.now();
            const moveData = {
                steps: [...this._currentStep],
                timestamp: now
            };
            
            this._history.push(moveData);
            this._timestamps.push(now);
            
            // Calculate duration since last move
            let duration = 0;
            if (this._timestamps.length > 1) {
                duration = now - this._timestamps[this._timestamps.length - 2];
            }
            
            this._moveMetadata.push({
                moveNumber: this._history.length,
                duration
            });
            
            this._currentStep = [];
        }
    }

    /**
     * Undo the last move
     * @returns {Array|null} Array of steps for the last move or null if no history
     */
    pop() {
        if (this._history.length === 0) return null;
        
        const lastMove = this._history.pop();
        this._moveNotations.pop();
        this._timestamps.pop();
        this._moveMetadata.pop();
        
        return lastMove.steps;
    }

    /**
     * Get the last move made
     * @returns {Array|null} Steps of the last move or null if no history
     */
    lastMove() {
        return this._history.length > 0 
            ? this._history[this._history.length - 1].steps 
            : null;
    }

    /**
     * Get complete move history with algebraic notation
     * @returns {Array} Array of move notations
     */
    getMoveHistory() {
        return [...this._moveNotations];
    }

    /**
     * Get full detailed history
     * @returns {Array} Array of move objects with all metadata
     */
    getFullHistory() {
        return this._history.map((entry, index) => ({
            moveNumber: index + 1,
            steps: entry.steps,
            timestamp: entry.timestamp,
            notation: this._moveNotations[index] || null,
            metadata: this._moveMetadata[index] || null
        }));
    }

    /**
     * Get duration of a specific move
     * @param {number} moveIndex - Index of the move
     * @returns {number} Duration in milliseconds
     */
    getMoveDuration(moveIndex) {
        if (moveIndex < 0 || moveIndex >= this._timestamps.length) return 0;
        if (moveIndex === 0) return this._timestamps[0];
        return this._timestamps[moveIndex] - this._timestamps[moveIndex - 1];
    }

    /**
     * Get average move time
     * @returns {number} Average duration in milliseconds
     */
    getAverageMoveTime() {
        if (this._timestamps.length < 2) return 0;
        
        const totalTime = this._timestamps[this._timestamps.length - 1] - this._timestamps[0];
        return totalTime / (this._timestamps.length - 1);
    }

    /**
     * Clear all history
     */
    clear() {
        this._currentStep = [];
        this._history = [];
        this._moveNotations = [];
        this._timestamps = [];
        this._moveMetadata = [];
    }

    /**
     * Get total number of moves
     * @returns {number} Count of moves
     */
    getMoveCount() {
        return this._history.length;
    }

    /**
     * Get the last timestamp
     * @returns {number|null} Last timestamp or null if no moves
     */
    getLastTimestamp() {
        return this._timestamps.length > 0 
            ? this._timestamps[this._timestamps.length - 1] 
            : null;
    }

    /**
     * Get game duration so far
     * @returns {number} Duration in milliseconds
     */
    getGameDuration() {
        if (this._timestamps.length === 0) return 0;
        return Date.now() - this._timestamps[0];
    }

    /**
     * Export complete history as JSON
     * @returns {string} JSON string of history data
     */
    exportToJSON() {
        return JSON.stringify({
            moves: this.getFullHistory(),
            metadata: {
                totalMoves: this.getMoveCount(),
                gameDuration: this.getGameDuration(),
                averageMoveTime: this.getAverageMoveTime()
            }
        });
    }
}