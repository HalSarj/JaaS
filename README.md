# Dream Insight - JaaS (Jung as a Service)

**"Capture once, wake up to patterns."**

Personal dream analysis tool that automatically processes .m4a files from Dropbox into deep psychological insights using Jungian + cognitive frameworks.

## 🚀 Quick Start

### Prerequisites
- [Supabase Account](https://supabase.com)
- [Dropbox Developer Account](https://www.dropbox.com/developers/apps) with app created
- [OpenRouter API Key](https://openrouter.ai) for Claude Sonnet 4 & Whisper

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
cp .env.example .env

# Set your keys:
# - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard
# - OPENROUTER_API_KEY from OpenRouter
# - DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_ACCESS_TOKEN from Dropbox App Console
```

### 3. Deploy Edge Functions

```bash
# Deploy the webhook handler and analysis pipeline
supabase functions deploy ingest --no-verify-jwt
supabase functions deploy analyze

# Set environment variables in Supabase
supabase secrets set OPENROUTER_API_KEY=your-openrouter-key
supabase secrets set DROPBOX_APP_SECRET=your-dropbox-app-secret
supabase secrets set DROPBOX_ACCESS_TOKEN=your-dropbox-access-token
```

### 4. Dropbox Integration Setup

#### Configure Dropbox App Permissions
1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your app
3. Go to **Permissions** tab and enable:
   - `files.metadata.read`
   - `files.content.read`
4. Generate a new access token

#### Set Up Webhook
1. In your Dropbox App Console, go to **Webhooks** tab
2. Add webhook URL: `https://your-project.supabase.co/functions/v1/ingest`
3. Enable the webhook

#### Test Integration
```bash
# Run the setup script to initialize folder monitoring
node setup-dropbox-monitoring.js
```

Now upload .m4a files to your Dropbox root directory - they'll be automatically processed!

## 🏗️ Architecture

```
Dropbox Upload → Webhook → ingest() → analyze() → Database
      ↓            ↓         ↓         ↓         ↓
   .m4a file → Notification → Download → Whisper → Claude → Insights
```

### Core Components

- **`ingest/`**: Dropbox webhook handler with cursor-based change tracking
- **`analyze/`**: Transcribes with Whisper, analyzes with Claude Sonnet 4
- **Database**: PostgreSQL with Dropbox metadata and vector embeddings
- **Types**: Comprehensive TypeScript definitions for dream analysis
- **`setup-dropbox-monitoring.js`**: Initial folder monitoring setup script

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
1. **Record**: Save .m4a dream recordings to Dropbox
2. **Auto-Process**: Webhook triggers automatic transcription and analysis
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
- `dreams`: Core dream records with transcripts, analysis, and Dropbox metadata
- `dropbox_cursor`: Tracks Dropbox changes for webhook processing
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