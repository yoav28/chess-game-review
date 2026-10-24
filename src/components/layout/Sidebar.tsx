import { Icon } from '@iconify/react/dist/iconify.js';
import { useState } from 'react';

import { useSelectGameStore } from '../../stores/useSelectGameStore';
import Settings from '../controls/Settings';
import PlayerAvatar from '../PlayerAvatar';

const links = [
  { label: 'Play', icon: 'play-white', path: 'play' },
  { label: 'Puzzles', icon: 'puzzle-piece', path: 'puzzles' },
  { label: 'Learn', icon: 'lessons', path: 'learn' },
  { label: 'Train', icon: 'training', path: 'train' },
  { label: 'Watch', icon: 'binoculars', path: 'watch' },
  { label: 'Community', icon: 'friends', path: 'community' },
  { label: 'Other', icon: 'ellipsis', path: 'other' },
];

export default function Sidebar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const selectedUsername = useSelectGameStore(state => state.username);
  const selectedSite = useSelectGameStore(state => state.site);
  const lastSite = read('game-input') === 'lichess' ? 'lichess' : 'chess.com';
  const site = selectedSite ?? lastSite;
  const username = selectedUsername || read(`${site}-username`);

  const profileUrl = username
    ? site === 'lichess' ? `https://lichess.org/@/${encodeURIComponent(username)}` : `https://www.chess.com/member/${encodeURIComponent(username)}`
    : 'https://www.chess.com/login';

  return (
    <aside className="site-sidebar">
      <a aria-label="Game Review home" className="site-logo" href="/">
        <img alt="Chess.com" height="32" src="/navigation/logo.svg" width="138" />
      </a>
      <nav aria-label="Main navigation" className="site-navigation">
        {links.slice(0, 3).map(({ label, icon, path }) => (
          <a className="site-navigation-link" href={`https://www.chess.com/${path}`} key={path} rel="noreferrer" target="_blank">
            <img alt="" height="24" src={`/navigation/${icon}.svg`} width="24" />
            <span>{label}</span>
          </a>
        ))}
        <button
          aria-controls="site-more-menu"
          aria-expanded={moreOpen}
          className="site-navigation-link site-more-button"
          onClick={() => setMoreOpen(!moreOpen)}
          type="button"
        >
          <Icon icon={moreOpen ? 'material-symbols:expand-less-rounded' : 'material-symbols:expand-more-rounded'} />
          <span>More</span>
        </button>
        {moreOpen && (
          <div id="site-more-menu">
            {links.slice(3).map(({ label, icon, path }) => (
              <a className="site-navigation-link" href={`https://www.chess.com/${path}`} key={path} rel="noreferrer" target="_blank">
                <img alt="" height="24" src={`/navigation/${icon}.svg`} width="24" />
                <span>{label}</span>
              </a>
            ))}
          </div>
        )}
        <a className="site-navigation-link site-free-trial" href="https://www.chess.com/membership" rel="noreferrer" target="_blank">
          <img alt="" height={24} src="/navigation/diamond.svg" width={24} />
          <span>Free Trial</span>
        </a>
      </nav>
      <div className="site-sidebar-bottom">
        <a className="site-search" href="https://www.chess.com/search" rel="noreferrer" target="_blank">
          <Icon icon="material-symbols:search-rounded" />
          <span>Search</span>
        </a>
        <a className="site-profile" href={profileUrl} rel="noreferrer" target="_blank">
          <PlayerAvatar height={24} name={username || ''} site={username ? site : undefined} width={24} />
          <span>{username || 'Profile'}</span>
        </a>
        <div className="site-footer-icons">
          <a aria-label="Friends" href="https://www.chess.com/friends" rel="noreferrer" target="_blank"><Icon icon="material-symbols:group-rounded" /></a>
          <a aria-label="Messages" href="https://www.chess.com/messages" rel="noreferrer" target="_blank"><Icon icon="material-symbols:mail-rounded" /></a>
          <a aria-label="Notifications" href="https://www.chess.com/alerts" rel="noreferrer" target="_blank"><Icon icon="material-symbols:notifications-rounded" /></a>
          <Settings />
        </div>
      </div>
    </aside>
  );
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  }
  catch {
    return null;
  }
}
