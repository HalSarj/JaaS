#!/bin/bash

# Dream Insight Deployment Script
set -e

echo "🚀 Deploying Dream Insight (JaaS) to Supabase..."

# Check if we're linked to a Supabase project
if [ ! -f "supabase/.gitignore" ]; then
    echo "❌ Not linked to a Supabase project. Run 'npx supabase link --project-ref YOUR_PROJECT_REF' first."
    exit 1
fi

# Check for required environment variables
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "⚠️  OPENROUTER_API_KEY not set. Please set it before deployment."
    echo "   You can set it with: npx supabase secrets set OPENROUTER_API_KEY=your-key-here"
fi

echo "📊 Pushing database migrations..."
npx supabase db push

echo "🔧 Deploying Edge Functions..."
npx supabase functions deploy ingest
npx supabase functions deploy analyze

echo "🎯 Setting up storage bucket..."
# Create the dreams-audio bucket if it doesn't exist
npx supabase storage create-bucket dreams-audio --public=false

echo "📝 Deployment Summary:"
echo "✅ Database schema applied"
echo "✅ Edge functions deployed"
echo "✅ Storage bucket configured"
echo ""
echo "🔑 Next steps:"
echo "1. Set your OpenRouter API key: npx supabase secrets set OPENROUTER_API_KEY=your-key"
echo "2. Configure your iOS Shortcut with the ingest endpoint"
echo "3. Test by recording a dream!"
echo ""
echo "📱 Ingest endpoint: https://$(npx supabase status | grep 'API URL' | awk '{print $3}' | sed 's|https://||')/functions/v1/ingest"

echo "🎉 Deployment complete!"