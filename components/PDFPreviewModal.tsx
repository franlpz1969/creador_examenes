import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PDFPreviewModalProps {
    file: File;
    onClose: () => void;
}

declare global {
    interface Window {
        pdfjsLib: any;
    }
}

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({ file, onClose }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        renderPage(currentPage);
    }, [currentPage, file]);

    const renderPage = async (pageNum: number) => {
        setIsLoading(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            if (totalPages === 0) {
                setTotalPages(pdf.numPages);
            }

            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.5 });

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-md">{file.name}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition"
                    >
                        <X size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                </div>

                {/* PDF Preview */}
                <div className="relative bg-slate-100 dark:bg-slate-950 flex items-center justify-center min-h-[500px] max-h-[70vh] overflow-auto p-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando página...</p>
                        </div>
                    ) : imageUrl ? (
                        <img src={imageUrl} alt={`Página ${currentPage}`} className="max-w-full h-auto shadow-lg" />
                    ) : (
                        <p className="text-slate-500 dark:text-slate-400">No se pudo cargar la vista previa</p>
                    )}
                </div>

                {/* Footer Navigation */}
                {totalPages > 0 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <button
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition"
                        >
                            <ChevronLeft size={18} /> Anterior
                        </button>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            Página {currentPage} de {totalPages}
                        </span>
                        <button
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition"
                        >
                            Siguiente <ChevronRight size={18} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
