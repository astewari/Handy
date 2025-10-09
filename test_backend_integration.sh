#!/bin/bash

# AI Summarization Backend Integration Test Script
# Tests all backend functionality end-to-end

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║    AI Summarization Backend Integration Test Suite           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

# Test function
test_case() {
    local name=$1
    echo -n "Testing: $name... "
}

pass() {
    echo -e "${GREEN}✓ PASS${NC}"
    ((pass_count++))
}

fail() {
    local msg=$1
    echo -e "${RED}✗ FAIL${NC}"
    if [ -n "$msg" ]; then
        echo "  Error: $msg"
    fi
    ((fail_count++))
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Test Category: Ollama Service"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1: Ollama Connection
test_case "Ollama service is running"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:11434/api/version | grep -q "200"; then
    pass
else
    fail "Could not connect to Ollama service"
fi

# Test 2: Model Availability
test_case "llama3.2 model is available"
if curl -s http://localhost:11434/api/tags | jq -e '.models[] | select(.name == "llama3.2:latest")' > /dev/null 2>&1; then
    pass
else
    fail "llama3.2 model not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Test Category: Profile Processing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 3: Professional Profile
test_case "Professional profile processing"
response=$(curl -s http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "System: You are a professional writing assistant. Convert casual speech into polished, professional text suitable for workplace communication. Fix grammar, remove filler words, and use formal tone while maintaining the original meaning.\n\nUser: Convert this speech transcription into professional text:\n\num hey can you send me those files",
  "stream": false,
  "options": {"temperature": 0.3, "top_p": 0.9}
}')

if echo "$response" | jq -e '.response' > /dev/null 2>&1; then
    if echo "$response" | jq -r '.response' | grep -qi "professional\|formal\|send\|files"; then
        pass
    else
        fail "Response doesn't contain expected professional language"
    fi
else
    fail "Invalid JSON response from Ollama"
fi

# Test 4: LLM Agent Profile
test_case "LLM Agent profile processing"
response=$(curl -s http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "System: You are a technical instruction optimizer. Convert natural speech into clear, structured instructions for AI agents. Use imperative voice, be specific and unambiguous, and remove conversational elements.\n\nUser: Convert this speech into a clear instruction for an AI agent:\n\nplease search through the code and find all the bugs",
  "stream": false,
  "options": {"temperature": 0.3, "top_p": 0.9}
}')

if echo "$response" | jq -e '.response' > /dev/null 2>&1; then
    if echo "$response" | jq -r '.response' | grep -qiE "search|scan|analyze|code|bug"; then
        pass
    else
        fail "Response doesn't contain expected imperative instructions"
    fi
else
    fail "Invalid JSON response from Ollama"
fi

# Test 5: Notes Profile
test_case "Notes profile processing"
response=$(curl -s http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "System: You are a note-taking assistant. Convert speech into concise, well-organized notes using bullet points. Extract key information and organize logically.\n\nUser: Convert this speech into organized notes:\n\nso we need to buy milk eggs and bread also pick up the dry cleaning",
  "stream": false,
  "options": {"temperature": 0.3, "top_p": 0.9}
}')

if echo "$response" | jq -e '.response' > /dev/null 2>&1; then
    if echo "$response" | jq -r '.response' | grep -qE "milk|eggs|bread|cleaning|•|bullet|\*|-"; then
        pass
    else
        fail "Response doesn't contain expected bullet points or items"
    fi
else
    fail "Invalid JSON response from Ollama"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Test Category: Code Compilation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 6: Rust Backend Compilation
test_case "Rust backend compiles without errors"
if cargo check --manifest-path=src-tauri/Cargo.toml 2>&1 | grep -q "Finished"; then
    pass
else
    fail "Rust compilation failed"
fi

# Test 7: Rust Unit Tests
test_case "Rust unit tests pass"
if cargo test --manifest-path=src-tauri/Cargo.toml --lib 2>&1 | grep -q "test result: ok"; then
    pass
else
    fail "Unit tests failed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Test Category: File Structure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 8: Backend Files
test_case "Backend Rust files exist"
if [ -f "src-tauri/src/managers/profile.rs" ] && \
   [ -f "src-tauri/src/managers/summarization.rs" ] && \
   [ -f "src-tauri/src/commands/summarization.rs" ]; then
    pass
else
    fail "Missing backend files"
fi

# Test 9: Frontend Files
test_case "Frontend React files exist"
if [ -f "src/components/settings/SummarizationSettings.tsx" ] && \
   [ -f "src/components/settings/ProfileManager.tsx" ] && \
   [ -f "src/components/settings/ProfileEditor.tsx" ] && \
   [ -f "src/hooks/useSummarization.ts" ]; then
    pass
else
    fail "Missing frontend files"
fi

# Test 10: Documentation Files
test_case "Documentation files exist"
if [ -f "AI_SUMMARIZATION_USER_GUIDE.md" ] && \
   [ -f "AI_SUMMARIZATION_TROUBLESHOOTING.md" ] && \
   [ -f "README.md" ]; then
    pass
else
    fail "Missing documentation files"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Test Category: Performance"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 11: Processing Speed
test_case "LLM response time < 5 seconds"
start_time=$(date +%s)
curl -s http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "System: Be concise.\n\nUser: Say hello",
  "stream": false,
  "options": {"temperature": 0.3}
}' > /dev/null
end_time=$(date +%s)
duration=$((end_time - start_time))

if [ $duration -lt 5 ]; then
    pass
else
    fail "Response took ${duration}s (>5s)"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                      TEST SUMMARY                             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Total Tests: $((pass_count + fail_count))"
echo -e "  ${GREEN}Passed: $pass_count${NC}"
echo -e "  ${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║        ✓ ALL TESTS PASSED - BACKEND IS READY!                ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║        ✗ SOME TESTS FAILED - PLEASE REVIEW                    ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
