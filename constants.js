// --- CONFIGURATION ---
const BOARD_ROWS = 9;
const BOARD_COLS = 8;
const TILE_SIZE = 70;

// --- COLORS ---
const COLORS = {
    WHITE: "#1E293B",         // Used for text primarily now, so Dark Slate
    BG_DARK: "#E2E8F0",       // Slate 200 (Matches Board Light)
    BOARD_LIGHT: "#E2E8F0",   // Slate 200 (Light Checkerboard)
    BOARD_DARK: "#CBD5E1",    // Slate 300 (Darker Checkerboard)

    // Coins - Vivid
    RED_COIN_BASE: "#DC2626",   // Red 600
    RED_COIN_LIGHT: "#EF4444",  // Red 500
    BLUE_COIN_BASE: "#2563EB",  // Blue 600
    BLUE_COIN_LIGHT: "#3B82F6", // Blue 500

    // UI & Highlights
    HIGHLIGHT_SELECT: "#F59E0B", // Amber 500
    HIGHLIGHT_VALID: "#10B981",  // Emerald 500

    // Animations
    ANIM_IDENTIFY: "#0EA5E9",    // Sky 500
    ANIM_SUCCESS: "#16A34A",    // Green 600
    ANIM_FAIL: "#DC2626",       // Red 600

    // Menu
    MENU_BTN: "#FFFFFF",        // White
    MENU_BTN_HOVER: "#F8FAFC",  // Slate 50
    MENU_TEXT: "#0F172A",       // Slate 900 (Dark Text)
    MENU_ACCENT: "#4F46E5"      // Indigo 600
};

// Algebraic Terms
const COIN_TERMS = {
    1: ["-4x^2", "-3x^2", "-2x^2", "-x^2", "x^2", "2x^2", "3x^2", "4x^2"],
    2: ["-4x", "-3x", "-2x", "-x", "x", "2x", "3x", "4x"],
    3: ["-4", "-3", "-2", "-1", "1", "2", "3", "4"]
};

// --- LATEX FORMATTING ---
function toLatexStyle(str) {
    let latexStr = str.replace(/-/g, "−");
    latexStr = latexStr.replace(/\^2/g, "²");
    return latexStr;
}

// --- PARSE HELPER ---
function parseTerm(termStr) {
    termStr = termStr.replace(/\s/g, '');
    let coeff = 0, degree = 0;
    if (termStr.includes("x^2")) {
        degree = 2;
        let cStr = termStr.replace("x^2", "");
        if (cStr === "" || cStr === "+") coeff = 1;
        else if (cStr === "-") coeff = -1;
        else coeff = parseInt(cStr);
    } else if (termStr.includes("x")) {
        degree = 1;
        let cStr = termStr.replace("x", "");
        if (cStr === "" || cStr === "+") coeff = 1;
        else if (cStr === "-") coeff = -1;
        else coeff = parseInt(cStr);
    } else {
        degree = 0; coeff = parseInt(termStr);
    }
    return { coeff, degree };
}
