import { useState } from 'react';

import usePlayerProfile from '../queries/usePlayerProfile';

import type { Site } from '../stores/useSelectGameStore';
import type { Color } from 'chess.js';
import type { ImgHTMLAttributes } from 'react';

interface PlayerAvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  name: string;
  site?: Site;
  color?: Color;
}

export default function PlayerAvatar({ name, site, color = 'w', alt = '', width = 40, height = 40, style, ...props }: PlayerAvatarProps) {
  const { data: profile } = usePlayerProfile(site, name);
  const [failedSource, setFailedSource] = useState<string>();
  const avatar = profile?.avatar;
  const fallback = site === 'chess.com' && profile && !avatar ? '/players/default.gif' : `/players/${color === 'w' ? 'white' : 'black'}.png`;

  return (
    <img
      {...props}
      alt={alt}
      crossOrigin="anonymous"
      height={height}
      onError={() => {
        if (avatar)
          setFailedSource(avatar);
      }}
      referrerPolicy="no-referrer"
      src={avatar && failedSource !== avatar ? avatar : fallback}
      style={{ objectFit: 'cover', ...style }}
      width={width}
    />
  );
}
