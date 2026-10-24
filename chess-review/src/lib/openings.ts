export type Opening = { name: string; eco: string }

const lines = [
  ['King’s Pawn Game', 'B00', 'e4'],
  ['Open Game', 'C20', 'e4 e5'],
  ['Italian Game', 'C50', 'e4 e5 Nf3 Nc6 Bc4'],
  ['Philidor Defense', 'C41', 'e4 e5 Nf3 d6'],
  ['Giuoco Piano', 'C50', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6'],
  ['Ruy Lopez', 'C60', 'e4 e5 Nf3 Nc6 Bb5'],
  ['Ruy Lopez', 'C60', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'],
  ['Scotch Game', 'C45', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4'],
  ['Sicilian Defense', 'B20', 'e4 c5'],
  ['Sicilian Najdorf', 'B90', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'],
  ['French Defense', 'C00', 'e4 e6 d4 d5'],
  ['French Winawer', 'C15', 'e4 e6 d4 d5 Nc3 Bb4'],
  ['Caro-Kann Defense', 'B10', 'e4 c6'],
  ['Caro-Kann Defense', 'B10', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4'],
  ['Scandinavian Defense', 'B01', 'e4 d5'],
  ['Scandinavian Defense', 'B01', 'e4 d5 exd5 Qxd5 Nc3 Qa5'],
  ['Queen’s Pawn Game', 'A40', 'd4'],
  ['Queen’s Gambit', 'D06', 'd4 d5 c4'],
  ['Queen’s Gambit Declined', 'D30', 'd4 d5 c4 e6'],
  ['Queen’s Gambit Declined', 'D30', 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7'],
  ['Queen’s Gambit Accepted', 'D20', 'd4 d5 c4 dxc4 Nf3 Nf6 e3'],
  ['King’s Indian Defense', 'E60', 'd4 Nf6 c4 g6'],
  ['King’s Indian Defense', 'E60', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O'],
  ['London System', 'D02', 'd4 d5 Bf4'],
  ['London System', 'D02', 'd4 d5 Bf4 Nf6 e3 e6 Nf3'],
  ['English Opening', 'A10', 'c4'],
  ['English Opening', 'A20', 'c4 e5 Nc3 Nf6'],
  ['Zukertort Opening', 'A04', 'Nf3'],
  ['Réti Opening', 'A04', 'Nf3 d5 g3'],
].map(([name, eco, moves]) => ({ name, eco, moves: moves.split(' ') }))

export function openingForMoves(moves: string[]): { opening: Opening | null; book: boolean } {
  if (!moves.length) return { opening: null, book: false }
  const completed = lines.filter(line => line.moves.length <= moves.length && line.moves.every((move, index) => move === moves[index]))
    .sort((a, b) => b.moves.length - a.moves.length)[0]
  const book = lines.some(line => moves.length <= line.moves.length && moves.every((move, index) => move === line.moves[index]))
  return { opening: completed ? { name: completed.name, eco: completed.eco } : null, book }
}
