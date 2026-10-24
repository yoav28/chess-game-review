import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  Volume2,
  X,
} from "lucide-react";
import type { GameReview, MoveReview } from "../lib/review";

export function CoachControls({
  review,
  move,
  onSelect,
  filterColor = 'all',
  text,
}: {
  review: GameReview;
  move?: MoveReview;
  onSelect: (ply: number) => void;
  filterColor?: 'all' | 'w' | 'b';
  text?: string;
}) {
  const [guided, setGuided] = useState(false);
  const [pace, setPace] = useState("highlights");
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const relevant = review.moves.filter(candidate => filterColor === 'all' || candidate.color === filterColor);
  const highlights = [...new Set([
    relevant[0]?.ply,
    ...review.keyMoments.filter(ply => relevant.some(candidate => candidate.ply === ply)),
    ...relevant.filter(candidate => ['brilliant', 'great'].includes(candidate.classification)).map(candidate => candidate.ply),
    ...relevant.filter(candidate => candidate.classification === 'book').slice(-1).map(candidate => candidate.ply),
    relevant.at(-1)?.ply,
  ])].filter((ply): ply is number => ply !== undefined && ply > 0).sort((a, b) => a - b);
  const stops = pace === 'all' ? relevant.map(candidate => candidate.ply) : highlights;
  const next = stops.find(ply => ply > (move?.ply ?? 0));
  const previous = [...stops].reverse().find(ply => ply < (move?.ply ?? 1));
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () =>
      setVoices(
        window.speechSynthesis
          .getVoices()
          .filter((voice) => voice.localService && voice.lang.startsWith("en")),
      );
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", update);
      window.speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [move?.ply]);
  function readMove() {
    if (!move || !voices.length) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const voice =
      voices.find((candidate) => candidate.name === voiceName) ??
      voices.find((candidate) => candidate.lang.startsWith("en")) ??
      voices[0];
    const utterance = new SpeechSynthesisUtterance(text ?? move.explanation);
    utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }
  return (
    <div className="coach-controls">
      {guided ? (
        <>
          <div className="report-caption">
            <span>
              Guided review · {move?.ply ?? 0} / {review.moves.length}
            </span>
            <button
              className="icon-button"
              onClick={() => setGuided(false)}
              aria-label="End guided review"
            >
              <X size={14} />
            </button>
          </div>
          <div className="guided-navigation">
            <button
              className="secondary"
              onClick={() => previous && onSelect(previous)}
              disabled={!previous}
            >
              <ChevronLeft size={15} /> Back
            </button>
            <button
              className="primary"
              onClick={() => {
                if (!next) setGuided(false);
                else onSelect(next);
              }}
            >
              {!next ? "Finish" : pace === 'all' ? "Next move" : "Next highlight"}
              <ChevronRight size={15} />
            </button>
          </div>
        </>
      ) : (
        <button
          className="secondary full-width"
          onClick={() => {
            setGuided(true);
            onSelect(stops[0] ?? 1);
          }}
          disabled={!review.moves.length}
        >
          <Play size={13} /> Start guided review
        </button>
      )}
      <select className="guided-pace" aria-label="Guided review pace" value={pace} onChange={event => setPace(event.target.value)}><option value="highlights">Highlights</option><option value="all">Every move</option></select>
      {move && voices.length > 0 && (
        <div className="voice-controls">
          <button className="text-button" onClick={readMove}>
            {speaking ? <Square size={12} /> : <Volume2 size={14} />}
            {speaking ? "Stop reading" : "Read explanation"}
          </button>
          <select
            aria-label="Coach voice"
            value={voiceName}
            onChange={(event) => setVoiceName(event.target.value)}
          >
            <option value="">Default local voice</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.name}>
                {voice.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
