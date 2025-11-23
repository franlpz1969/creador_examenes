export enum ExamType {
  TEST = 'TEST',
  CLOZE_FLASHCARD = 'CLOZE_FLASHCARD',
  OPEN_FLASHCARD = 'OPEN_FLASHCARD',
}

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface TestQuestion {
  question: string;
  options: string[];
  correctIndices: number[];
  explanation: string;
  sourceQuote: string;
  sourceFile?: string;
}

export interface ClozeCard {
  fullText: string;
  hiddenWords: string[];
  imagePrompt: string;
  sourceFile?: string;
}

export interface OpenQuestion {
  question: string;
  modelAnswer: string;
  sourceFile?: string;
}

export interface ExamSettings {
  type: ExamType;
  questionCount: number;
  difficulty: Difficulty;
  // Test Mode specific
  optionsCount?: number;
  allowMultipleCorrect?: boolean;
  negativeMarking?: boolean;
  // Cloze specific
  maxClozeBlanks?: number;
  // General
  autoRead?: boolean;
  timeLimit?: number; // in seconds, 0 = no limit
  showSummary?: boolean;
  showSourceFile?: boolean;
  benevolence?: 'STRICT' | 'NORMAL' | 'BENEVOLENT';
  voiceURI?: string;
}

export interface AppState {
  step: 'UPLOAD' | 'SETTINGS' | 'LOADING' | 'EXAM' | 'RESULTS';
  pdfText: string;
  settings: ExamSettings;
  testQuestions: TestQuestion[];
  clozeCards: ClozeCard[];
  openQuestions: OpenQuestion[];
  generatedImages: Record<number, string>; // Map index to base64 image
  uploadedFiles?: Map<string, File>; // Map filename to File object
}