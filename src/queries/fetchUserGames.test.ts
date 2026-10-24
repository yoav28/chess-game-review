import { afterEach, expect, test, vi } from 'vitest';

import { fetchUserGames } from './fetchUserGames';

function response(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('recent Chess.com games cross archive boundaries and sort newest first', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response({ archives: ['https://archive/2026/09', 'https://archive/2026/10'] }))
    .mockResolvedValueOnce(response({ games: [
      { uuid: 'older', rules: 'chess', end_time: 20 },
      { uuid: 'variant', rules: 'chess960', end_time: 40 },
      { uuid: 'newest', rules: 'chess', end_time: 30 },
    ] }))
    .mockResolvedValueOnce(response({ games: [{ uuid: 'previous-month', rules: 'chess', end_time: 10 }] }));

  vi.stubGlobal('fetch', fetchMock);
  const games = await fetchUserGames('Test User', 'chess.com', { limit: 3 });
  expect(games.map(game => 'uuid' in game ? game.uuid : game.id)).toEqual(['newest', 'older', 'previous-month']);
  expect(fetchMock.mock.calls[0][0]).toContain('Test%20User');
  expect(fetchMock.mock.calls[1][0]).toBe('https://archive/2026/10');
});

test('batch game retrieval applies date and count limits', async () => {
  const since = Date.UTC(2026, 9, 20);

  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response({ archives: ['https://archive/2026/09', 'https://archive/2026/10'] }))
    .mockResolvedValueOnce(response({ games: [
      { uuid: 'before', rules: 'chess', end_time: since / 1000 - 1 },
      { uuid: 'match', rules: 'chess', end_time: since / 1000 + 1 },
    ] }));

  vi.stubGlobal('fetch', fetchMock);
  const games = await fetchUserGames('user', 'chess.com', { since, limit: 100 });
  expect(games).toHaveLength(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('lichess uses streamed games and omits an unlimited max', async () => {
  const game = { id: 'game', variant: 'standard', pgn: '1. e4 e5 *', lastMoveAt: 100 };
  const fetchMock = vi.fn().mockResolvedValue(new Response(`${JSON.stringify(game)}\n`));
  vi.stubGlobal('fetch', fetchMock);
  expect(await fetchUserGames('user', 'lichess', { since: 50, limit: Number.POSITIVE_INFINITY })).toEqual([game]);
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.searchParams.get('since')).toBe('50');
  expect(url.searchParams.has('max')).toBe(false);
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
});

test('unknown usernames report a useful error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
  await expect(fetchUserGames('missing', 'chess.com')).rejects.toThrow('Username not found.');
});
