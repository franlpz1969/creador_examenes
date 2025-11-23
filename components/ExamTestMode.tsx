import React, { useState, useEffect, useRef } from 'react';
import { TestQuestion, ExamSettings } from '../types';
import { CheckCircle, XCircle, AlertCircle, ChevronRight, Volume2, StopCircle, Clock, Printer, RotateCcw, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface Props {
    questions: TestQuestion[];
    settings: ExamSettings;
    onRestart: () => void;
    uploadedFiles?: Map<string, File>;
}

interface SummaryItem {
    question: string;
    userSelected: string[];
    correctSelected: string[];
    isCorrect: boolean;
    explanation: string;
}

// Helper to create PDF blob URL with page anchor
// Helper to create PDF blob URL with page anchor
const createPDFLink = (uploadedFiles: Map<string, File> | undefined, sourceFile: string | undefined): { url: string | null; display: string } => {
    if (!sourceFile || !uploadedFiles) return { url: null, display: sourceFile || '' };

    // Parse "filename.pdf (Pág. 5)" format
    const match = sourceFile.match(/^(.+?)\s*\(Pág\.\s*(\d+)\)$/);
    if (!match) return { url: null, display: sourceFile };

    const [, filename, pageNum] = match;
    const trimmedFilename = filename.trim();

    // Try exact match first
    let file = uploadedFiles.get(trimmedFilename);

    // If not found, try fuzzy matching (remove extension and compare base names)
    if (!file) {
        const baseNameToFind = trimmedFilename.replace(/\.[^.]+$/, '').toLowerCase();

        for (const [key, value] of uploadedFiles.entries()) {
            const baseName = key.replace(/\.[^.]+$/, '').toLowerCase();
            if (baseName === baseNameToFind) {
                file = value;
                break;
            }
        }
    }

    if (!file) {
        console.warn(`PDF file not found for source: "${sourceFile}". Available files:`, Array.from(uploadedFiles.keys()));
        return { url: null, display: sourceFile };
    }

    const blobUrl = URL.createObjectURL(file);
    return { url: `${blobUrl}#page=${pageNum}`, display: sourceFile };
};

const ExamTestMode: React.FC<Props> = ({ questions, settings, onRestart, uploadedFiles }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [results, setResults] = useState<{ correct: number, wrong: number }>({ correct: 0, wrong: 0 });
    const [timeLeft, setTimeLeft] = useState<number>(settings.timeLimit || 0);
    const [summary, setSummary] = useState<SummaryItem[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [showSummary, setShowSummary] = useState(false);

    // Polling interval ref
    const speechInterval = useRef<number | null>(null);
    const lastReadIndex = useRef<number | null>(null);

    const currentQuestion = questions[currentIndex];
    const isFinished = currentIndex >= questions.length;

    // Polling for speech status
    useEffect(() => {
        const checkSpeech = () => {
            setIsSpeaking(window.speechSynthesis.speaking);
        };
        // Check every 100ms
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
            utterance.rate = 0.9; // Slightly slower for more natural sound
            utterance.pitch = 1.0; // Normal pitch

            const setVoice = () => {
                const voices = window.speechSynthesis.getVoices();

                // Use voice from settings if provided
                if (settings.voiceURI) {
                    const selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI);
                    if (selectedVoice) {
                        utterance.voice = selectedVoice;
                        return;
                    }
                }

                // Fallback to Spanish voice
                const spanishVoice = voices.find(v => v.lang.includes('es-ES')) ||
                    voices.find(v => v.lang.includes('es'));
                if (spanishVoice) utterance.voice = spanishVoice;
            };

            if (window.speechSynthesis.getVoices().length === 0) {
                window.speechSynthesis.onvoiceschanged = setVoice;
            } else {
                setVoice();
            }

            // Store in window to prevent garbage collection (common browser bug)
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

    // Helper to get full text including options
    const getQuestionTextToRead = () => {
        if (!currentQuestion) return '';
        const optionsText = currentQuestion.options.map((opt, idx) => `Opción ${idx + 1}: ${opt}`).join('. ');
        return `${currentQuestion.question}. ${optionsText}`;
    };

    // Ensure speech stops on unmount or question change
    useEffect(() => {
        return () => {
            stopSpeech();
        };
    }, [currentIndex]);

    // Auto-Read Logic
    useEffect(() => {
        if (settings.autoRead && !isFinished && currentQuestion && currentIndex !== lastReadIndex.current) {
            lastReadIndex.current = currentIndex;
            setTimeout(() => playSpeech(getQuestionTextToRead()), 200);
        }
    }, [currentIndex, settings.autoRead, isFinished, currentQuestion]);

    // Timer Logic
    useEffect(() => {
        if (!settings.timeLimit || isAnswered || isFinished) return;

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
    }, [currentIndex, isAnswered, isFinished, settings.timeLimit]);


    const handleTimeout = () => {
        setResults(prev => ({ ...prev, wrong: prev.wrong + 1 }));

        const newItem: SummaryItem = {
            question: questions[currentIndex].question,
            userSelected: ["Tiempo agotado"],
            correctSelected: questions[currentIndex].correctIndices.map(i => questions[currentIndex].options[i]),
            isCorrect: false,
            explanation: questions[currentIndex].explanation
        };
        setSummary(prev => [...prev, newItem]);

        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedOptions([]);
            setIsAnswered(false);
        } else {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handleOptionSelect = (idx: number) => {
        if (isAnswered) return;

        if (settings.allowMultipleCorrect) {
            if (selectedOptions.includes(idx)) {
                setSelectedOptions(selectedOptions.filter(i => i !== idx));
            } else {
                setSelectedOptions([...selectedOptions, idx]);
            }
        } else {
            setSelectedOptions([idx]);
        }
    };

    const handleSubmit = () => {
        if (selectedOptions.length === 0) return;

        const correctSet = new Set(currentQuestion.correctIndices);
        const selectedSet = new Set(selectedOptions);

        const isCorrect = correctSet.size === selectedSet.size && [...correctSet].every(x => selectedSet.has(x));

        let points = 0;
        if (isCorrect) {
            points = 1;
            setResults(prev => ({ ...prev, correct: prev.correct + 1 }));
        } else {
            setResults(prev => ({ ...prev, wrong: prev.wrong + 1 }));
            if (settings.negativeMarking) points = -0.5;
        }

        setScore(prev => prev + points);
        setIsAnswered(true);

        setSummary(prev => [...prev, {
            question: currentQuestion.question,
            userSelected: selectedOptions.map(i => currentQuestion.options[i]),
            correctSelected: currentQuestion.correctIndices.map(i => currentQuestion.options[i]),
            isCorrect,
            explanation: currentQuestion.explanation
        }]);
    };

    const handleNext = () => {
        window.speechSynthesis.cancel();
        setCurrentIndex(prev => prev + 1);
        setSelectedOptions([]);
        setIsAnswered(false);
    };

    useEffect(() => {
        if (isFinished) {
            const maxScore = questions.length;
            const grade = Math.round(Math.max(0, (score / maxScore) * 10));
            if (grade >= 5) {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            }
        }
    }, [isFinished, score, questions.length]);

    const handlePrint = () => {
        const printContent = document.getElementById('printable-area');
        if (!printContent) return;

        // Create a hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) return;

        // Write content
        doc.open();
        doc.write(`
        <html>
          <head>
            <title>Resultados del Examen</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
               body { padding: 40px; background: white; font-family: sans-serif; }
               .no-print { display: none !important; }
               .bg-slate-950 { background-color: white !important; color: black !important; }
               * { text-shadow: none !important; box-shadow: none !important; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
        doc.close();

        // Wait for content (specifically Tailwind CDN) to load
        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                // Cleanup after print dialog closes (or reasonably soon)
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }, 500);
        };
    };

    if (isFinished) {
        const maxScore = questions.length;
        const grade = Math.round(Math.max(0, (score / maxScore) * 10));
        const isPass = grade >= 5;

        return (
            <div id="printable-area" className={`w-full max-w-3xl mx-auto bg-white dark:bg-slate-950 rounded-3xl shadow-2xl dark:shadow-none p-10 text-center border border-slate-200 dark:border-slate-800 ${!isPass ? 'animate-shake bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">¡Examen Completado!</h2>

                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="text-sm text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-2">Nota Final</div>
                    <div className="relative">
                        <div className={`text-8xl font-black text-transparent bg-clip-text ${isPass ? 'bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400' : 'bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400'}`}>
                            {grade}
                        </div>
                        <div className="text-xl font-bold text-slate-400 mt-1">sobre 10</div>
                    </div>
                    {!isPass && <p className="text-red-500 font-bold mt-2">¡Necesitas mejorar!</p>}
                    {isPass && grade === 10 && <p className="text-indigo-500 font-bold mt-2">¡Perfecto!</p>}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-8 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col items-center p-2">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">Puntos</span>
                        <span className="text-xl font-bold text-slate-800 dark:text-slate-200">{score}</span>
                    </div>
                    <div className="flex flex-col items-center p-2 border-l border-slate-200 dark:border-slate-800">
                        <span className="text-green-600 dark:text-green-400 text-xs font-bold uppercase flex items-center gap-1"><CheckCircle size={12} /> Aciertos</span>
                        <span className="text-xl font-bold text-green-600 dark:text-green-400">{results.correct}</span>
                    </div>
                    <div className="flex flex-col items-center p-2 border-l border-slate-200 dark:border-slate-800">
                        <span className="text-red-500 dark:text-red-400 text-xs font-bold uppercase flex items-center gap-1"><XCircle size={12} /> Fallos</span>
                        <span className="text-xl font-bold text-red-500 dark:text-red-400">{results.wrong}</span>
                    </div>
                </div>

                <div className="no-print mb-6">
                    <button
                        onClick={() => setShowSummary(!showSummary)}
                        className="text-sm text-indigo-600 dark:text-indigo-400 font-bold underline hover:text-indigo-700 dark:hover:text-indigo-300 transition"
                    >
                        {showSummary ? 'Ocultar desglose detallado' : 'Ver desglose detallado de respuestas'}
                    </button>
                </div>

                {showSummary && (
                    <div className="text-left mb-8 mt-4 animate-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <FileText className="text-indigo-500" /> Resumen de Respuestas
                        </h3>
                        <div className="space-y-6">
                            {summary.map((item, idx) => (
                                <div key={idx} className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-900 dark:border-slate-800 break-inside-avoid">
                                    <div className="flex items-start gap-2 mb-2">
                                        <span className="font-bold text-slate-400 text-sm">#{idx + 1}</span>
                                        <p className="font-medium text-slate-800 dark:text-slate-200">{item.question}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-3 pl-6">
                                        <div>
                                            <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Tu Respuesta</span>
                                            <div className={`flex items-center gap-2 ${item.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {item.isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                {item.userSelected.join(', ')}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Respuesta Correcta</span>
                                            <div className="text-green-600 dark:text-green-400 font-medium">
                                                {item.correctSelected.join(', ')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pl-6 text-sm text-slate-600 dark:text-slate-400 italic bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                        ℹ️ {item.explanation}
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
                    <button onClick={onRestart} className="px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-900 dark:hover:bg-slate-600 transition flex items-center gap-2">
                        <RotateCcw size={18} /> Nuevo Examen
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex gap-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <span>Pregunta: {currentIndex + 1}/{questions.length}</span>
                    <span className="text-green-600 dark:text-green-400">✓ {results.correct}</span>
                    <span className="text-red-500 dark:text-red-400">✕ {results.wrong}</span>
                </div>
                <div className="flex items-center gap-6">
                    {settings.timeLimit && !isAnswered && (
                        <div className={`flex items-center gap-1 font-mono font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-indigo-600 dark:text-indigo-400'}`}>
                            <Clock size={16} />
                            {timeLeft}s
                        </div>
                    )}
                    <div className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">Puntos: {score}</div>
                </div>
            </div>

            {settings.timeLimit && !isAnswered && (
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
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="bg-white dark:bg-slate-950 rounded-3xl shadow-xl dark:shadow-none overflow-hidden border border-slate-100 dark:border-slate-800"
                >
                    <div className="p-8">
                        <div className="flex items-start gap-4 mb-6">
                            <button
                                onClick={() => toggleSpeech(getQuestionTextToRead())}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all flex-shrink-0 ${isSpeaking
                                    ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300'
                                    }`}
                            >
                                {isSpeaking ? <><StopCircle size={18} fill="currentColor" /> PARAR</> : <><Volume2 size={18} /> Leer</>}
                            </button>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-relaxed">{currentQuestion.question}</h3>
                        </div>

                        <div className="space-y-3">
                            {currentQuestion.options.map((option, idx) => {
                                const isSelected = selectedOptions.includes(idx);
                                const isCorrectAnswer = currentQuestion.correctIndices.includes(idx);

                                let containerClass = "border-2 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer";

                                if (isAnswered) {
                                    if (isCorrectAnswer) {
                                        containerClass = "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-800 dark:text-green-300";
                                    } else if (isSelected && !isCorrectAnswer) {
                                        containerClass = "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-800 dark:text-red-300";
                                    } else {
                                        containerClass = "border-slate-100 dark:border-slate-800 opacity-50 dark:text-slate-500";
                                    }
                                } else if (isSelected) {
                                    containerClass = "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-300";
                                } else {
                                    containerClass += " text-slate-700 dark:text-slate-300";
                                }

                                // Animation Logic
                                let animateProps: any = { opacity: 1, y: 0, scale: 1, x: 0 };
                                let transitionProps: any = { delay: idx * 0.05, duration: 0.2 };

                                if (isAnswered) {
                                    if (isSelected) {
                                        if (isCorrectAnswer) {
                                            // Correct Answer Animation: Pulse/Heartbeat
                                            animateProps = { opacity: 1, y: 0, scale: [1, 1.05, 1], x: 0 };
                                            transitionProps = { duration: 0.4, ease: "easeInOut" };
                                        } else {
                                            // Wrong Answer Animation: Shake
                                            animateProps = { opacity: 1, y: 0, scale: 1, x: [0, -10, 10, -10, 10, 0] };
                                            transitionProps = { duration: 0.5, ease: "easeInOut" };
                                        }
                                    } else {
                                        // Unselected options fade slightly
                                        animateProps = { opacity: isCorrectAnswer ? 1 : 0.5, y: 0, scale: 1, x: 0 };
                                    }
                                } else {
                                    // Initial Entry
                                    animateProps = { opacity: 1, y: 0, scale: isSelected ? 1.02 : 1, x: 0 };
                                }

                                return (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={animateProps}
                                        transition={transitionProps}
                                        onClick={() => handleOptionSelect(idx)}
                                        whileTap={!isAnswered ? { scale: 0.98 } : {}}
                                        className={`w-full p-4 rounded-xl transition-colors duration-200 flex items-start gap-3 ${containerClass}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${isSelected || (isAnswered && isCorrectAnswer) ? 'border-current' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {isAnswered && isCorrectAnswer && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}><CheckCircle size={14} /></motion.div>}
                                            {isAnswered && !isCorrectAnswer && isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}><XCircle size={14} /></motion.div>}
                                            {!isAnswered && isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-3 h-3 bg-indigo-600 dark:bg-indigo-400 rounded-full" />}
                                        </div>
                                        <span>{option}</span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    <AnimatePresence>
                        {isAnswered && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="bg-slate-50 dark:bg-slate-900 p-6 border-t border-slate-100 dark:border-slate-800"
                            >
                                <div className="flex items-start gap-3 mb-4">
                                    <AlertCircle className="text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200">Explicación</h4>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">{currentQuestion.explanation}</p>
                                    </div>
                                </div>
                                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800 text-sm text-yellow-800 dark:text-yellow-200 italic">
                                    "{currentQuestion.sourceQuote}"
                                    {currentQuestion.sourceFile && (() => {
                                        const { url, display } = createPDFLink(uploadedFiles, currentQuestion.sourceFile);
                                        return (
                                            <div className="mt-2 pt-2 border-t border-yellow-200 dark:border-yellow-800/50 flex items-center gap-1 not-italic font-semibold text-xs opacity-75">
                                                <FileText size={12} /> Fuente: {url ? (
                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-900 dark:hover:text-yellow-100 transition">
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

                    <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                        {!isAnswered ? (
                            <button
                                onClick={handleSubmit}
                                disabled={selectedOptions.length === 0}
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Responder
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                className="px-8 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold shadow-lg hover:bg-black dark:hover:bg-slate-600 transition-all flex items-center gap-2"
                            >
                                Siguiente <ChevronRight size={20} />
                            </button>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default ExamTestMode;