import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  dream_id: string;
  trigger?: 'ingest' | 'manual' | 'retry';
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { dream_id }: AnalyzeRequest = await req.json();
    
    if (!dream_id) {
      return new Response(
        JSON.stringify({ error: 'dream_id is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get dream record
    const { data: dream, error: dreamError } = await supabase
      .from('dreams')
      .select('*')
      .eq('id', dream_id)
      .single();

    if (dreamError || !dream) {
      return new Response(
        JSON.stringify({ error: 'Dream not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if already processed or in progress
    if (dream.status === 'complete') {
      return new Response(
        JSON.stringify({ 
          message: 'Dream already analyzed',
          dream_id: dream.id 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prevent infinite retries
    if (dream.processing_attempts >= 3) {
      await supabase
        .from('dreams')
        .update({ 
          status: 'failed',
          error_message: 'Maximum processing attempts exceeded'
        })
        .eq('id', dream_id);

      return new Response(
        JSON.stringify({ error: 'Maximum processing attempts exceeded' }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update status to analyzing and increment attempts
    await supabase
      .from('dreams')
      .update({ 
        status: 'analyzing',
        processing_attempts: dream.processing_attempts + 1
      })
      .eq('id', dream_id);

    let transcript = dream.transcript;
    
    // Get API keys from environment
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENROUTER_API_KEY) {
      console.error('Failed to get OPENROUTER_API_KEY');
      
      await supabase
        .from('dreams')
        .update({ 
          status: 'failed',
          error_message: 'Missing OPENROUTER_API_KEY configuration'
        })
        .eq('id', dream_id);

      return new Response(
        JSON.stringify({ error: 'Missing API key configuration' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 1: Transcribe if not already done
    if (!transcript) {
      await supabase
        .from('dreams')
        .update({ status: 'transcribing' })
        .eq('id', dream_id);

      try {
        // Get audio file from storage
        const { data: audioData, error: downloadError } = await supabase.storage
          .from('dreams-audio')
          .download(dream.audio_path);

        if (downloadError) {
          throw new Error(`Failed to download audio: ${downloadError.message}`);
        }

        // Transcribe with Whisper via OpenAI API (OpenRouter doesn't support audio transcription)
        if (!OPENAI_API_KEY) {
          throw new Error('OpenAI API key is required for Whisper transcription');
        }

        const formData = new FormData();
        formData.append('file', new Blob([audioData], { type: 'audio/m4a' }), 'audio.m4a');
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');

        const transcribeResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: formData
        });

        if (!transcribeResponse.ok) {
          const errorText = await transcribeResponse.text();
          console.error('OpenAI Whisper transcription error:', {
            status: transcribeResponse.status,
            statusText: transcribeResponse.statusText,
            error: errorText,
            headers: Object.fromEntries(transcribeResponse.headers.entries())
          });
          throw new Error(`Transcription failed (${transcribeResponse.status}): ${errorText}`);
        }

        const transcriptionResult = await transcribeResponse.json();
        transcript = transcriptionResult.text;

        if (!transcript || transcript.trim().length === 0) {
          throw new Error('Empty transcription result');
        }

        // Update dream with transcript
        await supabase
          .from('dreams')
          .update({ 
            transcript,
            status: 'analyzing'
          })
          .eq('id', dream_id);

      } catch (transcriptionError) {
        console.error('Transcription error:', transcriptionError);
        
        await supabase
          .from('dreams')
          .update({ 
            status: 'failed',
            error_message: `Transcription failed: ${transcriptionError.message}`
          })
          .eq('id', dream_id);

        return new Response(
          JSON.stringify({ 
            error: 'Transcription failed',
            details: transcriptionError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Step 2: Get user context for analysis
    const { data: recentDreams } = await supabase
      .from('dreams')
      .select('transcript, analysis, created_at')
      .eq('user_id', dream.user_id)
      .eq('status', 'complete')
      .neq('id', dream_id)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recurringMotifs } = await supabase
      .from('recurring_motifs')
      .select('motif, category, count, confidence_score')
      .eq('user_id', dream.user_id)
      .order('count', { ascending: false })
      .limit(20);

    // Step 3: Analyze with Claude Sonnet 4
    try {
      const analysisPrompt = buildAnalysisPrompt(transcript, recentDreams || [], recurringMotifs || []);
      
      const analysisResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            {
              role: 'system',
              content: 'You are an expert dream analyst combining Jungian psychology and cognitive neuroscience. Provide comprehensive dream analysis in the exact JSON format requested.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      });

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        throw new Error(`Analysis failed: ${errorText}`);
      }

      const analysisResult = await analysisResponse.json();
      const analysisText = analysisResult.choices[0].message.content;
      
      // Parse the JSON analysis
      let analysis;
      try {
        // Extract JSON from the response (in case it's wrapped in markdown)
        const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/) || 
                         analysisText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysisText;
        analysis = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Failed to parse analysis JSON:', parseError);
        console.error('Raw analysis text:', analysisText);
        throw new Error('Failed to parse analysis result');
      }

      // Generate embedding for the transcript using OpenAI API
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: transcript
        })
      });

      let embedding = null;
      if (embeddingResponse.ok) {
        const embeddingResult = await embeddingResponse.json();
        embedding = embeddingResult.data[0].embedding;
      }

      // Update dream with complete analysis
      const { error: updateError } = await supabase
        .from('dreams')
        .update({
          analysis,
          embedding,
          status: 'complete'
        })
        .eq('id', dream_id);

      if (updateError) {
        throw new Error(`Failed to save analysis: ${updateError.message}`);
      }

      // Step 4: Update recurring motifs
      await updateRecurringMotifs(supabase, dream.user_id, analysis);

      return new Response(
        JSON.stringify({
          success: true,
          dream_id: dream_id,
          message: 'Dream analyzed successfully'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (analysisError) {
      console.error('Analysis error:', analysisError);
      
      await supabase
        .from('dreams')
        .update({ 
          status: 'failed',
          error_message: `Analysis failed: ${analysisError.message}`
        })
        .eq('id', dream_id);

      return new Response(
        JSON.stringify({ 
          error: 'Analysis failed',
          details: analysisError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Unhandled error in analyze function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function buildAnalysisPrompt(transcript: string, recentDreams: any[], recurringMotifs: any[]): string {
  const contextSection = recentDreams.length > 0 
    ? `\n\nRECENT DREAMS CONTEXT:\n${recentDreams.map((d, i) => 
        `${i + 1}. ${d.transcript?.substring(0, 200)}...`
      ).join('\n')}`
    : '';

  const motifsSection = recurringMotifs.length > 0
    ? `\n\nKNOWN RECURRING MOTIFS:\n${recurringMotifs.map(m => 
        `- ${m.motif} (${m.category || 'uncategorized'}, appeared ${m.count} times)`
      ).join('\n')}`
    : '';

  return `Please analyze this dream transcript using both Jungian psychology and cognitive neuroscience frameworks.

DREAM TRANSCRIPT:
"${transcript}"
${contextSection}
${motifsSection}

Provide a comprehensive analysis in the following JSON format:

{
  "sentiment": {
    "overall": -1.0, // -1 to 1
    "progression": [0.2, -0.1, 0.8], // sentiment changes throughout dream
    "emotional_intensity": 0.7,
    "polarity_shifts": 2
  },
  "emotions": {
    "primary": ["anxiety", "curiosity"],
    "secondary": ["nostalgia", "hope"],
    "emotional_arc": {
      "beginning": ["anxiety"],
      "middle": ["curiosity", "excitement"], 
      "end": ["relief", "hope"]
    },
    "unresolved_emotions": ["underlying fear"]
  },
  "jungian_analysis": {
    "archetypes": [
      {
        "archetype": "The Shadow",
        "manifestation": "the pursuing figure",
        "strength": 0.8,
        "interpretation": "represents repressed aspects of self"
      }
    ],
    "individuation_themes": ["integration of opposites", "confronting the unknown"],
    "collective_symbols": [
      {
        "symbol": "water",
        "interpretation": "unconscious, emotions, purification",
        "confidence": 0.9,
        "cultural_context": "universal symbol of life and transformation"
      }
    ],
    "shadow_elements": ["fear of judgment", "hidden desires"],
    "anima_animus_presence": {
      "present": true,
      "manifestation": "the wise woman figure",
      "interpretation": "connection to inner wisdom"
    },
    "persona_vs_shadow": {
      "persona_elements": ["trying to appear composed"],
      "shadow_elements": ["panic and vulnerability"],
      "integration_opportunities": ["accepting vulnerability as strength"]
    }
  },
  "cognitive_analysis": {
    "threat_simulation": {
      "present": true,
      "type": "social rejection",
      "adaptive_value": "rehearsing coping mechanisms"
    },
    "memory_consolidation": {
      "episodic_memories": ["recent job interview"],
      "procedural_learning": ["problem-solving under pressure"],
      "emotional_processing": ["processing anxiety about performance"]
    },
    "emotional_regulation": {
      "coping_mechanisms": ["seeking help", "strategic retreat"],
      "unresolved_conflicts": ["self-worth vs. external validation"],
      "integration_attempts": ["finding balance between confidence and humility"]
    },
    "problem_solving": {
      "creative_solutions": ["thinking outside conventional approaches"],
      "rehearsal_scenarios": ["handling difficult social situations"],
      "alternative_perspectives": ["seeing challenges as opportunities"]
    }
  },
  "symbols": [
    {
      "item": "door",
      "context": "locked door blocking path",
      "personal_associations": ["barriers", "opportunity"],
      "universal_meanings": ["transition", "choice", "access"],
      "interpretation": "represents current life obstacles and the need to find new approaches",
      "confidence": 0.85,
      "emotional_charge": -0.3
    }
  ],
  "themes": ["overcoming obstacles", "self-discovery", "transformation"],
  "narrative_structure": {
    "type": "linear",
    "coherence_score": 0.8,
    "resolution": "ambiguous",
    "narrative_themes": ["journey", "challenge", "growth"],
    "story_arc": {
      "exposition": "finding oneself in an unfamiliar situation",
      "rising_action": ["encountering obstacles", "attempting solutions"],
      "climax": "moment of realization or breakthrough",
      "resolution": "new understanding or unresolved tension"
    }
  },
  "psychological_insights": "This dream appears to be processing anxiety about performance and acceptance, while also exploring themes of personal growth and authentic self-expression. The symbolic elements suggest a readiness for transformation but also apprehension about the unknown.",
  "connections_to_previous": ["Similar themes of doors/barriers in previous dreams", "Recurring anxiety patterns around evaluation"],
  "questions_to_explore": [
    "What specific barriers feel most challenging in your waking life?",
    "How might you integrate the wisdom shown in this dream?",
    "What would it mean to embrace vulnerability as strength?"
  ],
  "processing_metadata": {
    "analysis_version": "1.0",
    "processing_time_ms": 2500,
    "model_used": "claude-3.5-sonnet",
    "confidence_score": 0.82,
    "token_usage": {
      "input_tokens": 1200,
      "output_tokens": 800,
      "total_cost_usd": 0.024
    },
    "analysis_depth": "comprehensive"
  }
}

Focus on providing actionable psychological insights while maintaining scientific rigor. Consider both the personal context and universal dream symbolism.`;
}

async function updateRecurringMotifs(supabase: any, userId: string, analysis: any) {
  if (!analysis.symbols || !Array.isArray(analysis.symbols)) return;

  const today = new Date().toISOString().split('T')[0];

  for (const symbol of analysis.symbols) {
    if (!symbol.item || symbol.confidence < 0.6) continue;

    // Check if motif already exists
    const { data: existingMotif } = await supabase
      .from('recurring_motifs')
      .select('*')
      .eq('user_id', userId)
      .eq('motif', symbol.item.toLowerCase())
      .single();

    if (existingMotif) {
      // Update existing motif
      await supabase
        .from('recurring_motifs')
        .update({
          count: existingMotif.count + 1,
          last_seen: today,
          confidence_score: Math.max(existingMotif.confidence_score, symbol.confidence)
        })
        .eq('id', existingMotif.id);
    } else {
      // Create new motif
      await supabase
        .from('recurring_motifs')
        .insert({
          user_id: userId,
          motif: symbol.item.toLowerCase(),
          category: 'symbol', // Could be enhanced to detect category
          first_seen: today,
          last_seen: today,
          count: 1,
          confidence_score: symbol.confidence
        });
    }
  }

  // Also process themes as motifs
  if (analysis.themes && Array.isArray(analysis.themes)) {
    for (const theme of analysis.themes) {
      const { data: existingTheme } = await supabase
        .from('recurring_motifs')
        .select('*')
        .eq('user_id', userId)
        .eq('motif', theme.toLowerCase())
        .single();

      if (existingTheme) {
        await supabase
          .from('recurring_motifs')
          .update({
            count: existingTheme.count + 1,
            last_seen: today
          })
          .eq('id', existingTheme.id);
      } else {
        await supabase
          .from('recurring_motifs')
          .insert({
            user_id: userId,
            motif: theme.toLowerCase(),
            category: 'theme',
            first_seen: today,
            last_seen: today,
            count: 1,
            confidence_score: 0.8
          });
      }
    }
  }
}