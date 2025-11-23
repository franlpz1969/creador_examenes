import React, { useState } from 'react';
import { ExamType, ExamSettings, Difficulty } from '../types';
import { Settings as SettingsIcon, BookOpen, Layers, BrainCircuit, ArrowRight, BarChart3, Clock, Volume2, FileText } from 'lucide-react';

import { getQuestionCountsPerDocument } from '../services/geminiService';

interface SettingsProps {
    onStart: (settings: ExamSettings) => void;
    pdfText: string;
}

export const Settings: React.FC<SettingsProps> = ({ onStart, pdfText }) => {
    const [type, setType] = useState<ExamType>(ExamType.TEST);
    const [questionCount, setQuestionCount] = useState(5);
    const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
    const [optionsCount, setOptionsCount] = useState(4);
    const [allowMultipleCorrect, setAllowMultipleCorrect] = useState(false);
    const [negativeMarking, setNegativeMarking] = useState(false);
    const [maxClozeBlanks, setMaxClozeBlanks] = useState(2);
    const [benevolence, setBenevolence] = useState<'STRICT' | 'NORMAL' | 'BENEVOLENT'>('NORMAL');

    // New Settings
    const [autoRead, setAutoRead] = useState(false);
    const [timeLimit, setTimeLimit] = useState(0);
    const [showSummary, setShowSummary] = useState(true);
    const [showSourceFile, setShowSourceFile] = useState(false);

    const distribution = React.useMemo(() => {
        return getQuestionCountsPerDocument(pdfText, questionCount);
    }, [pdfText, questionCount]);

    const handleStart = () => {
        onStart({
            type,
            questionCount,
            difficulty,
            optionsCount,
            allowMultipleCorrect,
            negativeMarking,
            maxClozeBlanks,
            autoRead,
            timeLimit,
            showSummary,
            showSourceFile,
            benevolence
        });
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-white dark:bg-slate-950 rounded-xl shadow-lg dark:shadow-slate-900/50 overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="bg-indigo-600 dark:bg-indigo-900 px-4 py-2 text-white flex items-center gap-2 shadow-sm">
                <SettingsIcon className="w-4 h-4" />
                <h2 className="text-sm font-bold">Configuración</h2>
            </div>

            <div className="p-3 space-y-3">
                {/* Mode Selection */}
                <div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: ExamType.TEST, icon: Layers, label: 'Test' },
                            { id: ExamType.CLOZE_FLASHCARD, icon: BookOpen, label: 'Flashcards' },
                            { id: ExamType.OPEN_FLASHCARD, icon: BrainCircuit, label: 'Abierta' }
                        ].map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => setType(mode.id)}
                                className={`p-2 rounded-lg border flex flex-row items-center justify-center gap-2 transition-all ${type === mode.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'}`}
                            >
                                <mode.icon className="w-4 h-4" />
                                <span className="font-semibold text-xs">{mode.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Left Column */}
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">

                        {/* Difficulty & Count Row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Dificultad</label>
                                <select
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                                    className="w-full p-1.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded focus:ring-indigo-500"
                                >
                                    <option value="EASY">Fácil</option>
                                    <option value="MEDIUM">Medio</option>
                                    <option value="HARD">Difícil</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Preguntas: {questionCount}</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={questionCount}
                                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2"
                                />
                                {distribution.length > 1 && (
                                    <div className="mt-2 space-y-1">
                                        {distribution.map((doc, idx) => (
                                            <div key={idx} className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                <span className="truncate max-w-[120px]">{doc.docName}</span>
                                                <span className="font-bold">{doc.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mode Specific Settings */}
                        {type === ExamType.TEST && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Opciones</label>
                                    <div className="flex gap-1">
                                        {[2, 3, 4, 5].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setOptionsCount(n)}
                                                className={`px-2 py-0.5 text-xs rounded border ${optionsCount === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" checked={allowMultipleCorrect} onChange={e => setAllowMultipleCorrect(e.target.checked)} className="w-3.5 h-3.5 rounded accent-indigo-600" />
                                        <span className="text-[11px] text-slate-700 dark:text-slate-300">Multi-respuesta</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" checked={negativeMarking} onChange={e => setNegativeMarking(e.target.checked)} className="w-3.5 h-3.5 rounded accent-indigo-600" />
                                        <span className="text-[11px] text-slate-700 dark:text-slate-300">Restar fallos</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {type === ExamType.CLOZE_FLASHCARD && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between mb-1">
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Huecos por carta: {maxClozeBlanks}</label>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    value={maxClozeBlanks}
                                    onChange={(e) => setMaxClozeBlanks(parseInt(e.target.value))}
                                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                            </div>
                        )}
                        {type === ExamType.OPEN_FLASHCARD && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nivel de Benevolencia</label>
                                <select
                                    value={benevolence}
                                    onChange={(e) => setBenevolence(e.target.value as 'STRICT' | 'NORMAL' | 'BENEVOLENT')}
                                    className="w-full p-1.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded focus:ring-indigo-500"
                                >
                                    <option value="STRICT">Estricto (Exige precisión)</option>
                                    <option value="NORMAL">Normal (Equilibrado)</option>
                                    <option value="BENEVOLENT">Benevolente (Flexible)</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Control */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex flex-col justify-center gap-3">

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <Volume2 size={14} className="text-indigo-500" /> Lectura Auto
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={autoRead} onChange={e => setAutoRead(e.target.checked)} className="sr-only peer" />
                                <div className="w-7 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <FileText size={14} className="text-indigo-500" /> Resumen
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={showSummary} onChange={e => setShowSummary(e.target.checked)} className="sr-only peer" />
                                <div className="w-7 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <FileText size={14} className="text-indigo-500" /> Mostrar Fuente
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={showSourceFile} onChange={e => setShowSourceFile(e.target.checked)} className="sr-only peer" />
                                <div className="w-7 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                <Clock size={14} className="text-indigo-500" /> Límite Tiempo (s)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="300"
                                value={timeLimit}
                                onChange={(e) => setTimeLimit(parseInt(e.target.value) || 0)}
                                className="w-full p-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                                placeholder="0 = Infinito"
                            />
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleStart}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
                >
                    Comenzar Examen <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
};
