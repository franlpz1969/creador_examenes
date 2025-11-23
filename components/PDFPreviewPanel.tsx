import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface PDFPreviewPanelProps {
    file: File | null;
}

declare global {
    interface Window {
        pdfjsLib: any;
    }
}

export const PDFPreviewPanel: React.FC<PDFPreviewPanelProps> = ({ file }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (file) {
            setCurrentPage(1);
            renderPage(1);
        } else {
            setImageUrl(null);
            setTotalPages(0);
        }
    }, [file]);

    useEffect(() => {
        if (file && currentPage > 0) {
            renderPage(currentPage);
        }
    }, [currentPage]);

    const renderPage = async (pageNum: number) => {
        if (!file) return;

        setIsLoading(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            if (totalPages === 0) {
                setTotalPages(pdf.numPages);
            }

            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.4 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            setImageUrl(canvas.toDataURL());
        } catch (error) {
            console.error('Error rendering PDF:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    if (!file) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <FileText size={32} className="mb-2 opacity-50" />
                <p className="text-xs text-center">Selecciona un documento<br />para previsualizarlo</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <h4 className="font-semibold text-xs text-slate-700 dark:text-slate-300 truncate" title={file.name}>
                    {file.name}
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-2 overflow-auto min-h-[300px]">
                {isLoading ? (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Cargando...</p>
                    </div>
                ) : imageUrl ? (
                    <img src={imageUrl} alt={`Página ${currentPage}`} className="max-w-full h-auto shadow-md rounded" />
                ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No se pudo cargar</p>
                )}
            </div>

            {/* Footer Navigation */}
            {totalPages > 0 && (
                <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <button
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                        className="p-1 rounded bg-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-700 transition"
                        title="Anterior"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded bg-indigo-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-700 transition"
                        title="Siguiente"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};
