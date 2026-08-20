import React, { useState, useEffect } from "react";
import { X, Sparkles, CheckCircle2, XCircle, HelpCircle, ArrowRight, Check } from "lucide-react";
import { ActiveRecallQuizQuestion, StudyTask } from "../types";
import { playCompletionChime } from "../lib/audio";
import { useI18n } from "../lib/i18n";
import { fallbackGenerateQuizClient } from "../lib/fallbackPlanner";

interface QuizModalProps {
  task: StudyTask;
  isOpen: boolean;
  onClose: () => void;
  onMasteryUpdated?: (rating: 1 | 2 | 3 | 4 | 5) => void;
}

export function QuizModal({ task, isOpen, onClose, onMasteryUpdated }: QuizModalProps) {
  const { t, language } = useI18n();
  const [questions, setQuestions] = useState<ActiveRecallQuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!isOpen || !task) return;
    
    // Fetch quiz questions from server
    const fetchQuiz = async () => {
      setLoading(true);
      setError(null);
      setCurrentIdx(0);
      setSelectedAnswers({});
      setRevealedAnswers({});

      try {
        let data: any = null;
        try {
          const res = await fetch("/api/generate-quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topicTitle: task.topicTitle,
              taskTitle: task.title,
              keyObjectives: task.keyObjectives,
              language,
            }),
          });

          if (res.ok) {
            data = await res.json();
          }
        } catch (fetchErr) {
          console.warn("Network error during quiz fetch, generating local questions:", fetchErr);
        }

        if (!data || !data.questions || data.questions.length === 0) {
          data = fallbackGenerateQuizClient(task.topicTitle, task.title, language);
        }

        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        } else {
          setQuestions(fallbackGenerateQuizClient(task.topicTitle, task.title, language).questions);
        }
      } catch (err: any) {
        console.error("Quiz load handled:", err);
        setQuestions(fallbackGenerateQuizClient(task.topicTitle, task.title, language).questions);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [isOpen, task, language]);

  if (!isOpen) return null;

  const currentQ = questions[currentIdx];
  const isLastQ = currentIdx === questions.length - 1;
  const isRevealed = revealedAnswers[currentIdx];

  const handleSelectOption = (option: string) => {
    if (isRevealed) return;
    setSelectedAnswers({ ...selectedAnswers, [currentIdx]: option });
    setRevealedAnswers({ ...revealedAnswers, [currentIdx]: true });

    if (option === currentQ.correctAnswer) {
      playCompletionChime();
    }
  };

  const handleFinishQuiz = () => {
    const correctCount = questions.reduce((acc, q, idx) => {
      return acc + (selectedAnswers[idx] === q.correctAnswer ? 1 : 0);
    }, 0);

    const scoreRatio = correctCount / questions.length;
    let rating: 1 | 2 | 3 | 4 | 5 = 3;
    if (scoreRatio >= 0.8) rating = 5;
    else if (scoreRatio >= 0.6) rating = 4;
    else if (scoreRatio >= 0.4) rating = 3;
    else rating = 2;

    if (onMasteryUpdated) {
      onMasteryUpdated(rating);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-white border border-[#111111] w-full max-w-lg text-[#111111] font-mono shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#fafafa] border-b border-[#111111] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[10px] font-bold">
              [QUIZ]
            </span>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-tight text-[#111111]">{t("quizModalTitle")}</h3>
              <p className="text-[10px] text-[#666666] truncate max-w-xs mt-0.5">{task.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#111111] hover:bg-[#111111] hover:text-white p-1 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 font-mono">
          {loading ? (
            <div className="py-10 text-center space-y-2">
              <div className="w-5 h-5 border-2 border-[#111111] border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-[#666666]">{t("generatingQuizQuestions")}</p>
            </div>
          ) : error ? (
            <div className="py-6 text-center text-[#111111] text-xs space-y-2">
              <p className="font-bold">[ERROR: {error}]</p>
              <button
                onClick={onClose}
                className="mt-3 px-3 py-1 bg-[#111111] text-white text-xs font-bold cursor-pointer"
              >
                {language === "zh" ? "[关闭]" : "[CLOSE]"}
              </button>
            </div>
          ) : currentQ ? (
            <div className="space-y-4">
              {/* Question Progress Tracker */}
              <div className="flex items-center justify-between text-xs text-[#666666]">
                <span>{language === "zh" ? `[题号 ${currentIdx + 1} / ${questions.length}]` : `[Q ${currentIdx + 1}/${questions.length}]`}</span>
                <span className="border border-[#111111] bg-[#fafafa] text-[#111111] px-1.5 py-0.2 text-[10px] font-bold">
                  {currentQ.topicTitle}
                </span>
              </div>

              {/* Question Text */}
              <div className="bg-[#fafafa] border border-[#111111] p-3.5">
                <p className="text-xs font-bold text-[#111111] leading-relaxed">
                  {currentQ.question}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-2">
                {currentQ.options?.map((opt, oIdx) => {
                  const isUserPick = selectedAnswers[currentIdx] === opt;
                  const isCorrect = opt === currentQ.correctAnswer;
                  
                  let btnStyle = "bg-white border-[#111111] hover:bg-[#fafafa] text-[#111111]";
                  if (isRevealed) {
                    if (isCorrect) {
                      btnStyle = "bg-[#111111] border-[#111111] text-white font-bold";
                    } else if (isUserPick) {
                      btnStyle = "bg-[#fafafa] border-[#111111] text-[#111111] line-through font-bold";
                    } else {
                      btnStyle = "bg-white border-[#e5e5e5] text-[#999999] opacity-40";
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isRevealed}
                      className={`w-full text-left p-3 border text-xs transition-all flex items-start space-x-2.5 cursor-pointer ${btnStyle}`}
                    >
                      <span className={`w-4 h-4 border flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${isRevealed && isCorrect ? 'border-white text-white' : 'border-[#111111]'}`}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className="flex-1 leading-normal">{opt}</span>
                      {isRevealed && isCorrect && (
                        <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5">[{language === "zh" ? "正确" : "CORRECT"}]</span>
                      )}
                      {isRevealed && isUserPick && !isCorrect && (
                        <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5">[{language === "zh" ? "错误" : "INCORRECT"}]</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation Box */}
              {isRevealed && (
                <div className="p-3 bg-[#fafafa] border border-[#111111] space-y-1 text-xs">
                  <div className="flex items-center space-x-1 text-[#111111] font-bold text-[11px] uppercase">
                    <span>[{t("explanationLabel")}]</span>
                  </div>
                  <p className="text-[#333333] text-[11px] leading-relaxed">
                    {currentQ.explanation}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Controls */}
        {!loading && !error && questions.length > 0 && (
          <div className="px-5 py-3 bg-[#fafafa] border-t border-[#111111] flex items-center justify-between font-mono">
            <button
              onClick={() => {
                if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
              }}
              disabled={currentIdx === 0}
              className="px-2.5 py-1 text-xs text-[#666666] hover:text-[#111111] disabled:opacity-30 cursor-pointer"
            >
              [{t("prevQuestion")}]
            </button>

            {isRevealed && (
              <button
                onClick={() => {
                  if (isLastQ) {
                    handleFinishQuiz();
                  } else {
                    setCurrentIdx(currentIdx + 1);
                  }
                }}
                className="flex items-center space-x-1 px-4 py-1.5 bg-[#111111] hover:bg-[#333333] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <span>[{isLastQ ? t("finishAndLogMastery") : t("nextQuestion")}]</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
