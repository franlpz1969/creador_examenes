declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export const extractTextFromPDFs = async (files: File[]): Promise<string> => {
  let combinedText = '';

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();

    // Using the pdfjsLib loaded via CDN in index.html
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fileText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fileText += `--- [Página ${i}] ---\n${pageText}\n`;
    }
    combinedText += `--- Inicio del documento: ${file.name} | Páginas: ${pdf.numPages} ---\n${fileText}\n--- Fin del documento ---\n\n`;
  }

  console.log("Extracted Text Preview:", combinedText.slice(0, 500));
  return combinedText;
};

// Deprecated single file version kept for compatibility if needed, but mapped to new function
export const extractTextFromPDF = async (file: File): Promise<string> => {
  return extractTextFromPDFs([file]);
};