#!/bin/bash

echo "🚀 Deploying Dropbox OAuth 2 Implementation"

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Apply database migrations
echo "📊 Applying database migrations..."
npx supabase db push

# Deploy the OAuth function
echo "🔐 Deploying OAuth function..."
npx supabase functions deploy dropbox-oauth --no-verify-jwt

# Deploy the updated ingest function  
echo "📥 Deploying updated ingest function..."
npx supabase functions deploy ingest --no-verify-jwt

# Set environment variables (you'll need to update these)
echo "🔧 Setting environment variables..."
echo "Please set the following environment variables in your Supabase dashboard:"
echo ""
echo "Required variables:"
echo "- DROPBOX_APP_KEY=your_dropbox_app_key"
echo "- DROPBOX_APP_SECRET=your_dropbox_app_secret"
echo ""
echo "Optional variables:"
echo "- DROPBOX_REDIRECT_URI=https://your-project.supabase.co/functions/v1/dropbox-oauth/callback"
echo ""

# Instructions for Dropbox app setup
echo "📋 Dropbox App Configuration Required:"
echo ""
echo "1. Go to https://www.dropbox.com/developers/apps"
echo "2. Select your app (or create a new one)"
echo "3. Go to 'Permissions' tab and enable:"
echo "   - files.metadata.read"
echo "   - files.content.read" 
echo "4. Go to 'Settings' tab and add redirect URI:"
echo "   https://your-project.supabase.co/functions/v1/dropbox-oauth/callback"
echo "5. Update your app settings to use OAuth 2"
echo ""

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Update environment variables in Supabase dashboard"
echo "2. Configure Dropbox app permissions and redirect URI"
echo "3. Test OAuth flow with: https://your-project.supabase.co/functions/v1/dropbox-oauth/auth?user_id=YOUR_USER_ID"
echo ""
echo "Migration from static tokens:"
echo "- Remove DROPBOX_ACCESS_TOKEN from environment variables"
echo "- Users will need to re-authorize via OAuth flow"
echo "- Old setup-dropbox-monitoring.js script is no longer needed" 