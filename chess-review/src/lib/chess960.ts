import { ChessopsBoard } from './chessops-board'
import type { GameMove, ParsedGame } from './game'
import { parseVariantPgn } from './variant-pgn'

export interface Chess960Move extends GameMove {}
export interface Chess960ParsedGame extends ParsedGame { variant: 'chess960' }
export class Chess960Board extends ChessopsBoard {
  constructor(fen: string) { super(fen, 'chess960') }
}


export function parseChess960Pgn(pgn: string): Chess960ParsedGame {
  return parseVariantPgn(pgn, 'chess960') as Chess960ParsedGame
}
