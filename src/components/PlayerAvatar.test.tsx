import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import usePlayerCountry from '../queries/usePlayerCountry';
import PlayerAvatar from './PlayerAvatar';

function Country() {
  const { data } = usePlayerCountry('chess.com', 'PLAYER');

  return <span>{data}</span>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('shares the public profile request between avatar and country displays', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ avatar: 'https://example.com/avatar.jpg', country: 'SE' })));
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient();

  render(
    <QueryClientProvider client={client}>
      <PlayerAvatar alt="Player" name="player" site="chess.com" />
      <Country />
    </QueryClientProvider>,
  );

  expect(screen.getByRole('img', { name: 'Player' })).toHaveAttribute('src', '/players/white.png');
  await waitFor(() => expect(screen.getByRole('img', { name: 'Player' })).toHaveAttribute('src', 'https://example.com/avatar.jpg'));
  expect(screen.getByText('SE')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.error(screen.getByRole('img', { name: 'Player' }));
  expect(screen.getByRole('img', { name: 'Player' })).toHaveAttribute('src', '/players/white.png');
  client.clear();
});

test('uses the matching fallback for players without public avatars', () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><PlayerAvatar alt="Black player" color="b" name="Black" /></QueryClientProvider>);
  expect(screen.getByRole('img', { name: 'Black player' })).toHaveAttribute('src', '/players/black.png');
  expect(fetchMock).not.toHaveBeenCalled();
  client.clear();
});
