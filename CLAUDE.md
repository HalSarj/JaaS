# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dream Insight** is a personal dream analysis application that processes audio recordings from Dropbox into psychological insights using AI. The system automatically transcribes dream recordings and provides Jungian and cognitive analysis through a sophisticated processing pipeline.

## Architecture

**Core Data Flow**: Dropbox Upload → Webhook → ingest() → analyze() → Database → Frontend Dashboard

**Backend**: Supabase (PostgreSQL + Edge Functions) with vector embeddings for dream similarity search  
**Frontend**: Next.js 15 with TypeScript, Tailwind CSS 4, and Radix UI components  
**AI Integration**: GPT-o3-mini for analysis, Whisper for transcription (via OpenRouter)  
**External Integration**: Dropbox OAuth2 for automated file monitoring

## Essential Commands

### Backend Development (Supabase)
```bash
# Start local development
npx supabase start
npx supabase functions serve --env-file .env.local

# Database operations  
npx supabase db push
npx supabase db diff

# Deploy functions
npx supabase functions deploy ingest --no-verify-jwt
npx supabase functions deploy analyze

# Manage secrets
npx supabase secrets set OPENROUTER_API_KEY=your-key
```

### Frontend Development
```bash
cd frontend
npm run dev          # Development server
npm run build        # Production build  
npm run lint         # ESLint checks
```

### Full Deployment
```bash
./deploy.sh          # Complete deployment script
```

## Key Architecture Details

### Database Schema
- `dreams`: Core table with transcripts, analysis (JSONB), and vector embeddings
- `recurring_motifs`: Cross-dream pattern tracking
- `weekly_digests`: Periodic analysis summaries
- Vector extension enabled for semantic similarity search

### Edge Functions Structure
- `ingest/`: Dropbox webhook handler with HMAC signature verification
- `analyze/`: AI processing pipeline (transcription → analysis → embeddings)
- `chat/`: RAG-based dream query interface
- `dashboard-insights/`: Morning insights generation
- `dropbox-oauth/`: OAuth2 authentication flow
- `_shared/`: Common utilities (auth, security headers)

### Context Optimization System
The analyze function implements sophisticated context management to reduce AI costs by 30-70%:
- Smart dream selection based on relevance rather than chronology
- Hierarchical compression using thematic summaries
- Active motif filtering for recent/frequent patterns
- Budget-based adaptive context sizing

### Security Implementation
- HMAC-SHA256 webhook signature verification in ingest function
- Row Level Security policies for user data isolation
- OAuth2 flow for secure Dropbox integration
- Separate service role keys for different access levels

## Required Environment Variables

```bash
# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key

# AI Services
OPENROUTER_API_KEY=your-openrouter-key
CLAUDE_MODEL=openai/o3

# Dropbox OAuth2
DROPBOX_APP_KEY=your-app-key
DROPBOX_APP_SECRET=your-app-secret
```

## Testing

### Manual API Testing
```bash
# Test ingest endpoint locally
curl -X POST http://localhost:54321/functions/v1/ingest \
  -H "Authorization: Bearer your-anon-key" \
  -F "audio=@test-dream.m4a"
```

### Dropbox Integration Setup
```bash
node setup-dropbox-monitoring.js
```

## TypeScript Definitions

All dream analysis types are centralized in `/types/dream-analysis.ts`, covering the complete pipeline from audio processing to psychological analysis. The system maintains full type safety across the Supabase Edge Functions (Deno) and Next.js frontend.

## Development Notes

- Use vector similarity search for finding related dreams across the database
- The analysis system implements multi-dimensional psychological frameworks (Jungian archetypes, cognitive neuroscience, pattern recognition)
- Webhook endpoints require signature verification - never deploy ingest function with `--no-verify-jwt` in production
- Database migrations should include proper RLS policies for user data protection