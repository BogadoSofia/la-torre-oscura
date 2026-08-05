// ==========================================================
// Motor de ajedrez (reglas completas) + bot + interfaz del tablero
// ==========================================================

const PIEZA_IMG = { p: 'peon', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' };

const KNIGHT_OFFSETS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_OFFSETS   = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP_DIRS    = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK_DIRS      = [[-1,0],[1,0],[0,-1],[0,1]];
const QUEEN_DIRS     = BISHOP_DIRS.concat(ROOK_DIRS);

function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function opponent(color) { return color === 'w' ? 'b' : 'w'; }
function squareName(r, c) { return String.fromCharCode(97 + c) + (8 - r); }
function algebraicToRC(sq) { return [8 - parseInt(sq[1], 10), sq.charCodeAt(0) - 97]; }

function crearTableroInicial() {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  const orden = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: orden[c], color: 'b' };
    b[1][c] = { type: 'p', color: 'b' };
    b[6][c] = { type: 'p', color: 'w' };
    b[7][c] = { type: orden[c], color: 'w' };
  }
  return b;
}

function clonarTablero(board) {
  return board.map(fila => fila.map(p => (p ? { ...p } : null)));
}

function crearPartida() {
  return {
    board: crearTableroInicial(),
    turn: 'w',
    castling: { w: { K: true, Q: true }, b: { K: true, Q: true } },
    enPassant: null,
    history: [],
    status: 'playing',
  };
}

function clonarPartida(game) {
  return {
    board: clonarTablero(game.board),
    turn: game.turn,
    castling: { w: { ...game.castling.w }, b: { ...game.castling.b } },
    enPassant: game.enPassant ? [...game.enPassant] : null,
    history: [],
    status: game.status,
  };
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) return [r, c];
    }
  }
  return null;
}

function getAttackSquares(board, r, c, piece) {
  const out = [];
  const { type, color } = piece;

  if (type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (inBounds(nr, nc)) out.push([nr, nc]);
    }
  } else if (type === 'n') {
    for (const [dr, dc] of KNIGHT_OFFSETS) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) out.push([nr, nc]);
    }
  } else if (type === 'k') {
    for (const [dr, dc] of KING_OFFSETS) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) out.push([nr, nc]);
    }
  } else {
    const dirs = type === 'b' ? BISHOP_DIRS : type === 'r' ? ROOK_DIRS : QUEEN_DIRS;
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        out.push([nr, nc]);
        if (board[nr][nc]) break;
        nr += dr; nc += dc;
      }
    }
  }
  return out;
}

function isSquareAttacked(board, r, c, byColor) {
  for (let rr = 0; rr < 8; rr++) {
    for (let cc = 0; cc < 8; cc++) {
      const p = board[rr][cc];
      if (p && p.color === byColor) {
        const atk = getAttackSquares(board, rr, cc, p);
        for (const [ar, ac] of atk) {
          if (ar === r && ac === c) return true;
        }
      }
    }
  }
  return false;
}

function generatePseudoMoves(game, r, c) {
  const { board } = game;
  const piece = board[r][c];
  if (!piece) return [];
  const { type, color } = piece;
  const moves = [];

  if (type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const lastRow = color === 'w' ? 0 : 7;
    const oneR = r + dir;

    if (inBounds(oneR, c) && !board[oneR][c]) {
      moves.push({ to: [oneR, c], promotion: oneR === lastRow });
      const twoR = r + 2 * dir;
      if (r === startRow && !board[twoR][c]) {
        moves.push({ to: [twoR, c], double: true });
      }
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (target && target.color !== color) {
        moves.push({ to: [nr, nc], capture: true, promotion: nr === lastRow });
      } else if (!target && game.enPassant && game.enPassant[0] === nr && game.enPassant[1] === nc) {
        moves.push({ to: [nr, nc], capture: true, enPassant: true });
      }
    }
  } else if (type === 'n' || type === 'k') {
    const offsets = type === 'n' ? KNIGHT_OFFSETS : KING_OFFSETS;
    for (const [dr, dc] of offsets) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target || target.color !== color) moves.push({ to: [nr, nc], capture: !!target });
    }
    if (type === 'k') {
      const rights = game.castling[color];
      const homeRow = color === 'w' ? 7 : 0;
      const enemy = opponent(color);
      if (r === homeRow && c === 4 && !isSquareAttacked(board, r, c, enemy)) {
        if (rights.K && !board[homeRow][5] && !board[homeRow][6] &&
            board[homeRow][7] && board[homeRow][7].type === 'r' && board[homeRow][7].color === color &&
            !isSquareAttacked(board, homeRow, 5, enemy) && !isSquareAttacked(board, homeRow, 6, enemy)) {
          moves.push({ to: [homeRow, 6], castle: 'K' });
        }
        if (rights.Q && !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] &&
            board[homeRow][0] && board[homeRow][0].type === 'r' && board[homeRow][0].color === color &&
            !isSquareAttacked(board, homeRow, 3, enemy) && !isSquareAttacked(board, homeRow, 2, enemy)) {
          moves.push({ to: [homeRow, 2], castle: 'Q' });
        }
      }
    }
  } else {
    const dirs = type === 'b' ? BISHOP_DIRS : type === 'r' ? ROOK_DIRS : QUEEN_DIRS;
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ to: [nr, nc] });
        } else {
          if (target.color !== color) moves.push({ to: [nr, nc], capture: true });
          break;
        }
        nr += dr; nc += dc;
      }
    }
  }

  return moves.map(m => ({ from: [r, c], piece, ...m }));
}

function applyMoveToBoard(board, move) {
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = board[fr][fc];
  board[fr][fc] = null;

  if (move.enPassant) {
    const capRow = piece.color === 'w' ? tr + 1 : tr - 1;
    board[capRow][tc] = null;
  }

  if (move.castle) {
    if (move.castle === 'K') {
      board[fr][5] = board[fr][7];
      board[fr][7] = null;
    } else {
      board[fr][3] = board[fr][0];
      board[fr][0] = null;
    }
  }

  board[tr][tc] = move.promotion && move.chosenPromotion
    ? { type: move.chosenPromotion, color: piece.color }
    : piece;
}

function isMoveLegal(game, move) {
  const clone = clonarTablero(game.board);
  applyMoveToBoard(clone, move);
  const kingPos = findKing(clone, move.piece.color);
  if (!kingPos) return false;
  return !isSquareAttacked(clone, kingPos[0], kingPos[1], opponent(move.piece.color));
}

function getLegalMoves(game, r, c) {
  return generatePseudoMoves(game, r, c).filter(m => isMoveLegal(game, m));
}

function getAllLegalMoves(game, color) {
  let all = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c];
      if (p && p.color === color) all = all.concat(getLegalMoves(game, r, c));
    }
  }
  return all;
}

function makeMove(game, move) {
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = move.piece;

  let captured = null;
  if (move.enPassant) {
    const capRow = piece.color === 'w' ? tr + 1 : tr - 1;
    captured = game.board[capRow][tc];
  } else if (game.board[tr][tc]) {
    captured = game.board[tr][tc];
  }

  applyMoveToBoard(game.board, move);

  if (piece.type === 'k') {
    game.castling[piece.color].K = false;
    game.castling[piece.color].Q = false;
  }
  if (piece.type === 'r') {
    const homeRow = piece.color === 'w' ? 7 : 0;
    if (fr === homeRow && fc === 0) game.castling[piece.color].Q = false;
    if (fr === homeRow && fc === 7) game.castling[piece.color].K = false;
  }
  if (captured && captured.type === 'r') {
    const oppColor = opponent(piece.color);
    const homeRow = oppColor === 'w' ? 7 : 0;
    if (tr === homeRow && tc === 0) game.castling[oppColor].Q = false;
    if (tr === homeRow && tc === 7) game.castling[oppColor].K = false;
  }

  game.enPassant = move.double ? [(fr + tr) / 2, fc] : null;

  game.history.push({ ...move, captured });
  game.turn = opponent(game.turn);

  const legal = getAllLegalMoves(game, game.turn);
  const kingPos = findKing(game.board, game.turn);
  const inCheck = kingPos ? isSquareAttacked(game.board, kingPos[0], kingPos[1], opponent(game.turn)) : false;

  if (legal.length === 0) {
    game.status = inCheck ? 'checkmate' : 'stalemate';
  } else {
    game.status = inCheck ? 'check' : 'playing';
  }
}

// ==========================================================
// Problemas (posiciones fijas con una única jugada solución)
// ==========================================================

const PUZZLES = [
  {
    piezas: [
      { square: 'd1', type: 'r', color: 'w' },
      { square: 'h2', type: 'p', color: 'w' },
      { square: 'h3', type: 'k', color: 'w' },
      { square: 'd3', type: 'p', color: 'w' },
      { square: 'g4', type: 'p', color: 'w' },
      { square: 'e4', type: 'p', color: 'w' },
      { square: 'e6', type: 'b', color: 'w' },
      { square: 'b2', type: 'r', color: 'b' },
      { square: 'f4', type: 'b', color: 'b' },
      { square: 'd4', type: 'p', color: 'b' },
      { square: 'g7', type: 'k', color: 'b' },
    ],
    piezaJugable: 'b2',
    solucion: 'h2',
  },
  {
    piezas: [
      { square: 'b1', type: 'k', color: 'w' },
      { square: 'a2', type: 'p', color: 'w' },
      { square: 'b2', type: 'p', color: 'w' },
      { square: 'c2', type: 'p', color: 'w' },
      { square: 'e3', type: 'p', color: 'w' },
      { square: 'h3', type: 'r', color: 'w' },
      { square: 'h4', type: 'p', color: 'w' },
      { square: 'b5', type: 'n', color: 'w' },
      { square: 'e1', type: 'r', color: 'w' },
      { square: 'd4', type: 'p', color: 'b' },
      { square: 'c5', type: 'p', color: 'b' },
      { square: 'b6', type: 'p', color: 'b' },
      { square: 'e7', type: 'k', color: 'b' },
      { square: 'd7', type: 'p', color: 'b' },
      { square: 'f7', type: 'p', color: 'b' },
      { square: 'g7', type: 'p', color: 'b' },
      { square: 'h7', type: 'p', color: 'b' },
      { square: 'f1', type: 'q', color: 'b' },
      { square: 'f8', type: 'b', color: 'b' },
      { square: 'h8', type: 'r', color: 'b' },
    ],
    piezaJugable: 'f1',
    solucion: 'e1',
  },
];

// ==========================================================
// Ranking (Supabase)
// ==========================================================

const SUPABASE_URL = "https://znsvqbcozbkcucpwltzj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpuc3ZxYmNvemJrY3VjcHdsdHpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MDg2NzQsImV4cCI6MjEwMDk4NDY3NH0.i9isNzVLLNiGkrNRxJJLqjaFEL1Hx9mlMPM5u6yn9jQ";
const rankingClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLA_RANKING = "Ranking";
const PENALIZACION_ERROR = 4;
const PENALIZACION_PISTA = 5;
const PUNTOS_PUZZLE_PERFECTO = 20;
const CLAVE_PROBLEMAS_RESUELTOS = 'problemasResueltos';

async function sumarPuntos(cantidad) {
  const nombre = localStorage.getItem('miNombreRanking');
  if (!nombre) return;

  const { data, error } = await rankingClient
    .from(TABLA_RANKING)
    .select('Puntos')
    .eq('Nombre', nombre)
    .maybeSingle();

  if (error || !data) {
    console.error('No se pudo leer el puntaje actual:', error);
    return;
  }

  const nuevoPuntaje = Math.max(0, data.Puntos + cantidad);

  const { error: updateError } = await rankingClient
    .from(TABLA_RANKING)
    .update({ Puntos: nuevoPuntaje })
    .eq('Nombre', nombre);

  if (updateError) console.error('No se pudo actualizar el puntaje:', updateError);
}

function crearTableroPuzzle(def) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const p of def.piezas) {
    const [r, c] = algebraicToRC(p.square);
    board[r][c] = { type: p.type, color: p.color };
  }
  return board;
}

function movimientosPuzzle(board, r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const { type, color } = piece;
  const moves = [];

  if (type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const oneR = r + dir;
    if (inBounds(oneR, c) && !board[oneR][c]) {
      moves.push({ to: [oneR, c] });
      const twoR = r + 2 * dir;
      if (r === startRow && !board[twoR][c]) moves.push({ to: [twoR, c] });
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (target && target.color !== color) moves.push({ to: [nr, nc], capture: true });
    }
  } else if (type === 'n' || type === 'k') {
    const offsets = type === 'n' ? KNIGHT_OFFSETS : KING_OFFSETS;
    for (const [dr, dc] of offsets) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc)) continue;
      const target = board[nr][nc];
      if (!target) moves.push({ to: [nr, nc] });
      else if (target.color !== color) moves.push({ to: [nr, nc], capture: true });
    }
  } else {
    const dirs = type === 'b' ? BISHOP_DIRS : type === 'r' ? ROOK_DIRS : QUEEN_DIRS;
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ to: [nr, nc] });
        } else {
          if (target.color !== color) moves.push({ to: [nr, nc], capture: true });
          break;
        }
        nr += dr; nc += dc;
      }
    }
  }
  return moves;
}

// ==========================================================
// Bot (minimax + poda alfa-beta)
// ==========================================================

const VALOR_PIEZA = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const PROFUNDIDAD_BOT = 3;

function evaluarTablero(board) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      let val = VALOR_PIEZA[p.type];
      const distCentro = Math.abs(3.5 - r) + Math.abs(3.5 - c);
      val += (7 - distCentro) * 2;
      score += p.color === 'w' ? val : -val;
    }
  }
  return score;
}

function ordenarMovimientos(moves) {
  return moves.slice().sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));
}

function negamax(game, depth, alpha, beta, color) {
  const moves = ordenarMovimientos(getAllLegalMoves(game, color));

  if (moves.length === 0) {
    const kingPos = findKing(game.board, color);
    const inCheck = kingPos ? isSquareAttacked(game.board, kingPos[0], kingPos[1], opponent(color)) : false;
    if (inCheck) return -100000;
    return 0;
  }

  if (depth === 0) {
    const val = evaluarTablero(game.board);
    return color === 'w' ? val : -val;
  }

  let best = -Infinity;
  for (const move of moves) {
    if (move.promotion) move.chosenPromotion = move.chosenPromotion || 'q';
    const clone = clonarPartida(game);
    makeMove(clone, move);
    const score = -negamax(clone, depth - 1, -beta, -alpha, opponent(color));
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function elegirMovimientoBot(game) {
  const moves = ordenarMovimientos(getAllLegalMoves(game, game.turn));
  let bestMove = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of moves) {
    if (move.promotion) move.chosenPromotion = move.chosenPromotion || 'q';
    const clone = clonarPartida(game);
    makeMove(clone, move);
    const score = -negamax(clone, PROFUNDIDAD_BOT - 1, -beta, -alpha, opponent(game.turn));
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  return bestMove;
}

// ==========================================================
// Interfaz
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
  const gridEl = document.getElementById('tableroGrid');
  if (!gridEl) return;

  const ranksEl = document.getElementById('tableroRanks');
  const filesEl = document.getElementById('tableroFiles');
  const turnoEl = document.getElementById('tableroTurno');
  const mensajeEl = document.getElementById('tableroMensaje');
  const resetBtn = document.getElementById('tableroReset');
  const capturasBlancasEl = document.getElementById('capturasBlancas');
  const capturasNegrasEl = document.getElementById('capturasNegras');
  const promoModal = document.getElementById('promoModal');
  const promoOpcionesEl = document.getElementById('promoOpciones');
  const modoPersonaBtn = document.getElementById('modoPersonaBtn');
  const modoBotBtn = document.getElementById('modoBotBtn');
  const modoProblemasBtn = document.getElementById('modoProblemasBtn');
  const finModal = document.getElementById('finModal');
  const finModalTitulo = document.getElementById('finModalTitulo');
  const finModalTexto = document.getElementById('finModalTexto');
  const finModalReiniciar = document.getElementById('finModalReiniciar');
  const finModalCerrar = document.getElementById('finModalCerrar');
  const puzzleWinModal = document.getElementById('puzzleWinModal');
  const puzzleWinTexto = document.getElementById('puzzleWinTexto');
  const puzzleSiguienteBtn = document.getElementById('puzzleSiguienteBtn');
  const puzzleAnteriorBtn = document.getElementById('puzzleAnteriorBtn');
  const pistaBtn = document.getElementById('pistaBtn');
  const pistaFlecha = document.getElementById('pistaFlecha');
  const pistaFlechaLinea = document.getElementById('pistaFlechaLinea');

  const rankingListaEl = document.getElementById('rankingLista');
  const rankingFormEl = document.getElementById('rankingForm');
  const rankingNombreInput = document.getElementById('rankingNombreInput');
  const rankingSubmitBtn = document.getElementById('rankingSubmitBtn');
  const rankingStatusEl = document.getElementById('rankingStatus');
  const rankingIdentStatusEl = document.getElementById('rankingIdentStatus');

  const BOT_COLOR = 'b';
  let modo = 'persona';
  let game = crearPartida();
  let selected = null;
  let legalTargets = [];
  let pendingMove = null;
  let botPensando = false;

  let puzzleIndex = 0;
  let puzzleBoard = null;
  let puzzleSelected = null;
  let puzzleTargets = [];
  let puntosTotales = 0;
  let pistaNivel = 0;
  let puzzleWallet = PUNTOS_PUZZLE_PERFECTO;
  const problemasResueltos = new Set(JSON.parse(localStorage.getItem(CLAVE_PROBLEMAS_RESUELTOS) || '[]'));

  for (let r = 0; r < 8; r++) {
    const span = document.createElement('span');
    span.textContent = 8 - r;
    ranksEl.appendChild(span);
  }
  for (let c = 0; c < 8; c++) {
    const span = document.createElement('span');
    span.textContent = String.fromCharCode(97 + c);
    filesEl.appendChild(span);
  }

  const squareButtons = [];
  for (let r = 0; r < 8; r++) {
    squareButtons.push([]);
    for (let c = 0; c < 8; c++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'casilla ' + ((r + c) % 2 === 0 ? 'clara' : 'oscura');
      btn.dataset.r = r;
      btn.dataset.c = c;
      btn.addEventListener('pointerdown', (e) => iniciarPointerCasilla(e, r, c));
      gridEl.appendChild(btn);
      squareButtons[r].push(btn);
    }
  }

  function manejarTap(r, c) {
    if (modo === 'problemas') onPuzzleSquareClick(r, c);
    else onSquareClick(r, c);
  }

  function piezaEnCasilla(r, c) {
    return modo === 'problemas' ? (puzzleBoard && puzzleBoard[r][c]) : game.board[r][c];
  }

  function puedeArrastrarDesde(r, c) {
    const piece = piezaEnCasilla(r, c);
    if (!piece) return false;
    if (modo === 'problemas') return true;
    if (botPensando || partidaTerminada()) return false;
    if (modo === 'bot' && game.turn === BOT_COLOR) return false;
    return piece.color === game.turn;
  }

  function seleccionarParaArrastre(r, c) {
    if (modo === 'problemas') {
      if (!(puzzleSelected && puzzleSelected[0] === r && puzzleSelected[1] === c)) {
        onPuzzleSquareClick(r, c);
      }
    } else if (!(selected && selected[0] === r && selected[1] === c)) {
      onSquareClick(r, c);
    }
  }

  function casillaDesdeElemento(el) {
    const btn = el && el.closest ? el.closest('.casilla') : null;
    if (!btn || !gridEl.contains(btn)) return null;
    return [Number(btn.dataset.r), Number(btn.dataset.c)];
  }

  const UMBRAL_ARRASTRE = 6;
  let arrastre = null;
  let saltarAnimacionMovimiento = false;

  function iniciarPointerCasilla(e, r, c) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (arrastre) return;
    arrastre = {
      pointerId: e.pointerId,
      r, c,
      dragging: false,
      startX: e.clientX,
      startY: e.clientY,
      puedeArrastrar: puedeArrastrarDesde(r, c),
      ghost: null,
      origPiezaEl: null,
    };
  }

  function iniciarArrastreVisual(a) {
    a.dragging = true;
    seleccionarParaArrastre(a.r, a.c);
    const piece = piezaEnCasilla(a.r, a.c);
    if (!piece) return;
    const origBtn = squareButtons[a.r][a.c];
    const origPiezaEl = origBtn.querySelector('.pieza');
    if (origPiezaEl) {
      origPiezaEl.classList.add('es-arrastrando');
      a.origPiezaEl = origPiezaEl;
    }
    const rect = origBtn.getBoundingClientRect();
    const ghost = crearPiezaEl(piece);
    ghost.classList.add('pieza-fantasma');
    ghost.style.width = (rect.width * 0.76) + 'px';
    ghost.style.height = (rect.height * 0.76) + 'px';
    document.body.appendChild(ghost);
    a.ghost = ghost;
  }

  function moverArrastreVisual(x, y) {
    if (!arrastre || !arrastre.ghost) return;
    arrastre.ghost.style.left = x + 'px';
    arrastre.ghost.style.top = y + 'px';
  }

  function finalizarArrastreVisual() {
    if (!arrastre) return;
    if (arrastre.ghost) arrastre.ghost.remove();
    if (arrastre.origPiezaEl) arrastre.origPiezaEl.classList.remove('es-arrastrando');
  }

  document.addEventListener('pointermove', (e) => {
    if (!arrastre || e.pointerId !== arrastre.pointerId) return;
    if (!arrastre.dragging) {
      const dist = Math.hypot(e.clientX - arrastre.startX, e.clientY - arrastre.startY);
      if (dist < UMBRAL_ARRASTRE) return;
      if (!arrastre.puedeArrastrar) return;
      iniciarArrastreVisual(arrastre);
    }
    moverArrastreVisual(e.clientX, e.clientY);
  });

  document.addEventListener('pointerup', (e) => {
    if (!arrastre || e.pointerId !== arrastre.pointerId) return;
    const { r, c, dragging } = arrastre;
    finalizarArrastreVisual();
    if (dragging) {
      const destino = casillaDesdeElemento(document.elementFromPoint(e.clientX, e.clientY));
      if (destino) {
        saltarAnimacionMovimiento = true;
        manejarTap(destino[0], destino[1]);
      }
    } else {
      manejarTap(r, c);
    }
    arrastre = null;
  });

  document.addEventListener('pointercancel', (e) => {
    if (!arrastre || e.pointerId !== arrastre.pointerId) return;
    finalizarArrastreVisual();
    arrastre = null;
  });

  function crearPiezaEl(piece) {
    const span = document.createElement('span');
    span.className = `pieza pieza-${PIEZA_IMG[piece.type]} color-${piece.color === 'w' ? 'blancas' : 'negras'}`;
    return span;
  }

  function animarMovimientoRapido(origenR, origenC, destinoR, destinoC, piece) {
    if (!piece) return;
    const origenRect = squareButtons[origenR][origenC].getBoundingClientRect();
    const destinoRect = squareButtons[destinoR][destinoC].getBoundingClientRect();

    const ghost = crearPiezaEl(piece);
    ghost.classList.add('pieza-fantasma', 'pieza-viaje');
    ghost.style.width = (origenRect.width * 0.76) + 'px';
    ghost.style.height = (origenRect.height * 0.76) + 'px';
    ghost.style.left = (origenRect.left + origenRect.width / 2) + 'px';
    ghost.style.top = (origenRect.top + origenRect.height / 2) + 'px';
    document.body.appendChild(ghost);

    requestAnimationFrame(() => {
      ghost.style.left = (destinoRect.left + destinoRect.width / 2) + 'px';
      ghost.style.top = (destinoRect.top + destinoRect.height / 2) + 'px';
    });

    ghost.addEventListener('transitionend', () => ghost.remove(), { once: true });
    setTimeout(() => { if (ghost.isConnected) ghost.remove(); }, 400);
  }

  function cargarPuzzle(index) {
    const def = PUZZLES[index];
    puzzleBoard = crearTableroPuzzle(def);
    puzzleSelected = null;
    puzzleTargets = [];
    puzzleWinModal.hidden = true;
    pistaNivel = 0;
    puzzleWallet = PUNTOS_PUZZLE_PERFECTO;
    puzzleAnteriorBtn.hidden = modo !== 'problemas' || index === 0;
    renderPuzzle();
  }

  function renderPuzzle() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const btn = squareButtons[r][c];
        btn.className = 'casilla ' + ((r + c) % 2 === 0 ? 'clara' : 'oscura');
        btn.innerHTML = '';
        btn.setAttribute('aria-label', squareName(r, c));

        const piece = puzzleBoard[r][c];
        if (piece) btn.appendChild(crearPiezaEl(piece));

        if (puzzleSelected && puzzleSelected[0] === r && puzzleSelected[1] === c) {
          btn.classList.add('es-seleccionada');
        }
        const target = puzzleTargets.find(m => m.to[0] === r && m.to[1] === c);
        if (target) {
          btn.classList.add(target.capture ? 'captura-legal' : 'mov-legal');
        }
      }
    }

    turnoEl.classList.remove('es-negras');
    turnoEl.textContent = `Problema ${puzzleIndex + 1} · Puntos: ${puntosTotales}`;
    mensajeEl.classList.remove('es-jaquemate');
    mensajeEl.textContent = '';
    capturasBlancasEl.innerHTML = '';
    capturasNegrasEl.innerHTML = '';

    actualizarPista();
  }

  function actualizarPista() {
    squareButtons.flat().forEach(btn => btn.classList.remove('es-pista-origen'));
    pistaFlecha.hidden = true;

    if (pistaNivel < 1 || modo !== 'problemas' || !puzzleBoard) return;

    const def = PUZZLES[puzzleIndex];
    const [origenR, origenC] = algebraicToRC(def.piezaJugable);
    squareButtons[origenR][origenC].classList.add('es-pista-origen');

    if (pistaNivel >= 2) {
      const [destinoR, destinoC] = algebraicToRC(def.solucion);
      dibujarFlechaPista(origenR, origenC, destinoR, destinoC);
    }
  }

  function dibujarFlechaPista(origenR, origenC, destinoR, destinoC) {
    const celda = 100 / 8;
    const x1 = (origenC + 0.5) * celda;
    const y1 = (origenR + 0.5) * celda;
    let x2 = (destinoC + 0.5) * celda;
    let y2 = (destinoR + 0.5) * celda;
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy) || 1;
    const recorte = celda * 0.35;
    x2 -= (dx / dist) * recorte;
    y2 -= (dy / dist) * recorte;
    pistaFlechaLinea.setAttribute('x1', x1);
    pistaFlechaLinea.setAttribute('y1', y1);
    pistaFlechaLinea.setAttribute('x2', x2);
    pistaFlechaLinea.setAttribute('y2', y2);
    pistaFlecha.hidden = false;
  }

  pistaBtn.addEventListener('click', () => {
    if (modo !== 'problemas' || !puzzleBoard) return;
    if (pistaNivel >= 2) {
      pistaNivel = 0;
    } else {
      pistaNivel += 1;
      puzzleWallet = Math.max(0, puzzleWallet - PENALIZACION_PISTA);
    }
    actualizarPista();
  });

  function onPuzzleSquareClick(r, c) {
    const def = PUZZLES[puzzleIndex];
    const saltarAnimacion = saltarAnimacionMovimiento;
    saltarAnimacionMovimiento = false;

    if (!puzzleSelected) {
      if (puzzleBoard[r][c]) {
        puzzleSelected = [r, c];
        puzzleTargets = movimientosPuzzle(puzzleBoard, r, c);
        renderPuzzle();
      }
      return;
    }

    const [sr, sc] = puzzleSelected;
    if (sr === r && sc === c) {
      puzzleSelected = null;
      puzzleTargets = [];
      renderPuzzle();
      return;
    }

    const movingPiece = puzzleBoard[sr][sc];
    const capturedPiece = puzzleBoard[r][c];
    const origenAlg = squareName(sr, sc);
    const destinoAlg = squareName(r, c);

    puzzleBoard[r][c] = movingPiece;
    puzzleBoard[sr][sc] = null;
    puzzleSelected = null;
    puzzleTargets = [];
    renderPuzzle();
    if (!saltarAnimacion) animarMovimientoRapido(sr, sc, r, c, movingPiece);

    if (origenAlg === def.piezaJugable && destinoAlg === def.solucion) {
      const yaResuelto = problemasResueltos.has(puzzleIndex);
      const premio = yaResuelto ? 0 : puzzleWallet;
      puntosTotales += premio;
      puzzleWinTexto.textContent = yaResuelto ? 'Ya habías resuelto este problema' : `Ganaste +${premio} puntos`;
      puzzleWinModal.hidden = false;
      pistaNivel = 0;
      if (!yaResuelto) {
        problemasResueltos.add(puzzleIndex);
        localStorage.setItem(CLAVE_PROBLEMAS_RESUELTOS, JSON.stringify([...problemasResueltos]));
        sumarPuntos(premio);
      }
      renderPuzzle();
      return;
    }

    puzzleWallet = Math.max(0, puzzleWallet - PENALIZACION_ERROR);

    setTimeout(() => {
      puzzleBoard[sr][sc] = movingPiece;
      puzzleBoard[r][c] = capturedPiece;
      renderPuzzle();
    }, 450);
  }

  function render() {
    const lastMove = game.history[game.history.length - 1] || null;
    const kingPos = findKing(game.board, game.turn);
    const inCheck = game.status === 'check' || game.status === 'checkmate';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const btn = squareButtons[r][c];
        btn.className = 'casilla ' + ((r + c) % 2 === 0 ? 'clara' : 'oscura');
        btn.innerHTML = '';
        btn.setAttribute('aria-label', squareName(r, c));

        const piece = game.board[r][c];
        if (piece) btn.appendChild(crearPiezaEl(piece));

        if (lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) ||
                          (lastMove.to[0] === r && lastMove.to[1] === c))) {
          btn.classList.add('es-jugada-anterior');
        }
        if (selected && selected[0] === r && selected[1] === c) {
          btn.classList.add('es-seleccionada');
        }
        if (inCheck && kingPos && kingPos[0] === r && kingPos[1] === c) {
          btn.classList.add('es-jaque');
        }
        const target = legalTargets.find(m => m.to[0] === r && m.to[1] === c);
        if (target) {
          btn.classList.add(target.capture ? 'captura-legal' : 'mov-legal');
        }
      }
    }

    turnoEl.classList.toggle('es-negras', game.turn === 'b');
    turnoEl.innerHTML = '<span class="turno-dot"></span>Turno: ' + (game.turn === 'w' ? 'Blancas' : 'Negras');

    mensajeEl.classList.remove('es-jaquemate');
    if (botPensando) {
      mensajeEl.textContent = 'El bot está pensando...';
    } else if (game.status === 'checkmate') {
      const ganador = opponent(game.turn) === 'w' ? 'Blancas' : 'Negras';
      mensajeEl.textContent = `Jaque mate — Ganan ${ganador}`;
      mensajeEl.classList.add('es-jaquemate');
    } else if (game.status === 'stalemate') {
      mensajeEl.textContent = 'Tablas por ahogado';
    } else if (game.status === 'check') {
      mensajeEl.textContent = '¡Jaque!';
    } else {
      mensajeEl.textContent = '';
    }

    renderCapturas();
  }

  function renderCapturas() {
    capturasBlancasEl.innerHTML = '';
    capturasNegrasEl.innerHTML = '';
    for (const mv of game.history) {
      if (!mv.captured) continue;
      const el = crearPiezaEl(mv.captured);
      if (mv.captured.color === 'b') capturasBlancasEl.appendChild(el);
      else capturasNegrasEl.appendChild(el);
    }
  }

  function partidaTerminada() {
    return game.status === 'checkmate' || game.status === 'stalemate';
  }

  function mostrarFinSiCorresponde() {
    if (game.status === 'checkmate') {
      const ganador = opponent(game.turn) === 'w' ? 'Blancas' : 'Negras';
      finModalTitulo.textContent = 'Jaque mate';
      finModalTexto.textContent = `Ganan ${ganador}.`;
      finModal.hidden = false;
    } else if (game.status === 'stalemate') {
      finModalTitulo.textContent = 'Tablas';
      finModalTexto.textContent = 'Ahogado: quien tiene el turno no puede mover ninguna pieza, pero no está en jaque.';
      finModal.hidden = false;
    }
  }

  function despuesDeJugada() {
    render();
    if (partidaTerminada()) {
      mostrarFinSiCorresponde();
      return;
    }
    if (modo === 'bot' && game.turn === BOT_COLOR) {
      botPensando = true;
      render();
      setTimeout(jugarTurnoBot, 350);
    }
  }

  function jugarTurnoBot() {
    const move = elegirMovimientoBot(game);
    botPensando = false;
    if (move) makeMove(game, move);
    render();
    if (partidaTerminada()) mostrarFinSiCorresponde();
  }

  function onSquareClick(r, c) {
    if (botPensando || partidaTerminada()) return;
    if (modo === 'bot' && game.turn === BOT_COLOR) return;

    const saltarAnimacion = saltarAnimacionMovimiento;
    saltarAnimacionMovimiento = false;

    const piece = game.board[r][c];

    if (selected) {
      const move = legalTargets.find(m => m.to[0] === r && m.to[1] === c);
      if (move) {
        selected = null;
        legalTargets = [];
        if (move.promotion) {
          pendingMove = move;
          abrirPromocion(move.piece.color);
          render();
          return;
        }
        makeMove(game, move);
        despuesDeJugada();
        if (!saltarAnimacion) {
          animarMovimientoRapido(move.from[0], move.from[1], move.to[0], move.to[1], move.piece);
        }
        return;
      }
      if (piece && piece.color === game.turn) {
        selected = [r, c];
        legalTargets = getLegalMoves(game, r, c);
        render();
        return;
      }
      selected = null;
      legalTargets = [];
      render();
      return;
    }

    if (piece && piece.color === game.turn) {
      selected = [r, c];
      legalTargets = getLegalMoves(game, r, c);
      render();
    }
  }

  function abrirPromocion(color) {
    promoOpcionesEl.innerHTML = '';
    for (const tipo of ['q', 'r', 'b', 'n']) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'promo-opcion';
      const piezaEl = crearPiezaEl({ type: tipo, color });
      btn.appendChild(piezaEl);
      btn.addEventListener('click', () => {
        pendingMove.chosenPromotion = tipo;
        makeMove(game, pendingMove);
        pendingMove = null;
        promoModal.hidden = true;
        despuesDeJugada();
      });
      promoOpcionesEl.appendChild(btn);
    }
    promoModal.hidden = false;
  }

  function reiniciar() {
    game = crearPartida();
    selected = null;
    legalTargets = [];
    pendingMove = null;
    botPensando = false;
    promoModal.hidden = true;
    finModal.hidden = true;
    render();
  }

  function elegirModo(nuevoModo) {
    if (modo === nuevoModo) return;
    modo = nuevoModo;
    modoPersonaBtn.classList.toggle('is-active', modo === 'persona');
    modoBotBtn.classList.toggle('is-active', modo === 'bot');
    modoProblemasBtn.classList.toggle('is-active', modo === 'problemas');
    resetBtn.textContent = modo === 'problemas' ? 'Reiniciar problema' : 'Reiniciar partida';
    pistaBtn.hidden = modo !== 'problemas';
    puzzleAnteriorBtn.hidden = modo !== 'problemas';
    pistaNivel = 0;
    pistaFlecha.hidden = true;
    promoModal.hidden = true;
    finModal.hidden = true;
    puzzleWinModal.hidden = true;

    if (modo === 'problemas') {
      puzzleIndex = 0;
      cargarPuzzle(puzzleIndex);
    } else {
      reiniciar();
    }
  }

  modoPersonaBtn.addEventListener('click', () => elegirModo('persona'));
  modoBotBtn.addEventListener('click', () => elegirModo('bot'));
  modoProblemasBtn.addEventListener('click', () => elegirModo('problemas'));
  resetBtn.addEventListener('click', () => {
    if (modo === 'problemas') cargarPuzzle(puzzleIndex);
    else reiniciar();
  });
  finModalReiniciar.addEventListener('click', reiniciar);
  finModalCerrar.addEventListener('click', () => { finModal.hidden = true; });
  puzzleAnteriorBtn.addEventListener('click', () => {
    if (puzzleIndex === 0) return;
    puzzleIndex -= 1;
    cargarPuzzle(puzzleIndex);
  });
  puzzleSiguienteBtn.addEventListener('click', () => {
    puzzleWinModal.hidden = true;
    const next = puzzleIndex + 1;
    if (next < PUZZLES.length) {
      puzzleIndex = next;
      cargarPuzzle(puzzleIndex);
    } else {
      cargarPuzzle(puzzleIndex);
      mensajeEl.textContent = 'Por ahora no hay más problemas — ¡volvé pronto!';
    }
  });

  async function renombrarMiPerfil(nombreActual) {
    const nuevoNombre = (window.prompt('Cambiar tu nombre en el ranking:', nombreActual) || '').trim();
    if (!nuevoNombre || nuevoNombre === nombreActual) return;

    const { error } = await rankingClient
      .from(TABLA_RANKING)
      .update({ Nombre: nuevoNombre })
      .eq('Nombre', nombreActual);

    if (error) {
      rankingIdentStatusEl.textContent = 'No se pudo cambiar el nombre (¿ya hay alguien con ese nombre?).';
      rankingIdentStatusEl.className = 'form-status error';
      console.error(error);
      return;
    }

    localStorage.setItem('miNombreRanking', nuevoNombre);
    rankingIdentStatusEl.textContent = `Listo, ahora figurás como "${nuevoNombre}".`;
    rankingIdentStatusEl.className = 'form-status success';
    cargarRanking();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  async function reclamarNombre(nombre) {
    const { error } = await rankingClient
      .from(TABLA_RANKING)
      .update({ Reclamado: true })
      .eq('Nombre', nombre)
      .eq('Reclamado', false);

    if (error) {
      console.error(error);
      return;
    }

    localStorage.setItem('miNombreRanking', nombre);
    cargarRanking();
  }

  async function cargarRanking() {
    const { data, error } = await rankingClient
      .from(TABLA_RANKING)
      .select('Nombre, Puntos, Reclamado')
      .order('Puntos', { ascending: false });

    if (error) {
      rankingListaEl.innerHTML = '<p>No se pudo cargar el ranking.</p>';
      console.error(error);
      return;
    }

    const miNombre = localStorage.getItem('miNombreRanking');
    const estoyEnLista = data.some(j => j.Nombre === miNombre);

    if (!data.length) {
      rankingListaEl.innerHTML = '<p>Todavía no hay nadie en el ranking.</p>';
    } else {
      rankingListaEl.innerHTML = '<ul class="ranking-list">' +
        data.map((j, i) => {
          const esYo = j.Nombre === miNombre;
          const bloqueado = !!j.Reclamado && !esYo;
          const clases = ['ranking-item'];
          if (esYo) clases.push('es-yo');
          if (bloqueado) clases.push('es-bloqueado');
          return `
            <li class="${clases.join(' ')}" data-nombre="${escapeHtml(j.Nombre)}" data-reclamado="${!!j.Reclamado}">
              <span class="ranking-pos">#${i + 1}</span>
              <span class="ranking-nombre">${escapeHtml(j.Nombre)}</span>
              <span class="ranking-puntos">${j.Puntos} pts</span>
            </li>
          `;
        }).join('') +
        '</ul>';

      rankingListaEl.querySelectorAll('.ranking-item').forEach(item => {
        let lastTap = 0;
        const alDobleClick = () => {
          const nombreActualDispositivo = localStorage.getItem('miNombreRanking');
          const esMio = item.dataset.nombre === nombreActualDispositivo;
          const reclamado = item.dataset.reclamado === 'true';

          if (reclamado && !esMio) {
            return;
          }
          if (esMio) {
            renombrarMiPerfil(item.dataset.nombre);
            return;
          }
          reclamarNombre(item.dataset.nombre);
        };
        item.addEventListener('dblclick', alDobleClick);
        item.addEventListener('touchend', () => {
          const ahora = Date.now();
          if (ahora - lastTap < 350) alDobleClick();
          lastTap = ahora;
        });
      });
    }

    rankingFormEl.hidden = estoyEnLista;
  }

  rankingSubmitBtn.addEventListener('click', async () => {
    const nombre = rankingNombreInput.value.trim();
    if (!nombre) {
      rankingStatusEl.textContent = 'Escribí tu nombre primero.';
      rankingStatusEl.className = 'form-status error';
      return;
    }

    rankingSubmitBtn.disabled = true;
    rankingStatusEl.textContent = 'Sumándote...';
    rankingStatusEl.className = 'form-status';

    const { error } = await rankingClient
      .from(TABLA_RANKING)
      .insert([{ Nombre: nombre, Puntos: 0, Reclamado: true }]);

    if (error) {
      rankingStatusEl.textContent = 'Ese nombre ya existe o hubo un error. Si ya estás en la lista, hacé doble clic en tu nombre.';
      rankingStatusEl.className = 'form-status error';
      rankingSubmitBtn.disabled = false;
      return;
    }

    localStorage.setItem('miNombreRanking', nombre);
    rankingStatusEl.textContent = '¡Listo, ya estás en el ranking!';
    rankingStatusEl.className = 'form-status success';
    rankingSubmitBtn.disabled = false;
    cargarRanking();
  });

  cargarRanking();

  render();
});
