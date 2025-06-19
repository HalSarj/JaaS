import { getSupabaseClient } from './supabase'
import { getCurrentUserId } from './auth'
import { ChatMessage, ChatResponse, Dream } from '@/types/chat'

export class ApiClient {
  private baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  async sendChatMessage(
    message: string, 
    conversationHistory: ChatMessage[] = [],
    maxDreams: number = 5
  ): Promise<ChatResponse> {
    if (!this.baseUrl) {
      throw new Error('Supabase URL not configured')
    }
    
    const userId = getCurrentUserId()
    
    const response = await fetch(`${this.baseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        user_id: userId === 'null' ? null : userId,
        conversation_history: conversationHistory,
        max_dreams: maxDreams
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.details || 'Failed to send message')
    }

    return response.json()
  }

  async getDreams(): Promise<Dream[]> {
    const client = getSupabaseClient()
    const userId = getCurrentUserId()
    
    let query = client
      .from('dreams')
      .select('*')
    
    if (userId === null) {
      query = query.is('user_id', null)
    } else {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch dreams: ${error.message}`)
    }

    return data || []
  }

  async getDream(id: string): Promise<Dream | null> {
    const client = getSupabaseClient()
    const userId = getCurrentUserId()
    
    let query = client
      .from('dreams')
      .select('*')
      .eq('id', id)
    
    if (userId === null) {
      query = query.is('user_id', null)
    } else {
      query = query.eq('user_id', userId)
    }
    
    const { data, error } = await query.single()

    if (error) {
      console.error('Failed to fetch dream:', error)
      return null
    }

    return data
  }

  async deleteDream(id: string): Promise<void> {
    const client = getSupabaseClient()
    const userId = getCurrentUserId()
    
    let query = client
      .from('dreams')
      .delete()
      .eq('id', id)
    
    if (userId === null) {
      query = query.is('user_id', null)
    } else {
      query = query.eq('user_id', userId)
    }
    
    const { error } = await query

    if (error) {
      throw new Error(`Failed to delete dream: ${error.message}`)
    }
  }

  async searchDreams(query: string): Promise<Dream[]> {
    const client = getSupabaseClient()
    const userId = getCurrentUserId()
    
    let searchQuery = client
      .from('dreams')
      .select('*')
    
    if (userId === null) {
      searchQuery = searchQuery.is('user_id', null)
    } else {
      searchQuery = searchQuery.eq('user_id', userId)
    }
    
    const { data, error } = await searchQuery
      .ilike('transcript', `%${query}%`)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to search dreams: ${error.message}`)
    }

    return data || []
  }

  async getDashboardInsights(forceRefresh = false): Promise<{
    pattern_insight: string;
    today_practice: {
      type: 'immediate' | 'deeper';
      action: string;
      duration_minutes: number;
    };
    integration_bridge: string;
    reflection_prompt: string;
    context_thread: string;
    generated_at: string;
    dreams_analyzed: number;
  }> {
    if (!this.baseUrl) {
      throw new Error('Supabase URL not configured')
    }
    
    const userId = getCurrentUserId()
    
    const response = await fetch(`${this.baseUrl}/functions/v1/dashboard-insights`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId === 'null' ? null : userId,
        force_refresh: forceRefresh
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.details || error.error || 'Failed to fetch dashboard insights')
    }

    return response.json()
  }
}

export const apiClient = new ApiClient()