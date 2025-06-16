// Database types
export interface Dream {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  audio_path: string;
  transcript: string | null;
  transcript_confidence: number | null;
  analysis: DreamAnalysis | null;
  embedding: number[] | null;
  status: 'uploaded' | 'transcribing' | 'analyzing' | 'complete' | 'failed';
  error_message: string | null;
  processing_attempts: number;
  audio_duration_seconds: number | null;
  recording_date: string;
}

export interface RecurringMotif {
  id: string;
  user_id: string;
  motif: string;
  category: 'person' | 'place' | 'object' | 'emotion' | 'action' | 'symbol' | null;
  first_seen: string;
  last_seen: string;
  count: number;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyDigest {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  summary: string | null;
  key_themes: string[] | null;
  emotional_patterns: EmotionalPatterns | null;
  recurring_motifs_summary: RecurringMotifsWeeklySummary | null;
  insights: string[] | null;
  dreams_analyzed: number;
  token_cost: number | null;
  processing_time_seconds: number | null;
  created_at: string;
}

export interface DreamTag {
  id: string;
  dream_id: string;
  tag: string;
  confidence: number;
  source: 'user' | 'ai' | 'pattern_detection';
  created_at: string;
}

// Analysis structure types
export interface DreamAnalysis {
  sentiment: SentimentAnalysis;
  emotions: EmotionalAnalysis;
  jungian_analysis: JungianAnalysis;
  cognitive_analysis: CognitiveAnalysis;
  symbols: SymbolAnalysis[];
  themes: string[];
  narrative_structure: NarrativeStructure;
  psychological_insights: string;
  connections_to_previous: string[];
  questions_to_explore: string[];
  processing_metadata: ProcessingMetadata;
}

export interface SentimentAnalysis {
  overall: number; // -1 to 1
  progression: number[]; // sentiment over time in dream
  emotional_intensity: number; // 0 to 1
  polarity_shifts: number; // count of major sentiment changes
}

export interface EmotionalAnalysis {
  primary: string[];
  secondary: string[];
  emotional_arc: {
    beginning: string[];
    middle: string[];
    end: string[];
  };
  unresolved_emotions: string[];
}

export interface JungianAnalysis {
  archetypes: ArchetypePresence[];
  individuation_themes: string[];
  collective_symbols: CollectiveSymbol[];
  shadow_elements: string[];
  anima_animus_presence: {
    present: boolean;
    manifestation?: string;
    interpretation?: string;
  };
  persona_vs_shadow: {
    persona_elements: string[];
    shadow_elements: string[];
    integration_opportunities: string[];
  };
}

export interface ArchetypePresence {
  archetype: string;
  manifestation: string;
  strength: number; // 0 to 1
  interpretation: string;
}

export interface CollectiveSymbol {
  symbol: string;
  interpretation: string;
  confidence: number; // 0 to 1
  cultural_context: string;
}

export interface CognitiveAnalysis {
  threat_simulation: {
    present: boolean;
    type?: string;
    adaptive_value?: string;
  };
  memory_consolidation: {
    episodic_memories: string[];
    procedural_learning: string[];
    emotional_processing: string[];
  };
  emotional_regulation: {
    coping_mechanisms: string[];
    unresolved_conflicts: string[];
    integration_attempts: string[];
  };
  problem_solving: {
    creative_solutions: string[];
    rehearsal_scenarios: string[];
    alternative_perspectives: string[];
  };
}

export interface SymbolAnalysis {
  item: string;
  context: string;
  personal_associations: string[];
  universal_meanings: string[];
  interpretation: string;
  confidence: number; // 0 to 1
  emotional_charge: number; // -1 to 1
}

export interface NarrativeStructure {
  type: 'linear' | 'fragmented' | 'cyclical' | 'surreal' | 'nested';
  coherence_score: number; // 0 to 1
  resolution: 'resolved' | 'unresolved' | 'ambiguous' | 'interrupted';
  narrative_themes: string[];
  story_arc: {
    exposition: string;
    rising_action: string[];
    climax: string;
    resolution: string;
  };
}

export interface ProcessingMetadata {
  analysis_version: string;
  processing_time_ms: number;
  model_used: string;
  confidence_score: number; // 0 to 1
  token_usage: {
    input_tokens: number;
    output_tokens: number;
    total_cost_usd: number;
  };
  analysis_depth: 'basic' | 'standard' | 'comprehensive';
}

// Weekly digest related types
export interface EmotionalPatterns {
  dominant_emotions: string[];
  emotional_trends: {
    emotion: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    significance: number;
  }[];
  emotional_balance: {
    positive_ratio: number;
    negative_ratio: number;
    neutral_ratio: number;
  };
  stress_indicators: string[];
}

export interface RecurringMotifsWeeklySummary {
  new_motifs: string[];
  strengthening_motifs: {
    motif: string;
    previous_count: number;
    current_count: number;
  }[];
  fading_motifs: string[];
  persistent_themes: string[];
}

// API request/response types
export interface TranscriptionRequest {
  audio_path: string;
  dream_id: string;
}

export interface AnalysisRequest {
  dream_id: string;
  transcript: string;
  user_context?: UserContext;
}

export interface UserContext {
  recent_dreams: Dream[];
  recurring_motifs: RecurringMotif[];
  life_events?: LifeEvent[];
  preferences?: AnalysisPreferences;
}

export interface LifeEvent {
  date: string;
  event: string;
  impact_level: 'low' | 'medium' | 'high';
  emotional_impact: string[];
}

export interface AnalysisPreferences {
  focus_areas: ('jungian' | 'cognitive' | 'emotional' | 'symbolic')[];
  depth_level: 'basic' | 'standard' | 'comprehensive';
  include_connections: boolean;
  privacy_level: 'standard' | 'enhanced';
}

// Chat/RAG types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: DreamReference[];
}

export interface DreamReference {
  dream_id: string;
  relevance_score: number;
  excerpt: string;
  date: string;
}

export interface RAGQuery {
  question: string;
  user_id: string;
  max_dreams?: number;
  date_range?: {
    start: string;
    end: string;
  };
  focus_areas?: string[];
}

// Error types
export interface ProcessingError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retry_after?: number;
  permanent?: boolean;
}

// Export utility types
export type DreamStatus = Dream['status'];
export type MotifCategory = RecurringMotif['category'];
export type TagSource = DreamTag['source'];
export type NarrativeType = NarrativeStructure['type'];
export type ResolutionType = NarrativeStructure['resolution'];
export type AnalysisDepth = ProcessingMetadata['analysis_depth'];