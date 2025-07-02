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
    const { data: allDreams } = await supabase
      .from('dreams')
      .select('transcript, analysis, created_at')
      .eq('user_id', dream.user_id)
      .eq('status', 'complete')
      .neq('id', dream_id)
      .order('created_at', { ascending: false })
      .limit(10); // Get more dreams for relevance selection

    const { data: allMotifs } = await supabase
      .from('recurring_motifs')
      .select('motif, category, count, confidence_score, last_seen')
      .eq('user_id', dream.user_id)
      .order('count', { ascending: false })
      .limit(30); // Get more motifs for filtering

    // Apply smart context selection
    const recentDreams = selectRelevantDreams(transcript, allDreams || []);
    const recurringMotifs = filterActiveMotifs(allMotifs || []);

    // Step 3: Analyze with GPT o3
    try {
      const modelName = 'openai/gpt-o3';
      const analysisPrompt = buildAnalysisPrompt(transcript, recentDreams || [], recurringMotifs || [], modelName);
      
      const analysisResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
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

function selectRelevantDreams(transcript: string, allDreams: any[]): any[] {
  if (!allDreams || allDreams.length === 0) return [];

  // Score each dream for relevance
  const scoredDreams = allDreams.map(dream => {
    const relevanceScore = scoreContextRelevance(transcript, dream);
    return { ...dream, relevanceScore };
  });
  
  // Sort by relevance and take top 3
  return scoredDreams
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 3);
}

function scoreContextRelevance(newTranscript: string, pastDream: any): number {
  if (!pastDream.analysis) return 0;
  
  const newKeywords = extractKeywords(newTranscript);
  const pastThemes = pastDream.analysis.themes || [];
  const pastEmotions = pastDream.analysis.emotions?.primary || [];
  
  // Calculate shared themes (40%)
  const sharedThemes = intersection(newKeywords, pastThemes).length;
  const themeScore = sharedThemes / Math.max(newKeywords.length, pastThemes.length, 1);
  
  // Calculate shared emotions (40%)
  const newEmotions = extractEmotionalWords(newTranscript);
  const sharedEmotions = intersection(newEmotions, pastEmotions).length;
  const emotionScore = sharedEmotions / Math.max(newEmotions.length, pastEmotions.length, 1);
  
  // Calculate recency bonus (20%)
  const daysSince = Math.floor((Date.now() - new Date(pastDream.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.max(0, (30 - daysSince) / 30);
  
  return (themeScore * 0.4) + (emotionScore * 0.4) + (recencyScore * 0.2);
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Common dream themes
  const themes = ['water', 'house', 'car', 'family', 'work', 'school', 'death', 'flying', 'falling', 'chase', 'lost', 'door', 'stairs', 'animal', 'baby', 'wedding', 'fire', 'money', 'phone', 'mirror'];
  themes.forEach(theme => {
    if (lowerText.includes(theme)) keywords.push(theme);
  });
  
  return keywords;
}

function extractEmotionalWords(text: string): string[] {
  const emotions: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Common emotional words
  const emotionalTerms = ['scared', 'afraid', 'happy', 'sad', 'angry', 'excited', 'worried', 'calm', 'anxious', 'peaceful', 'frustrated', 'joy', 'fear', 'love', 'hate', 'confused', 'confident', 'nervous', 'relaxed'];
  emotionalTerms.forEach(term => {
    if (lowerText.includes(term)) emotions.push(term);
  });
  
  return emotions;
}

function intersection(arr1: string[], arr2: string[]): string[] {
  return arr1.filter(item => arr2.includes(item));
}

function filterActiveMotifs(allMotifs: any[]): any[] {
  if (!allMotifs || allMotifs.length === 0) return [];
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return allMotifs
    .filter(motif => {
      // Include recent motifs (count >= 1) and established patterns (count >= 2)
      const lastSeen = new Date(motif.last_seen);
      return lastSeen > thirtyDaysAgo && motif.count >= 1;
    })
    .slice(0, 8); // Limit to top 8 active motifs
}

function buildAnalysisPrompt(transcript: string, recentDreams: any[], recurringMotifs: any[], modelName: string): string {
  // Compress context using hierarchical summaries
  const contextSection = recentDreams.length > 0 
    ? `\n\nRELEVANT DREAM PATTERNS:\n${recentDreams.map((d, i) => {
        const themes = d.analysis?.themes?.slice(0, 3).join(', ') || 'no themes';
        const primaryEmotion = d.analysis?.emotions?.primary?.[0] || 'neutral';
        const daysAgo = Math.floor((Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return `${i + 1}. ${themes} (${primaryEmotion}, ${daysAgo}d ago)`;
      }).join('\n')}`
    : '';

  const motifsSection = recurringMotifs.length > 0
    ? `\n\nACTIVE RECURRING MOTIFS:\n${recurringMotifs.map(m => 
        `- ${m.motif} (${m.category || 'symbol'}, ${m.count}x)`
      ).join('\n')}`
    : '';

  return `Analyze this dream using Jungian psychology and cognitive neuroscience. Provide comprehensive analysis in this JSON format:

DREAM: "${transcript}"
${contextSection}
${motifsSection}

{
  "sentiment": {"overall": -1.0, "progression": [0.2, -0.1], "emotional_intensity": 0.7, "polarity_shifts": 2},
  "emotions": {
    "primary": ["anxiety"], "secondary": ["hope"], 
    "emotional_arc": {"beginning": ["anxiety"], "middle": ["curiosity"], "end": ["relief"]},
    "unresolved_emotions": ["fear"]
  },
  "jungian_analysis": {
    "archetypes": [{"archetype": "Shadow", "manifestation": "pursuing figure", "strength": 0.8, "interpretation": "repressed aspects"}],
    "individuation_themes": ["integration", "confronting unknown"],
    "collective_symbols": [{"symbol": "water", "interpretation": "unconscious emotions", "confidence": 0.9, "cultural_context": "universal transformation symbol"}],
    "shadow_elements": ["fear", "hidden desires"],
    "anima_animus_presence": {"present": true, "manifestation": "wise figure", "interpretation": "inner wisdom"},
    "persona_vs_shadow": {
      "persona_elements": ["composed appearance"], 
      "shadow_elements": ["vulnerability"],
      "integration_opportunities": ["accepting weakness as strength"]
    }
  },
  "cognitive_analysis": {
    "threat_simulation": {"present": true, "type": "social rejection", "adaptive_value": "rehearsing coping"},
    "memory_consolidation": {"episodic_memories": ["recent events"], "procedural_learning": ["problem-solving"], "emotional_processing": ["anxiety processing"]},
    "emotional_regulation": {"coping_mechanisms": ["seeking help"], "unresolved_conflicts": ["self-worth"], "integration_attempts": ["finding balance"]},
    "problem_solving": {"creative_solutions": ["novel approaches"], "rehearsal_scenarios": ["social situations"], "alternative_perspectives": ["reframing challenges"]}
  },
  "symbols": [{
    "item": "door", "context": "blocked path", 
    "personal_associations": ["barriers"], "universal_meanings": ["transition"], 
    "interpretation": "life obstacles requiring new approaches", "confidence": 0.85, "emotional_charge": -0.3
  }],
  "themes": ["obstacles", "self-discovery", "transformation"],
  "narrative_structure": {
    "type": "linear", "coherence_score": 0.8, "resolution": "ambiguous",
    "narrative_themes": ["journey"], 
    "story_arc": {"exposition": "unfamiliar situation", "rising_action": ["obstacles"], "climax": "realization", "resolution": "new understanding"}
  },
  "psychological_insights": "Comprehensive interpretation connecting dream elements to psychological patterns and life themes.",
  "connections_to_previous": ["Similar patterns from past dreams"],
  "questions_to_explore": ["Key questions for deeper reflection", "Integration opportunities"],
  "processing_metadata": {"analysis_version": "1.0", "model_used": "${modelName}", "confidence_score": 0.82, "analysis_depth": "comprehensive"}
}

Provide rich, detailed analysis maintaining full psychological depth and scientific rigor.`;
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