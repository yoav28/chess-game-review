import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useState } from 'react';

import { useBoardStore } from '../../stores/useBoardStore';
import { reviewId } from '../../utils/reviewStorage';

const favoriteKey = 'game-review:favorites:v1';

function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(favoriteKey) ?? '[]');

    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  }
  catch {
    return [];
  }
}

export default function ReviewFavoriteButton() {
  const currentGame = useBoardStore(state => state.currentGame);
  const [favorites, setFavorites] = useState(readFavorites);
  const [error, setError] = useState('');
  const id = reviewId(currentGame.pgn());
  const favorite = favorites.includes(id);

  return (
    <Button
      aria-label={favorite ? 'Remove review from favorites' : 'Favorite review'}
      aria-pressed={favorite}
      className="review-favorite"
      isIconOnly
      onPress={() => {
        const next = favorite ? favorites.filter(entry => entry !== id) : [...favorites, id];

        try {
          localStorage.setItem(favoriteKey, JSON.stringify(next));
          setFavorites(next);
          setError('');
        }
        catch {
          setError('Browser storage could not save this favorite.');
        }
      }}
      radius="sm"
      size="sm"
      title={error || (favorite ? 'Remove review from favorites' : 'Favorite review')}
      variant="light"
    >
      <Icon icon={favorite ? 'material-symbols:favorite-rounded' : 'material-symbols:favorite-outline-rounded'} />
    </Button>
  );
}
