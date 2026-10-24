import { useQuery } from '@tanstack/react-query';

import type { Site } from '../stores/useSelectGameStore';

export default function usePlayerCountry(site: Site | undefined, username: string | undefined) {
  return useQuery({
    queryKey: ['playerCountry', site, username],
    queryFn: async ({ signal }) => {
      const response = await fetch(site === 'chess.com'
        ? `https://api.chess.com/pub/player/${encodeURIComponent(username!)}`
        : `https://lichess.org/api/user/${encodeURIComponent(username!)}`, { signal });

      if (!response.ok)
        return null;
      const profile = await response.json();

      return (site === 'chess.com' ? profile.country : profile.profile?.flag || profile.profile?.country) as string | null;
    },
    enabled: !!site && !!username && !username.startsWith('lichess AI'),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}
