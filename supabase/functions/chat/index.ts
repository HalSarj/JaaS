import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface ChatRequest {
  message: string;
  user_id: string | null;
  conversation_history?: ChatMessage[];
  max_dreams?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface DreamContext {
  id: string;
  created_at: string;
  transcript: string;
  analysis: any;
  similarity_score: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey || !openrouterApiKey) {
      return new Response('Server configuration error', {
        status: 500,
        headers: corsHeaders
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders
      });
    }

    const { message, user_id, conversation_history = [], max_dreams = 5 }: ChatRequest = await req.json();

    if (!message || (user_id === undefined)) {
      return new Response('Missing required fields', {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('Chat request:', { message, user_id, max_dreams });

    // For now, let's get dreams without vector search since our test dreams don't have embeddings
    let query = supabase
      .from('dreams')
      .select('*')
      .eq('status', 'complete')
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(max_dreams);
    
    if (user_id === null) {
      query = query.is('user_id', null);
    } else {
      query = query.eq('user_id', user_id);
    }

    const { data: relevantDreams, error: searchError } = await query;

    if (searchError) {
      console.error('Dream search error:', searchError);
      // Continue without dreams if search fails
    }

    console.log(`Found ${relevantDreams?.length || 0} relevant dreams`);

    // 3. Format dream context for the LLM
    let dreamContext = '';
    const dreamReferences: DreamContext[] = [];

    if (relevantDreams && relevantDreams.length > 0) {
      dreamContext = '\n\n## Relevant Dreams from User\'s History:\n\n';
      
      relevantDreams.forEach((dream: any, index: number) => {
        const dreamDate = new Date(dream.created_at).toLocaleDateString();
        
        dreamContext += `### Dream ${index + 1} (${dreamDate})\n`;
        dreamContext += `**Transcript:** ${dream.transcript || 'No transcript available'}\n\n`;
        
        if (dream.analysis) {
          if (dream.analysis.themes) {
            dreamContext += `**Key Themes:** ${dream.analysis.themes.join(', ')}\n`;
          }
          if (dream.analysis.emotions?.primary) {
            dreamContext += `**Primary Emotions:** ${dream.analysis.emotions.primary.join(', ')}\n`;
          }
          if (dream.analysis.symbols && dream.analysis.symbols.length > 0) {
            const topSymbols = dream.analysis.symbols.slice(0, 3).map((s: any) => s.item).join(', ');
            dreamContext += `**Key Symbols:** ${topSymbols}\n`;
          }
          if (dream.analysis.psychological_insights) {
            dreamContext += `**Insights:** ${dream.analysis.psychological_insights}\n`;
          }
        }
        
        dreamContext += '\n---\n\n';
        
        dreamReferences.push({
          id: dream.id,
          created_at: dream.created_at,
          transcript: dream.transcript,
          analysis: dream.analysis,
          similarity_score: 1.0 // Default to high relevance when not using vector search
        });
      });
    }

    // 4. Build conversation history
    let conversationContext = '';
    if (conversation_history.length > 0) {
      conversationContext = '\n\n## Previous Conversation:\n\n';
      conversation_history.slice(-10).forEach(msg => {
        conversationContext += `**${msg.role}:** ${msg.content}\n\n`;
      });
    }

    // 5. Create system prompt for dream analysis
    const systemPrompt = `You are a Jungian-oriented dream guide helping users discover what their unconscious is revealing. Use collaborative discovery - ask probing questions, identify patterns, and help users connect dream material to their personal development. Focus on what the psyche is showing them, then guide toward practical integration in real life. Be direct about psychological material but supportive in helping them work with it.`;

    const userPrompt = `${message}${dreamContext}${conversationContext}`;

    console.log('Sending request to LLM...');

    // 6. Generate response using Claude
    const chatResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/o3-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        stream: false
      })
    });

    if (!chatResponse.ok) {
      throw new Error(`Failed to generate response: ${await chatResponse.text()}`);
    }

    const chatData = await chatResponse.json();
    const assistantMessage = chatData.choices[0].message.content;

    console.log('Generated response successfully');

    // 7. Return response with dream references
    return new Response(JSON.stringify({
      message: assistantMessage,
      dream_references: dreamReferences,
      conversation_id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Chat function error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process chat request',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});