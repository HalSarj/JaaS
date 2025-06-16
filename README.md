# Dream Insight - JaaS (Jung as a Service)

**"Capture once, wake up to patterns."**

Personal dream analysis tool that transforms voice recordings into deep psychological insights using Jungian + cognitive frameworks.

## 🚀 Quick Start

### Prerequisites
- [Supabase Account](https://supabase.com)
- [OpenRouter API Key](https://openrouter.ai) for Claude Sonnet 4 & Whisper
- iOS device with Shortcuts app

### 1. Database Setup

```bash
# Link to your Supabase project
npx supabase link --project-ref your-project-ref

# Apply database migrations
npx supabase db push
```

### 2. Configure Environment Variables

```bash
# Copy and configure environment variables
cp .env.example .env.local

# Set your keys:
# - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard
# - OPENROUTER_API_KEY from OpenRouter
```

### 3. Deploy Edge Functions

```bash
# Deploy the analysis pipeline
npx supabase functions deploy ingest
npx supabase functions deploy analyze

# Set environment variables in Supabase
npx supabase secrets set OPENROUTER_API_KEY=your-key-here
```

### 4. iOS Shortcut Setup

1. Create new Shortcut in iOS Shortcuts app
2. Add "Record Audio" action
3. Add "Get Contents of URL" action with:
   - URL: `https://your-project.supabase.co/functions/v1/ingest`
   - Method: POST
   - Headers: `Authorization: Bearer YOUR_ANON_KEY`
   - Request Body: Form data with audio file

## 🏗️ Architecture

```
iOS Shortcut → ingest() → analyze() → Database
     ↓              ↓         ↓         ↓
  Voice memo → Storage → Whisper → Claude → Insights
```

### Core Components

- **`ingest/`**: Handles audio upload and triggers analysis
- **`analyze/`**: Transcribes with Whisper, analyzes with Claude Sonnet 4
- **Database**: PostgreSQL with vector embeddings for dream patterns
- **Types**: Comprehensive TypeScript definitions for dream analysis

## 📊 Features

### Analysis Framework
- **Jungian Psychology**: Archetypes, shadow work, individuation themes
- **Cognitive Neuroscience**: Threat simulation, memory consolidation
- **Pattern Recognition**: Recurring motifs, emotional trends
- **Symbolic Interpretation**: Personal + universal symbol meanings

### Data Structure
```typescript
interface DreamAnalysis {
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
}
```

## 📈 Usage

### Daily Workflow
1. **Record**: Use iOS Shortcut to capture dream voice memo
2. **Process**: System automatically transcribes and analyzes
3. **Review**: Check insights and patterns in your dashboard
4. **Reflect**: Weekly digests highlight key themes

### Costs (Personal Use)
- **Claude Sonnet 4**: ~$2-3/month (100 dreams)
- **Whisper**: ~$0.30/month
- **Supabase**: Free tier sufficient
- **Total**: <$5/month

## 🔒 Privacy & Security

- **Row Level Security**: Users only access their own dreams
- **Encrypted Storage**: Audio files and analysis data protected
- **Data Export**: Full data portability
- **Local Processing**: No external analytics or tracking

## 🛠️ Development

### Local Development
```bash
# Start Supabase locally
npx supabase start

# Serve functions locally
npx supabase functions serve --env-file .env.local

# Test ingest endpoint
curl -X POST http://localhost:54321/functions/v1/ingest \
  -H "Authorization: Bearer your-anon-key" \
  -F "audio=@test-dream.m4a"
```

### Database Schema
- `dreams`: Core dream records with transcripts and analysis
- `recurring_motifs`: Pattern tracking across dreams
- `weekly_digests`: Periodic summaries and insights
- `dream_tags`: Flexible categorization system

## 🎯 Roadmap

### Phase 2: Frontend (Next)
- [ ] React dashboard for dream exploration
- [ ] Timeline visualization with pattern highlights
- [ ] Chat interface for dream Q&A (RAG)

### Phase 3: Advanced Analysis
- [ ] Life context integration (stress, events, sleep)
- [ ] Predictive patterns and insights
- [ ] Multi-model analysis comparison

### Phase 4: Enhanced Features
- [ ] Weekly digest email automation
- [ ] Dream sharing and community insights
- [ ] Integration with sleep tracking apps

## 📚 Resources

- [Jungian Dream Analysis](https://www.cgjung.org/)
- [Cognitive Theories of Dreaming](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2814941/)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenRouter API Reference](https://openrouter.ai/docs)

---

*Built with Supabase, Claude Sonnet 4, and deep respect for the unconscious mind.*