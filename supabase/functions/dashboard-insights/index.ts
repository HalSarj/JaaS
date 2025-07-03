import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DashboardRequest {
  user_id?: string;
  force_refresh?: boolean;
}

interface DashboardInsights {
  pattern_insight: string;
  today_practice: {
    type: 'immediate' | 'deeper';
    action: string;
    duration_minutes: number;
  };
  integration_bridge: string;
  shadow_analysis: string;
  context_thread: string;
  generated_at: string;
  dreams_analyzed: number;
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

    const requestBody = await req.json() as DashboardRequest;
    const { user_id = null, force_refresh = false } = requestBody;

    // Check for existing insights if not forcing refresh
    if (!force_refresh) {
      const { data: existingInsights } = await supabase
        .from('dashboard_insights')
        .select('*')
        .eq('user_id', user_id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      // If we have insights from today, return them
      if (existingInsights) {
        const generatedDate = new Date(existingInsights.generated_at);
        const today = new Date();
        const isToday = generatedDate.toDateString() === today.toDateString();
        
        if (isToday) {
          return new Response(
            JSON.stringify(existingInsights.insights),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Get recent dreams for analysis
    let dreamQuery = supabase
      .from('dreams')
      .select('*')
      .eq('status', 'complete')
      .not('analysis', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (user_id === null) {
      dreamQuery = dreamQuery.is('user_id', null);
    } else {
      dreamQuery = dreamQuery.eq('user_id', user_id);
    }

    const { data: recentDreams, error: dreamsError } = await dreamQuery;

    if (dreamsError) {
      throw new Error(`Failed to fetch dreams: ${dreamsError.message}`);
    }

    if (!recentDreams || recentDreams.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No analyzed dreams found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate insights using AI
    const insights = await generateDashboardInsights(recentDreams);
    
    // Store insights in database
    const { error: insertError } = await supabase
      .from('dashboard_insights')
      .insert({
        user_id: user_id,
        insights: insights,
        generated_at: new Date().toISOString(),
        dreams_analyzed: recentDreams.length
      });

    if (insertError) {
      console.error('Failed to store insights:', insertError);
      // Continue anyway, just log the error
    }

    return new Response(
      JSON.stringify(insights),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Dashboard insights error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function generateDashboardInsights(dreams: any[]): Promise<DashboardInsights> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const prompt = buildInsightsPrompt(dreams);
  
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/o3-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert Jungian dream analyst. Create practical daily guidance based on recent dream patterns. Respond only with valid JSON in the exact format requested.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    let errorMessage = `OpenRouter API error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage += ` - ${errorData.error?.message || JSON.stringify(errorData)}`;
    } catch (e) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      errorMessage += ` - ${errorText}`;
    }
    throw new Error(errorMessage);
  }

  let result;
  try {
    result = await response.json();
  } catch (e) {
    throw new Error('Failed to parse OpenRouter API response as JSON');
  }

  if (!result.choices || !result.choices[0] || !result.choices[0].message) {
    throw new Error('Invalid OpenRouter API response structure');
  }

  const content = result.choices[0].message.content;
  
  if (!content) {
    throw new Error('No content returned from AI');
  }

  try {
    // Extract JSON from potentially wrapped text (e.g., markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', content);
      throw new Error('Invalid response format from AI - no JSON detected');
    }

    const jsonString = jsonMatch[0];
    const insights = JSON.parse(jsonString);
    
    // Validate required fields
    const requiredFields = ['pattern_insight', 'today_practice', 'integration_bridge', 'shadow_analysis', 'context_thread'];
    const missingFields = requiredFields.filter(field => !insights[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields in AI response: ${missingFields.join(', ')}`);
    }

    // Validate today_practice structure
    if (!insights.today_practice?.action || !insights.today_practice?.type || typeof insights.today_practice?.duration_minutes !== 'number') {
      throw new Error('Invalid today_practice structure in AI response');
    }
    
    // Add metadata
    insights.generated_at = new Date().toISOString();
    insights.dreams_analyzed = dreams.length;
    
    return insights;
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    console.error('Parse error:', e);
    throw new Error(`Invalid response format from AI: ${e instanceof Error ? e.message : 'Unknown parsing error'}`);
  }
}

function buildInsightsPrompt(dreams: any[]): string {
  const dreamSummaries = dreams.map((dream, index) => {
    const themes = dream.analysis?.themes?.slice(0, 3)?.join(', ') || 'No themes';
    const emotions = dream.analysis?.emotions?.primary?.slice(0, 2)?.join(', ') || 'No emotions';
    const symbols = dream.analysis?.symbols?.slice(0, 2)?.map((s: any) => s.item || s)?.join(', ') || 'No symbols';
    
    return `Dream ${index + 1} (${new Date(dream.created_at).toLocaleDateString()}):
- Themes: ${themes}
- Emotions: ${emotions}
- Key symbols: ${symbols}
- Transcript excerpt: "${dream.transcript?.substring(0, 150)}..."`;
  }).join('\n\n');

  return `Analyze these recent dreams and create practical morning guidance for today. Focus on behavioral suggestions and actionable integration.

RECENT DREAMS:
${dreamSummaries}

CRITICAL: You must respond with ONLY valid JSON in the exact format below. Do not include any text before or after the JSON. Do not use markdown code blocks.

{
  "pattern_insight": "A 2-3 sentence interpretation of the key pattern or relationship between these dreams. What's the underlying psychological theme or message?",
  "today_practice": {
    "type": "immediate",
    "action": "A specific behavioral suggestion for today - something the person can actually do. Make it practical and connected to the dream patterns.",
    "duration_minutes": 5
  },
  "integration_bridge": "How to apply the dream wisdom to daily interactions and decisions today. Be specific about real-life application.",
  "shadow_analysis": "Direct, unflinching analysis of shadow elements, blind spots, and unconscious patterns revealed in the dreams. Focus on what the psyche is trying to show about hidden aspects of personality, defense mechanisms, or avoided truths. Be honest and clear without being needlessly harsh - the goal is insight, not judgment.",
  "context_thread": "A brief note on how these recent patterns might relate to longer-term psychological development or growth themes."
}

IMPORTANT REQUIREMENTS:
- All text fields must be non-empty strings
- duration_minutes must be a number between 5 and 30
- type must be either "immediate" or "deeper"
- Response must be valid JSON only - no additional text
- Keep all text conversational and accessible, not overly clinical
- Make the "today_practice" genuinely doable and specific
- Choose "immediate" (5-10 mins) for most practices, only use "deeper" (20-30 mins) and increase duration_minutes if the patterns suggest significant integration work is needed
- Focus on Jungian principles applied practically
- Be encouraging but realistic in most sections
- For "shadow_analysis": Provide direct, unflinching insight into hidden aspects, defense mechanisms, and blind spots. Be honest without being needlessly harsh; the aim is understanding, not judgment
- No generic advice - make it specific to these dream patterns`;
}