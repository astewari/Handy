#!/bin/bash

echo "Quick Backend Validation Test"
echo "=============================="
echo ""

# Test 1: Ollama
echo -n "1. Ollama running: "
if curl -s http://localhost:11434/api/version | grep -q version; then
    echo "✓ PASS"
else
    echo "✗ FAIL"
    exit 1
fi

# Test 2: Model available
echo -n "2. Model available: "
if curl -s http://localhost:11434/api/tags | grep -q llama3.2; then
    echo "✓ PASS"
else
    echo "✗ FAIL"
    exit 1
fi

# Test 3: Rust compiles
echo -n "3. Rust compiles: "
if cargo check --manifest-path=src-tauri/Cargo.toml --quiet 2>&1; then
    echo "✓ PASS"
else
    echo "✗ FAIL"
    exit 1
fi

# Test 4: Unit tests
echo -n "4. Unit tests pass: "
if cargo test --manifest-path=src-tauri/Cargo.toml --lib --quiet 2>&1 | grep -q "test result: ok"; then
    echo "✓ PASS"
else
    echo "✗ FAIL"
    exit 1
fi

# Test 5: Files exist
echo -n "5. All files exist: "
if [ -f "src-tauri/src/managers/profile.rs" ] && \
   [ -f "src-tauri/src/managers/summarization.rs" ] && \
   [ -f "src/components/settings/SummarizationSettings.tsx" ] && \
   [ -f "src/hooks/useSummarization.ts" ]; then
    echo "✓ PASS"
else
    echo "✗ FAIL"
    exit 1
fi

echo ""
echo "✓ ALL QUICK TESTS PASSED!"
echo ""
echo "Backend is functional and ready for UI testing."
