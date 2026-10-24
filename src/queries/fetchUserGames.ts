import readStream from '../utils/nd-json';

import type { Site } from '../stores/useSelectGameStore';
import type { ChessComGame, LichessGame } from './useMonthlyArchives';

interface GameOptions {
  since?: number;
  limit?: number;
  signal?: AbortSignal;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(response.status === 404 ? 'Username not found.' : `Could not fetch games (${response.status}). Please try again.`);

  return response.json();
}

export async function fetchUserGames(username: string, site: Site, { since, limit = 100, signal }: GameOptions = {}): Promise<(ChessComGame | LichessGame)[]> {
  const encodedUsername = encodeURIComponent(username.trim());

  if (site === 'chess.com') {
    const { archives } = await fetchJson<{ archives: string[] }>(`https://api.chess.com/pub/player/${encodedUsername}/games/archives`, signal);
    const games: ChessComGame[] = [];

    for (const archive of [...archives].sort().reverse()) {
      const match = archive.match(/\/(\d{4})\/(\d{2})$/);
      if (since && match && Date.UTC(Number(match[1]), Number(match[2]), 1) <= since)
        break;
      const response = await fetchJson<{ games: ChessComGame[] }>(archive, signal);
      games.push(...response.games.filter(game => game.rules === 'chess' && (!since || game.end_time * 1000 >= since)));
      games.sort((a, b) => b.end_time - a.end_time);
      if (games.length >= limit)
        break;
    }

    return games.slice(0, limit);
  }

  const params = new URLSearchParams({ pgnInJson: 'true', clocks: 'true', literate: 'true', sort: 'dateDesc', ongoing: 'false', perfType: 'ultraBullet,bullet,blitz,rapid,classical,correspondence' });
  if (since)
    params.set('since', String(since));
  if (Number.isFinite(limit))
    params.set('max', String(limit));
  const headers: Record<string, string> = { Accept: 'application/x-ndjson' };
  if (import.meta.env.VITE_LICHESS_TOKEN)
    headers.Authorization = `Bearer ${import.meta.env.VITE_LICHESS_TOKEN}`;
  const response = await fetch(`https://lichess.org/api/games/user/${encodedUsername}?${params}`, { headers, signal });
  if (!response.ok)
    throw new Error(response.status === 404 ? 'Username not found.' : `Could not fetch games (${response.status}). Please try again.`);
  const games: LichessGame[] = [];

  await readStream((game: LichessGame) => {
    if (game.variant === 'standard' && game.pgn)
      games.push(game);
  })(response);

  return games.sort((a, b) => b.lastMoveAt - a.lastMoveAt).slice(0, limit);
}
