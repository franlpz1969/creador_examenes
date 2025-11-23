import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ExamSettings, ExamType, TestQuestion, ClozeCard, OpenQuestion } from "../types";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getDifficultyPrompt = (difficulty: string) => {
  switch (difficulty) {
    case 'EASY':
      return "Nivel de dificultad FÁCIL: Céntrate en definiciones básicas, hechos explícitos y conceptos fundamentales. Las preguntas deben ser directas.";
    case 'HARD':
      return "Nivel de dificultad DIFÍCIL: Céntrate en análisis complejo, inferencias, detalles sutiles y aplicación de conceptos. Las preguntas deben ser retadoras.";
    case 'MEDIUM':
    default:
      return "Nivel de dificultad MEDIO: Equilibra hechos directos con algo de comprensión y aplicación. Dificultad estándar.";
  }
};

export const getQuestionCountsPerDocument = (text: string, totalQuestions: number): { docName: string; count: number }[] => {
  // Updated regex to capture page count: --- Inicio del documento: [name] | Páginas: [pages] ---
  const docRegex = /--- Inicio del documento: (.*?) \| Páginas: (\d+) ---\n([\s\S]*?)\n--- Fin del documento ---/g;
  let match;
  const docs: { name: string; pages: number }[] = [];
  let totalPages = 0;

  while ((match = docRegex.exec(text)) !== null) {
    const pages = parseInt(match[2], 10);
    docs.push({ name: match[1], pages });
    totalPages += pages;
  }

  // Fallback for backward compatibility or if regex fails (e.g. old text format)
  if (docs.length === 0) {
    const oldDocRegex = /--- Inicio del documento: (.*?) ---\n([\s\S]*?)\n--- Fin del documento ---/g;
    const oldDocs: { name: string; length: number }[] = [];
    let totalLength = 0;
    while ((match = oldDocRegex.exec(text)) !== null) {
      const length = match[2].length;
      oldDocs.push({ name: match[1], length });
      totalLength += length;
    }

    if (oldDocs.length <= 1) return [];

    let distributedCount = 0;
    const result: { docName: string; count: number }[] = [];

    oldDocs.forEach((doc, index) => {
      let count;
      if (index === oldDocs.length - 1) {
        count = totalQuestions - distributedCount;
      } else {
        count = Math.round((doc.length / totalLength) * totalQuestions);
        if (count === 0 && totalQuestions >= oldDocs.length) count = 1;
      }
      distributedCount += count;
      result.push({ docName: doc.name, count });
    });
    return result;
  }

  if (docs.length <= 1) return [];

  let distributedCount = 0;
  const result: { docName: string; count: number }[] = [];

  docs.forEach((doc, index) => {
    let count;
    if (index === docs.length - 1) {
      // Assign remaining questions to the last doc to ensure total matches
      count = totalQuestions - distributedCount;
    } else {
      count = Math.round((doc.pages / totalPages) * totalQuestions);
      // Ensure at least 1 question if possible, but don't exceed total
      if (count === 0 && totalQuestions >= docs.length) count = 1;
    }

    distributedCount += count;
    result.push({ docName: doc.name, count });
  });

  return result;
};

const calculateQuestionDistribution = (text: string, totalQuestions: number): string => {
  const distribution = getQuestionCountsPerDocument(text, totalQuestions);
  if (distribution.length === 0) return "";

  let distributionPrompt = "INSTRUCCIÓN DE DISTRIBUCIÓN OBLIGATORIA:\n";
  distribution.forEach(item => {
    distributionPrompt += `- Genera EXACTAMENTE ${item.count} preguntas/items del documento "${item.docName}".\n`;
  });

  return distributionPrompt;
};

export const generateTestQuestions = async (text: string, settings: ExamSettings): Promise<TestQuestion[]> => {
  const ai = getAiClient();
  const distributionInstruction = calculateQuestionDistribution(text, settings.questionCount);

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        options: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctIndices: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: "Zero-based indices of correct options" },
        explanation: { type: Type.STRING },
        sourceQuote: { type: Type.STRING, description: "Direct quote from text supporting the answer" },
        sourceFile: { type: Type.STRING, description: "Name of the file where the content was found, extracted from the delimiters." },
      },
      required: ["question", "options", "correctIndices", "explanation", "sourceQuote"],
    },
  };

  const prompt = `
    Genera ${settings.questionCount} preguntas de tipo test (selección múltiple) basadas en el siguiente texto.
    
    INSTRUCCIÓN CRÍTICA: El texto contiene múltiples documentos delimitados por "--- Inicio del documento: [nombre] | Páginas: [num] ---" y marcadores de página "--- [Página X] ---".
    ${settings.showSourceFile ? "PARA CADA PREGUNTA, DEBES IDENTIFICAR DE QUÉ DOCUMENTO Y PÁGINA PROVIENE LA INFORMACIÓN. Asigna 'NombreArchivo (Pág. X)' al campo 'sourceFile'." : ""}
    
    ${distributionInstruction}

    Todo el contenido DEBE estar en ESPAÑOL.
    ${getDifficultyPrompt(settings.difficulty)}
    Cada pregunta debe tener ${settings.optionsCount || 4} opciones.
    ${settings.allowMultipleCorrect ? "Las preguntas PUEDEN tener múltiples respuestas correctas." : "Las preguntas DEBEN tener exactamente una respuesta correcta."}
    
    Contexto del texto:
    ${text.slice(0, 30000)}... (truncado)
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  return JSON.parse(response.text || "[]") as TestQuestion[];
};

export const generateClozeCards = async (text: string, settings: ExamSettings): Promise<ClozeCard[]> => {
  const ai = getAiClient();
  const distributionInstruction = calculateQuestionDistribution(text, settings.questionCount);

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        fullText: { type: Type.STRING, description: "Una frase o párrafo corto con hechos clave en ESPAÑOL." },
        hiddenWords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Términos clave encontrados en el texto completo que deben ocultarse." },
        sourceFile: { type: Type.STRING, description: "Name of the file where the content was found." },
      },
      required: ["fullText", "hiddenWords"],
    },
  };

  const prompt = `
    Crea ${settings.questionCount} tarjetas didácticas (flashcards) de rellenar huecos a partir del texto.

    INSTRUCCIÓN CRÍTICA: El texto contiene múltiples documentos delimitados por "--- Inicio del documento: [nombre] | Páginas: [num] ---" y marcadores de página "--- [Página X] ---".
    ${settings.showSourceFile ? "PARA CADA TARJETA, DEBES IDENTIFICAR DE QUÉ DOCUMENTO Y PÁGINA PROVIENE LA INFORMACIÓN. Asigna 'NombreArchivo (Pág. X)' al campo 'sourceFile'." : ""}

    ${distributionInstruction}

    Todo el contenido (fullText y hiddenWords) DEBE estar en ESPAÑOL.
    ${getDifficultyPrompt(settings.difficulty)}
    Identifica hasta ${settings.maxClozeBlanks || 3} términos clave para ocultar por tarjeta.

    Contexto del texto:
    ${text.slice(0, 30000)}... (truncado)
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  return JSON.parse(response.text || "[]") as ClozeCard[];
};

export const generateOpenQuestions = async (text: string, settings: ExamSettings): Promise<OpenQuestion[]> => {
  const ai = getAiClient();
  const distributionInstruction = calculateQuestionDistribution(text, settings.questionCount);

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING, description: "Una pregunta abierta que requiera una respuesta de párrafo corto en ESPAÑOL." },
        modelAnswer: { type: Type.STRING, description: "La respuesta correcta ideal en ESPAÑOL." },
        sourceFile: { type: Type.STRING, description: "Name of the file where the content was found." },
      },
      required: ["question", "modelAnswer"],
    },
  };

  const prompt = `
    Genera ${settings.questionCount} preguntas de estudio abiertas basadas en el texto.

    INSTRUCCIÓN CRÍTICA: El texto contiene múltiples documentos delimitados por "--- Inicio del documento: [nombre] | Páginas: [num] ---" y marcadores de página "--- [Página X] ---".
    ${settings.showSourceFile ? "PARA CADA PREGUNTA, DEBES IDENTIFICAR DE QUÉ DOCUMENTO Y PÁGINA PROVIENE LA INFORMACIÓN. Asigna 'NombreArchivo (Pág. X)' al campo 'sourceFile'." : ""}

    ${distributionInstruction}

    Todo el contenido DEBE estar en ESPAÑOL.
    ${getDifficultyPrompt(settings.difficulty)}
    IMPORTANTE: Las preguntas deben ser CORTAS y CONCISAS.
    La respuesta esperada no debe exceder 1-2 oraciones.
    Proporciona una respuesta modelo breve para cada una.

    Contexto del texto:
    ${text.slice(0, 30000)}... (truncado)
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  return JSON.parse(response.text || "[]") as OpenQuestion[];
};

export const evaluateOpenAnswer = async (question: string, modelAnswer: string, userAnswer: string, benevolence: 'STRICT' | 'NORMAL' | 'BENEVOLENT' = 'NORMAL'): Promise<{ score: number; feedback: string }> => {
  const ai = getAiClient();

  let benevolenceInstruction = "";
  switch (benevolence) {
    case 'STRICT':
      benevolenceInstruction = "CRITERIOS DE EVALUACIÓN: Sé ESTRICTO. La respuesta debe ser precisa y completa. Penaliza imprecisiones o falta de detalle clave. Si es vaga, marca 0.";
      break;
    case 'BENEVOLENT':
      benevolenceInstruction = "CRITERIOS DE EVALUACIÓN: Sé MUY BENEVOLENTE. Si la respuesta tiene CUALQUIER relación con la correcta o demuestra una mínima comprensión, marca 1. Ignora errores de expresión.";
      break;
    case 'NORMAL':
    default:
      benevolenceInstruction = "CRITERIOS DE EVALUACIÓN: Sé FLEXIBLE pero RAZONABLE. Si captura la idea principal, marca 1. Si es claramente incorrecta o irrelevante, marca 0.";
      break;
  }

  const prompt = `
        Actúa como un profesor evaluando una respuesta de examen.
        Evalúa la respuesta del usuario frente a la respuesta modelo para la pregunta dada.
        Responde SIEMPRE en JSON y en ESPAÑOL.
        
        Pregunta: ${question}
        Respuesta Modelo: ${modelAnswer}
        Respuesta Usuario: ${userAnswer}

        El 'score' debe ser 1 si es correcta/suficiente, 0 si es incorrecta/insuficiente.
        'feedback' debe ser una breve explicación en español.
        
        ${benevolenceInstruction}
    `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.INTEGER, description: "1 para correcto, 0 para incorrecto" },
      feedback: { type: Type.STRING }
    },
    required: ["score", "feedback"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  return JSON.parse(response.text || '{"score": 0, "feedback": "Error evaluando"}');
}

export const generateThematicBackground = async (text: string): Promise<string | null> => {
  const ai = getAiClient();

  try {
    // Step 1: Get a prompt description for the background
    const promptResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
                Analyze the following text and write a prompt for an image generator.
                The prompt should describe an "abstract, artistic, subtle background wallpaper" that represents the main topic of the text.
                It should be suitable for a web application background (not too busy, good contrast for overlay text).
                Do NOT include any text inside the image itself.
                Keep the prompt in English.
                
                Text sample: ${text.slice(0, 5000)}
            `
    });

    const imagePrompt = promptResponse.text;

    // Step 2: Generate the image
    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: imagePrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        }
      }
    });

    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;

  } catch (e) {
    console.error("Background generation failed", e);
    return null;
  }
};