import type { MoveEval } from '../stores/useStockfishOutputStore';

export function parseEngineInfo(message: string): { depth: number; move: MoveEval } | undefined {
  if (!message.startsWith('info ') || /\b(?:lowerbound|upperbound)\b/.test(message))
    return;
  const depth = message.match(/\bdepth (\d+)/)?.[1];
  const score = message.match(/\bscore (cp|mate) (-?\d+)/);
  const line = message.match(/\bpv (.+)$/)?.[1].trim().split(/\s+/);
  if (!depth || !score || !line?.length || !/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(line[0]))
    return;

  return {
    depth: Number(depth),
    move: {
      nodes: Number(message.match(/\bnodes (\d+)/)?.[1] ?? 0),
      multiPv: Number(message.match(/\bmultipv (\d+)/)?.[1] ?? 1),
      pv: line[0],
      line,
      [score[1]]: Number(score[2]),
    },
  };
}
