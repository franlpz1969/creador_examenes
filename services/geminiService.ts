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
    INSTRUCCIÓN CRÍTICA: Genera ${settings.questionCount} preguntas de tipo test basadas ESTRICTAMENTE en el texto proporcionado a continuación.
    
    REGLAS OBLIGATORIAS:
    1. Cada pregunta DEBE basarse en información que aparece EXPLÍCITAMENTE en el texto
    2. NO inventes información que no esté en el texto
    3. Las respuestas correctas DEBEN poder verificarse leyendo el texto
    4. Las opciones incorrectas pueden usar conocimiento general pero deben ser claramente incorrectas según el texto
    5. Si el texto no tiene suficiente información, genera MENOS preguntas (no inventes contenido)
    
    El texto contiene múltiples documentos delimitados por "--- Inicio del documento: [nombre] | Páginas: [num] ---" y marcadores de página "--- [Página X] ---".
    ${settings.showSourceFile ? "Para cada pregunta, identifica de qué documento y página proviene. Asigna 'NombreArchivo (Pág. X)' al campo 'sourceFile'." : ""}
    
    ${distributionInstruction}

    REQUISITOS:
    - Todo en ESPAÑOL
    - ${getDifficultyPrompt(settings.difficulty)}
    - ${settings.optionsCount || 4} opciones por pregunta
    - ${settings.allowMultipleCorrect ? "Pueden haber múltiples respuestas correctas" : "Una sola respuesta correcta"}
    - Incluye una explicación que cite el texto
    - Proporciona una cita TEXTUAL del documento que respalde la respuesta
    
    TEXTO DEL DOCUMENTO:
    ${text.slice(0, 30000)}
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
    Crea ${settings.questionCount} tarjetas didácticas (flashcards) de rellenar huecos basadas en el siguiente texto.

    IMPORTANTE:
    - Usa información del texto proporcionado
    - Cada tarjeta debe contener conceptos clave del texto
    - Los términos ocultos deben ser palabras importantes que aparecen en el texto

    El texto contiene múltiples documentos delimitados por "--- Inicio del documento: [nombre] | Páginas: [num] ---" y marcadores de página "--- [Página X] ---".
    ${settings.showSourceFile ? "Para cada tarjeta, identifica de qué documento y página proviene. Asigna 'NombreArchivo (Pág. X)' al campo 'sourceFile'." : ""}

    ${distributionInstruction}

    REQUISITOS:
    - Todo en ESPAÑOL
    - ${getDifficultyPrompt(settings.difficulty)}
    - Hasta ${settings.maxClozeBlanks || 3} términos clave ocultos por tarjeta

    TEXTO:
    ${text.slice(0, 30000)}
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
    Genera ${settings.questionCount} preguntas de estudio abiertas basadas en el siguiente texto.

    IMPORTANTE:
    - Usa principalmente información del texto proporcionado
    - Las preguntas deben ser respondibles con el contenido del texto
    - Las respuestas modelo deben basarse en el texto

    El texto contiene múltiples documentos delimitados por "--- Inicio del documento: [nombre] | Páginas: [num] ---" y marcadores de página "--- [Página X] ---".
    ${settings.showSourceFile ? "Para cada pregunta, identifica de qué documento y página proviene. Asigna 'NombreArchivo (Pág. X)' al campo 'sourceFile'." : ""}

    ${distributionInstruction}

    REQUISITOS:
    - Todo en ESPAÑOL
    - ${getDifficultyPrompt(settings.difficulty)}
    - Preguntas CORTAS y CONCISAS
    - Respuestas de 1-2 oraciones máximo

    TEXTO:
    ${text.slice(0, 30000)}
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

export const generateExamTitle = async (text: string): Promise<string> => {
  const ai = getAiClient();

  try {
    const prompt = `
      Analiza el siguiente texto y genera un título corto y descriptivo para un examen.
      El título debe:
      - Ser conciso (máximo 8 palabras)
      - Reflejar el tema principal del contenido
      - Estar en español
      - Ser apropiado para un examen académico
      - NO incluir la palabra "Examen" (se añadirá automáticamente)
      
      Texto: ${text.slice(0, 3000)}
      
      Responde SOLO con el título, sin comillas ni puntuación adicional.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text?.trim() || "Conocimientos Generales";
  } catch (e) {
    console.error("Title generation failed", e);
    return "Conocimientos Generales";
  }
};