export const embedPlayerScript = `
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
  const frame = data.frames[ply], ranks = frame.fen.split(' ')[0].split('/'), cells = [];
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
    const cell = document.createElement('div'), piece = cells[original];
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
    el('board').append(cell);
  }
  el('board').setAttribute('aria-label', frame.label + '; ' + (frame.fen.split(' ')[1] === 'w' ? 'White' : 'Black') + ' to move');
  el('caption').textContent = frame.label + ' · ' + ply + '/' + (data.frames.length - 1);
  el('explanation').textContent = frame.explanation;
  el('timeline').value = ply;
  el('previous').disabled = ply === 0;
  el('next').disabled = ply === data.frames.length - 1;
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
draw();
`
