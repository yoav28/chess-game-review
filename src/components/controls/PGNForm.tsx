import { useForm } from 'react-hook-form';

import { useBoardStore } from '../../stores/useBoardStore';
import { useSelectGameStore } from '../../stores/useSelectGameStore';
import { useStageStore } from '../../stores/useStageStore';

import type { SubmitHandler } from 'react-hook-form';

interface Inputs {
  pgn: string;
}

export default function PGNForm() {
  const loadGame = useBoardStore(state => state.loadGame);
  const submitGame = useSelectGameStore(state => state.submitGame);
  const setStage = useStageStore(state => state.setStage);
  const { handleSubmit, register, setError, formState, watch } = useForm<Inputs>({ defaultValues: { pgn: '' } });

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    try {
      loadGame(data.pgn);
      submitGame();
      setStage('loaded');
    }
    catch (error) {
      setError('pgn', { type: 'pgn-parsing', message: (error as Error).message });
    }
  };

  return (
    <form className="import-form" onSubmit={handleSubmit(onSubmit)}>
      <label className="import-label" htmlFor="import-pgn">Load PGN</label>
      <textarea
        aria-describedby={formState.errors.pgn ? 'import-pgn-error' : undefined}
        aria-invalid={Boolean(formState.errors.pgn)}
        className="import-input import-pgn"
        id="import-pgn"
        placeholder="Paste a game in PGN format"
        spellCheck={false}
        {...register('pgn')}
      />
      {formState.errors.pgn && <p className="import-error" id="import-pgn-error" role="alert">{formState.errors.pgn.message}</p>}
      <button className="chess-primary-button" disabled={!watch('pgn').trim()} type="submit">Load Game</button>
    </form>
  );
}
