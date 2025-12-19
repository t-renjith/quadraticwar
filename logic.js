// --- LOGIC & HELPERS ---

function getTermAtPos(player, termType, col) {
    const terms = COIN_TERMS[termType];
    if (player === 1) return terms[terms.length - 1 - col];
    else return terms[col];
}

function isValidMove(startR, startC, endR, endC, player) {
    if (startR === endR && startC === endC) return false;
    const startKey = `${startR},${startC}`;
    const endKey = `${endR},${endC}`;
    if (!board[startKey]) return false;
    if (board[endKey]) return false;

    const term = board[startKey].term;
    const isQuad = term.includes("x^2");
    const isLin = term.includes("x") && !isQuad;
    const isConst = !isQuad && !isLin;

    const maxRange = isQuad ? 3 : (isLin ? 2 : 1);
    const rowDiff = endR - startR;
    const colDiff = endC - startC;
    const absRow = Math.abs(rowDiff);
    const absCol = Math.abs(colDiff);
    const maxStep = Math.max(absRow, absCol);

    if (maxStep > maxRange) return false;

    if (isConst) {
        if (absCol !== 0) return false;
        if (player === 1 && rowDiff !== 1) return false;
        if (player === 2 && rowDiff !== -1) return false;
    } else if (isLin) {
        if (absRow > 0 && absCol > 0) return false;
    } else if (isQuad) {
        const isCardinal = (absRow === 0 || absCol === 0);
        const isDiagonal = (absRow === absCol);
        if (!isCardinal && !isDiagonal) return false;
    }

    const stepR = rowDiff === 0 ? 0 : (rowDiff > 0 ? 1 : -1);
    const stepC = colDiff === 0 ? 0 : (colDiff > 0 ? 1 : -1);
    let curR = startR + stepR;
    let curC = startC + stepC;
    while (curR !== endR || curC !== endC) {
        if (board[`${curR},${curC}`]) return false;
        curR += stepR;
        curC += stepC;
    }
    return true;
}

function getValidMoves(r, c, player) {
    let moves = [];
    for (let i = 0; i < BOARD_ROWS; i++) {
        for (let j = 0; j < BOARD_COLS; j++) {
            if (isValidMove(r, c, i, j, player)) {
                moves.push({ r: i, c: j });
            }
        }
    }
    return moves;
}

// --- EQUATION DETECTION ---
function getContiguousChain(startR, startC, deltaR, deltaC) {
    let chain = [];
    let currR = startR + deltaR;
    let currC = startC + deltaC;
    while (currR >= 0 && currR < BOARD_ROWS && currC >= 0 && currC < BOARD_COLS) {
        if (board[`${currR},${currC}`]) {
            chain.push({ r: currR, c: currC });
            currR += deltaR;
            currC += deltaC;
        } else { break; }
    }
    return chain;
}

function checkForEquations(r, c, activePlayer) {
    const detected = [];
    const opponent = activePlayer === 1 ? 2 : 1;
    const axes = [
        { neg: [0, -1], pos: [0, 1] }, { neg: [-1, 0], pos: [1, 0] },
        { neg: [-1, -1], pos: [1, 1] }, { neg: [-1, 1], pos: [1, -1] }
    ];

    axes.forEach(axis => {
        const negChain = getContiguousChain(r, c, axis.neg[0], axis.neg[1]);
        const posChain = getContiguousChain(r, c, axis.pos[0], axis.pos[1]);
        const fullChain = [...negChain.reverse(), { r, c }, ...posChain];

        if (fullChain.length < 2) return;
        const players = new Set();
        const terms = [];
        fullChain.forEach(pos => {
            const piece = board[`${pos.r},${pos.c}`];
            players.add(piece.p);
            terms.push(piece.term);
        });

        if (players.size < 2) return;

        let a = 0, b = 0, constant = 0;
        terms.forEach(t => {
            const p = parseTerm(t);
            if (p.degree === 2) a += p.coeff;
            else if (p.degree === 1) b += p.coeff;
            else constant += p.coeff;
        });

        if (a === 0) return;
        const discriminant = (b * b) - (4 * a * constant);
        const hasRealSolutions = discriminant >= 0;
        const targetColor = hasRealSolutions ? opponent : activePlayer;
        const removeList = [];
        fullChain.forEach(pos => {
            if (board[`${pos.r},${pos.c}`].p === targetColor) removeList.push(pos);
        });

        detected.push({
            coords: fullChain,
            remove: removeList,
            isSuccess: hasRealSolutions,
            polyStr: `${a}x^2 + ${b}x + ${constant}`,
            phase: 'IDENTIFY',
            startTime: performance.now()
        });
    });
    return detected;
}

function checkGameEnd(board) {
    let redPieces = 0;
    let bluePieces = 0;
    let hasQuad = false;
    let hasLinear = false;
    let redQuad = 0, redLin = 0, redConst = 0;
    let blueQuad = 0, blueLin = 0, blueConst = 0;

    let redConstSign = 0; // 0: none, 1: pos, -1: neg, 2: mixed
    let blueConstSign = 0;
    let redQuadSign = 0;
    let blueQuadSign = 0;

    for (let key in board) {
        const p = board[key];
        const parsed = parseTerm(p.term);

        if (p.p === 1) {
            redPieces++;
            if (parsed.degree === 2) {
                hasQuad = true; redQuad++;
                if (redQuadSign === 0) redQuadSign = Math.sign(parsed.coeff);
                else if (redQuadSign !== Math.sign(parsed.coeff)) redQuadSign = 2;
            }
            else if (parsed.degree === 1) { hasLinear = true; redLin++; }
            else {
                redConst++;
                if (redConstSign === 0) redConstSign = Math.sign(parsed.coeff);
                else if (redConstSign !== Math.sign(parsed.coeff)) redConstSign = 2;
            }
        } else {
            bluePieces++;
            if (parsed.degree === 2) {
                hasQuad = true; blueQuad++;
                if (blueQuadSign === 0) blueQuadSign = Math.sign(parsed.coeff);
                else if (blueQuadSign !== Math.sign(parsed.coeff)) blueQuadSign = 2;
            }
            else if (parsed.degree === 1) { hasLinear = true; blueLin++; }
            else {
                blueConst++;
                if (blueConstSign === 0) blueConstSign = Math.sign(parsed.coeff);
                else if (blueConstSign !== Math.sign(parsed.coeff)) blueConstSign = 2;
            }
        }
    }

    // 1. WIN CONDITIONS
    if (redPieces === 0) return { status: "WIN_BLUE", reason: "All Red pieces eliminated!" };
    if (bluePieces === 0) return { status: "WIN_RED", reason: "All Blue pieces eliminated!" };

    // 2. DRAW CONDITIONS
    // A. No Quadratics left on board (Impossible to make x^2 equation)
    if (!hasQuad) return { status: "DRAW", reason: "No Quadratic terms left. Impossible to form equations." };

    // B. Impossible Solution (Only x^2 and Constants with same sign)
    // If NO linear terms exist on the board...
    if (!hasLinear) {
        // Check Red: Has Quads AND Constants, AND signs match (e.g. 2x^2 + 4 = 0 -> x^2 = -2 -> Complex)
        // Or if one side has ONLY constants and the other ONLY quads?
        // Simpler rule: If global state precludes solutions.

        // Let's check generally:
        // If (All Quads Positive AND All Constants Positive) OR (All Quads Negative AND All Constants Negative)
        // Then no real solution is possible for ax^2 + c = 0

        let allQuadSign = 0;
        let allConstSign = 0;

        // Re-scan for global signs if we only have Quads + Constants in play
        // (We already know !hasLinear)

        let allQuadsPos = true;
        let allQuadsNeg = true;
        let allConstPos = true;
        let allConstNeg = true;

        for (let key in board) {
            const p = board[key];
            const parsed = parseTerm(p.term);
            const sign = Math.sign(parsed.coeff);

            if (parsed.degree === 2) {
                if (sign < 0) allQuadsPos = false;
                if (sign > 0) allQuadsNeg = false;
            } else if (parsed.degree === 0) {
                if (sign < 0) allConstPos = false;
                if (sign > 0) allConstNeg = false;
            }
        }

        if ((allQuadsPos && allConstPos) || (allQuadsNeg && allConstNeg)) {
            return { status: "DRAW", reason: "Analysis: Only same-sign terms left. Real solutions impossible." };
        }
    }

    return { status: "PLAYING", reason: "" };
}

// --- AI LOGIC ---
function makeBestMove() {
    let allMoves = [];
    for (let key in board) {
        if (board[key].p === 1) { // Computer is Red (1)
            const [r, c] = key.split(',').map(Number);
            const moves = getValidMoves(r, c, 1);
            moves.forEach(m => {
                allMoves.push({ start: { r, c }, end: { r: m.r, c: m.c } });
            });
        }
    }

    if (allMoves.length === 0) {
        currentPlayer = 2; resetStatusText(); return;
    }

    let bestScore = -Infinity;
    let candidates = [];

    allMoves.forEach(move => {
        let score = 0;
        const startKey = `${move.start.r},${move.start.c}`;
        const endKey = `${move.end.r},${move.end.c}`;
        const movingPiece = board[startKey];
        delete board[startKey];
        board[endKey] = movingPiece;

        const equations = checkForEquations(move.end.r, move.end.c, 1);

        delete board[endKey];
        board[startKey] = movingPiece;

        if (equations.length > 0) {
            equations.forEach(eq => {
                if (eq.isSuccess) score += 100 + (eq.remove.length * 10);
                else score -= 1000;
            });
        } else {
            // Heuristic: Advance forward, prefer center
            score += (move.end.r - move.start.r) * 2;
            if (move.end.c > 2 && move.end.c < 5) score += 1;
            score += Math.random();
        }

        if (score > bestScore) {
            bestScore = score; candidates = [move];
        } else if (score === bestScore) {
            candidates.push(move);
        }
    });

    const selectedMove = candidates[Math.floor(Math.random() * candidates.length)];
    const startKey = `${selectedMove.start.r},${selectedMove.start.c}`;
    const endKey = `${selectedMove.end.r},${selectedMove.end.c}`;

    board[endKey] = board[startKey];
    delete board[startKey];

    const equations = checkForEquations(selectedMove.end.r, selectedMove.end.c, 1);
    if (equations.length > 0) {
        animationQueue.push(...equations);
    } else {
        currentPlayer = 2; resetStatusText();
    }
}
