// --- STATE ---
let gameState = "MENU"; // "MENU", "PLAYING", "HOSTING", "JOINING"
let previousState = "MENU";
let gameMode = null;    // "PVP", "PVC", "ONLINE"
let network = null;     // NetworkManager instance
let isHost = false;     // Am I the host?
let onlineId = "";      // My ID or Host ID
let myPlayerColor = 0;  // 1 (Red) or 2 (Blue)
let isOnlineTurn = false; // Is it my turn in online mode?
let joinCodeInput = "";   // Buffer for typing host code
let joinStatusMsg = "";   // Status message for join screen

let board = {};
let selectedCoin = null;
let currentPlayer = 2; // Blue Starts
let validMoves = [];
let animationQueue = [];
let currentAnimation = null;
let isAIThinking = false;
let mouse = { x: 0, y: 0 };
let currentStatus = { text: "", color: COLORS.WHITE };
let gameResult = { status: "", reason: "" }; // Store win/loss info

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- BUTTONS FOR MENU ---
const btnPVP = { x: 130, y: 180, w: 300, h: 50, text: "2 Players (Local)" };
const btnPVC = { x: 130, y: 250, w: 300, h: 50, text: "Vs Computer" };
const btnOnline = { x: 130, y: 320, w: 300, h: 50, text: "Online PvP" };
const btnInstr = { x: 130, y: 390, w: 300, h: 50, text: "Instructions" };
const btnBack = { x: 20, y: 20, w: 100, h: 40, text: "Back" };

// Online Menu Buttons
const btnHost = { x: 130, y: 250, w: 300, h: 60, text: "Host Game" };
const btnJoin = { x: 130, y: 340, w: 300, h: 60, text: "Join Game" };
// btnBack already defined above


// Game Buttons (Below Board)
const btnGameBack = { x: 20, y: 640, w: 140, h: 45, text: "Exit to Menu" };
const btnGameInstr = { x: 400, y: 640, w: 140, h: 45, text: "Instructions" };

// Game Over Button
const btnGameOverMenu = { x: 180, y: 400, w: 200, h: 50, text: "Main Menu" };

// --- INITIALIZATION ---
function initBoard() {
    board = {};
    for (let c = 0; c < BOARD_COLS; c++) {
        board[`0,${c}`] = { p: 1, term: getTermAtPos(1, 1, c) };
        board[`1,${c}`] = { p: 1, term: getTermAtPos(1, 2, c) };
        board[`2,${c}`] = { p: 1, term: getTermAtPos(1, 3, c) };
    }
    for (let c = 0; c < BOARD_COLS; c++) {
        board[`6,${c}`] = { p: 2, term: getTermAtPos(2, 3, c) };
        board[`7,${c}`] = { p: 2, term: getTermAtPos(2, 2, c) };
        board[`8,${c}`] = { p: 2, term: getTermAtPos(2, 1, c) };
    }
}

// --- ONLINE LOGIC ---
function initNetwork() {
    network = new NetworkManager();

    network.onData((data) => {
        if (data.type === 'MOVE') {
            applyOpponentMove(data.move);
        } else if (data.type === 'START') {
            // Joiner receives START from Host
            // PER USER REQUEST: Host is Blue (2), Joiner is Red (1)
            // Blue starts.
            // PER USER REQUEST: Host is Blue (2), Joiner is Red (1)
            // Blue starts.
            startGame("ONLINE");
            myPlayerColor = 1; // Joiner is Red
            isOnlineTurn = false; // Blue (Host) starts
            resetStatusText(); // Update UI with correct roles
        }
    });

    network.onClose(() => {
        alert("Opponent disconnected!");
        gameState = "MENU";
        gameMode = null;
        network = null;
    });
}

function startOnlineGameAsHost() {
    initNetwork();
    gameState = "HOSTING";
    currentStatus.text = "Generating ID...";
    network.initHost((id) => {
        onlineId = id;
        currentStatus.text = `Waiting for Opponent... Code: ${id.split('-')[1]}`;
    });

    // Callback when someone connects to us
    network.onConnectCallback = () => {
        console.log("Opponent Connected!");
        // Notify Joiner to start
        network.send({ type: 'START' });

        startGame("ONLINE");
        // Host is Blue (2), goes first
        myPlayerColor = 2;
        isOnlineTurn = true;
        resetStatusText();
    };
}

function joinOnlineGame(code) {
    if (!code || code.length < 4) return;

    initNetwork();
    const fullId = "QW-" + code.toUpperCase();
    joinStatusMsg = "Connecting...";

    network.initJoin(fullId, () => {
        // On Connect
        joinStatusMsg = "Connected! Waiting for Host...";
    }, (err) => {
        joinStatusMsg = "Error: " + err;
        // console.error(err);
    });
}

function applyOpponentMove(move) {
    const { start, end } = move; // {r,c}
    const startKey = `${start.r},${start.c}`;
    const endKey = `${end.r},${end.c}`;

    // Apply move locally without valid checks (trust opponent)
    // But we should double check validity if we wanted to be secure

    board[endKey] = board[startKey];
    delete board[startKey];

    const equations = checkForEquations(end.r, end.c, currentPlayer); // currentPlayer should be opponent
    if (equations.length > 0) {
        animationQueue.push(...equations);
    } else {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        isOnlineTurn = true; // My turn now
        resetStatusText();
    }
}

function startGame(mode) {
    gameMode = mode;
    gameState = "PLAYING";
    previousState = "MENU";
    currentPlayer = 2; // Blue Always Starts? NO.
    // In Original code: currentPlayer = 2 (Blue Starts).
    // Let's keep that rule: BLUE STARTS.

    // ADJUSTMENT: If Blue Starts
    // Host (Red) = Player 1
    // Joiner (Blue) = Player 2
    // So Joiner moves first!

    currentPlayer = 2;

    currentPlayer = 2;

    if (mode === "ONLINE") {
        // We will set isOnlineTurn explicitly in the caller (Host/Join functions)
        // to avoid race conditions or default value overwrites.
        // Default to false primarily, but the callers override immediately.
        isOnlineTurn = false;
    }

    selectedCoin = null;
    validMoves = [];
    animationQueue = [];
    currentAnimation = null;
    initBoard();
    resetStatusText();
}


function triggerComputerTurn() {
    if (isAIThinking || gameState !== "PLAYING") return;
    isAIThinking = true;
    currentStatus.text = "Computer is thinking...";
    currentStatus.color = COLORS.RED_COIN_LIGHT;

    setTimeout(() => {
        makeBestMove();
        isAIThinking = false;
    }, 800);
}

// --- DRAWING HELPERS ---
function drawSharpRect(x, y, w, h) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.closePath();
}

function isHovered(btn) {
    return mouse.x >= btn.x && mouse.x <= btn.x + btn.w &&
        mouse.y >= btn.y && mouse.y <= btn.y + btn.h;
}

// --- DRAWING ---
function drawInstructions() {
    ctx.fillStyle = COLORS.BG_DARK;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Back Button
    const backHover = isHovered(btnBack);
    ctx.fillStyle = backHover ? COLORS.MENU_BTN_HOVER : COLORS.MENU_BTN;
    drawSharpRect(btnBack.x, btnBack.y, btnBack.w, btnBack.h);
    ctx.fill();

    ctx.strokeStyle = backHover ? COLORS.MENU_ACCENT : COLORS.BOARD_LIGHT;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = COLORS.MENU_TEXT;
    ctx.font = "400 14px 'Lato', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(btnBack.text.toUpperCase(), btnBack.x + btnBack.w / 2, btnBack.y + btnBack.h / 2);

    // Title
    ctx.font = "700 32px 'Cinzel', serif";
    ctx.fillStyle = COLORS.MENU_ACCENT;
    ctx.fillText("INSTRUCTIONS", canvas.width / 2, 60);

    // Decorative Line under title
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 100, 75);
    ctx.lineTo(canvas.width / 2 + 100, 75);
    ctx.strokeStyle = COLORS.BOARD_LIGHT;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Content
    const lines = [
        "OBJECTIVE",
        "Form quadratic equations (ax² + bx + c = 0)",
        "using adjacent pieces. If the equation has REAL",
        "solutions (Δ ≥ 0), the opponent's pieces are removed.",
        "",
        "MOVEMENT",
        "Pieces move based on their algebraic term.",
        "x² (Quadratic): Up to 3 steps in any direction.",
        "x (Linear): Up to 2 steps (Horizontal/Vertical).",
        "Constant: 1 step Forward.",
        "",
        "WINNING",
        "Eliminate all opponent pieces, otherwise it is a draw."
    ];

    let y = 120;
    lines.forEach(line => {
        if (line === "OBJECTIVE" || line === "MOVEMENT" || line === "WINNING") {
            ctx.fillStyle = COLORS.MENU_ACCENT;
            ctx.font = "700 16px 'Cinzel', serif";
            y += 10;
        } else {
            ctx.fillStyle = "#475569"; // Slate 600 (Darker Grey for subtitle)
            ctx.font = "300 15px 'Lato', sans-serif";
        }
        ctx.textAlign = "center";
        ctx.fillText(line, canvas.width / 2, y);
        y += 28;
    });
}

function drawGameOver() {
    // Semi-transparent overlay
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)"; // Slate 900 fade
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Title
    ctx.font = "700 48px 'Cinzel', serif";

    let title = "";
    let color = COLORS.WHITE;

    if (gameResult.status === "WIN_RED") {
        title = "RED WINS!";
        color = COLORS.RED_COIN_LIGHT;
    } else if (gameResult.status === "WIN_BLUE") {
        title = "BLUE WINS!";
        color = COLORS.BLUE_COIN_LIGHT;
    } else {
        title = "DRAW";
        color = COLORS.HIGHLIGHT_SELECT; // Amber
    }

    ctx.fillStyle = color;
    ctx.fillText(title, canvas.width / 2, 250);

    // Reason
    ctx.font = "400 18px 'Lato', sans-serif";
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillText(gameResult.reason, canvas.width / 2, 310);

    // Menu Button
    const hovered = isHovered(btnGameOverMenu);
    ctx.fillStyle = hovered ? COLORS.MENU_BTN_HOVER : COLORS.MENU_BTN;
    drawSharpRect(btnGameOverMenu.x, btnGameOverMenu.y, btnGameOverMenu.w, btnGameOverMenu.h);
    ctx.fill();

    ctx.strokeStyle = hovered ? COLORS.MENU_ACCENT : COLORS.BOARD_LIGHT;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = hovered ? COLORS.WHITE : COLORS.MENU_TEXT;
    ctx.font = "400 16px 'Lato', sans-serif"; // Using Lato for button text
    ctx.fillText(btnGameOverMenu.text.toUpperCase(), btnGameOverMenu.x + btnGameOverMenu.w / 2, btnGameOverMenu.y + btnGameOverMenu.h / 2);
}



function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawMenu() {
    // 1. Background Gradient (Board Matches)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, "#E2E8F0"); // Slate 200 (Board Light)
    bgGrad.addColorStop(1, "#CBD5E1"); // Slate 300 (Board Dark)
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Title Decoration
    ctx.shadowColor = "rgba(79, 70, 229, 0.4)"; // Indigo Glow
    ctx.shadowBlur = 15;

    ctx.font = "700 52px 'Cinzel', serif";
    ctx.fillStyle = COLORS.MENU_ACCENT;
    ctx.textAlign = "center";
    ctx.fillText("QUADRATIC WAR", canvas.width / 2, 100);

    // 3. Determine Buttons based on State
    let buttons = [];
    let title = "";

    if (gameState === "MENU") {
        buttons = [btnPVP, btnPVC, btnOnline, btnInstr];
    } else if (gameState === "ONLINE_MENU") {
        title = "ONLINE MODE";
        buttons = [btnHost, btnJoin, btnBack];
    }

    if (title) {
        ctx.fillStyle = COLORS.MENU_ACCENT;
        ctx.font = "700 24px 'Cinzel', serif";
        ctx.fillText(title, canvas.width / 2, 215);
    }

    // 4. Draw Buttons
    buttons.forEach(btn => {
        const hovered = isHovered(btn);

        // Button Shadow
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;

        if (hovered) {
            ctx.fillStyle = COLORS.MENU_BTN_HOVER;
            ctx.shadowColor = "rgba(79, 70, 229, 0.3)"; // Indigo Glow
            ctx.shadowBlur = 15;
        } else {
            ctx.fillStyle = COLORS.MENU_BTN;
        }

        drawRoundedRect(btn.x, btn.y, btn.w, btn.h, 10);
        ctx.fill();

        // Reset Shadow for Border
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = hovered ? COLORS.MENU_ACCENT : "#334155";
        ctx.lineWidth = hovered ? 2 : 1;
        ctx.stroke();

        ctx.fillStyle = hovered ? COLORS.WHITE : COLORS.MENU_TEXT;
        ctx.font = "700 16px 'Cinzel', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(btn.text.toUpperCase(), btn.x + btn.w / 2, btn.y + btn.h / 2);
    });

    if (gameState === "HOSTING") {
        ctx.fillStyle = COLORS.MENU_TEXT; // Dark Text
        ctx.font = "400 22px 'Lato', sans-serif";
        ctx.fillText(currentStatus.text, canvas.width / 2, 480);

        // Waiting animation (dots)
        const dots = ".".repeat(Math.floor(Date.now() / 500) % 4);
        ctx.fillText(dots, canvas.width / 2, 510);

        // Show Back button to cancel hosting
        const hovered = isHovered(btnBack);

        // Shadow
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;

        if (hovered) ctx.fillStyle = COLORS.MENU_BTN_HOVER;
        else ctx.fillStyle = COLORS.MENU_BTN;

        drawRoundedRect(btnBack.x, btnBack.y, btnBack.w, btnBack.h, 10);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = hovered ? COLORS.MENU_ACCENT : "#334155";
        ctx.lineWidth = hovered ? 2 : 1;
        ctx.stroke();

        ctx.fillStyle = hovered ? COLORS.WHITE : COLORS.MENU_TEXT;
        ctx.font = "700 16px 'Cinzel', serif"; // Consistent font
        ctx.fillText("BACK", btnBack.x + btnBack.w / 2, btnBack.y + btnBack.h / 2);
    }

    if (gameState === "JOINING") {
        // Overlay for Input
        ctx.fillStyle = "rgba(241, 245, 249, 0.9)"; // Slate 100 with high opacity
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = COLORS.MENU_ACCENT;
        ctx.font = "700 36px 'Cinzel', serif";
        ctx.fillText("ENTER CODE", canvas.width / 2, 180);

        // Input Box
        const w = 240;
        const h = 60;
        const x = (canvas.width - w) / 2;
        const y = 240;

        // Input bg
        ctx.fillStyle = "#FFFFFF";
        drawRoundedRect(x, y, w, h, 8);
        ctx.fill();
        ctx.strokeStyle = COLORS.MENU_ACCENT;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Typed Text
        ctx.fillStyle = "#1e293b"; // Slate 800
        ctx.font = "700 32px 'Lato', sans-serif"; // Bigger font
        ctx.letterSpacing = "4px";
        const displayCode = joinCodeInput || "";
        ctx.fillText(displayCode + (Date.now() % 1000 < 500 ? "|" : ""), canvas.width / 2, y + h / 2 + 2);

        // Helper text
        ctx.fillStyle = "#94a3b8";
        ctx.font = "italic 16px 'Lato', sans-serif";
        ctx.letterSpacing = "0px";
        ctx.fillText("Type the 4-character host code", canvas.width / 2, y + 90);

        if (joinStatusMsg) {
            ctx.fillStyle = joinStatusMsg.startsWith("Error") ? COLORS.ANIM_FAIL : COLORS.ANIM_IDENTIFY;
            ctx.font = "600 16px 'Lato', sans-serif";
            ctx.fillText(joinStatusMsg, canvas.width / 2, y + 130);
        }

        // Buttons: Connect, Back (Styled same as above)
        const btnConnect = { x: 130, y: 400, w: 300, h: 50, text: "CONNECT" };
        const btnCancel = { x: 130, y: 470, w: 300, h: 50, text: "CANCEL" };

        [btnConnect, btnCancel].forEach(btn => {
            const hovered = isHovered(btn);
            // Button Shadow
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;

            if (hovered) ctx.fillStyle = COLORS.MENU_BTN_HOVER;
            else ctx.fillStyle = COLORS.MENU_BTN;

            drawRoundedRect(btn.x, btn.y, btn.w, btn.h, 10);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            ctx.strokeStyle = hovered ? COLORS.MENU_ACCENT : "#334155";
            ctx.stroke();

            ctx.fillStyle = hovered ? COLORS.WHITE : COLORS.MENU_TEXT;
            ctx.font = "700 16px 'Cinzel', serif";
            ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
        });

        return; // Skip normal button drawing for Joining overlay
    }
}


function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Tiles
    for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE;
            ctx.fillStyle = (r + c) % 2 === 0 ? COLORS.BOARD_LIGHT : COLORS.BOARD_DARK;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

            // Show valid moves if it's human's turn
            const isHumanTurn = (gameMode === 'PVP') ||
                (gameMode === 'PVC' && currentPlayer === 2) ||
                (gameMode === 'ONLINE' && isOnlineTurn);

            if (!currentAnimation && isHumanTurn) {
                const isValid = validMoves.some(m => m.r === r && m.c === c);
                if (isValid) {
                    ctx.strokeStyle = COLORS.HIGHLIGHT_VALID;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                }
            }
        }
    }

    // 2. Animations
    if (currentAnimation) {
        const anim = currentAnimation;
        let color = (anim.phase === 'IDENTIFY') ? COLORS.ANIM_IDENTIFY : (anim.isSuccess ? COLORS.ANIM_SUCCESS : COLORS.ANIM_FAIL);
        ctx.globalAlpha = 0.5; ctx.fillStyle = color;
        anim.coords.forEach(pos => ctx.fillRect(pos.c * TILE_SIZE, pos.r * TILE_SIZE, TILE_SIZE, TILE_SIZE));
        ctx.globalAlpha = 1.0; ctx.strokeStyle = color; ctx.lineWidth = 4;
        anim.coords.forEach(pos => ctx.strokeRect(pos.c * TILE_SIZE + 2, pos.r * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4));
    }

    // 3. Coins
    for (let key in board) {
        const piece = board[key];
        const [r, c] = key.split(',').map(Number);
        const x = c * TILE_SIZE + TILE_SIZE / 2;
        const y = r * TILE_SIZE + TILE_SIZE / 2;
        const radius = TILE_SIZE / 2 - 6;

        if (selectedCoin && selectedCoin.r === r && selectedCoin.c === c) {
            ctx.beginPath();
            ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.HIGHLIGHT_SELECT;
            ctx.fill();
        }

        const gradient = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius);
        if (piece.p === 1) {
            gradient.addColorStop(0, COLORS.RED_COIN_LIGHT);
            gradient.addColorStop(1, COLORS.RED_COIN_BASE);
        } else {
            gradient.addColorStop(0, COLORS.BLUE_COIN_LIGHT);
            gradient.addColorStop(1, COLORS.BLUE_COIN_BASE);
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fill();
        ctx.shadowColor = 'transparent';

        ctx.fillStyle = "#FFFFFF"; // Keep coin text white as coins are distinct colors
        ctx.font = "700 20px 'Lato', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(toLatexStyle(piece.term), x, y);
    }

    // 4. In-Game Buttons
    [btnGameBack, btnGameInstr].forEach(btn => {
        const hovered = isHovered(btn);
        ctx.fillStyle = hovered ? COLORS.MENU_BTN_HOVER : COLORS.MENU_BTN;
        drawSharpRect(btn.x, btn.y, btn.w, btn.h);
        ctx.fill();

        ctx.strokeStyle = hovered ? COLORS.MENU_ACCENT : COLORS.BOARD_LIGHT;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = hovered ? COLORS.WHITE : COLORS.MENU_TEXT;
        ctx.font = "400 14px 'Lato', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(btn.text.toUpperCase(), btn.x + btn.w / 2, btn.y + btn.h / 2);
    });

    // 5. Status Text (Between Buttons)
    // 280 is center of 560
    ctx.fillStyle = currentStatus.color;
    // Adapt font size
    const fontSize = currentStatus.text.length > 30 ? 13 : 16;
    ctx.font = `600 ${fontSize}px 'Lato', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(currentStatus.text, 280, 663);
}

// --- MAIN LOOP ---
function update(timestamp) {
    if (gameState === "MENU" || gameState === "ONLINE_MENU" || gameState === "HOSTING" || gameState === "JOINING") {
        drawMenu();
    } else if (gameState === "INSTRUCTIONS") {
        drawInstructions();
    } else if (gameState === "GAME_OVER") {
        drawBoard(); // Show board in background
        drawGameOver();
    } else {
        // GAMEPLAY STATE
        if (currentAnimation) {
            const elapsed = timestamp - currentAnimation.startTime;
            if (currentAnimation.phase === 'IDENTIFY') {
                const visualPoly = toLatexStyle(currentAnimation.polyStr);
                currentStatus.text = `Analyzing: ${visualPoly} = 0`;
                currentStatus.color = COLORS.ANIM_IDENTIFY;
                if (elapsed > 1500) {
                    currentAnimation.phase = 'RESOLVE';
                    currentAnimation.startTime = timestamp;
                }
            } else if (currentAnimation.phase === 'RESOLVE') {
                const isSuccess = currentAnimation.isSuccess;
                currentStatus.text = isSuccess ? "REAL Solutions (Δ ≥ 0). Opponent Removed." : "COMPLEX Solutions (Δ < 0). Backfire!";
                currentStatus.color = isSuccess ? COLORS.ANIM_SUCCESS : COLORS.ANIM_FAIL;
                if (elapsed > 1500) {
                    currentAnimation.remove.forEach(pos => { delete board[`${pos.r},${pos.c}`]; });
                    currentAnimation = null;
                    if (animationQueue.length === 0) {
                        const endCheck = checkGameEnd(board);
                        if (endCheck.status !== "PLAYING") {
                            gameState = "GAME_OVER";
                            gameResult = endCheck;
                        } else {
                            currentPlayer = currentPlayer === 1 ? 2 : 1;

                            // SYNC ONLINE TURN
                            if (gameMode === "ONLINE") {
                                isOnlineTurn = (currentPlayer === myPlayerColor);
                            }

                            resetStatusText();
                        }
                    }
                }
            }
        } else {
            if (animationQueue.length > 0) {
                currentAnimation = animationQueue.shift();
                currentAnimation.startTime = timestamp;
            } else {
                // Turn Logic
                if (gameMode === "PVC" && currentPlayer === 1 && !isAIThinking) {
                    triggerComputerTurn();
                }
            }
        }
        drawBoard();
    }
    requestAnimationFrame(update);
}

function resetStatusText() {
    if (gameMode === "PVC") {
        if (currentPlayer === 1) {
            currentStatus.text = "Computer (Red)'s Turn";
            currentStatus.color = COLORS.RED_COIN_LIGHT;
        } else {
            currentStatus.text = "Your Turn (Blue)";
            currentStatus.color = COLORS.ANIM_IDENTIFY;
        }
    } else if (gameMode === "ONLINE") {
        if (isOnlineTurn) {
            // I could be Red or Blue.
            const pName = myPlayerColor === 1 ? "Red" : "Blue";
            currentStatus.text = `Your Turn (${pName})`;
            currentStatus.color = myPlayerColor === 1 ? COLORS.RED_COIN_LIGHT : COLORS.ANIM_IDENTIFY;
        } else {
            currentStatus.text = "Opponent's Turn";
            currentStatus.color = myPlayerColor === 1 ? COLORS.ANIM_IDENTIFY : COLORS.RED_COIN_LIGHT;
        }
    } else {
        // PVP
        const pName = currentPlayer === 1 ? "Red" : "Blue";
        currentStatus.text = `${pName}'s Turn`;
        currentStatus.color = currentPlayer === 1 ? COLORS.RED_COIN_LIGHT : COLORS.ANIM_IDENTIFY;
    }
}

// --- INPUT ---
canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // MENU CLICKS
    if (gameState === "MENU") {
        if (x >= btnPVP.x && x <= btnPVP.x + btnPVP.w && y >= btnPVP.y && y <= btnPVP.y + btnPVP.h) {
            startGame("PVP");
        } else if (x >= btnPVC.x && x <= btnPVC.x + btnPVC.w && y >= btnPVC.y && y <= btnPVC.y + btnPVC.h) {
            startGame("PVC");
        } else if (x >= btnInstr.x && x <= btnInstr.x + btnInstr.w && y >= btnInstr.y && y <= btnInstr.y + btnInstr.h) {
            gameState = "INSTRUCTIONS";
        } else if (x >= btnOnline.x && x <= btnOnline.x + btnOnline.w && y >= btnOnline.y && y <= btnOnline.y + btnOnline.h) {
            gameState = "ONLINE_MENU";
        }
        return;
    }

    if (gameState === "HOSTING") {
        if (x >= btnBack.x && x <= btnBack.x + btnBack.w && y >= btnBack.y && y <= btnBack.y + btnBack.h) {
            if (network) network.close();
            gameState = "ONLINE_MENU";
        }
        return;
    }

    if (gameState === "ONLINE_MENU") {
        if (x >= btnHost.x && x <= btnHost.x + btnHost.w && y >= btnHost.y && y <= btnHost.y + btnHost.h) {
            startOnlineGameAsHost();
        } else if (x >= btnJoin.x && x <= btnJoin.x + btnJoin.w && y >= btnJoin.y && y <= btnJoin.y + btnJoin.h) {
            gameState = "JOINING";
            joinCodeInput = "";
            joinStatusMsg = "";
        } else if (x >= btnBack.x && x <= btnBack.x + btnBack.w && y >= btnBack.y && y <= btnBack.y + btnBack.h) {
            gameState = "MENU";
        }
        return;
    }

    if (gameState === "JOINING") {
        const btnConnect = { x: 130, y: 380, w: 300, h: 50, text: "CONNECT" };
        const btnCancel = { x: 130, y: 450, w: 300, h: 50, text: "BACK" };

        if (x >= btnConnect.x && x <= btnConnect.x + btnConnect.w && y >= btnConnect.y && y <= btnConnect.y + btnConnect.h) {
            joinOnlineGame(joinCodeInput);
        } else if (x >= btnCancel.x && x <= btnCancel.x + btnCancel.w && y >= btnCancel.y && y <= btnCancel.y + btnCancel.h) {
            gameState = "ONLINE_MENU";
        }
        return;
    }

    if (gameState === "INSTRUCTIONS") {
        if (x >= btnBack.x && x <= btnBack.x + btnBack.w && y >= btnBack.y && y <= btnBack.y + btnBack.h) {
            gameState = previousState; // Resume game or go back to menu
        }
        return;
    }

    if (gameState === "GAME_OVER") {
        if (x >= btnGameOverMenu.x && x <= btnGameOverMenu.x + btnGameOverMenu.w && y >= btnGameOverMenu.y && y <= btnGameOverMenu.y + btnGameOverMenu.h) {
            gameState = "MENU";
            gameMode = null;
        }
        return;
    }

    // GAMEPLAY CLICKS
    // Check Navigation Buttons first
    if (x >= btnGameBack.x && x <= btnGameBack.x + btnGameBack.w && y >= btnGameBack.y && y <= btnGameBack.y + btnGameBack.h) {
        // Exit to Menu
        gameState = "MENU";
        gameMode = null;
        currentStatus.text = ""; // Clear status logic, not needed in menu
        return;
    }
    if (x >= btnGameInstr.x && x <= btnGameInstr.x + btnGameInstr.w && y >= btnGameInstr.y && y <= btnGameInstr.y + btnGameInstr.h) {
        previousState = "PLAYING";
        gameState = "INSTRUCTIONS";
        return;
    }

    if (currentAnimation || animationQueue.length > 0 || isAIThinking) return;

    // Prevent Human from clicking during Computer's turn in PVC mode
    if (gameMode === "PVC" && currentPlayer === 1) return;

    // Prevent Human from clicking during Opponent's turn in ONLINE mode
    if (gameMode === "ONLINE" && !isOnlineTurn) return;

    const c = Math.floor(x / TILE_SIZE);
    const r = Math.floor(y / TILE_SIZE);
    const key = `${r},${c}`;

    if (selectedCoin) {
        const startR = selectedCoin.r; const startC = selectedCoin.c;
        if (startR === r && startC === c) {
            selectedCoin = null; validMoves = []; return;
        }
        const isMoveValid = validMoves.some(m => m.r === r && m.c === c);
        if (isMoveValid) {
            // ... move execution ...
            // ONLINE: Send Move
            if (gameMode === "ONLINE") {
                network.send({
                    type: 'MOVE',
                    move: { start: { r: startR, c: startC }, end: { r, c } }
                });
                isOnlineTurn = false;
            }

            board[`${r},${c}`] = board[`${startR},${startC}`];
            delete board[`${startR},${startC}`];
            selectedCoin = null; validMoves = [];
            const equations = checkForEquations(r, c, currentPlayer);
            if (equations.length > 0) {
                animationQueue.push(...equations);
            } else {
                currentPlayer = currentPlayer === 1 ? 2 : 1;

                // SYNC ONLINE TURN
                if (gameMode === "ONLINE") {
                    isOnlineTurn = (currentPlayer === myPlayerColor);
                }

                resetStatusText();
            }
        } else {
            // Try selecting the new coin
            if (board[key] && board[key].p === currentPlayer) {
                selectedCoin = { r, c };
                validMoves = getValidMoves(r, c, currentPlayer);
                console.log(`Selected ${r},${c}. Player: ${currentPlayer}. Valid Moves:`, validMoves);
            } else {
                selectedCoin = null; validMoves = [];
            }
        }
    } else {
        if (board[key] && board[key].p === currentPlayer) {
            selectedCoin = { r, c };
            validMoves = getValidMoves(r, c, currentPlayer);
            console.log(`Initial Select ${r},${c}. Player: ${currentPlayer}. Valid Moves:`, validMoves);
            console.log(`Debug: Mode=${gameMode}, OnlineTurn=${isOnlineTurn}, MyColor=${myPlayerColor}`);
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
});


// --- KEYBOARD INPUT FOR JOINING ---
window.addEventListener('keydown', (e) => {
    if (gameState === "JOINING") {
        if (e.key === "Backspace") {
            joinCodeInput = joinCodeInput.slice(0, -1);
        } else if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
            if (joinCodeInput.length < 4) {
                joinCodeInput += e.key.toUpperCase();
            }
        } else if (e.key === "Enter") {
            joinOnlineGame(joinCodeInput);
        }
    }
});


requestAnimationFrame(update);
