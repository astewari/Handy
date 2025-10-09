# Qwen2.5:7b-instruct Setup Guide

## Issue: Qwen Not Appearing in Dropdown

The model dropdown in Handy's AI Summarization settings shows **only the models that are currently installed** in your local Ollama instance. The dropdown fetches this list dynamically by calling Ollama's `/api/tags` endpoint.

If you don't see `qwen2.5:7b-instruct-q4_K_M` (or any other model) in the dropdown, it means that model is **not yet installed** in your local Ollama.

## Solution: Install Qwen2.5:7b-instruct in Ollama

### Option 1: Install via Ollama CLI (Recommended)

1. **Open a terminal** and run:
   ```bash
   ollama pull qwen2.5:7b-instruct-q4_K_M
   ```

2. **Wait for the download to complete**. This model is approximately 4.7 GB.

3. **Restart Handy** or click the **Refresh button** (🔄) next to the model dropdown in Settings.

4. **Qwen should now appear** in the dropdown.

### Option 2: Use the Text Input Fallback

If you prefer not to download the model yet or want to test with a different model:

1. **Before fetching models**, the dropdown shows a **text input field**.
2. You can **type any model name** directly (e.g., `qwen2.5:7b-instruct-q4_K_M`).
3. Click outside the input field to save.
4. Handy will attempt to use this model even if it's not installed (you'll get an error if it's missing).

### Option 3: Install Different Qwen Variants

Ollama supports multiple Qwen2.5 variants:

```bash
# 7B parameter models
ollama pull qwen2.5:7b              # Full precision (largest)
ollama pull qwen2.5:7b-instruct     # Instruction-tuned (recommended)
ollama pull qwen2.5:7b-instruct-q4_K_M   # 4-bit quantized (smallest, fastest)

# Other sizes
ollama pull qwen2.5:0.5b            # Smallest (500M parameters)
ollama pull qwen2.5:1.5b            # 1.5B parameters
ollama pull qwen2.5:3b              # 3B parameters
ollama pull qwen2.5:14b             # 14B parameters (larger, more capable)
```

**Recommendation**: Use `qwen2.5:7b-instruct-q4_K_M` for the best balance of performance and quality.

## Verify Installation

After installing, verify the model is available:

```bash
ollama list
```

You should see output like:

```
NAME                            ID              SIZE      MODIFIED
qwen2.5:7b-instruct-q4_K_M      abc123def456    4.7 GB    2 minutes ago
llama3.2:latest                 xyz789abc123    2.0 GB    3 days ago
```

## Testing Qwen2.5 with Handy

1. **Start Ollama** (if not already running):
   ```bash
   ollama serve
   ```

2. **Open Handy Settings** → **AI Summarization**

3. **Enable AI Summarization**

4. **Click Test Connection** → Should show "✅ Connected"

5. **Click Refresh Models** (🔄) → Should show "Found X models"

6. **Select `qwen2.5:7b-instruct-q4_K_M`** from the dropdown

7. **Test transcription** → Speak something and verify the output is clean (no explanations)

## Why Qwen2.5?

Qwen2.5 is a high-quality open-source LLM from Alibaba that:
- ✅ Supports 128K context length
- ✅ Excellent instruction following
- ✅ Fast inference on consumer hardware
- ✅ Strong multilingual support
- ✅ Good at text summarization and rewriting

## Troubleshooting

### "Model not found" error when using Qwen

**Cause**: The model name in settings doesn't match any installed model.

**Fix**:
1. Run `ollama list` to see exact model names
2. Copy the exact name from the list
3. Paste it into Handy's model dropdown

### Dropdown shows "llama3.2" but not "qwen2.5"

**Cause**: You have llama3.2 installed but not qwen2.5.

**Fix**: Run `ollama pull qwen2.5:7b-instruct-q4_K_M`

### Dropdown is empty / shows text input

**Cause**: Either:
- Ollama is not running (`ollama serve`)
- Ollama endpoint is incorrect (check Settings → LLM Endpoint)
- Network/connection issue

**Fix**:
1. Check Ollama is running: `curl http://localhost:11434/api/version`
2. Click "Test Connection" in Handy settings
3. If connection succeeds, click "Refresh Models" (🔄)

## Related Files

- **Backend**: `src-tauri/src/managers/summarization.rs` - LLM integration
- **Frontend**: `src/components/settings/SummarizationSettings.tsx` - Model dropdown UI
- **Hook**: `src/hooks/useSummarization.ts` - Model fetching logic
- **Profiles**: `src-tauri/src/managers/profile.rs` - System prompts (now enforce "Output ONLY...")
