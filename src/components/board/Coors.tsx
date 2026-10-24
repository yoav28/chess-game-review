import { useBoardStore } from '../../stores/useBoardStore';
import { useSettingsStore } from '../../stores/useSettingsStore';

const rankPositions = [3.5, 15.75, 28.25, 40.75, 53.25, 65.75, 78.25, 90.75];
const filePositions = [10, 22.5, 35, 47.5, 60, 72.5, 85, 97.5];
const files = 'abcdefgh';

const colors = {
  green: { light: '#ebecd0', dark: '#739552' },
  brown: { light: '#edd6b0', dark: '#b88762' },
  ice: { light: '#c5d5dc', dark: '#7a9db2' },
};

export default function Coors() {
  const isFlipped = useBoardStore(state => state.isFlipped);
  const board = useSettingsStore(state => state.settings.board);
  const palette = colors[board];

  return (
    <svg
      aria-hidden="true"
      className="board-coordinates"
      fontSize={2.8}
      fontWeight={600}
      id="coors"
      viewBox="0 0 100 100"
    >
      {rankPositions.map((y, index) => (
        <text fill={index % 2 === 0 ? palette.dark : palette.light} key={`rank-${index}`} x={0.75} y={y}>
          {isFlipped ? index + 1 : 8 - index}
        </text>
      ))}
      {filePositions.map((x, index) => (
        <text fill={index % 2 === 0 ? palette.light : palette.dark} key={`file-${index}`} x={x} y={99}>
          {files[isFlipped ? 7 - index : index]}
        </text>
      ))}
    </svg>
  );
}
