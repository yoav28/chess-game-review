import { useQuery } from '@tanstack/react-query';

import { loadStockfish } from '../services/analysis';

export default function useStockfish() {
  return useQuery({
    queryKey: ['stockfish'],
    queryFn: loadStockfish,
    staleTime: 0,
    gcTime: 0,
    retry: 0,
  });
}
