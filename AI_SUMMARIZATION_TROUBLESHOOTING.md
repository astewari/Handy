# AI Summarization Troubleshooting Guide

This guide provides detailed solutions for common issues with Handy's AI Summarization feature.

## Table of Contents
- [Connection Issues](#connection-issues)
- [Model Issues](#model-issues)
- [Performance Issues](#performance-issues)
- [Output Quality Issues](#output-quality-issues)
- [Configuration Issues](#configuration-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Advanced Debugging](#advanced-debugging)

---

## Connection Issues

### Issue: "Could not connect to LLM service"

#### Symptom
When enabling AI Summarization or testing connection, you see an error message indicating the LLM service is unreachable.

#### Root Causes
1. Ollama is not running
2. Ollama is running on a different port
3. Firewall is blocking the connection
4. Wrong endpoint configured in Handy

#### Solutions

**Step 1: Verify Ollama is running**
```bash
# Check if Ollama process is running
ps aux | grep ollama

# Test endpoint directly
curl http://localhost:11434/api/version
```

Expected response:
```json
{"version":"0.x.x"}
```

If you get "Connection refused", Ollama isn't running.

**Step 2: Start Ollama**
```bash
ollama serve
```

On macOS, Ollama should start automatically. If not:
```bash
# Check if Ollama app is in Applications
open -a Ollama

# Or start from terminal
ollama serve
```

**Step 3: Verify port**
Ollama defaults to port 11434. If you've configured it differently:

Check Ollama's configuration:
```bash
# macOS/Linux
echo $OLLAMA_HOST

# If custom port is set, update Handy's endpoint setting
# Example: http://localhost:8080
```

**Step 4: Check firewall**
On macOS:
```bash
# System Preferences > Security & Privacy > Firewall
# Ensure Ollama is allowed
```

On Linux:
```bash
sudo ufw status
sudo ufw allow 11434/tcp
```

**Step 5: Test with different endpoint**
In Handy settings, try:
- `http://127.0.0.1:11434` (instead of localhost)
- `http://0.0.0.0:11434`

---

### Issue: Connection works but times out during processing

#### Symptom
Test Connection succeeds, but actual transcriptions fail or take very long.

#### Solutions

**1. Increase timeout**
- Go to Handy Settings > AI Summarization
- Increase "Timeout" from 10s to 30s or 60s

**2. Check model is loaded**
```bash
ollama ps
```
If no model is shown, it needs to be loaded on first use (can be slow).

**3. Preload model**
```bash
ollama run llama3.2 "test"
# Keep this running in background
```

**4. Check system resources**
```bash
# macOS
top -o cpu

# Linux
htop
```
Ensure CPU/RAM aren't maxed out by other processes.

---

## Model Issues

### Issue: "Model not found" error

#### Symptom
Connection test passes, but processing fails with "Model not found" or similar error.

#### Solutions

**Step 1: List installed models**
```bash
ollama list
```

Output example:
```
NAME              ID              SIZE    MODIFIED
llama3.2:latest   abc123...       2.0 GB  2 days ago
mistral:latest    def456...       4.1 GB  5 days ago
```

**Step 2: Install the model if missing**
```bash
ollama pull llama3.2
```

**Step 3: Match model name in Handy**
The model name in Handy settings must exactly match the name from `ollama list`.

Common mismatches:
- Handy: `llama3.2` vs Ollama: `llama3.2:latest` ✗
- Use: `llama3.2:latest` or just `llama3.2` ✓

**Step 4: Refresh model list in Handy**
Click the refresh button next to the model selector to auto-populate available models.

---

### Issue: Model takes too long to load

#### Symptom
First transcription after starting Ollama is very slow.

#### Explanation
Models are loaded into memory on first use. Subsequent uses are fast.

#### Solutions

**1. Preload model at startup**
```bash
# Create a startup script
ollama run llama3.2 "warming up" && exit
```

**2. Keep Ollama running**
Don't quit Ollama between uses. Let it run in the background.

**3. Use a smaller model**
```bash
ollama pull phi3  # ~2.3 GB, loads faster
```

---

## Performance Issues

### Issue: AI processing is too slow

#### Symptom
Transcriptions take 5+ seconds to process and paste.

#### Diagnosis
```bash
# Time a test request
time curl -X POST http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Convert to professional text: hey whats up",
  "stream": false
}'
```

If this takes >3 seconds, the issue is with the LLM, not Handy.

#### Solutions

**1. Use a faster model**
| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| phi3 | 2.3GB | Fast | Good |
| llama3.2 | 2.0GB | Medium | Excellent |
| mistral | 4.1GB | Slow | Excellent |

```bash
ollama pull phi3
# Update model in Handy settings
```

**2. Reduce context/prompt length**
- Keep system prompts concise (<200 characters)
- Avoid very long transcriptions

**3. Optimize hardware**
- Close unnecessary applications
- Ensure adequate RAM (8GB minimum, 16GB recommended)
- Use SSD instead of HDD for model storage

**4. Check CPU throttling**
macOS:
```bash
# Check if Mac is thermal throttling
sudo powermetrics --samplers cpu_power -n 1
```

**5. Use GPU acceleration (if available)**
Ollama automatically uses GPU if available. Verify:
```bash
ollama run llama3.2 "test"
# Watch GPU usage in Activity Monitor (macOS) or nvidia-smi (Linux)
```

---

### Issue: Memory usage is high

#### Symptom
Ollama or Handy consuming excessive RAM.

#### Diagnosis
```bash
# Check Ollama memory usage
ps aux | grep ollama | awk '{print $6}'

# macOS: in MB, divide by 1024 for GB
```

#### Solutions

**1. Use a smaller model**
```bash
ollama pull phi3  # Uses less RAM than llama3.2
```

**2. Unload model when not in use**
```bash
ollama stop llama3.2
```

**3. Configure model unload timeout in Handy**
Settings > Advanced > Model Unload Timeout

---

## Output Quality Issues

### Issue: Processed text is nonsense or incorrect

#### Symptom
AI-processed transcription is gibberish, unrelated, or incorrect.

#### Diagnosis Steps

**1. Check raw transcription first**
Switch to "Raw" profile and test. If raw transcription is bad, the issue is with Whisper, not AI Summarization.

**2. Test the model directly**
```bash
ollama run llama3.2
>>> Convert to professional text: hey whats up
```

If output is bad here, the model itself has issues.

**3. Check prompt quality**
Review your profile's system prompt and user prompt template.

#### Solutions

**1. Fix transcription quality first**
- Check microphone is working
- Reduce background noise
- Speak clearly and at normal pace
- Try different Whisper model

**2. Adjust profile prompts**
Bad prompt:
```
System: Fix text
User: {transcription}
```

Good prompt:
```
System: You are a professional writing assistant. Convert casual speech
        into polished, professional text. Fix grammar and remove filler
        words while maintaining the original meaning.
User: Convert this speech transcription into professional text:

{transcription}
```

**3. Use built-in profiles**
If custom profiles aren't working well, stick to built-in profiles. They're tested and optimized.

**4. Try a different model**
Some models are better at certain tasks:
- `llama3.2` - Balanced, good for most tasks
- `mistral` - Excellent at formal writing
- `phi3` - Good for simple rewrites

---

### Issue: AI changes meaning or adds information

#### Symptom
Processed text says something you didn't intend.

#### Explanation
AI models can hallucinate or embellish. This is a known limitation.

#### Solutions

**1. Use more restrictive prompts**
Add to system prompt:
```
Do not add information not present in the original text.
Do not make assumptions or infer meaning.
Maintain factual accuracy above all else.
```

**2. Use "Notes" or "Raw" profile**
These profiles are more conservative and less likely to embellish.

**3. Review before pasting**
For critical communications, review the processed text before using it.

**4. Adjust temperature (advanced)**
Lower temperature = more conservative, less creative.

Edit `src-tauri/src/managers/summarization.rs`:
```rust
temperature: 0.1,  // Default is 0.3
```

---

## Configuration Issues

### Issue: Settings not persisting

#### Symptom
After changing AI Summarization settings, they revert after restart.

#### Diagnosis
```bash
# Check settings file
# macOS
cat ~/Library/Application\ Support/com.cjpais.handy/settings_store.json

# Linux
cat ~/.config/handy/settings_store.json

# Windows
type %APPDATA%\com.cjpais.handy\settings_store.json
```

#### Solutions

**1. Check file permissions**
```bash
# macOS/Linux
ls -la ~/Library/Application\ Support/com.cjpais.handy/
# Ensure you have write permissions
```

**2. Reset settings**
```bash
# Backup first
cp settings_store.json settings_store.json.backup

# Delete and restart Handy
rm settings_store.json
```

**3. Check disk space**
Ensure adequate disk space for settings file.

---

### Issue: Cannot create custom profiles

#### Symptom
"Save" button disabled or profile doesn't appear after saving.

#### Validation Requirements
- **Name**: Non-empty, max 50 characters
- **Description**: Non-empty, max 200 characters
- **System Prompt**: Max 1000 characters
- **User Prompt Template**: Must contain `{transcription}`, max 500 characters

#### Solutions

**1. Check for required fields**
All fields marked with * are required.

**2. Verify {transcription} placeholder**
User Prompt Template MUST include `{transcription}` exactly as written (case-sensitive).

**3. Check character limits**
If text is cut off, you've exceeded the limit.

**4. Check for special characters**
Avoid using `"` or `\` in profile IDs (other fields are fine).

---

## Platform-Specific Issues

### macOS Issues

#### Issue: Ollama not starting automatically

**Solution:**
```bash
# Check if Ollama is in Login Items
# System Preferences > Users & Groups > Login Items
# Add Ollama if missing
```

#### Issue: Accessibility permissions

**Solution:**
Handy needs accessibility permissions to paste text. Grant in:
System Preferences > Security & Privacy > Privacy > Accessibility

---

### Linux Issues

#### Issue: Ollama install failed

**Solution:**
```bash
# Try manual installation
curl -fsSL https://ollama.ai/install.sh | sh

# Or download binary directly
sudo curl -L https://ollama.ai/download/ollama-linux-amd64 -o /usr/local/bin/ollama
sudo chmod +x /usr/local/bin/ollama
```

#### Issue: Port 11434 in use

**Solution:**
```bash
# Find process using port
sudo lsof -i :11434

# Kill if needed
sudo kill -9 <PID>

# Or run Ollama on different port
OLLAMA_HOST=0.0.0.0:8080 ollama serve
# Update Handy endpoint to http://localhost:8080
```

---

### Windows Issues

#### Issue: Ollama service not running

**Solution:**
1. Open Services (Win+R, type `services.msc`)
2. Find "Ollama Service"
3. Set to "Automatic" startup
4. Start the service

#### Issue: Firewall blocking connection

**Solution:**
1. Windows Defender Firewall > Advanced Settings
2. Inbound Rules > New Rule
3. Port > TCP > 11434
4. Allow the connection

---

## Advanced Debugging

### Enable Debug Logging

**In Handy:**
Settings > Debug > Enable Debug Mode

**View logs:**
```bash
# macOS
tail -f ~/Library/Logs/com.cjpais.handy/handy.log

# Linux
tail -f ~/.local/share/handy/logs/handy.log

# Windows
type %LOCALAPPDATA%\com.cjpais.handy\logs\handy.log
```

Look for lines containing "summarization" or "LLM".

---

### Test Ollama API Directly

**Check version:**
```bash
curl http://localhost:11434/api/version
```

**List models:**
```bash
curl http://localhost:11434/api/tags
```

**Test generation:**
```bash
curl -X POST http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "System: You are helpful.\n\nUser: Say hello",
  "stream": false
}'
```

---

### Check Network Traffic

```bash
# macOS/Linux
sudo tcpdump -i lo0 port 11434 -A

# Watch for HTTP requests when triggering transcription
```

---

### Profile Validation

Test your profile's prompts:
```bash
ollama run llama3.2 "$(cat <<EOF
System: <your system prompt>

User: <your user prompt with sample transcription>
EOF
)"
```

---

### Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Connection refused" | Ollama not running | Start Ollama |
| "Model not found" | Model not installed | `ollama pull <model>` |
| "Timeout" | Processing too slow | Increase timeout or use faster model |
| "Invalid response" | Corrupted response | Check Ollama logs |
| "Profile not found" | Profile ID mismatch | Use correct profile ID |

---

## Still Having Issues?

### Before Reporting a Bug

1. ✅ Verified Ollama is running and accessible
2. ✅ Tested with built-in profile (not custom)
3. ✅ Checked logs for error messages
4. ✅ Tried with "Raw" profile (works = issue is with AI)
5. ✅ Tested Ollama API directly (works = issue is with Handy)

### Gather Debug Information

```bash
# System info
uname -a

# Ollama version
ollama --version

# Handy version
# Check in Settings > About

# Installed models
ollama list

# Recent logs (last 50 lines)
tail -50 ~/Library/Logs/com.cjpais.handy/handy.log

# Test API
curl http://localhost:11434/api/version
```

### Report Issue

Include the above information in your bug report:
- GitHub: [github.com/cjpais/Handy/issues/new](https://github.com/cjpais/Handy/issues/new)
- Discord: [Join our community](https://discord.com/invite/WVBeWsNXK4)

---

## Known Limitations

1. **Single model at a time**: Can't use different models for different profiles simultaneously
2. **No streaming**: Processing happens all at once, not incrementally
3. **Fixed timeout**: Cannot set per-profile timeouts
4. **No batch processing**: Cannot process multiple transcriptions in parallel
5. **English-optimized**: Works best with English; other languages may have mixed results

These limitations may be addressed in future releases.

---

**Last Updated:** 2025-10-09
**Version:** 1.0
