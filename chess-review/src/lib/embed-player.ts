import { embedPuzzlePlayerScript } from './embed-puzzle-player'

export const embedPlayerScript = String.raw`
const data = JSON.parse(document.getElementById('review-data').textContent);
let ply = data.selected, orientation = data.orientation, timer = null;
const el = id => document.getElementById(id);
el('players').textContent = data.white + ' vs ' + data.black + ' · ' + data.result;
const score = value => value === null ? '—' : value.toFixed(1);
el('scores').textContent = 'White ' + score(data.whiteAccuracy) + ' · Black ' + score(data.blackAccuracy) + ' · ' + data.model;
el('coordinates').checked = data.coordinates;
el('provenance').textContent = data.imported
  ? 'Open File · imported report; scores and explanations supplied in a file. No engine runs in this embed.'
  : 'Open File · independent recorded review. No engine runs in this embed.';
function pause() {
  clearInterval(timer);
  timer = null;
  el('play').textContent = 'Play';
}
function draw() {
  const frame = puzzleFrame(), ranks = frame.fen.split(' ')[0].split('/'), cells = [];
  const drawPocket = (id, color) => {
    const container = el(id), pieces = frame.pockets && frame.pockets[color];
    container.setAttribute('role', 'group'); container.setAttribute('aria-label', color === 'w' ? 'White pocket' : 'Black pocket');
    container.replaceChildren();
    if (!pieces || !Object.values(pieces).some(count => count > 0)) return;
    const label = document.createElement('small'); label.textContent = color === 'w' ? 'White pocket' : 'Black pocket'; container.append(label);
    for (const type of ['p','n','b','r','q']) {
      const count = pieces[type]; if (!count) continue;
      const active = puzzleActive() && color === data.puzzle.side;
      const item = document.createElement(active ? 'button' : 'div'), image = document.createElement('img'), total = document.createElement('span');
      item.className = 'pocket-piece'; image.alt = ''; image.src = data.artwork[color + type]; total.textContent = String(count);
      if (active) {
        item.type = 'button'; item.setAttribute('aria-label', 'Drop ' + (color === 'w' ? 'white ' : 'black ') + ({ p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen' }[type]) + ', ' + count + ' available');
        item.setAttribute('aria-pressed', String(puzzleDrop === type)); item.disabled = Boolean(puzzleSolved || puzzleReply || puzzleWrong);
        item.onclick = () => puzzleSelectDrop(type);
      }
      if (puzzleDrop === type && active) item.classList.add('selected');
      item.append(image, total); container.append(item);
    }
  };
  const topColor = orientation === 'w' ? 'b' : 'w';
  drawPocket('pocket-top', topColor); drawPocket('pocket-bottom', topColor === 'w' ? 'b' : 'w');
  for (const rank of ranks) {
    for (const character of rank) {
      if (/[1-8]/.test(character)) cells.push(...Array(Number(character)).fill(''));
      else cells.push(character);
    }
  }
  el('board').replaceChildren();
  for (let index = 0; index < 64; index++) {
    const original = orientation === 'w' ? index : 63 - index;
    const file = original % 8, rank = 8 - Math.floor(original / 8), square = 'abcdefgh'[file] + rank;
    const cell = document.createElement(puzzleActive() ? 'button' : 'div'), piece = cells[original];
    if ((file + rank) % 2 === 0) cell.classList.add('dark');
    if (frame.lastMove && (frame.lastMove.from === square || frame.lastMove.to === square)) cell.classList.add('last');
    if (piece) {
      const image = document.createElement('img');
      const white = piece === piece.toUpperCase();
      image.alt = square + ' ' + (white ? 'White ' : 'Black ')
        + ({ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[piece.toLowerCase()]);
      image.src = data.artwork[(white ? 'w' : 'b') + piece.toLowerCase()];
      cell.append(image);
    }
    if (el('coordinates').checked && (index % 8 === 0 || index >= 56)) {
      const label = document.createElement('small');
      label.textContent = (index % 8 === 0 ? rank : '') + (index >= 56 ? 'abcdefgh'[file] : '');
      cell.append(label);
    }
    puzzleCell(cell, square, piece, index);
    el('board').append(cell);
  }
  el('board').setAttribute('aria-label', frame.outcome || frame.label + '; ' + (frame.fen.split(' ')[1] === 'w' ? 'White' : 'Black') + ' to move');
  const checks = frame.fen.split(' ')[6]?.match(/^\+([0-3])\+([0-3])$/);
  el('caption').textContent = frame.label + ' · ' + ply + '/' + (data.frames.length - 1)
    + (checks ? ' · Checks White ' + checks[1] + '/3 · Black ' + checks[2] + '/3' : '')
    + (frame.outcome ? ' · ' + frame.outcome : '');
  el('explanation').textContent = frame.explanation;
  el('timeline').value = ply;
  el('previous').disabled = ply === 0;
  el('next').disabled = ply === data.frames.length - 1;
  drawPuzzle();
}
el('previous').onclick = () => { pause(); ply = Math.max(0, ply - 1); draw(); };
el('next').onclick = () => { pause(); ply = Math.min(data.frames.length - 1, ply + 1); draw(); };
el('timeline').oninput = () => { pause(); ply = Number(el('timeline').value); draw(); };
el('flip').onclick = () => { orientation = orientation === 'w' ? 'b' : 'w'; draw(); };
el('coordinates').onchange = draw;
el('play').onclick = () => {
  if (timer) { pause(); return; }
  if (ply === data.frames.length - 1) ply = 0;
  el('play').textContent = 'Pause';
  draw();
  timer = setInterval(() => {
    ply++;
    draw();
    if (ply === data.frames.length - 1) pause();
  }, 800);
};
${embedPuzzlePlayerScript}
setupPuzzle();
draw();
`
