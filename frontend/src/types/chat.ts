export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  id?: string;
}

export interface DreamAnalysis {
  themes?: string[];
  emotions?: {
    primary?: string[];
    secondary?: string[];
  };
  symbols?: Array<{
    item: string;
    [key: string]: unknown;
  }>;
  psychological_insights?: string;
  [key: string]: unknown;
}

export interface DreamReference {
  id: string;
  created_at: string;
  transcript: string;
  analysis: DreamAnalysis | null;
  similarity_score: number;
}

export interface ChatResponse {
  message: string;
  dream_references: DreamReference[];
  conversation_id: string;
  timestamp: string;
}

export interface Dream {
  id: string;
  created_at: string;
  transcript: string | null;
  analysis: DreamAnalysis | null;
  status: 'uploaded' | 'transcribing' | 'analyzing' | 'complete' | 'failed';
  audio_path: string;
  dropbox_path?: string;
}