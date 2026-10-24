import { useForm } from 'react-hook-form';

import useLocalStorage from '../../hooks/useLocalStorage';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';

import type { Site } from '../../stores/useSelectGameStore';
import type { SubmitHandler } from 'react-hook-form';

interface Inputs {
  username: string;
}

export default function ChessSiteForm({ site }: { site: Site }) {
  const submitUsername = useSelectGameStore(state => state.submitUsername);
  const setStage = useStageStore(state => state.setStage);
  const { item: lastUsername, set } = useLocalStorage(`${site}-username`);
  const { handleSubmit, register, watch } = useForm<Inputs>({ defaultValues: { username: lastUsername || '' } });

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    submitUsername(data.username.trim(), site);
    set(`${site}-username`, data.username);
    setStage('select-game');
  };

  return (
    <form className="import-form" onSubmit={handleSubmit(onSubmit)}>
      <label className="import-label" htmlFor="import-username">
        {site === 'chess.com' ? 'Chess.com' : 'Lichess'}
        {' '}
        username
      </label>
      <input
        autoCapitalize="none"
        autoComplete="username"
        className="import-input"
        id="import-username"
        placeholder="Enter username"
        spellCheck={false}
        {...register('username')}
      />
      <button className="chess-primary-button" disabled={!watch('username').trim()} type="submit">Find Games</button>
    </form>
  );
}
