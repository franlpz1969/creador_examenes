import React, { useState, useEffect, useRef } from 'react';
import { OpenQuestion, ExamSettings } from '../types';
import { evaluateOpenAnswer } from '../services/geminiService';
import { Send, CheckCircle, XCircle, ArrowRight, RotateCcw, Loader2, Volume2, StopCircle, Eye, Clock, Printer, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface Props {
    questions: OpenQuestion[];
    onRestart: () => void;
    settings?: ExamSettings;
    uploadedFiles?: Map<string, File>;
}

// Helper to create PDF blob URL with page anchor
const createPDFLink = (uploadedFiles: Map<string, File> | undefined, sourceFile: string | undefined): { url: string | null; display: string } => {
    if (!sourceFile || !uploadedFiles) return { url: null, display: sourceFile || '' };

    // Parse "filename.pdf (Pág. 5)" format
    const match = sourceFile.match(/^(.+?)\s*\(Pág\.\s*(\d+)\)$/);
    if (!match) return { url: null, display: sourceFile };

    const [, filename, pageNum] = match;
    const file = uploadedFiles.get(filename.trim());

    if (!file) return { url: null, display: sourceFile };

    const blobUrl = URL.createObjectURL(file);
    return { url: `${blobUrl}#page=${pageNum}`, display: sourceFile };
};

const ExamOpenMode: React.FC<Props> = ({ questions, onRestart, settings, uploadedFiles }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [evaluation, setEvaluation] = useState<{ score: number, feedback: string } | null>(null);
    const [showModelAnswer, setShowModelAnswer] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [totalScore, setTotalScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState<number>(settings?.timeLimit || 0);
    const [summary, setSummary] = useState<Array<{ q: string, a: string, m: string, score: number }>>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const speechInterval = useRef<number | null>(null);

    const lastReadIndex = useRef<number | null>(null);

    const currentQuestion = questions[currentIndex];
    const isFinished = currentIndex >= questions.length;

    useEffect(() => {
        const checkSpeech = () => {
            setIsSpeaking(window.speechSynthesis.speaking);
        };
        speechInterval.current = window.setInterval(checkSpeech, 100);
        return () => {
            if (speechInterval.current) clearInterval(speechInterval.current);
        };
    }, []);

    const stopSpeech = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    };

    const playSpeech = (text: string) => {
        if (!('speechSynthesis' in window)) return;

        stopSpeech();

        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';

            const setVoice = () => {
                const voices = window.speechSynthesis.getVoices();
                const spanishVoice = voices.find(v => v.lang.includes('es-ES')) ||
                    voices.find(v => v.lang.includes('es'));
                if (spanishVoice) utterance.voice = spanishVoice;
            };

            if (window.speechSynthesis.getVoices().length === 0) {
                window.speechSynthesis.onvoiceschanged = setVoice;
            } else {
                setVoice();
            }

            // @ts-ignore
            window.currentUtterance = utterance;
            utterance.onend = () => {
                // @ts-ignore
                delete window.currentUtterance;
            };

            window.speechSynthesis.speak(utterance);
        }, 50);
    };

    const toggleSpeech = (text: string) => {
        if (window.speechSynthesis.speaking) {
            stopSpeech();
        } else {
            playSpeech(text);
        }
    };

    useEffect(() => {
        return () => {
            stopSpeech();
        };
    }, []);

    useEffect(() => {
        if (settings?.autoRead && !isFinished && currentQuestion && currentIndex !== lastReadIndex.current) {
            lastReadIndex.current = currentIndex;
            setTimeout(() => playSpeech(currentQuestion.question), 200);
        }
    }, [currentIndex, settings?.autoRead, isFinished, currentQuestion]);

    useEffect(() => {
        if (!settings?.timeLimit || evaluation || showModelAnswer || isFinished || isEvaluating) return;

        setTimeLeft(settings.timeLimit);
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [currentIndex, evaluation, showModelAnswer, isFinished, isEvaluating, settings?.timeLimit]);

    const handleTimeout = () => {
        setSummary(prev => [...prev, {
            q: currentQuestion.question,
            a: "(Tiempo agotado)",
            m: currentQuestion.modelAnswer,
            score: 0
        }]);
        handleNextStep(true);
    };

    const handleNextStep = (skipEval = false) => {
        window.speechSynthesis.cancel();
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setUserAnswer('');
            setEvaluation(null);
            setShowModelAnswer(false);
        } else {
            setCurrentIndex(prev => prev + 1);
        }
    }

    const handleCheck = async () => {
        if (!userAnswer.trim()) {
            setShowModelAnswer(true);
            setSummary(prev => [...prev, {
                q: currentQuestion.question,
                a: "(Sin respuesta)",
                m: currentQuestion.modelAnswer,
                score: 0
            }]);
            return;
        }

        setIsEvaluating(true);
        try {
            const result = await evaluateOpenAnswer(currentQuestion.question, currentQuestion.modelAnswer, userAnswer);
            setEvaluation(result);
            if (result.score === 1) setTotalScore(prev => prev + 1);

            setSummary(prev => [...prev, {
                q: currentQuestion.question,
                a: userAnswer,
                m: currentQuestion.modelAnswer,
                score: result.score
            }]);

        } catch (e) {
            console.error(e);
            setEvaluation({ score: 0, feedback: "Error al evaluar con IA." });
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleNext = () => {
        handleNextStep();
    };

    useEffect(() => {
        if (isFinished) {
            const grade = Math.round((totalScore / questions.length) * 10);
            if (grade >= 5) {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            }
        }
    }, [isFinished, totalScore, questions.length]);

    const handlePrint = () => window.print();

    if (isFinished) {
        const grade = Math.round((totalScore / questions.length) * 10);
        const isPass = grade >= 5;

        return (
            <div id="printable-area" className={`w-full max-w-3xl mx-auto bg-white dark:bg-slate-950 p-10 rounded-3xl shadow-2xl dark:shadow-none text-center border border-slate-200 dark:border-slate-800 ${!isPass ? 'animate-shake bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">Evaluación Completa</h2>

                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="text-sm text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-2">Nota Final</div>
                    <div className="relative">
                        <div className={`text-8xl font-black text-transparent bg-clip-text ${isPass ? 'bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400' : 'bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400'}`}>
                            {grade}
                        </div>
                        <div className="text-xl font-bold text-slate-400 mt-1">sobre 10</div>
                    </div>
                    {!isPass && <p className="text-red-500 font-bold mt-2">¡Inténtalo de nuevo!</p>}
                </div>

                <p className="text-slate-500 dark:text-slate-400 mb-8">Has obtenido {totalScore} aciertos de {questions.length} preguntas.</p>

                {settings?.showSummary && (
                    <div className="text-left mb-8 mt-8">
                        <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <FileText className="text-indigo-500" /> Detalle de Respuestas
                        </h3>
                        <div className="space-y-4">
                            {summary.map((item, idx) => (
                                <div key={idx} className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-900 dark:border-slate-800 break-inside-avoid">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 mb-2">{idx + 1}. {item.q}</p>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Tu respuesta</span>
                                            <p className={`text-sm mt-1 ${item.score === 1 ? 'text-green-600' : 'text-red-500'}`}>{item.a}</p>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="text-xs font-bold text-slate-400 uppercase">Respuesta Ideal</span>
                                            <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">{item.m}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-4 justify-center no-print">
                    <button onClick={handlePrint} className="px-6 py-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition flex items-center gap-2">
                        <Printer size={18} /> Imprimir
                    </button>
                    <button onClick={onRestart} className="px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-900 dark:hover:bg-slate-600 flex justify-center items-center gap-2">
                        <RotateCcw size={18} /> Reiniciar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="mb-4 flex justify-between items-center text-sm font-bold text-slate-400">
                <span>PREGUNTA {currentIndex + 1} DE {questions.length}</span>
                <div className="flex items-center gap-4">
                    {settings?.timeLimit && !evaluation && !showModelAnswer && (
                        <div className={`flex items-center gap-1 font-mono font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-indigo-600 dark:text-indigo-400'}`}>
                            <Clock size={16} />
                            {timeLeft}s
                        </div>
                    )}
                    <span>PUNTOS: {totalScore}</span>
                </div>
            </div>

            {settings?.timeLimit && !evaluation && !showModelAnswer && (
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full mb-6 overflow-hidden">
                    <motion.div
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: settings.timeLimit, ease: "linear" }}
                        className="h-full bg-indigo-500"
                    />
                </div>
            )}

            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -50, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="bg-white dark:bg-slate-950 rounded-2xl shadow-xl dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden"
                >
                    <div className="p-8 bg-gradient-to-br from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
                        <div className="flex items-start gap-3 mb-6">
                            <button
                                onClick={() => toggleSpeech(currentQuestion.question)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all flex-shrink-0 ${isSpeaking
                                    ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300'
                                    }`}
                            >
                                {isSpeaking ? <><StopCircle size={18} fill="currentColor" /> PARAR</> : <><Volume2 size={18} /> Leer</>}
                            </button>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{currentQuestion.question}</h3>
                        </div>

                        <textarea
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            disabled={evaluation !== null || showModelAnswer || isEvaluating}
                            placeholder="Escribe tu respuesta aquí (máx 1 párrafo) o déjalo en blanco para ver la solución..."
                            className="w-full h-40 p-4 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500"
                        />
                    </div>

                    <AnimatePresence>
                        {(evaluation || showModelAnswer) && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className={`p-6 border-t ${evaluation
                                    ? (evaluation.score === 1 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800')
                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                                    }`}
                            >
                                {evaluation && (
                                    <div className="flex items-start gap-3 mb-4">
                                        {evaluation.score === 1 ? <CheckCircle className="text-green-600 dark:text-green-400 mt-1" /> : <XCircle className="text-red-500 dark:text-red-400 mt-1" />}
                                        <div>
                                            <h4 className={`font-bold ${evaluation.score === 1 ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                                                {evaluation.score === 1 ? 'Correcto / Suficiente' : 'Incorrecto / Insuficiente'}
                                            </h4>
                                            <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{evaluation.feedback}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700">
                                    <h5 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Respuesta Modelo</h5>
                                    <p className="text-slate-700 dark:text-slate-300 text-sm italic bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        {currentQuestion.modelAnswer}
                                    </p>
                                    {currentQuestion.sourceFile && (() => {
                                        const { url, display } = createPDFLink(uploadedFiles, currentQuestion.sourceFile);
                                        return (
                                            <div className="mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-700 flex items-center gap-1 text-xs text-slate-400 font-medium">
                                                <FileText size={12} /> Fuente: {url ? (
                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600 dark:hover:text-slate-200 transition">
                                                        {display}
                                                    </a>
                                                ) : display}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                        {(!evaluation && !showModelAnswer) ? (
                            <button
                                onClick={handleCheck}
                                disabled={isEvaluating}
                                className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${userAnswer.trim()
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'
                                    : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {isEvaluating ? <Loader2 className="animate-spin" /> : (userAnswer.trim() ? <Send size={18} /> : <Eye size={18} />)}
                                {userAnswer.trim() ? 'Comprobar' : 'Ver Respuesta'}
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                className="px-6 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg font-bold hover:bg-black dark:hover:bg-slate-600 flex items-center gap-2 transition-all"
                            >
                                Siguiente <ArrowRight size={18} />
                            </button>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default ExamOpenMode;