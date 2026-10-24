import { afterEach, expect, test, vi } from 'vitest';

import { fetchPlayerProfile } from './usePlayerProfile';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('reads Chess.com public avatars and country URLs', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ avatar: 'https://images.chesscomfiles.com/avatar.jpg', country: 'https://api.chess.com/pub/country/SE' })));
  vi.stubGlobal('fetch', fetchMock);
  expect(await fetchPlayerProfile('chess.com', 'Test User')).toEqual({ avatar: 'https://images.chesscomfiles.com/avatar.jpg', country: 'https://api.chess.com/pub/country/SE' });
  expect(fetchMock.mock.calls[0][0]).toBe('https://api.chess.com/pub/player/Test%20User');
});

test('reads Lichess flags without expecting an avatar', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ profile: { flag: 'FR' } }))));
  expect(await fetchPlayerProfile('lichess', 'player')).toEqual({ avatar: null, country: 'FR' });
});

test('keeps missing or unavailable profiles safe for fallback display', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response('', { status: 404 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ avatar: 'invalid', country: 123 })));

  vi.stubGlobal('fetch', fetchMock);
  expect(await fetchPlayerProfile('chess.com', 'missing')).toBeNull();
  expect(await fetchPlayerProfile('chess.com', 'empty')).toEqual({ avatar: null, country: null });
});
