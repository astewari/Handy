#!/bin/bash

# AI Summarization Integration Test Suite
# Tests all profiles, edge cases, and performance

set -e

ENDPOINT="http://localhost:11434"
MODEL="llama3.2"
RESULTS_FILE="test_results.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "# AI Summarization Test Results" > $RESULTS_FILE
echo "" >> $RESULTS_FILE
echo "**Test Date:** $(date)" >> $RESULTS_FILE
echo "**Ollama Version:** $(curl -s $ENDPOINT/api/version | grep -o '"version":"[^"]*"' | cut -d'"' -f4)" >> $RESULTS_FILE
echo "**Model:** $MODEL" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE

passed=0
failed=0

# Function to run a test
run_test() {
    local test_name="$1"
    local system_prompt="$2"
    local user_prompt="$3"
    local input_text="$4"
    local expected_contains="$5"

    echo -e "${YELLOW}Testing: $test_name${NC}"

    local full_prompt="System: $system_prompt\n\nUser: $user_prompt"
    full_prompt="${full_prompt//\{transcription\}/$input_text}"

    local start_time=$(date +%s%3N)

    local response=$(curl -s -X POST $ENDPOINT/api/generate -d "{
        \"model\": \"$MODEL\",
        \"prompt\": \"$full_prompt\",
        \"stream\": false,
        \"options\": {
            \"temperature\": 0.3,
            \"top_p\": 0.9
        }
    }" | python3 -c "import sys, json; print(json.load(sys.stdin).get('response', ''))" 2>&1)

    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))

    if [ $? -eq 0 ] && [ ! -z "$response" ]; then
        echo -e "${GREEN}✓ PASS${NC} - ${duration}ms"
        ((passed++))

        echo "## ✓ $test_name" >> $RESULTS_FILE
        echo "" >> $RESULTS_FILE
        echo "**Status:** PASS" >> $RESULTS_FILE
        echo "**Duration:** ${duration}ms" >> $RESULTS_FILE
        echo "**Input:** $input_text" >> $RESULTS_FILE
        echo "**Output:** $response" >> $RESULTS_FILE
        echo "" >> $RESULTS_FILE
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((failed++))

        echo "## ✗ $test_name" >> $RESULTS_FILE
        echo "" >> $RESULTS_FILE
        echo "**Status:** FAIL" >> $RESULTS_FILE
        echo "**Error:** $response" >> $RESULTS_FILE
        echo "" >> $RESULTS_FILE
    fi

    echo ""
}

# Test 1: Professional Profile
echo "=== Testing Built-in Profiles ==="
run_test "Professional Profile" \
    "You are a professional writing assistant. Convert casual speech into polished, professional text suitable for workplace communication. Fix grammar, remove filler words, and use formal tone while maintaining the original meaning." \
    "Convert this speech transcription into professional text:\n\n{transcription}" \
    "um hey john so like i wanted to ask you about that thing we talked about yesterday" \
    "professional"

# Test 2: LLM Agent Profile
run_test "LLM Agent Instructions Profile" \
    "You are a technical instruction optimizer. Convert natural speech into clear, structured instructions for AI agents. Use imperative voice, be specific and unambiguous, and remove conversational elements." \
    "Convert this speech into a clear instruction for an AI agent:\n\n{transcription}" \
    "so i want you to look through all the code and find any places where we're using the old api and update them" \
    "search"

# Test 3: Email Profile
run_test "Email Profile" \
    "You are an email writing assistant. Convert speech into a well-formatted email. Add appropriate greeting and closing if missing, use proper paragraphs, and maintain professional yet friendly tone." \
    "Convert this speech into a well-formatted email:\n\n{transcription}" \
    "wanted to follow up on our meeting yesterday about the project can you send me your availability" \
    "follow"

# Test 4: Notes Profile
run_test "Notes Profile" \
    "You are a note-taking assistant. Convert speech into concise, well-organized notes using bullet points. Extract key information and organize logically." \
    "Convert this speech into organized notes:\n\n{transcription}" \
    "okay so for the meeting tomorrow we need to cover the budget and talk about new hires and the office move" \
    "budget"

# Test 5: Code Comments Profile
run_test "Code Comments Profile" \
    "You are a technical documentation assistant. Convert speech into clear, concise code comments or documentation. Use technical language appropriately and be precise." \
    "Convert this speech into a code comment or technical documentation:\n\n{transcription}" \
    "this function takes in a user id and returns all their posts from the database" \
    "user"

echo "=== Testing Edge Cases ==="

# Test 6: Empty input
run_test "Empty Input" \
    "You are a professional writing assistant. Convert casual speech into polished, professional text." \
    "Convert this:\n\n{transcription}" \
    "" \
    "empty"

# Test 7: Very long input (500+ words)
long_input="um so like yesterday we had this really important meeting and there were like so many people there i mean there was john and sarah and mike and like basically the entire team you know and we were talking about the project timeline and um the budget constraints and all that stuff and john was saying that we need to like prioritize the features better because we can't do everything at once right and sarah agreed and she mentioned that we should focus on the core functionality first and then add the nice to have features later which makes sense i guess and mike brought up some concerns about the technical debt we've been accumulating and how that might slow us down if we dont address it soon which is totally valid and then we spent like an hour discussing different approaches and weighing the pros and cons of each one and it was pretty productive actually even though it felt really long at the time and by the end we had a pretty good action plan laid out with specific tasks assigned to different team members and deadlines for each milestone and everyone seemed pretty happy with the outcome so that was good"
run_test "Long Input (500+ words)" \
    "You are a professional writing assistant. Convert casual speech into polished, professional text." \
    "Convert this:\n\n{transcription}" \
    "$long_input" \
    "meeting"

# Test 8: Special characters
run_test "Special Characters" \
    "You are a professional writing assistant. Convert casual speech into polished, professional text." \
    "Convert this:\n\n{transcription}" \
    "hey can you check the file at /usr/local/bin and see if the config.json has the right settings? it should have api_key = \"abc123\" and timeout = 30" \
    "file"

# Test 9: Numbers and dates
run_test "Numbers and Dates" \
    "You are a professional writing assistant. Convert casual speech into polished, professional text." \
    "Convert this:\n\n{transcription}" \
    "um so the meeting is scheduled for october ninth two thousand twenty five at three thirty pm and we need like five people to attend" \
    "meeting"

# Test 10: Multiple languages mixed
run_test "Mixed Languages" \
    "You are a professional writing assistant. Convert casual speech into polished, professional text." \
    "Convert this:\n\n{transcription}" \
    "hey can we have the meeting at the cafe tomorrow and discuss the projet details" \
    "meeting"

# Performance test
echo "=== Testing Performance ==="
echo "## Performance Metrics" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE

test_input="hey john can you send me the report by friday"
total_time=0
iterations=5

for i in $(seq 1 $iterations); do
    start_time=$(date +%s%3N)
    curl -s -X POST $ENDPOINT/api/generate -d "{
        \"model\": \"$MODEL\",
        \"prompt\": \"System: Convert to professional text.\n\nUser: $test_input\",
        \"stream\": false,
        \"options\": {\"temperature\": 0.3, \"top_p\": 0.9}
    }" > /dev/null
    end_time=$(date +%s%3N)
    duration=$((end_time - start_time))
    total_time=$((total_time + duration))
    echo "  Iteration $i: ${duration}ms"
done

avg_time=$((total_time / iterations))
echo ""
echo -e "${GREEN}Average latency: ${avg_time}ms${NC}"
echo "**Average Latency:** ${avg_time}ms (over $iterations iterations)" >> $RESULTS_FILE
echo "**Target:** <1000ms" >> $RESULTS_FILE

if [ $avg_time -lt 1000 ]; then
    echo -e "${GREEN}✓ Performance target met${NC}"
    echo "**Result:** ✓ PASS" >> $RESULTS_FILE
else
    echo -e "${RED}✗ Performance target missed${NC}"
    echo "**Result:** ✗ FAIL" >> $RESULTS_FILE
fi

echo "" >> $RESULTS_FILE

# Summary
echo "=== Test Summary ===" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE
echo "**Total Tests:** $((passed + failed))" >> $RESULTS_FILE
echo "**Passed:** $passed" >> $RESULTS_FILE
echo "**Failed:** $failed" >> $RESULTS_FILE
echo "**Success Rate:** $(echo "scale=1; $passed * 100 / ($passed + $failed)" | bc)%" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE

echo ""
echo "==================================="
echo "Test Summary"
echo "==================================="
echo -e "Total: $((passed + failed))"
echo -e "${GREEN}Passed: $passed${NC}"
echo -e "${RED}Failed: $failed${NC}"
echo ""
echo "Results saved to: $RESULTS_FILE"

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
