import { Icon } from '@iconify/react/dist/iconify.js';

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
  return (
    <aside className="site-sidebar">
      <a aria-label="Game Review home" className="site-logo" href="/">
        <img alt="Chess.com" height="32" src="/navigation/logo.svg" width="138" />
      </a>
      <nav aria-label="Main navigation" className="site-navigation">
        {links.map(({ label, icon, path }) => (
          <a className="site-navigation-link" href={`https://www.chess.com/${path}`} key={path} rel="noreferrer" target="_blank">
            <img alt="" height="24" src={`/navigation/${icon}.svg`} width="24" />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="site-sidebar-bottom">
        <a className="site-search" href="https://www.chess.com/search" rel="noreferrer" target="_blank">
          <Icon icon="material-symbols:search-rounded" />
          <span>Search</span>
        </a>
        <a className="site-signup" href="https://www.chess.com/register" rel="noreferrer" target="_blank">Sign Up</a>
        <a className="site-login" href="https://www.chess.com/login" rel="noreferrer" target="_blank">Log In</a>
        <a className="site-support" href="https://support.chess.com" rel="noreferrer" target="_blank">
          <Icon icon="material-symbols:help-center-rounded" />
          <span>Help &amp; Support</span>
        </a>
        <span className="site-language">
          <Icon icon="material-symbols:translate" />
          <span>English</span>
        </span>
      </div>
    </aside>
  );
}
