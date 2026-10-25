import { Bell, ChevronDown, ChevronUp, FolderOpen, Mail, Search, Settings as SettingsIcon, Users } from "lucide-react";
import { useState } from "react";

type AppHeaderProps = { onImport: () => void; onLibrary: () => void; onSettings: () => void; username: string };

const navigation = [
  { label: "Play", path: "play", icon: "play-white" },
  { label: "Puzzles", path: "puzzles", icon: "puzzle-piece" },
  { label: "Learn", path: "learn", icon: "lessons" },
  { label: "Train", path: "train", icon: "training" },
  { label: "Watch", path: "watch", icon: "binoculars" },
  { label: "Community", path: "community", icon: "friends" },
  { label: "Other", path: "other", icon: "ellipsis" },
];

export function AppHeader({ onImport, onLibrary, onSettings, username }: AppHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const profileUrl = username
    ? `https://www.chess.com/member/${encodeURIComponent(username)}`
    : "https://www.chess.com/login";

  return (
    <aside className="app-header site-sidebar">
      <a aria-label="Game Review home" className="site-logo" href="/">
        <img alt="Chess.com" src="/navigation/logo.svg" />
      </a>
      <nav aria-label="Main navigation" className="app-navigation site-navigation">
        {navigation.slice(0, 3).map(({ label, path, icon }) => (
          <a className="site-navigation-link" href={`https://www.chess.com/${path}`} key={path} rel="noreferrer" target="_blank">
            <img alt="" src={`/navigation/${icon}.svg`} />
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
          {moreOpen ? <ChevronUp /> : <ChevronDown />}
          <span>More</span>
        </button>
        {moreOpen && (
          <div id="site-more-menu">
            {navigation.slice(3).map(({ label, path, icon }) => (
              <a className="site-navigation-link" href={`https://www.chess.com/${path}`} key={path} rel="noreferrer" target="_blank">
                <img alt="" src={`/navigation/${icon}.svg`} />
                <span>{label}</span>
              </a>
            ))}
          </div>
        )}
        <a className="site-navigation-link site-free-trial" href="https://www.chess.com/membership" rel="noreferrer" target="_blank">
          <img alt="" src="/navigation/diamond.svg" />
          <span>Free Trial</span>
        </a>
      </nav>
      <div className="site-sidebar-bottom">
        <button aria-label="Search games" className="site-search" onClick={onLibrary}>
          <Search />
          <span>Search</span>
        </button>
        <a className="site-profile" href={profileUrl} rel="noreferrer" target="_blank">
          <img src="/players/white.png" alt="" />
          <span>{username || "Profile"}</span>
        </a>
        <div className="site-footer-icons">
          <a aria-label="Friends" href="https://www.chess.com/friends" rel="noreferrer" target="_blank"><Users /></a>
          <a aria-label="Messages" href="https://www.chess.com/messages" rel="noreferrer" target="_blank"><Mail /></a>
          <a aria-label="Notifications" href="https://www.chess.com/alerts" rel="noreferrer" target="_blank"><Bell /></a>
          <button aria-label="Load PGN" onClick={onImport}><FolderOpen /></button>
          <button aria-label="Review settings" onClick={onSettings}><SettingsIcon /></button>
        </div>
      </div>
    </aside>
  );
}
