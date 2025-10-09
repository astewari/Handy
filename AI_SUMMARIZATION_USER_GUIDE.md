# AI Summarization User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Using Built-in Profiles](#using-built-in-profiles)
5. [Creating Custom Profiles](#creating-custom-profiles)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)
9. [FAQ](#faq)

---

## Introduction

The AI Summarization feature enhances Handy's transcription capabilities by allowing you to automatically process your speech with a local AI language model. This helps you:

- Convert casual speech into professional text
- Format emails and documents properly
- Generate concise notes from long recordings
- Create clear instructions for AI agents
- Improve grammar and remove filler words

**Key Benefits:**
- **Privacy-First**: All processing happens locally on your machine
- **No Cloud Required**: Works completely offline
- **Customizable**: Create profiles for your specific use cases
- **Optional**: Enable or disable anytime without affecting core functionality

---

## Prerequisites

Before using AI Summarization, you need:

### 1. Ollama Installation

Ollama is a free, open-source tool for running large language models locally.

**Installation:**

On macOS/Linux:
```bash
curl https://ollama.ai/install.sh | sh
```

On macOS with Homebrew:
```bash
brew install ollama
```

On Windows:
- Download from [ollama.ai/download](https://ollama.ai/download)
- Run the installer

### 2. Download an AI Model

After installing Ollama, download a language model:

```bash
# Recommended: Llama 3.2 (small, fast, good quality)
ollama pull llama3.2

# Alternative options:
ollama pull mistral        # Slightly larger, excellent quality
ollama pull phi3           # Very small, good for basic tasks
```

### 3. Start Ollama Service

Ollama needs to be running for AI Summarization to work:

```bash
ollama serve
```

On macOS, Ollama typically starts automatically after installation.

**Verify it's running:**
```bash
curl http://localhost:11434/api/version
```

You should see a version response. If you get a connection error, Ollama isn't running.

---

## Quick Start

### Step 1: Enable AI Summarization

1. Open Handy
2. Click on Settings
3. Navigate to "AI Summarization" (new section in sidebar)
4. Toggle "Enable AI Summarization" to ON

### Step 2: Choose a Profile

1. In the "Active Profile" dropdown, select a profile:
   - **Professional** - For workplace communication
   - **Email** - For well-formatted emails
   - **Notes** - For concise bullet points
   - **LLM Agent Instructions** - For AI prompts
   - **Code Comments** - For technical documentation
   - **Raw** - No processing (bypass AI)

2. Read the profile description to understand what it does

### Step 3: Configure LLM Settings (if needed)

The default settings should work if you installed Ollama normally:

- **Endpoint**: `http://localhost:11434` (default)
- **Model**: `llama3.2` (or whatever you installed)

Click "Test Connection" to verify everything is working. You should see a green "Connected" status.

### Step 4: Start Transcribing

1. Press your Handy shortcut (e.g., Option+Space on macOS)
2. Speak your message
3. Release the shortcut
4. Handy will:
   - Transcribe your speech
   - Process it with the selected profile
   - Paste the improved text

**Example:**

You speak (casually):
> "um hey sarah so like i wanted to check in about that report you know the one we talked about last week uh when will it be ready thanks"

With "Professional" profile, you get:
> "Hi Sarah, I wanted to follow up on the report we discussed last week. When will it be ready? Thank you."

---

## Using Built-in Profiles

### Professional

**Use for:** Business emails, workplace messages, formal communication

**What it does:**
- Converts casual speech to formal tone
- Removes filler words (um, uh, like, you know)
- Fixes grammar and punctuation
- Maintains clarity and professionalism

**Example:**
```
Input:  "hey can you send me the file when you get a chance"
Output: "Could you please send me the file at your convenience?"
```

---

### LLM Agent Instructions

**Use for:** Giving instructions to AI assistants like ChatGPT, Claude

**What it does:**
- Converts natural speech into clear, structured instructions
- Uses imperative voice
- Removes ambiguity
- Organizes requirements clearly

**Example:**
```
Input:  "so i want you to look through the code and find any places
         where we're using the old api and update them"
Output: "Review all code files. Identify instances of old API usage.
         Update each to use the new API. Test after changes."
```

---

### Email

**Use for:** Writing emails quickly

**What it does:**
- Adds proper greeting and closing if missing
- Formats into paragraphs
- Maintains professional yet friendly tone
- Ensures proper email structure

**Example:**
```
Input:  "wanted to follow up on our meeting yesterday about the
         project timeline can you send me your availability for
         next week"
Output: "Hi [Name],

I wanted to follow up on our meeting yesterday regarding the
project timeline. Could you please send me your availability
for next week?

Thank you,
[Your Name]"
```

---

### Notes

**Use for:** Taking quick notes, capturing key points from meetings

**What it does:**
- Converts speech into bullet points
- Extracts key information
- Organizes logically
- Removes unnecessary details

**Example:**
```
Input:  "okay so for the meeting tomorrow we need to cover the
         budget and talk about new hires and don't forget the
         office move"
Output: "Meeting Agenda (Tomorrow):
• Budget review
• New hires discussion
• Office move update"
```

---

### Code Comments

**Use for:** Writing code documentation, technical explanations

**What it does:**
- Converts speech into concise technical language
- Uses appropriate terminology
- Formats for code documentation
- Maintains precision

**Example:**
```
Input:  "this function takes in a user id and returns all their posts"
Output: "Retrieves all posts associated with the specified user ID."
```

---

### Raw (No Processing)

**Use for:** When you want original transcription without AI processing

**What it does:**
- Bypasses AI completely
- Returns raw Whisper transcription
- Useful for debugging or when AI isn't needed

---

## Creating Custom Profiles

Custom profiles let you tailor AI processing to your specific needs.

### Step 1: Open Profile Manager

1. Go to Settings > AI Summarization
2. Click "Manage Profiles..." button
3. Click "+ New Profile"

### Step 2: Fill in Profile Details

**Name** (required):
- Short, descriptive name (e.g., "Casual Friendly", "Technical Report")
- Max 50 characters

**Description** (required):
- Brief explanation of what the profile does
- Max 200 characters

**System Prompt** (required):
- Instructions for the AI about its role and behavior
- Max 1000 characters
- Example: "You are a friendly writing assistant. Convert speech into casual, conversational text. Use contractions and keep it relaxed."

**User Prompt Template** (required):
- The actual prompt sent with each transcription
- Must include `{transcription}` placeholder
- Max 500 characters
- Example: "Convert this to friendly text:\n\n{transcription}"

### Step 3: Test Your Profile

1. Save the profile
2. Select it in the Active Profile dropdown
3. Do a test transcription
4. Adjust prompts if needed

### Profile Examples

#### Example 1: Casual Friendly
```
Name: Casual Friendly
Description: Relaxed, conversational tone for friends
System Prompt: You are a casual writing assistant. Keep text friendly
               and conversational. Use contractions. Don't be too formal.
User Prompt: Make this casual and friendly:\n\n{transcription}
```

#### Example 2: Technical Report
```
Name: Technical Report
Description: Formal technical documentation with precise language
System Prompt: You are a technical writer. Convert speech into precise,
               formal technical documentation. Use industry terminology
               appropriately.
User Prompt: Convert to technical documentation:\n\n{transcription}
```

#### Example 3: Meeting Minutes
```
Name: Meeting Minutes
Description: Structured meeting notes with action items
System Prompt: You are a meeting secretary. Convert speech into
               structured meeting minutes with action items, decisions,
               and attendee notes.
User Prompt: Create meeting minutes:\n\n{transcription}
```

---

## Configuration

### LLM Endpoint

The endpoint where Ollama is running.

**Default:** `http://localhost:11434`

**Change if:**
- Running Ollama on a different port
- Using a remote Ollama instance
- Using OpenAI-compatible API instead of Ollama

### LLM Model

The AI model to use for processing.

**Default:** `llama3.2`

**Options:**
- `llama3.2` - Good balance of speed and quality (recommended)
- `mistral` - Excellent quality, slightly slower
- `phi3` - Very fast, good for basic tasks
- Any other model you've pulled with Ollama

**Tip:** Click the refresh button to see all installed models.

### API Type

**Default:** Ollama

**Options:**
- **Ollama** - For local Ollama installation (recommended)
- **OpenAI-Compatible** - For OpenAI API or other compatible services

### Timeout

Maximum time to wait for AI processing before falling back to raw text.

**Default:** 10 seconds

**Change if:**
- Using a slower model
- Processing very long transcriptions
- Running on slower hardware

---

## Troubleshooting

### Problem: "Could not connect to LLM service"

**Solutions:**
1. Check Ollama is running:
   ```bash
   curl http://localhost:11434/api/version
   ```

2. Start Ollama if not running:
   ```bash
   ollama serve
   ```

3. Verify endpoint in Handy settings matches your Ollama installation

4. Check firewall isn't blocking localhost:11434

---

### Problem: "Model not found"

**Solutions:**
1. List installed models:
   ```bash
   ollama list
   ```

2. Pull the model if not installed:
   ```bash
   ollama pull llama3.2
   ```

3. Update model name in Handy settings to match an installed model

4. Click "Refresh" button next to model selector in Handy

---

### Problem: Processing is very slow

**Solutions:**
1. Use a smaller/faster model:
   ```bash
   ollama pull phi3
   ```

2. Check system resources (CPU/RAM usage)

3. Verify Ollama isn't running multiple models:
   ```bash
   ollama ps
   ```

4. Try increasing timeout in settings if processing eventually succeeds

---

### Problem: Processed text is nonsense

**Solutions:**
1. Check if the model is appropriate for your task
2. Review and adjust profile prompts
3. Try a different built-in profile
4. Ensure transcription quality is good (check microphone)
5. Test with a simpler/clearer transcription first

---

### Problem: Feature not working, always getting raw text

**Solutions:**
1. Verify "Enable AI Summarization" is toggled ON
2. Check active profile is not set to "Raw"
3. Click "Test Connection" to verify LLM is accessible
4. Check application logs for error messages

---

## Best Practices

### 1. Choose the Right Profile

Match your profile to your use case:
- Business communication → Professional or Email
- Quick notes → Notes
- Talking to AI → LLM Agent Instructions
- Documentation → Code Comments

### 2. Keep Ollama Running

For best performance, keep Ollama running in the background. It will automatically start on macOS after installation.

### 3. Test Connection First

Before important work, click "Test Connection" to ensure everything is working.

### 4. Create Profiles for Repeated Tasks

If you frequently do the same type of transcription, create a custom profile for it.

### 5. Start with Built-in Profiles

Before creating custom profiles, try the built-in ones. They cover most use cases.

### 6. Keep Prompts Concise

Shorter, clearer prompts generally work better than long, complex ones.

### 7. Use Raw Profile for Debugging

If you suspect AI processing is causing issues, switch to "Raw" profile to get unprocessed transcription.

### 8. Monitor Performance

If processing is slow, consider:
- Using a smaller model
- Upgrading hardware
- Adjusting timeout settings

---

## FAQ

### Q: Does AI Summarization require internet?

**A:** No! Everything runs locally on your machine. No data is sent to the cloud.

---

### Q: Is my data private?

**A:** Yes! All transcriptions and AI processing happen locally. Nothing leaves your computer.

---

### Q: Can I use ChatGPT or Claude instead of Ollama?

**A:** Not directly in the current version, but you can use OpenAI-compatible APIs. However, this would send your transcriptions to the cloud, which defeats the privacy purpose of Handy.

---

### Q: Which model should I use?

**A:** Start with `llama3.2` - it's a good balance of speed and quality. If it's too slow, try `phi3`. If you want better quality and have a powerful computer, try `mistral`.

---

### Q: How much disk space do models take?

**A:** Varies by model:
- `phi3`: ~2.3 GB
- `llama3.2`: ~2.0 GB
- `mistral`: ~4.1 GB

---

### Q: Can I use multiple models?

**A:** Yes, you can install multiple models and switch between them in settings. Only one model is used at a time.

---

### Q: Does AI Summarization slow down transcription?

**A:** It adds some latency (typically <1 second), but transcription accuracy isn't affected. If the AI is slow or unavailable, Handy automatically falls back to raw transcription.

---

### Q: Can I share my custom profiles?

**A:** Not yet, but this feature is planned for a future release. For now, you can manually recreate profiles on different machines.

---

### Q: What if I don't want AI processing for a specific transcription?

**A:** Switch to the "Raw" profile temporarily, or toggle off "Enable AI Summarization" in settings.

---

### Q: Can I edit transcriptions after they're pasted?

**A:** Yes, but you'll need to edit them in the target application. Handy's history shows both raw and processed versions if you need to reference the original.

---

### Q: Does this work with all Whisper models?

**A:** Yes, AI Summarization works with all Whisper models (Small, Medium, Turbo, Large) and Parakeet V3.

---

### Q: Can I use AI Summarization with translation?

**A:** Yes, but the AI processes the English translation, not the original language. The flow is: Speech → Transcription → Translation (if enabled) → AI Processing → Paste.

---

## Support

For issues, questions, or feature requests:
- GitHub Issues: [github.com/cjpais/Handy/issues](https://github.com/cjpais/Handy/issues)
- Discord: [Join our community](https://discord.com/invite/WVBeWsNXK4)
- Email: [contact@handy.computer](mailto:contact@handy.computer)

---

**Happy transcribing with AI!**
