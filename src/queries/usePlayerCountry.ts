import usePlayerProfile from './usePlayerProfile';

import type { Site } from '../stores/useSelectGameStore';

export default function usePlayerCountry(site: Site | undefined, username: string | undefined) {
  const query = usePlayerProfile(site, username);

  return { ...query, data: query.data?.country ?? null };
}
