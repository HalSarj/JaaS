import { supabase } from './supabase'
import { getCurrentUserId } from './auth'
import { ChatMessage, ChatResponse, Dream } from '@/types/chat'

export class ApiClient {
  private baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  async sendChatMessage(
    message: string, 
    conversationHistory: ChatMessage[] = [],
    maxDreams: number = 5
  ): Promise<ChatResponse> {
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
    const userId = getCurrentUserId()
    
    let query = supabase
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
    const userId = getCurrentUserId()
    
    let query = supabase
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

  async searchDreams(query: string): Promise<Dream[]> {
    const userId = getCurrentUserId()
    
    let searchQuery = supabase
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
}

export const apiClient = new ApiClient()