import { TUTORIAL_STEPS } from '../content/tutorials';
import { useCircuitStore } from '../store/circuitStore';

interface TutorialPanelProps {
  onClose: () => void;
}

export function TutorialPanel({ onClose }: TutorialPanelProps) {
  const tutorialStep = useCircuitStore(s => s.tutorialStep);
  const setStep      = useCircuitStore(s => s.setTutorialStep);
  const loadExample  = useCircuitStore(s => s.loadExample);

  const step = TUTORIAL_STEPS[tutorialStep];
  const isFirst = tutorialStep === 0;
  const isLast  = tutorialStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (!isLast) setStep(tutorialStep + 1);
  };
  const handlePrev = () => {
    if (!isFirst) setStep(tutorialStep - 1);
  };
  const handleLoadExample = () => {
    if (step.exampleId) loadExample(step.exampleId);
  };

  return (
    <div className="w-72 bg-slate-900/95 border border-slate-700 rounded-lg shadow-2xl backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-cyan-400">Tutorial</span>
          <span className="text-[10px] text-slate-500">{tutorialStep + 1}/{TUTORIAL_STEPS.length}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
        >
          ×
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-slate-800">
        <div
          className="h-full bg-cyan-500 transition-all duration-300"
          style={{ width: `${((tutorialStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step content */}
      <div className="p-3 space-y-2.5">
        <h3 className="text-sm font-semibold text-slate-100">
          {tutorialStep + 1}. {step.title}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          {step.description}
        </p>
        {step.hint && (
          <div className="flex gap-2 bg-slate-800 rounded p-2 border border-slate-700">
            <span className="text-amber-400 shrink-0">💡</span>
            <p className="text-[10px] text-slate-400 leading-relaxed">{step.hint}</p>
          </div>
        )}
        {step.exampleId && (
          <button
            onClick={handleLoadExample}
            className="w-full text-xs px-2.5 py-1.5 rounded border border-cyan-700
                       bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50 transition-colors"
          >
            Load this example →
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800">
        <button
          onClick={handlePrev}
          disabled={isFirst}
          className="text-xs px-3 py-1 rounded bg-slate-800 border border-slate-700
                     text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors"
        >
          ← Prev
        </button>

        {/* Step dots */}
        <div className="flex gap-1">
          {TUTORIAL_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === tutorialStep ? 'bg-cyan-400' : i < tutorialStep ? 'bg-cyan-800' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={isLast}
          className="text-xs px-3 py-1 rounded bg-cyan-800 border border-cyan-700
                     text-cyan-200 hover:bg-cyan-700 disabled:opacity-30 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
