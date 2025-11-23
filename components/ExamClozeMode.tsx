import React, { useState, useEffect, useRef } from 'react';
import { ClozeCard, ExamSettings } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, ArrowRight, RotateCcw, Volume2, StopCircle, FileText, XCircle } from 'lucide-react';

interface Props {
    cards: ClozeCard[];
    onRestart: () => void;
    uploadedFiles?: Map<string, File>;
    settings: ExamSettings;
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

const ExamClozeMode: React.FC<Props> = ({ cards, onRestart, uploadedFiles, settings }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    const speechInterval = useRef<number | null>(null);

    const currentCard = cards[currentIndex];
    const isFinished = currentIndex >= cards.length;

    useEffect(() => {
        const checkSpeech = () => {
            setIsSpeaking(window.speechSynthesis.speaking);
        };
        speechInterval.current = window.setInterval(checkSpeech, 100);
        return () => {
            if (speechInterval.current) clearInterval(speechInterval.current);
        };
    }, []);

    useEffect(() => {
        if (currentCard) {
            setIsRevealed(false);
            window.speechSynthesis.cancel();
        }
        return () => {
            window.speechSynthesis.cancel();
        }
    }, [currentCard]);

    const escapeRegExp = (string: string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    const getParsedContent = () => {
        if (!currentCard) return [];
        let parts: { text: string; hidden: boolean; word?: string }[] = [{ text: currentCard.fullText, hidden: false }];

        currentCard.hiddenWords.forEach(word => {
            if (!word) return;
            const newParts: typeof parts = [];
            parts.forEach(part => {
                if (part.hidden) {
                    newParts.push(part);
                } else {
                    const safeWord = escapeRegExp(word.trim());
                    // Use case-insensitive matching
                    const regex = new RegExp(`(${safeWord})`, 'gi');
                    const split = part.text.split(regex);
                    split.forEach(s => {
                        if (s.toLowerCase() === word.trim().toLowerCase()) {
                            newParts.push({ text: s, hidden: true, word: s });
                        } else {
                            if (s) newParts.push({ text: s, hidden: false });
                        }
                    });
                }
            });
            parts = newParts;
        });
        return parts;
    };

    const toggleSpeech = () => {
        if (!currentCard) return;
        if (!('speechSynthesis' in window)) return;

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            return;
        }

        window.speechSynthesis.cancel();

        const parts = getParsedContent();

        // Create speech with pauses at gaps
        let partIndex = 0;
        const speakParts = () => {
            if (partIndex >= parts.length) return;

            const part = parts[partIndex];

            if (part.hidden && !isRevealed) {
                // Pause for 250ms at gaps
                setTimeout(() => {
                    partIndex++;
                    speakParts();
                }, 250);
            } else {
                const text = part.text.replace(/[_]{2,}/g, '');
                if (text.trim()) {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'es-ES';
                    utterance.rate = 0.9;
                    utterance.pitch = 1.0;

                    const setVoice = () => {
                        const voices = window.speechSynthesis.getVoices();
                        if (settings.voiceURI) {
                            const selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI);
                            if (selectedVoice) {
                                utterance.voice = selectedVoice;
                                return;
                            }
                        }
                        const spanishVoice = voices.find(v => v.lang.includes('es-ES')) ||
                            voices.find(v => v.lang.includes('es'));
                        if (spanishVoice) utterance.voice = spanishVoice;
                    };

                    if (window.speechSynthesis.getVoices().length === 0) {
                        window.speechSynthesis.onvoiceschanged = setVoice;
                    } else {
                        setVoice();
                    }

                    utterance.onend = () => {
                        partIndex++;
                        speakParts();
                    };

                    window.speechSynthesis.speak(utterance);
                } else {
                    partIndex++;
                    speakParts();
                }
            }
        };

        setTimeout(() => speakParts(), 50);
    }

    const handleNext = () => {
        window.speechSynthesis.cancel();
        setCurrentIndex(prev => prev + 1);
    };

    if (isFinished) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">¡Repaso Completado!</h2>
                <button onClick={onRestart} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-transform hover:scale-105">
                    <RotateCcw size={20} /> Reiniciar
                </button>
            </div>
        )
    }

    const parts = getParsedContent();


    return (
        <div className="w-full max-w-3xl mx-auto perspective-1000">
            <div className="flex justify-between mb-4 text-slate-500 dark:text-slate-400 font-medium items-center">
                <span>Tarjeta {currentIndex + 1} de {cards.length}</span>
                <div className="flex gap-2">
                    <button
                        onClick={toggleSpeech}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-sm ${isSpeaking
                            ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300'
                            }`}
                    >
                        {isSpeaking ? (
                            <>
                                <StopCircle size={18} fill="currentColor" />
                                <span>PARAR</span>
                            </>
                        ) : (
                            <>
                                <Volume2 size={18} />
                                <span>Leer</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => setCurrentIndex(cards.length)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-full transition-colors flex items-center gap-2"
                        title="Terminar repaso"
                    >
                        <XCircle size={16} />
                        Terminar
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 200, scale: 0.5, rotate: 10 }}
                    animate={{ opacity: 1, x: 0, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, x: -200, scale: 0.5, rotate: -10 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, mass: 1 }}
                    className="bg-white dark:bg-slate-950 rounded-3xl shadow-2xl dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden min-h-[550px] flex flex-col transform-gpu"
                >
                    {/* Decorative Top */}
                    <div className="h-20 bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-indigo-950 dark:to-slate-900 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-400 via-transparent to-transparent"></div>
                    </div>

                    {/* Content Area */}
                    <div className="p-8 flex-grow flex flex-col items-center justify-center bg-white dark:bg-slate-950 relative">
                        <div className="relative z-10 w-full">
                            <p className="text-2xl font-medium text-slate-700 dark:text-slate-200 leading-loose text-center">
                                {parts.map((part, i) => {
                                    if (part.hidden) {
                                        return (
                                            <span key={i} className="inline-block mx-1 align-bottom">
                                                <span className={`
                                            inline-block
                                            min-w-[100px] px-2 py-0.5 rounded-md border-b-4
                                            text-center font-bold
                                            transition-all duration-300
                                            ${isRevealed
                                                        ? 'bg-green-100 dark:bg-green-900/40 border-green-500 text-green-700 dark:text-green-300'
                                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 select-none'
                                                    }
                                        `}>
                                                    <span className={!isRevealed ? 'opacity-0' : ''}>
                                                        {part.word || part.text || "______"}
                                                    </span>
                                                </span>
                                            </span>
                                        )
                                    }
                                    return <span key={i}>{part.text}</span>
                                })}
                            </p>
                        </div>

                        {/* Backup text display */}
                        {isRevealed && (
                            <div className="mt-12 pt-6 border-t border-slate-100 dark:border-slate-800 w-full text-center opacity-75">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-3">Palabras Clave</p>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {currentCard.hiddenWords.map((w, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-green-50 dark:bg-green-900/20 rounded-lg text-base font-semibold text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                                            {w}
                                        </span>
                                    ))}
                                </div>
                                {currentCard.sourceFile && (() => {
                                    const { url, display } = createPDFLink(uploadedFiles, currentCard.sourceFile);
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
                        )}
                    </div>

                    {/* Action Area */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row gap-4 justify-center border-t border-slate-100 dark:border-slate-800">
                        {!isRevealed ? (
                            <button
                                onClick={() => setIsRevealed(true)}
                                className="px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white w-full md:w-auto min-w-[200px] hover:scale-105 active:scale-95"
                            >
                                Ver Solución <Eye />
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                className="px-8 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg bg-slate-900 dark:bg-slate-700 text-white hover:bg-black dark:hover:bg-slate-600 w-full md:w-auto min-w-[200px]"
                            >
                                Siguiente <ArrowRight />
                            </button>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default ExamClozeMode;