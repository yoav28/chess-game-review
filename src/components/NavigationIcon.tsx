import '../styles/navigation-icon.css';

type NavigationGlyph = 'analysis' | 'games' | 'explore' | 'engine' | 'interface' | 'board' | 'first' | 'previous' | 'next' | 'last';

export default function NavigationIcon({ name }: { name: NavigationGlyph }) {
  const source = `url("/navigation/${name}.svg")`;

  return <span aria-hidden="true" className="navigation-icon" style={{ maskImage: source, WebkitMaskImage: source }} />;
}
