#!/bin/bash

# Trigger manual landscape generation on Railway worker
# Usage: ./trigger-generation.sh [RAILWAY_URL]

# Check if Railway URL provided as argument
if [ -n "$1" ]; then
    RAILWAY_URL="$1"
else
    # Try to read from environment or prompt user
    echo "Railway URL not provided. Please enter your Railway worker URL:"
    echo "Example: landscapeclock-production.up.railway.app"
    read -r RAILWAY_URL
fi

# Remove https:// if user included it
RAILWAY_URL=${RAILWAY_URL#https://}
RAILWAY_URL=${RAILWAY_URL#http://}

echo "🚀 Triggering generation on: https://$RAILWAY_URL"
echo ""

# Trigger generation
response=$(curl -s -w "\n%{http_code}" "https://$RAILWAY_URL/generate-now")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 200 ]; then
    echo "✅ Generation triggered successfully!"
    echo "Response: $body"
    echo ""
    echo "⏱️  This will take approximately 15-17 minutes."
    echo "📊 Monitor progress at: https://railway.app"
    echo ""
    echo "You can check the API status with:"
    echo "curl https://landscapeclock.vercel.app/api/blob-status"
else
    echo "❌ Failed to trigger generation (HTTP $http_code)"
    echo "Response: $body"
    exit 1
fi
