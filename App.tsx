import React, { useState, useEffect } from 'react';
import { AppState, ExamSettings, ExamType } from './types';
import { generateTestQuestions, generateClozeCards, generateOpenQuestions, generateThematicBackground } from './services/geminiService';
import FileUpload from './components/FileUpload';
import { Settings } from './components/Settings';
import ExamTestMode from './components/ExamTestMode';
import ExamClozeMode from './components/ExamClozeMode';
import ExamOpenMode from './components/ExamOpenMode';
import { Loader2, Moon, Sun, Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    step: 'UPLOAD',
    pdfText: '',
    settings: { type: ExamType.TEST, questionCount: 5, difficulty: 'MEDIUM' },
    testQuestions: [],
    clozeCards: [],
    openQuestions: [],
    generatedImages: {}
  });
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Auto-scale effect for Full Screen
  useEffect(() => {
    if (isFullScreen) {
      // Escala automática al entrar en pantalla completa para mejorar legibilidad
      setZoomLevel(1.25);
    } else {
      // Restaurar escala original al salir
      setZoomLevel(1);
    }
  }, [isFullScreen]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullScreen(true));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullScreen(false));
      }
    }
  };

  // Listen for fullscreen changes via ESC key
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const handleTextExtracted = (data: { text: string; files: File[] }) => {
    const filesMap = new Map<string, File>();
    data.files.forEach(file => filesMap.set(file.name, file));

    setState(prev => ({ ...prev, pdfText: data.text, uploadedFiles: filesMap, step: 'SETTINGS' }));

    // Trigger background generation asynchronously
    generateThematicBackground(data.text)
      .then(bg => {
        if (bg) setBackgroundImage(bg);
      })
      .catch(err => console.error("Failed to generate background", err));
  };

  const handleStartExam = async (settings: ExamSettings) => {
    setState(prev => ({ ...prev, step: 'LOADING', settings }));

    try {
      if (settings.type === ExamType.TEST) {
        setLoadingMessage('Generando preguntas de tipo test...');
        const questions = await generateTestQuestions(state.pdfText, settings);
        setState(prev => ({ ...prev, testQuestions: questions, step: 'EXAM' }));
      } else if (settings.type === ExamType.CLOZE_FLASHCARD) {
        setLoadingMessage('Creando tarjetas de memoria y visualizaciones...');
        const cards = await generateClozeCards(state.pdfText, settings);
        setState(prev => ({ ...prev, clozeCards: cards, step: 'EXAM' }));
      } else if (settings.type === ExamType.OPEN_FLASHCARD) {
        setLoadingMessage('Formulando preguntas abiertas...');
        const questions = await generateOpenQuestions(state.pdfText, settings);
        setState(prev => ({ ...prev, openQuestions: questions, step: 'EXAM' }));
      }
    } catch (error) {
      console.error(error);
      alert('Error al generar el examen. Por favor, revisa tu API Key o inténtalo de nuevo.');
      setState(prev => ({ ...prev, step: 'SETTINGS' }));
    }
  };

  const handleRestart = () => {
    setState(prev => ({
      ...prev,
      step: 'SETTINGS',
      testQuestions: [],
      clozeCards: [],
      openQuestions: []
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-200 dark:selection:bg-indigo-900 transition-colors duration-300 overflow-x-hidden relative">

      {/* Thematic Background Layer */}
      <div
        className="fixed inset-0 z-[-1] bg-cover bg-center transition-opacity duration-1000 pointer-events-none"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
          opacity: backgroundImage ? 0.2 : 0 // 80% transparency = 20% opacity
        }}
      />

      {/* Navbar */}
      <nav className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-300 no-print">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-lg text-indigo-600 dark:text-indigo-400 tracking-tight cursor-pointer" onClick={() => setState(prev => ({ ...prev, step: 'UPLOAD' }))}>
            <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-sm">DOCU</span>
            <span className="hidden sm:inline">EXAM AI</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Zoom Controls */}
            <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button onClick={() => setZoomLevel(Math.max(0.8, zoomLevel - 0.1))} className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"><ZoomOut size={14} /></button>
              <span className="text-[10px] w-8 text-center font-mono">{Math.round(zoomLevel * 100)}%</span>
              <button onClick={() => setZoomLevel(Math.min(1.5, zoomLevel + 0.1))} className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"><ZoomIn size={14} /></button>
            </div>

            <button
              onClick={toggleFullScreen}
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title={isFullScreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Modo oscuro"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Container with Zoom */}
      <div id="zoom-container" style={{ zoom: zoomLevel }} className="transition-transform duration-200 origin-top">
        <main className="max-w-6xl mx-auto px-4 py-8">
          {state.step === 'UPLOAD' && (
            <div className="text-center space-y-4">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                Exámenes desde PDF <br />
                <span className="text-indigo-600 dark:text-indigo-400">con Inteligencia Artificial</span>
              </h1>
              <p className="text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
                Sube tu documento y genera tests, flashcards y evaluaciones al instante.
              </p>
              <FileUpload
                onTextExtracted={handleTextExtracted}
                setLoading={(isLoading) => setLoadingMessage(isLoading ? 'Analizando PDF...' : '')}
              />
              {loadingMessage && state.step === 'UPLOAD' && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                  <Loader2 className="animate-spin" size={16} /> {loadingMessage}
                </div>
              )}
            </div>
          )}

          {state.step === 'SETTINGS' && (
            <Settings onStart={handleStartExam} pdfText={state.pdfText} uploadedFiles={state.uploadedFiles} />
          )}

          {state.step === 'LOADING' && (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-6">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 dark:border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 animate-pulse">{loadingMessage}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs">Procesando contenido con IA...</p>
            </div>
          )}

          {state.step === 'EXAM' && (
            <>
              {state.settings.type === ExamType.TEST && (
                <ExamTestMode
                  questions={state.testQuestions}
                  settings={state.settings}
                  onRestart={handleRestart}
                  uploadedFiles={state.uploadedFiles}
                />
              )}
              {state.settings.type === ExamType.CLOZE_FLASHCARD && (
                <ExamClozeMode
                  cards={state.clozeCards}
                  onRestart={handleRestart}
                  uploadedFiles={state.uploadedFiles}
                />
              )}
              {state.settings.type === ExamType.OPEN_FLASHCARD && (
                <ExamOpenMode
                  questions={state.openQuestions}
                  onRestart={handleRestart}
                  settings={state.settings}
                  uploadedFiles={state.uploadedFiles}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;