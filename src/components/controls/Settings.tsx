import { Button, Popover, PopoverContent, PopoverTrigger } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useState } from 'react';

import { useSettingsStore } from '../../stores/useSettingsStore';
import capitalize from '../../utils/capitalize';
import AnalysisSettings from './AnalysisSettings';

import type { Board, Pieces } from '../../stores/useSettingsStore';

import '../../styles/imports.css';

export default function Settings() {
  const [isOpen, setIsOpen] = useState(false);
  const { showRatings, pieces, board } = useSettingsStore(state => state.settings);
  const toggleShowRatings = useSettingsStore(state => state.toggleShowRatings);
  const choosePieces = useSettingsStore(state => state.choosePieces);
  const chooseBoard = useSettingsStore(state => state.chooseBoard);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="top-end">
      <PopoverTrigger>
        <Button aria-label="Settings" className="ml-auto text-2xl" isIconOnly radius="sm" size="sm" variant="light">
          <Icon icon="material-symbols:settings" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="chess-settings">
        <div className="chess-settings-body">
          <h2 className="chess-settings-heading">Settings</h2>
          <label className="chess-setting-switch">
            Show ratings
            <input checked={showRatings} onChange={toggleShowRatings} type="checkbox" />
          </label>
          <label className="chess-setting-field">
            <span>Pieces</span>
            <select onChange={event => choosePieces(event.target.value as Pieces)} value={pieces}>
              {['neo', 'classic', 'ocean'].map(pieces => <option key={pieces} value={pieces}>{capitalize(pieces)}</option>)}
            </select>
          </label>
          <label className="chess-setting-field">
            <span>Board</span>
            <select onChange={event => chooseBoard(event.target.value as Board)} value={board}>
              {['green', 'brown', 'ice'].map(board => <option key={board} value={board}>{capitalize(board)}</option>)}
            </select>
          </label>
          <AnalysisSettings />
        </div>
      </PopoverContent>
    </Popover>
  );
}
