import { ArrowRight, FolderOpen, Settings as SettingsIcon } from "lucide-react";

type AppHeaderProps = { onImport: () => void; onSettings: () => void };

export function AppHeader({ onImport, onSettings }: AppHeaderProps) {
  return (
      <header className="app-header">
        <div className="brand">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M5 5h5v6h12V5h5v13l-4 4v4H9v-4l-4-4zM7 29h18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            open file<span className="brand-period">.</span>
          </span>
          <span className="brand-divider" />
          <span className="product-label">Game review</span>
        </div>
        <div className="header-actions">
          <span className="local-indicator">Analysis on your device</span>
          <button className="secondary" onClick={onImport}>
            <FolderOpen size={16} />
            <span>Load PGN</span>
          </button>
          <button
            className="icon-button"
            onClick={onSettings}
            aria-label="Review settings"
          >
            <SettingsIcon size={19} />
          </button>
        </div>
      </header>
  );
}

export function AppFooter({ onSample }: { onSample: () => void }) {
  return (
      <footer className="app-footer">
        <span>Independent of Chess.com. Games from public archives.</span>
        <button
          className="text-button"
          onClick={onSample}
        >
          Explore the sample game <ArrowRight size={12} />
        </button>
      </footer>
  );
}
