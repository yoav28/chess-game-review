import { Button, Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useState } from 'react';

import { useSettingsStore } from '../../stores/useSettingsStore';
import capitalize from '../../utils/capitalize';
import NavigationIcon from '../NavigationIcon';
import AnalysisSettings from './AnalysisSettings';

import type { Board, Pieces } from '../../stores/useSettingsStore';
import type { KeyboardEvent } from 'react';

import '../../styles/imports.css';

const tabs = ['Engine', 'Interface', 'Board'] as const;
type SettingsTab = typeof tabs[number];

export default function Settings() {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('Engine');
  const { showRatings, pieces, board, autoplayInterval } = useSettingsStore(state => state.settings);
  const toggleShowRatings = useSettingsStore(state => state.toggleShowRatings);
  const choosePieces = useSettingsStore(state => state.choosePieces);
  const chooseBoard = useSettingsStore(state => state.chooseBoard);
  const chooseAutoplayInterval = useSettingsStore(state => state.chooseAutoplayInterval);

  function changeTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight'
      ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft'
        ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined;

    if (next === undefined)
      return;

    event.preventDefault();
    setTab(tabs[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next].focus();
  }

  return (
    <>
      <Button aria-label="Settings" className="ml-auto text-2xl" isIconOnly onPress={() => setIsOpen(true)} radius="sm" size="sm" variant="light">
        <Icon icon="material-symbols:settings" />
      </Button>
      <Modal
        classNames={{ base: 'chess-settings-dialog', wrapper: 'chess-settings-overlay', backdrop: 'chess-settings-backdrop', closeButton: 'chess-settings-close' }}
        disableAnimation
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        placement="top"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="chess-settings-header">Settings</ModalHeader>
          <div aria-label="Settings categories" className="chess-settings-tabs" role="tablist">
            {tabs.map((name, index) => (
              <button
                aria-controls={`settings-panel-${name}`}
                aria-selected={tab === name}
                id={`settings-tab-${name}`}
                key={name}
                onClick={() => setTab(name)}
                onKeyDown={event => changeTab(event, index)}
                role="tab"
                tabIndex={tab === name ? 0 : -1}
                type="button"
              >
                <NavigationIcon name={name === 'Engine' ? 'engine' : name === 'Interface' ? 'interface' : 'board'} />
                {name}
              </button>
            ))}
          </div>
          <ModalBody
            aria-labelledby={`settings-tab-${tab}`}
            className="chess-settings-panel"
            id={`settings-panel-${tab}`}
            role="tabpanel"
          >
            <h3>{tab === 'Engine' ? 'Analysis' : tab === 'Board' ? 'Board and Pieces' : 'Interface'}</h3>
            {tab === 'Engine' && <AnalysisSettings />}
            {tab === 'Interface' && (
              <>
                <label className="chess-settings-toggle-row">
                  <span>Show Ratings</span>
                  <input checked={showRatings} onChange={toggleShowRatings} type="checkbox" />
                </label>
                <label className="chess-setting-field">
                  <span>Playback Interval</span>
                  <select onChange={event => chooseAutoplayInterval(Number(event.target.value))} value={autoplayInterval}>
                    {[0.5, 1, 2, 3, 5].map(interval => <option key={interval} value={interval}>{`${interval} ${interval === 1 ? 'second' : 'seconds'}`}</option>)}
                  </select>
                </label>
              </>
            )}
            {tab === 'Board' && (
              <>
                <label className="chess-setting-field">
                  <span>Board Theme</span>
                  <select onChange={event => chooseBoard(event.target.value as Board)} value={board}>
                    {['green', 'brown', 'ice'].map(board => <option key={board} value={board}>{capitalize(board)}</option>)}
                  </select>
                </label>
                <label className="chess-setting-field">
                  <span>Pieces</span>
                  <select onChange={event => choosePieces(event.target.value as Pieces)} value={pieces}>
                    {['neo', 'classic', 'ocean'].map(pieces => <option key={pieces} value={pieces}>{capitalize(pieces)}</option>)}
                  </select>
                </label>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
