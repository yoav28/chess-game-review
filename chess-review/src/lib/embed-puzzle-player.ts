export const embedPuzzlePlayerScript = String.raw`
let puzzleSelected = null, puzzleHint = null, puzzleWrong = null, puzzlePending = null;
let puzzleReply = null, puzzleSolved = false, puzzleRevealed = false, puzzleStatus = '', puzzleCursor = 'e2';
const puzzleActive = () => Boolean(data.puzzle && !puzzleRevealed);
const puzzleFrame = () => puzzleWrong || data.frames[ply];
function clearPuzzleReply() { clearTimeout(puzzleReply); puzzleReply = null; }
function puzzleReset() {
  pause(); clearPuzzleReply();
  ply = data.puzzle.start;
  puzzleSelected = puzzleHint = puzzleWrong = puzzlePending = null;
  puzzleSolved = puzzleRevealed = false; puzzleStatus = '';
  draw();
}
function puzzleFocus() { document.querySelector('[data-square="' + puzzleCursor + '"]')?.focus(); }
function puzzleChoose(move) {
  puzzleSelected = puzzleHint = puzzlePending = null;
  if (move.uci !== data.puzzle.expected[ply]) {
    puzzleWrong = { ...data.frames[ply], fen: move.fen, label: move.san, outcome: null, lastMove: { from: move.from, to: move.to } };
    puzzleStatus = move.san + ' is legal, but is not the recorded move. Try again.';
    draw(); el('retry').focus(); return;
  }
  ply++;
  puzzleStatus = 'Correct: ' + move.san + '.';
  if (ply < data.frames.length - 1) {
    puzzleReply = setTimeout(() => {
      puzzleReply = null; ply++;
      puzzleSolved = ply === data.frames.length - 1;
      puzzleStatus = puzzleSolved ? 'All recorded moves found.' : 'Opponent played ' + data.frames[ply].label + '.';
      draw();
      if (puzzleSolved) el('reset').focus(); else puzzleFocus();
    }, 500);
  } else { puzzleSolved = true; puzzleStatus = 'All recorded moves found.'; }
  draw();
  if (puzzleSolved) el('reset').focus();
}
function puzzleSelect(square, piece) {
  if (!puzzleActive() || puzzleSolved || puzzleReply || puzzleWrong) return;
  puzzleCursor = square;
  const moves = data.puzzle.turns[ply] || [];
  if (puzzleSelected) {
    const matches = moves.filter(move => move.from === puzzleSelected && (move.to === square || move.rookFrom === square));
    if (matches.length === 1) { puzzleChoose(matches[0]); puzzleFocus(); return; }
    if (matches.length > 1) { puzzlePending = matches; puzzleStatus = 'Choose the move below the board.'; draw(); el('choices').querySelector('button')?.focus(); return; }
  }
  if (piece && (piece === piece.toUpperCase() ? 'w' : 'b') === data.puzzle.side) {
    puzzleSelected = puzzleSelected === square ? null : square;
    puzzlePending = null; puzzleStatus = puzzleSelected ? 'Choose a destination for ' + square + '.' : '';
  } else puzzleStatus = puzzleSelected ? 'That destination is not legal. Choose another square.' : 'Choose one of your pieces.';
  draw(); puzzleFocus();
}
function puzzleCell(cell, square, piece, index) {
  if (!puzzleActive()) return;
  cell.dataset.square = square;
  cell.tabIndex = square === puzzleCursor ? 0 : -1;
  cell.setAttribute('aria-label', square + ', ' + (piece ? (piece === piece.toUpperCase() ? 'White ' : 'Black ') + ({ p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' }[piece.toLowerCase()]) : 'empty'));
  cell.setAttribute('aria-pressed', String(puzzleSelected === square));
  cell.disabled = Boolean(puzzleSolved || puzzleReply || puzzleWrong);
  if (square === puzzleSelected || square === puzzleHint) cell.classList.add('selected');
  cell.onclick = () => puzzleSelect(square, piece);
  cell.onkeydown = event => {
    const directions = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] };
    if (directions[event.key]) {
      event.preventDefault(); const [dx,dy] = directions[event.key];
      const target = Math.max(0, Math.min(7, index % 8 + dx)) + 8 * Math.max(0, Math.min(7, Math.floor(index / 8) + dy));
      const original = orientation === 'w' ? target : 63 - target;
      puzzleCursor = 'abcdefgh'[original % 8] + (8 - Math.floor(original / 8));
      draw(); puzzleFocus();
    } else if (event.key === 'Escape') { puzzleSelected = puzzlePending = null; draw(); puzzleFocus(); }
  };
}
function drawPuzzle() {
  const active = puzzleActive();
  el('puzzle-controls').hidden = !data.puzzle;
  el('replay-controls').hidden = active;
  el('timeline-label').hidden = active; el('timeline').hidden = active;
  el('scores').hidden = active && !puzzleSolved;
  el('explanation-details').hidden = active && !puzzleSolved;
  el('solution-line').hidden = !data.puzzle || !puzzleRevealed;
  if (!data.puzzle) return;
  el('hint').disabled = !active || puzzleSolved || Boolean(puzzleReply || puzzleWrong);
  el('solution').disabled = puzzleRevealed;
  el('retry').hidden = !puzzleWrong;
  el('choices').replaceChildren();
  for (const move of puzzlePending || []) {
    const button = document.createElement('button'); button.textContent = move.san;
    button.onclick = () => { puzzleChoose(move); puzzleFocus(); }; el('choices').append(button);
  }
  if (active) {
    const turn = data.puzzle.side === 'w' ? 'White' : 'Black';
    const checks = puzzleFrame().fen.split(' ')[6]?.match(/^\+([0-3])\+([0-3])$/);
    el('caption').textContent = (puzzleStatus ? puzzleStatus + ' ' : '')
      + (puzzleSolved ? (data.frames[ply].outcome || 'End of recorded game.') : puzzleWrong ? 'Use Try again to restore the position.' : puzzleReply ? 'Waiting for the recorded reply.' : turn + ' to play. Guess the recorded move.')
      + (checks ? ' Checks White ' + checks[1] + '/3 · Black ' + checks[2] + '/3.' : '');
  }
}
function setupPuzzle() {
  if (!data.puzzle) return;
  puzzleCursor = data.puzzle.side === 'w' ? 'e2' : 'e7';
  el('hint').onclick = () => {
    const move = data.puzzle.turns[ply].find(move => move.uci === data.puzzle.expected[ply]);
    puzzleHint = move.from; puzzleStatus = 'Hint: move the piece on ' + move.from + '.'; draw();
  };
  el('retry').onclick = () => { puzzleWrong = puzzleSelected = puzzlePending = null; puzzleStatus = ''; draw(); puzzleFocus(); };
  el('reset').onclick = puzzleReset;
  el('solution').onclick = () => {
    clearPuzzleReply(); puzzleWrong = puzzleSelected = puzzlePending = null; puzzleRevealed = true;
    el('solution-line').textContent = data.frames.slice(data.puzzle.start + 1).map(frame => frame.label).join(' · '); draw(); el('play').focus();
  };
  puzzleReset();
}
`
