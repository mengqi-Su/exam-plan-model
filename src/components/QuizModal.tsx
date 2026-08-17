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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-[#e9e9e7] rounded-xl w-full max-w-lg text-[#37352f] shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#f7f6f3] border-b border-[#e9e9e7] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#9065b0]" />
            <div>
              <h3 className="font-semibold text-xs text-[#37352f]">{t("quizModalTitle")}</h3>
              <p className="text-[10px] text-[#787774] truncate max-w-xs">{task.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#787774] hover:text-[#37352f] p-1 rounded hover:bg-[#efefed] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-10 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-[#e9e9e7] border-t-[#37352f] rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[#787774]">{t("generatingQuizQuestions")}</p>
            </div>
          ) : error ? (
            <div className="py-6 text-center text-[#d44c47] text-xs">
              <p>{error}</p>
              <button
                onClick={onClose}
                className="mt-3 px-3 py-1 bg-[#efefed] text-[#37352f] rounded text-xs"
              >
                {language === "zh" ? "关闭" : "Close"}
              </button>
            </div>
          ) : currentQ ? (
            <div className="space-y-4">
              {/* Question Progress Tracker */}
              <div className="flex items-center justify-between text-xs text-[#787774]">
                <span>{language === "zh" ? `第 ${currentIdx + 1} 题 / 共 ${questions.length} 题` : `Question ${currentIdx + 1} of ${questions.length}`}</span>
                <span className="notion-tag-purple px-1.5 py-0.2 rounded text-[10px] font-medium">
                  {currentQ.topicTitle}
                </span>
              </div>

              {/* Question Text */}
              <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg p-3.5">
                <p className="text-xs font-semibold text-[#37352f] leading-relaxed">
                  {currentQ.question}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-2">
                {currentQ.options?.map((opt, oIdx) => {
                  const isUserPick = selectedAnswers[currentIdx] === opt;
                  const isCorrect = opt === currentQ.correctAnswer;
                  
                  let btnStyle = "bg-white border-[#e9e9e7] hover:bg-[#fbfbfa] text-[#37352f]";
                  if (isRevealed) {
                    if (isCorrect) {
                      btnStyle = "bg-[#edf3ec] border-[#448361] text-[#448361] font-medium";
                    } else if (isUserPick) {
                      btnStyle = "bg-[#fdebec] border-[#d44c47] text-[#d44c47] font-medium";
                    } else {
                      btnStyle = "bg-[#fbfbfa] border-[#e9e9e7] text-[#9b9a97] opacity-60";
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isRevealed}
                      className={`w-full text-left p-3 rounded-md border text-xs transition-all flex items-start space-x-2.5 cursor-pointer ${btnStyle}`}
                    >
                      <span className="w-4 h-4 rounded-sm border border-[#dfdfde] flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className="flex-1 leading-normal">{opt}</span>
                      {isRevealed && isCorrect && (
                        <CheckCircle2 className="w-4 h-4 text-[#448361] shrink-0 mt-0.5" />
                      )}
                      {isRevealed && isUserPick && !isCorrect && (
                        <XCircle className="w-4 h-4 text-[#d44c47] shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation Box */}
              {isRevealed && (
                <div className="p-3 bg-[#f7f6f3] border border-[#e9e9e7] rounded-md space-y-1 text-xs">
                  <div className="flex items-center space-x-1 text-[#37352f] font-semibold text-[11px]">
                    <HelpCircle className="w-3.5 h-3.5 text-[#2b78a0]" />
                    <span>{t("explanationLabel")}</span>
                  </div>
                  <p className="text-[#5a5a57] text-[11px] leading-relaxed">
                    {currentQ.explanation}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Controls */}
        {!loading && !error && questions.length > 0 && (
          <div className="px-5 py-3 bg-[#f7f6f3] border-t border-[#e9e9e7] flex items-center justify-between">
            <button
              onClick={() => {
                if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
              }}
              disabled={currentIdx === 0}
              className="px-2.5 py-1 text-xs text-[#787774] hover:text-[#37352f] disabled:opacity-40"
            >
              {t("prevQuestion")}
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
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#37352f] hover:bg-[#201f1c] text-white rounded text-xs font-semibold shadow-2xs transition-colors"
              >
                <span>{isLastQ ? t("finishAndLogMastery") : t("nextQuestion")}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
