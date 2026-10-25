import { Activity, ArrowRight, Bookmark, ClipboardCheck, Dumbbell, FolderOpen, Library, Settings as SettingsIcon } from "lucide-react";
import type { WorkspaceTab } from "./WorkspaceTabs";

type AppHeaderProps = {
  activeTab: WorkspaceTab;
  libraryOpen: boolean;
  onImport: () => void;
  onLibrary: () => void;
  onSettings: () => void;
  onTabChange: (tab: WorkspaceTab) => void;
};

export function AppHeader({ activeTab, libraryOpen, onImport, onLibrary, onSettings, onTabChange }: AppHeaderProps) {
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
        <nav className="app-navigation" aria-label="Workspace">
          <button aria-label="Games" className={libraryOpen ? "active" : ""} aria-current={libraryOpen ? "page" : undefined} onClick={onLibrary}>
            <Library size={21} /><span>Games</span>
          </button>
          <button aria-label="Review" className={activeTab === "review" ? "active" : ""} aria-current={activeTab === "review" ? "page" : undefined} onClick={() => onTabChange("review")}>
            <ClipboardCheck size={21} /><span>Review</span>
          </button>
          <button aria-label="Analysis" className={activeTab === "analysis" ? "active" : ""} aria-current={activeTab === "analysis" ? "page" : undefined} onClick={() => onTabChange("analysis")}>
            <Activity size={21} /><span>Analysis</span>
          </button>
          <button aria-label="Practice" className={activeTab === "practice" ? "active" : ""} aria-current={activeTab === "practice" ? "page" : undefined} onClick={() => onTabChange("practice")}>
            <Dumbbell size={21} /><span>Practice</span>
          </button>
          <button aria-label="Saved" className={activeTab === "history" ? "active" : ""} aria-current={activeTab === "history" ? "page" : undefined} onClick={() => onTabChange("history")}>
            <Bookmark size={21} /><span>Saved</span>
          </button>
        </nav>
        <div className="header-actions">
          <button aria-label="Load PGN" className="secondary" onClick={onImport}>
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
