import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, MousePointerClick, ZoomIn, Hand, Check } from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Welcome to Infinity Notebook',
      icon: <MousePointerClick className="w-8 h-8 text-sky-500" />,
      content: (
        <div className="space-y-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
          <p>
            An endless paper notebook and infinite canvas in one unified workspace.
          </p>
          <p>
            Whether using a laptop trackpad, a mouse, or a stylus, every interaction is engineered for maximum precision, zero lag, and effortless hands-free drawing.
          </p>
        </div>
      ),
    },
    {
      title: 'Click-to-Ink (Hands-Free Drawing)',
      icon: <MousePointerClick className="w-8 h-8 text-sky-500" />,
      content: (
        <div className="space-y-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
          <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800">
            <div className="font-semibold text-sky-800 dark:text-sky-200 mb-1">
              How it works:
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-sky-900 dark:text-sky-300">
              <li>Press <kbd className="font-mono bg-white dark:bg-stone-900 px-1 py-0.5 rounded border">Ctrl+Shift+L</kbd> or click the status bar button.</li>
              <li>Click once anywhere on paper to lower the pen.</li>
              <li>Move the pointer freely without holding down any button.</li>
              <li>Click once more to finish and commit the stroke.</li>
            </ol>
          </div>
          <p className="text-[11px] text-stone-500">
            Hold <strong className="text-stone-700 dark:text-stone-300">Space</strong> to temporarily lift the pen and reposition without drawing!
          </p>
        </div>
      ),
    },
    {
      title: 'Windows Precision Touchpad & Zoom',
      icon: <ZoomIn className="w-8 h-8 text-purple-500" />,
      content: (
        <div className="space-y-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="font-bold text-stone-800 dark:text-stone-200">•</span>
              <span><strong>Pinch-to-zoom:</strong> Smoothly scales from 2% to 6400%, strictly anchored right under your pointer.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-stone-800 dark:text-stone-200">•</span>
              <span><strong>Two-finger scroll:</strong> Effortlessly glide through endless stacked pages or across the infinite board.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-stone-800 dark:text-stone-200">•</span>
              <span><strong>Hold Shift:</strong> While drawing, automatically snap freehand strokes into laser-straight lines or 45° angles.</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: 'Dual Mode: Endless Pages & Infinite Canvas',
      icon: <Hand className="w-8 h-8 text-emerald-500" />,
      content: (
        <div className="space-y-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
          <p>
            Switch seamlessly between continuous vertical <strong>Notebook Mode</strong> and unbounded <strong>Canvas Mode</strong> with one click on the top bar.
          </p>
          <p>
            Your pages turn into movable frames on the canvas, and you can draw freely anywhere inside or outside any page!
          </p>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {current.icon}
            <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              {current.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-[140px]">{current.content}</div>

        {/* Stepper dots & navigation */}
        <div className="flex items-center justify-between border-t border-stone-100 dark:border-stone-800 pt-3">
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-5 bg-blue-600' : 'w-1.5 bg-stone-300 dark:bg-stone-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                Next
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Start Writing</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
