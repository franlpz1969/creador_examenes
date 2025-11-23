import React, { useState, useEffect } from 'react';
import { ExamType, ExamSettings, Difficulty } from '../types';
import { Settings as SettingsIcon, BookOpen, Layers, BrainCircuit, ArrowRight, Clock, Volume2, FileText, File as FileIcon } from 'lucide-react';

import { getQuestionCountsPerDocument } from '../services/geminiService';
import { PDFPreviewPanel } from './PDFPreviewPanel';

interface SettingsProps {
    onStart: (settings: ExamSettings) => void;
    pdfText: string;
    uploadedFiles?: Map<string, File>;
}

export const Settings: React.FC<SettingsProps> = ({ onStart, pdfText, uploadedFiles }) => {
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
    const [showSourceFile, setShowSourceFile] = useState(true); // Enabled by default
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    // Voice Selection
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
    const [isPreviewingSpeech, setIsPreviewingSpeech] = useState(false);

    // Load available voices
    useEffect(() => {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();

            // Filter and prioritize high-quality voices
            const spanishVoices = voices.filter(v => v.lang.startsWith('es'));

            // Sort voices: premium/neural first, then by quality indicators
            const sortedVoices = spanishVoices.sort((a, b) => {
                // Prioritize voices with quality indicators in their names
                const aQuality = (a.name.toLowerCase().includes('premium') ||
                    a.name.toLowerCase().includes('neural') ||
                    a.name.toLowerCase().includes('enhanced')) ? 1 : 0;
                const bQuality = (b.name.toLowerCase().includes('premium') ||
                    b.name.toLowerCase().includes('neural') ||
                    b.name.toLowerCase().includes('enhanced')) ? 1 : 0;

                if (aQuality !== bQuality) return bQuality - aQuality;

                // Then prioritize es-ES over other Spanish variants
                const aIsES = a.lang === 'es-ES' ? 1 : 0;
                const bIsES = b.lang === 'es-ES' ? 1 : 0;
                return bIsES - aIsES;
            });

            setAvailableVoices(sortedVoices.length > 0 ? sortedVoices : voices);

            // Auto-select best quality Spanish voice
            if (!selectedVoiceURI && sortedVoices.length > 0) {
                setSelectedVoiceURI(sortedVoices[0].voiceURI);
            }
        };

        loadVoices();

        // Some browsers load voices asynchronously
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    const previewVoice = () => {
        if (!selectedVoiceURI) return;

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            setIsPreviewingSpeech(false);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(
            "Hola, esta es una muestra de la voz seleccionada para la lectura de preguntas."
        );
        utterance.lang = 'es-ES';

        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) utterance.voice = voice;

        utterance.onstart = () => setIsPreviewingSpeech(true);
        utterance.onend = () => setIsPreviewingSpeech(false);
        utterance.onerror = () => setIsPreviewingSpeech(false);

        window.speechSynthesis.speak(utterance);
    };

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
            benevolence,
            voiceURI: selectedVoiceURI
        });
    };

    return (
        <div className="w-full max-w-6xl mx-auto bg-white dark:bg-slate-950 rounded-xl shadow-lg dark:shadow-slate-900/50 overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="bg-indigo-600 dark:bg-indigo-900 px-4 py-2 text-white flex items-center gap-2 shadow-sm">
                <SettingsIcon className="w-4 h-4" />
                <h2 className="text-sm font-bold">Configuración del Examen</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-4 p-4">
                {/* Left Column: Settings */}
                <div className="space-y-3">
                    {/* Mode Selection */}
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

                    {/* Main Settings Panel */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-3">
                        {/* Difficulty & Count */}
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
                            </div>
                        </div>

                        {/* Question Distribution */}
                        {distribution.length > 1 && (
                            <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Distribución</label>
                                {distribution.map((doc, idx) => (
                                    <div key={idx} className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                        <span className="truncate flex-1">{doc.docName}</span>
                                        <span className="font-bold ml-2">{doc.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}

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
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Huecos: {maxClozeBlanks}</label>
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
                                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Benevolencia</label>
                                <select
                                    value={benevolence}
                                    onChange={(e) => setBenevolence(e.target.value as 'STRICT' | 'NORMAL' | 'BENEVOLENT')}
                                    className="w-full p-1.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded focus:ring-indigo-500"
                                >
                                    <option value="STRICT">Estricto</option>
                                    <option value="NORMAL">Normal</option>
                                    <option value="BENEVOLENT">Benevolente</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Control Settings */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <Volume2 size={14} className="text-indigo-500" /> Lectura Auto
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={autoRead} onChange={e => setAutoRead(e.target.checked)} className="sr-only peer" />
                                <div className="w-7 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {/* Voice Selection */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                                <Volume2 size={10} className="inline mr-1" />Voz de Lectura
                            </label>
                            <div className="flex gap-2">
                                <select
                                    value={selectedVoiceURI}
                                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                                    className="flex-1 p-1.5 text-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded focus:ring-indigo-500"
                                    disabled={availableVoices.length === 0}
                                >
                                    {availableVoices.length === 0 ? (
                                        <option>Cargando voces...</option>
                                    ) : (
                                        availableVoices.map((voice) => (
                                            <option key={voice.voiceURI} value={voice.voiceURI}>
                                                {voice.name} ({voice.lang})
                                            </option>
                                        ))
                                    )}
                                </select>
                                <button
                                    onClick={previewVoice}
                                    disabled={!selectedVoiceURI}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1 ${isPreviewingSpeech
                                        ? 'bg-red-500 text-white hover:bg-red-600'
                                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-300 disabled:opacity-50'
                                        }`}
                                    title="Escuchar muestra de voz"
                                >
                                    {isPreviewingSpeech ? '⏸️' : '🔊'}
                                </button>
                            </div>
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

                        <div>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                <Clock size={14} className="text-indigo-500" /> Límite (s)
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

                    {/* Uploaded Documents List */}
                    {uploadedFiles && uploadedFiles.size > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                                <FileIcon size={14} className="text-indigo-500" /> Documentos ({uploadedFiles.size})
                            </h3>
                            <div className="space-y-1">
                                {Array.from(uploadedFiles.entries()).map(([filename, file]) => {
                                    const docDistribution = distribution.find(d => d.docName === filename);
                                    const isSelected = previewFile === file;
                                    return (
                                        <button
                                            key={filename}
                                            onClick={() => setPreviewFile(file)}
                                            className={`w-full text-left p-2 rounded-lg border transition ${isSelected
                                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-slate-800'
                                                }`}
                                        >
                                            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                                                {filename}
                                            </div>
                                            <div className="flex gap-3 mt-0.5 text-[10px] text-slate-400">
                                                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                {docDistribution && (
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                        {docDistribution.count} preguntas
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleStart}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
                    >
                        Comenzar Examen <ArrowRight size={16} />
                    </button>
                </div>

                {/* Right Column: PDF Preview */}
                <div className="lg:sticky lg:top-4 h-[500px]">
                    <PDFPreviewPanel file={previewFile} />
                </div>
            </div>
        </div>
    );
};
