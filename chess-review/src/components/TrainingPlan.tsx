import { useId, useState } from 'react'
import type { Color } from 'chess.js'
import { trainingMethod, trainingPlan } from '../lib/training'
import type { GameReview } from '../lib/review'
import './TrainingPlan.css'

export function TrainingPlan({ review, color = 'w', onPractice, onSelect }: {
  review: GameReview
  color?: Color
  onPractice: (ply: number) => void
  onSelect: (ply: number) => void
}) {
  const [selection, setSelection] = useState<{ initial: Color; color: Color }>({ initial: color, color })
  const selected = selection.initial === color ? selection.color : color
  const selectId = useId()
  const exercises = trainingPlan(review, selected)
  return <section className="training-plan" aria-label="Personal training plan">
    <h3>What to work on</h3>
    <label htmlFor={selectId}>Plan for</label>
    <select id={selectId} value={selected} onChange={event => setSelection({ initial: color, color: event.target.value as Color })}>
      <option value="w">White · {review.white}</option>
      <option value="b">Black · {review.black}</option>
    </select>
    {exercises.length ? <ol>
      {exercises.map(exercise => <li key={exercise.ply}>
        <h4>{exercise.title}</h4>
        <p className="training-move">{exercise.moveLabel} · {exercise.phase} · {exercise.lossText}</p>
        <p>{exercise.goal}</p>
        <details><summary>Why this exercise / hint</summary><p>{exercise.evidence}</p><p>{exercise.hint}</p></details>
        <div className="training-actions">
          <button className="secondary" onClick={() => onPractice(exercise.ply)}>Practice position</button>
          <button className="text-button" onClick={() => onSelect(exercise.ply)}>Review move</button>
        </div>
      </li>)}
    </ol> : <p className="training-empty">No eligible errors for {selected === 'w' ? 'White' : 'Black'} in this review. Review another game to find more practice positions.</p>}
    <details className="training-method"><summary>How this plan works</summary><p>{trainingMethod}</p></details>
  </section>
}
