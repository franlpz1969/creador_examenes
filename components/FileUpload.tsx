import React, { useCallback, useState } from 'react';
import { UploadCloud, FileText, X, File as FileIcon, ArrowRight, Plus } from 'lucide-react';
import { extractTextFromPDFs } from '../services/pdfService';

interface FileUploadProps {
    onTextExtracted: (data: { text: string; files: File[] }) => void;
    setLoading: (loading: boolean) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onTextExtracted, setLoading }) => {
    const [files, setFiles] = useState<File[]>([]);

    const processFiles = async () => {
        if (files.length === 0) return;

        setLoading(true);
        try {
            const text = await extractTextFromPDFs(files);
            if (text.trim().length === 0) {
                alert('No se pudo extraer texto. Los PDFs podrían contener solo imágenes.');
            } else {
                onTextExtracted({ text, files });
            }
        } catch (error) {
            console.error(error);
            alert('Error analizando los PDFs.');
        } finally {
            setLoading(false);
        }
    };

    const handleNewFiles = (newFiles: FileList | null) => {
        if (!newFiles) return;
        const validFiles: File[] = [];

        Array.from(newFiles).forEach(file => {
            if (file.type === 'application/pdf') {
                // Avoid duplicates by name
                if (!files.some(f => f.name === file.name)) {
                    validFiles.push(file);
                }
            } else {
                alert(`El archivo ${file.name} no es un PDF.`);
            }
        });

        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles]);
        }
    };

    const removeFile = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        handleNewFiles(e.dataTransfer.files);
    }, [files]);

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleNewFiles(e.target.files);
        // Reset input so same file can be selected again if deleted
        e.target.value = '';
    };

    return (
        <div className="w-full max-w-2xl mx-auto mt-4">

            {/* Drop Zone */}
            <div
                className={`
                relative w-full min-h-[250px] flex flex-col items-center justify-center p-8 
                border-4 border-dashed rounded-3xl transition-all duration-300 cursor-pointer group
                ${files.length > 0
                        ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/20'
                        : 'border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-indigo-400'
                    }
            `}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onClick={() => document.getElementById('pdf-upload')?.click()}
            >
                <input
                    type="file"
                    id="pdf-upload"
                    className="hidden"
                    accept=".pdf"
                    multiple
                    onChange={onInputChange}
                />

                <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`
                    w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 shadow-inner
                    ${files.length > 0 ? 'bg-white dark:bg-slate-800 text-indigo-600' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 group-hover:scale-110'}
                `}>
                        {files.length > 0 ? <Plus size={32} /> : <UploadCloud size={32} />}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">
                            {files.length > 0 ? 'Añadir más archivos' : 'Sube tus documentos'}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {files.length > 0 ? 'Arrastra o haz clic para agregar' : 'PDFs (Selección múltiple)'}
                        </p>
                    </div>
                </div>
            </div>

            {/* File List Area */}
            {files.length > 0 && (
                <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Documentos seleccionados ({files.length})</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setFiles([]); }}
                                className="text-xs text-red-500 hover:text-red-600 font-medium"
                            >
                                Limpiar todo
                            </button>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[200px] overflow-y-auto scrollbar-thin">
                            {files.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 flex-shrink-0">
                                            <FileIcon size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                                            <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => removeFile(index, e)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                        title="Eliminar archivo"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={processFiles}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        Analizar {files.length} Documentos <ArrowRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default FileUpload;