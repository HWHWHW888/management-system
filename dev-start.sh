#!/bin/bash

# Junket Management System - Local Development Startup Script
# This script starts both frontend and backend for local development

echo "🚀 Starting Junket Management System - Local Development"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the frontend root directory"
    exit 1
fi

# Start backend server in background
echo "📡 Starting backend server (localhost:3001)..."
cd "supabase/functions/server"
npm run dev &
BACKEND_PID=$!
cd ../../..

# Wait a moment for backend to start
sleep 3

# Start frontend development server
echo "🌐 Starting frontend server (localhost:3000)..."
echo "📝 Frontend will connect to: http://localhost:3001/api"
echo ""
echo "🔧 Development URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   API:      http://localhost:3001/api"
echo ""
echo "🛑 Press Ctrl+C to stop both servers"
echo "=================================================="

# Start frontend (this will block)
npm start

# If frontend stops, kill backend too
echo "🛑 Stopping backend server..."
kill $BACKEND_PID 2>/dev/null
echo "✅ Development servers stopped"
