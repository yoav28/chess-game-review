import { useQuery } from '@tanstack/react-query';

import { useSelectGameStore } from '../stores/useSelectGameStore';
import { fetchUserGames } from './fetchUserGames';

export default function useRecentGames() {
  const username = useSelectGameStore(state => state.username);
  const site = useSelectGameStore(state => state.site);

  return useQuery({
    queryKey: ['recentGames', site, username],
    queryFn: ({ signal }) => fetchUserGames(username!, site!, { signal }),
    enabled: !!username && !!site,
    staleTime: 60 * 1000,
    retry: false,
  });
}
