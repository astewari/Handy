#!/bin/bash

echo "Testing Ollama Summarization Backend"
echo "====================================="
echo ""

# Test 1: Check Ollama connection
echo "Test 1: Check Ollama connection"
curl -s http://localhost:11434/api/version | jq '.'
echo ""

# Test 2: List available models
echo "Test 2: List available models"
curl -s http://localhost:11434/api/tags | jq '.models[] | .name'
echo ""

# Test 3: Test Professional profile
echo "Test 3: Test Professional profile"
echo "Input: 'um hey john so like i wanted to ask you about that thing we talked about yesterday'"
echo ""
curl -s http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "System: You are a professional writing assistant. Convert casual speech into polished, professional text suitable for workplace communication. Fix grammar, remove filler words, and use formal tone while maintaining the original meaning.\n\nUser: Convert this speech transcription into professional text:\n\num hey john so like i wanted to ask you about that thing we talked about yesterday",
  "stream": false,
  "options": {
    "temperature": 0.3,
    "top_p": 0.9
  }
}' | jq -r '.response'
echo ""

# Test 4: Test LLM Agent profile
echo "Test 4: Test LLM Agent Instructions profile"
echo "Input: 'so like i want you to look through all the typescript files and um find any places where we are using the old api you know the v1 stuff'"
echo ""
curl -s http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "System: You are a technical instruction optimizer. Convert natural speech into clear, structured instructions for AI agents. Use imperative voice, be specific and unambiguous, and remove conversational elements.\n\nUser: Convert this speech into a clear instruction for an AI agent:\n\nso like i want you to look through all the typescript files and um find any places where we are using the old api you know the v1 stuff",
  "stream": false,
  "options": {
    "temperature": 0.3,
    "top_p": 0.9
  }
}' | jq -r '.response'
echo ""

# Test 5: Test Notes profile
echo "Test 5: Test Notes profile"
echo "Input: 'okay so for the meeting tomorrow we need to cover like the budget stuff and then talk about the new hires um also do not forget to mention the office move'"
echo ""
curl -s http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "System: You are a note-taking assistant. Convert speech into concise, well-organized notes using bullet points. Extract key information and organize logically.\n\nUser: Convert this speech into organized notes:\n\nokay so for the meeting tomorrow we need to cover like the budget stuff and then talk about the new hires um also do not forget to mention the office move",
  "stream": false,
  "options": {
    "temperature": 0.3,
    "top_p": 0.9
  }
}' | jq -r '.response'
echo ""

echo "====================================="
echo "Backend testing complete!"
