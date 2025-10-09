# AI-Powered Summarization Feature - Requirements Specification

## Document Information
- **Version**: 1.0
- **Date**: 2025-10-09
- **Feature Name**: AI-Powered Post-Processing Pipeline
- **Status**: Ready for Implementation

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Feature Overview](#feature-overview)
3. [Architecture](#architecture)
4. [Technical Requirements](#technical-requirements)
5. [Data Structures](#data-structures)
6. [API Specifications](#api-specifications)
7. [UI/UX Requirements](#uiux-requirements)
8. [Implementation Phases](#implementation-phases)
9. [Testing Requirements](#testing-requirements)
10. [Configuration Examples](#configuration-examples)
11. [Migration & Compatibility](#migration--compatibility)

---

## Executive Summary

### Objective
Enhance Handy's transcription capabilities by adding an optional AI-powered post-processing pipeline that converts raw speech transcriptions into polished, context-appropriate text using local LLM models (Ollama/Mistral).

### Key Benefits
- **Context-Aware Output**: Adapt tone and style based on use case (professional emails, LLM instructions, casual notes)
- **Privacy-Preserving**: All processing remains local using user's own Ollama/Mistral installation
- **Non-Breaking**: Existing functionality unchanged; feature is opt-in
- **Extensible**: Profile-based system allows custom user-defined processing rules

### Success Criteria
- Users can enable/disable AI summarization via settings
- Users can select from built-in profiles or create custom ones
- System gracefully falls back to raw transcription if LLM service unavailable
- Both raw and processed text saved to history
- Feature adds <500ms latency for typical transcriptions

---

## Feature Overview

### Current Flow
```
Audio Recording → VAD Filtering → Whisper/Parakeet → Raw Text → Clipboard Paste
```

### New Flow
```
Audio Recording → VAD Filtering → Whisper/Parakeet → Raw Text
                                                       ↓
                                        [AI Post-Processing]
                                        - Profile Selection
                                        - LLM Processing
                                        - Error Handling
                                                       ↓
                                            Processed Text → Clipboard Paste
                                                       ↓
                                        History (stores both raw & processed)
```

### Core Principles
1. **Opt-In**: Feature disabled by default; users must explicitly enable
2. **Local-Only**: No cloud services; uses Ollama/Mistral running on user's machine
3. **Fallback-Safe**: If LLM unavailable, falls back to raw transcription without error
4. **Profile-Based**: Multiple processing styles selectable via settings
5. **Transparent**: User knows when summarization is active

---

## Architecture

### Component Overview

#### New Components
1. **SummarizationManager** (`src-tauri/src/managers/summarization.rs`)
   - Manages LLM connections
   - Handles profile-based processing
   - Implements retry and fallback logic

2. **Profile System** (`src-tauri/src/managers/profile.rs`)
   - Defines profile structure
   - Manages built-in and custom profiles
   - Stores profile configurations

3. **Settings Extensions** (`src-tauri/src/settings.rs`)
   - Summarization-related settings
   - Profile configurations
   - LLM endpoint settings

4. **UI Components** (`src/components/settings/`)
   - SummarizationSettings.tsx
   - ProfileSelector.tsx
   - ProfileEditor.tsx
   - LLMConfiguration.tsx

#### Modified Components
1. **actions.rs** - Add post-processing hook between transcription and paste
2. **history.rs** - Extend to store both raw and processed text
3. **lib.rs** - Initialize SummarizationManager

### Integration Points

```rust
// In actions.rs::TranscribeAction::stop()
// Location: Line ~107, after tm.transcribe(samples)

match tm.transcribe(samples) {
    Ok(raw_transcription) => {
        let settings = get_settings(&ah);

        // NEW: Post-processing step
        let final_text = if settings.enable_summarization && !raw_transcription.is_empty() {
            let sm = Arc::clone(&ah.state::<Arc<SummarizationManager>>());

            match sm.process_with_profile(&raw_transcription, &settings.active_profile_id).await {
                Ok(processed) => {
                    debug!("Summarization completed: {} chars -> {} chars",
                           raw_transcription.len(), processed.len());
                    processed
                }
                Err(e) => {
                    error!("Summarization failed, using raw text: {}", e);
                    raw_transcription.clone()
                }
            }
        } else {
            raw_transcription.clone()
        };

        // Save to history with both versions
        let hm_clone = Arc::clone(&hm);
        let transcription_for_history = raw_transcription.clone();
        let processed_for_history = if settings.enable_summarization {
            Some(final_text.clone())
        } else {
            None
        };

        tauri::async_runtime::spawn(async move {
            if let Err(e) = hm_clone
                .save_transcription_with_processed(
                    samples_clone,
                    transcription_for_history,
                    processed_for_history
                )
                .await
            {
                error!("Failed to save transcription to history: {}", e);
            }
        });

        // Paste final text
        utils::paste(final_text, ah_clone.clone())?;
    }
}
```

---

## Technical Requirements

### 1. SummarizationManager

**File**: `src-tauri/src/managers/summarization.rs`

**Responsibilities**:
- Manage HTTP client for Ollama/Mistral API
- Load and cache profiles
- Process text with selected profile
- Handle timeouts and retries
- Provide fallback mechanism

**Core Methods**:

```rust
pub struct SummarizationManager {
    client: Arc<reqwest::Client>,
    app_handle: AppHandle,
    profiles: Arc<Mutex<HashMap<String, Profile>>>,
}

impl SummarizationManager {
    pub fn new(app: &App) -> Result<Self>;

    // Process text using specified profile
    pub async fn process_with_profile(
        &self,
        raw_text: &str,
        profile_id: &str
    ) -> Result<String>;

    // Get LLM endpoint from settings
    fn get_llm_endpoint(&self) -> String;

    // Check if LLM service is available
    pub async fn check_llm_availability(&self) -> bool;

    // Get list of available models from LLM service
    pub async fn get_available_llm_models(&self) -> Result<Vec<String>>;

    // Load all profiles (built-in + custom)
    fn load_profiles(&self) -> HashMap<String, Profile>;

    // Reload profiles from settings
    pub fn reload_profiles(&self) -> Result<()>;
}
```

**Error Handling**:
- Network timeouts: 10 second timeout for LLM requests
- Connection failures: Log error, return raw text
- Invalid responses: Parse errors should return raw text
- Profile not found: Use default "passthrough" profile

**Performance Requirements**:
- LLM request timeout: 10 seconds
- Target processing time: <500ms for typical transcriptions (100-200 words)
- No blocking of main thread
- Async/await for all LLM communication

### 2. Profile System

**File**: `src-tauri/src/managers/profile.rs`

**Data Structure**:

```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub user_prompt_template: String,
    pub is_built_in: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

impl Profile {
    // Create a new custom profile
    pub fn new_custom(
        id: String,
        name: String,
        description: String,
        system_prompt: String,
        user_prompt_template: String
    ) -> Self;

    // Format the complete prompt for LLM
    pub fn format_prompt(&self, raw_text: &str) -> String {
        self.user_prompt_template.replace("{transcription}", raw_text)
    }
}
```

**Built-in Profiles**:

1. **Professional (ID: "professional")**
   - **Name**: Professional
   - **Description**: Formal tone suitable for workplace communication
   - **System Prompt**: "You are a professional writing assistant. Convert casual speech into polished, professional text suitable for workplace communication. Fix grammar, remove filler words, and use formal tone while maintaining the original meaning."
   - **User Prompt Template**: "Convert this speech transcription into professional text:\n\n{transcription}"

2. **LLM Agent (ID: "llm_agent")**
   - **Name**: LLM Agent Instructions
   - **Description**: Clear, structured instructions for AI agents
   - **System Prompt**: "You are a technical instruction optimizer. Convert natural speech into clear, structured instructions for AI agents. Use imperative voice, be specific and unambiguous, and remove conversational elements."
   - **User Prompt Template**: "Convert this speech into a clear instruction for an AI agent:\n\n{transcription}"

3. **Email (ID: "email")**
   - **Name**: Email
   - **Description**: Well-formatted email with proper structure
   - **System Prompt**: "You are an email writing assistant. Convert speech into a well-formatted email. Add appropriate greeting and closing if missing, use proper paragraphs, and maintain professional yet friendly tone."
   - **User Prompt Template**: "Convert this speech into a well-formatted email:\n\n{transcription}"

4. **Notes (ID: "notes")**
   - **Name**: Notes
   - **Description**: Concise bullet points and key phrases
   - **System Prompt**: "You are a note-taking assistant. Convert speech into concise, well-organized notes using bullet points. Extract key information and organize logically."
   - **User Prompt Template**: "Convert this speech into organized notes:\n\n{transcription}"

5. **Code Comments (ID: "code_comments")**
   - **Name**: Code Comments
   - **Description**: Technical documentation style
   - **System Prompt**: "You are a technical documentation assistant. Convert speech into clear, concise code comments or documentation. Use technical language appropriately and be precise."
   - **User Prompt Template**: "Convert this speech into a code comment or technical documentation:\n\n{transcription}"

6. **Raw (ID: "raw")**
   - **Name**: Raw (No Processing)
   - **Description**: Bypass summarization, paste raw transcription
   - **System Prompt**: "" (not used)
   - **User Prompt Template**: "" (not used)
   - **Special**: This profile bypasses LLM processing entirely

**Profile Storage**:
- Built-in profiles: Hardcoded in `profile.rs`
- Custom profiles: Stored in settings JSON under `custom_profiles` array
- Profile validation: Ensure ID uniqueness, non-empty name

### 3. Settings Extensions

**File**: `src-tauri/src/settings.rs`

**New Settings Fields**:

```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppSettings {
    // ... existing fields ...

    // Summarization settings
    #[serde(default = "default_enable_summarization")]
    pub enable_summarization: bool,

    #[serde(default = "default_active_profile_id")]
    pub active_profile_id: String,

    #[serde(default = "default_llm_endpoint")]
    pub llm_endpoint: String,

    #[serde(default = "default_llm_model")]
    pub llm_model: String,

    #[serde(default)]
    pub custom_profiles: Vec<Profile>,

    #[serde(default = "default_llm_timeout_seconds")]
    pub llm_timeout_seconds: u64,
}

fn default_enable_summarization() -> bool {
    false
}

fn default_active_profile_id() -> String {
    "raw".to_string() // Default to no processing
}

fn default_llm_endpoint() -> String {
    "http://localhost:11434".to_string() // Ollama default
}

fn default_llm_model() -> String {
    "llama3.2".to_string() // Good default model
}

fn default_llm_timeout_seconds() -> u64 {
    10
}
```

**New Settings Commands**:

Add to `src-tauri/src/shortcut.rs` or create new `src-tauri/src/commands/summarization.rs`:

```rust
#[tauri::command]
pub fn change_summarization_enabled_setting(
    app: tauri::AppHandle,
    enabled: bool
) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.enable_summarization = enabled;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_active_profile_setting(
    app: tauri::AppHandle,
    profile_id: String
) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.active_profile_id = profile_id;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_llm_endpoint_setting(
    app: tauri::AppHandle,
    endpoint: String
) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.llm_endpoint = endpoint;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_llm_model_setting(
    app: tauri::AppHandle,
    model: String
) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.llm_model = model;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn save_custom_profile(
    app: tauri::AppHandle,
    profile: Profile
) -> Result<(), String> {
    let mut settings = get_settings(&app);

    // Check if updating existing or adding new
    if let Some(pos) = settings.custom_profiles.iter().position(|p| p.id == profile.id) {
        settings.custom_profiles[pos] = profile;
    } else {
        settings.custom_profiles.push(profile);
    }

    write_settings(&app, settings);

    // Reload profiles in SummarizationManager
    let sm = app.state::<Arc<SummarizationManager>>();
    sm.reload_profiles().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_custom_profile(
    app: tauri::AppHandle,
    profile_id: String
) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.custom_profiles.retain(|p| p.id != profile_id);
    write_settings(&app, settings);

    // Reload profiles in SummarizationManager
    let sm = app.state::<Arc<SummarizationManager>>();
    sm.reload_profiles().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_all_profiles(app: tauri::AppHandle) -> Result<Vec<Profile>, String> {
    let sm = app.state::<Arc<SummarizationManager>>();
    let profiles = sm.profiles.lock().unwrap();
    Ok(profiles.values().cloned().collect())
}

#[tauri::command]
pub async fn check_llm_connection(app: tauri::AppHandle) -> Result<bool, String> {
    let sm = app.state::<Arc<SummarizationManager>>();
    Ok(sm.check_llm_availability().await)
}

#[tauri::command]
pub async fn get_llm_models(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let sm = app.state::<Arc<SummarizationManager>>();
    sm.get_available_llm_models().await.map_err(|e| e.to_string())
}
```

### 4. History Database Schema Extension

**File**: `src-tauri/src/managers/history.rs`

**Schema Changes**:

```sql
-- Migration to add processed_text column
ALTER TABLE history ADD COLUMN processed_text TEXT NULL;
```

**Modified Methods**:

```rust
impl HistoryManager {
    // Update existing method signature
    pub async fn save_transcription_with_processed(
        &self,
        audio_samples: Vec<f32>,
        raw_text: String,
        processed_text: Option<String>
    ) -> Result<()> {
        // ... save audio file ...

        // Insert into database
        db.execute(
            "INSERT INTO history (timestamp, text, processed_text, audio_file_path, duration, saved)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![timestamp, raw_text, processed_text, audio_file_path, duration, false]
        )?;

        Ok(())
    }

    // Keep backward compatibility
    pub async fn save_transcription(
        &self,
        audio_samples: Vec<f32>,
        raw_text: String
    ) -> Result<()> {
        self.save_transcription_with_processed(audio_samples, raw_text, None).await
    }
}
```

**HistoryEntry Structure**:

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub id: i64,
    pub timestamp: String,
    pub text: String,
    pub processed_text: Option<String>, // NEW
    pub audio_file_path: String,
    pub duration: f32,
    pub saved: bool,
}
```

---

## API Specifications

### Ollama API Integration

**Endpoint**: `POST {llm_endpoint}/api/generate`

**Request Format**:
```json
{
  "model": "llama3.2",
  "prompt": "System: {system_prompt}\n\nUser: {user_prompt}",
  "stream": false,
  "options": {
    "temperature": 0.3,
    "top_p": 0.9
  }
}
```

**Response Format**:
```json
{
  "model": "llama3.2",
  "created_at": "2025-10-09T12:00:00Z",
  "response": "Processed text here...",
  "done": true
}
```

**Error Handling**:
- HTTP 404: Model not found → Log error, return raw text
- HTTP 500: Server error → Log error, return raw text
- Timeout: After 10s → Log warning, return raw text
- Connection refused: Ollama not running → Log info, return raw text

**Alternative: Mistral API Integration**

For Mistral.ai API (if user prefers):

**Endpoint**: `POST {llm_endpoint}/v1/chat/completions`

**Request Format**:
```json
{
  "model": "mistral-tiny",
  "messages": [
    {
      "role": "system",
      "content": "{system_prompt}"
    },
    {
      "role": "user",
      "content": "{user_prompt}"
    }
  ],
  "temperature": 0.3,
  "max_tokens": 1000
}
```

**Implementation Strategy**:
- Detect API type based on endpoint format
- Support both Ollama and OpenAI-compatible APIs
- User selects "API Type" in settings: Ollama or OpenAI-Compatible

---

## Data Structures

### Complete Type Definitions

```rust
// src-tauri/src/managers/profile.rs
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub user_prompt_template: String,
    pub is_built_in: bool,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

// src-tauri/src/managers/summarization.rs
#[derive(Debug, Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaOptions {
    temperature: f32,
    top_p: f32,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaResponse {
    model: String,
    created_at: String,
    response: String,
    done: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<Message>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Choice {
    message: Message,
}
```

---

## UI/UX Requirements

### 1. Settings Panel - Summarization Section

**Location**: New tab/section in settings sidebar (after "Advanced")

**Component**: `src/components/settings/SummarizationSettings.tsx`

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│ AI Summarization                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ☐ Enable AI Summarization                              │
│   Process transcriptions with local AI before pasting  │
│                                                         │
│ ────────────────────────────────────────────────────── │
│                                                         │
│ Active Profile                                          │
│ ┌─────────────────────────────────────────────┐        │
│ │ Professional                           ▼    │        │
│ └─────────────────────────────────────────────┘        │
│ Formal tone suitable for workplace communication       │
│                                                         │
│ ────────────────────────────────────────────────────── │
│                                                         │
│ LLM Configuration                                       │
│                                                         │
│ Endpoint                                                │
│ ┌─────────────────────────────────────────────┐        │
│ │ http://localhost:11434                      │        │
│ └─────────────────────────────────────────────┘        │
│                                                         │
│ Model                                                   │
│ ┌─────────────────────────────────────────────┐        │
│ │ llama3.2                           [↻]      │        │
│ └─────────────────────────────────────────────┘        │
│                                                         │
│ [ Test Connection ]  ● Connected                        │
│                                                         │
│ ────────────────────────────────────────────────────── │
│                                                         │
│ [ Manage Profiles... ]                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Behavior**:
- When "Enable AI Summarization" toggled:
  - If disabled: All other controls grayed out
  - If enabled: Perform connection test in background
- Profile dropdown:
  - Show built-in profiles first
  - Then "──────────" separator
  - Then custom profiles
  - Profile description shown below dropdown
- "Refresh" button next to Model: Fetch available models from LLM endpoint
- "Test Connection":
  - Shows spinner while testing
  - Shows "✓ Connected" (green) or "✗ Not Connected" (red)
  - If failed, show helpful error message below

### 2. Profile Manager Modal

**Component**: `src/components/settings/ProfileManager.tsx`

**Triggered by**: "Manage Profiles..." button

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│ Manage Profiles                                    [✕]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌───────────────────┬──────────────────────────────┐   │
│ │ Built-in Profiles │ Profile Details              │   │
│ ├───────────────────┤                              │   │
│ │ > Professional    │  Name: Professional          │   │
│ │   LLM Agent       │                              │   │
│ │   Email           │  Description:                │   │
│ │   Notes           │  Formal tone suitable for... │   │
│ │   Code Comments   │                              │   │
│ │   Raw             │  System Prompt:              │   │
│ │                   │  ┌──────────────────────────┐│   │
│ │ Custom Profiles   ││ You are a professional... ││   │
│ │   My Casual       ││                           ││   │
│ │   Technical Docs  ││                           ││   │
│ │                   │└──────────────────────────┘│   │
│ │                   │                              │   │
│ │ [+ New Profile]   │  User Prompt Template:       │   │
│ │                   │  ┌──────────────────────────┐│   │
│ │                   ││ Convert this...           ││   │
│ │                   ││ {transcription}           ││   │
│ │                   ││                           ││   │
│ │                   │└──────────────────────────┘│   │
│ │                   │                              │   │
│ │                   │  [Edit]  [Delete]  [Duplicate]│   │
│ └───────────────────┴──────────────────────────────┘   │
│                                                         │
│                                [ Close ]                │
└─────────────────────────────────────────────────────────┘
```

**Behavior**:
- Built-in profiles: Read-only, cannot edit or delete
- Custom profiles: Can edit, delete, or duplicate
- "New Profile" button: Opens profile editor
- Selecting a profile: Shows details on right side
- "Edit": Opens profile editor with current values
- "Delete": Shows confirmation dialog
- "Duplicate": Creates new profile with copied values

### 3. Profile Editor Modal

**Component**: `src/components/settings/ProfileEditor.tsx`

**Triggered by**: "New Profile" or "Edit" in Profile Manager

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│ Edit Profile: My Custom Profile               [✕]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Name *                                                  │
│ ┌─────────────────────────────────────────────┐        │
│ │ My Custom Profile                           │        │
│ └─────────────────────────────────────────────┘        │
│                                                         │
│ Description *                                           │
│ ┌─────────────────────────────────────────────┐        │
│ │ Custom formatting for my specific use case  │        │
│ └─────────────────────────────────────────────┘        │
│                                                         │
│ System Prompt *                                         │
│ Instructions for the AI about how to process text      │
│ ┌─────────────────────────────────────────────┐        │
│ │ You are a writing assistant. Your task is  │        │
│ │ to convert speech into...                  │        │
│ │                                             │        │
│ │                                             │        │
│ └─────────────────────────────────────────────┘        │
│                                                         │
│ User Prompt Template *                                  │
│ Use {transcription} where the text should be inserted  │
│ ┌─────────────────────────────────────────────┐        │
│ │ Convert this speech:\n\n{transcription}    │        │
│ │                                             │        │
│ │                                             │        │
│ └─────────────────────────────────────────────┘        │
│                                                         │
│                           [ Cancel ]  [ Save ]          │
└─────────────────────────────────────────────────────────┘
```

**Validation**:
- Name: Required, max 50 characters, unique among custom profiles
- Description: Required, max 200 characters
- System Prompt: Required, max 1000 characters
- User Prompt Template: Required, must contain `{transcription}`, max 500 characters

### 4. History Panel Enhancement

**Component**: `src/components/settings/HistorySettings.tsx`

**Change**: Add toggle to show processed text

**Layout Change**:

```
┌────────────────────────────────────────────┐
│ Today                                      │
├────────────────────────────────────────────┤
│                                            │
│ 2:34 PM        [♡] [♪] [🗑]                │
│ This is the raw transcription text from   │
│ speech recognition...                      │
│                                            │
│ ▼ Show Processed Version                   │  ← New toggle
│                                            │
│ 2:30 PM        [♡] [♪] [🗑]                │
│ Here is some more transcribed text that   │
│ was captured earlier...                    │
│                                            │
│ ▶ Show Processed Version                   │
│                                            │
└────────────────────────────────────────────┘
```

**When Expanded**:

```
│ ▼ Show Processed Version                   │
│ ┌──────────────────────────────────────┐   │
│ │ Processed (Professional):            │   │
│ │                                      │   │
│ │ This represents the raw transcript-  │   │
│ │ ion text that was generated from     │   │
│ │ speech recognition software.         │   │
│ └──────────────────────────────────────┘   │
```

### 5. Visual Indicators

**Tray Icon Enhancement** (Optional):
- When summarization enabled: Small dot or different icon variant
- Helps user remember if feature is on

**Overlay Enhancement** (Optional):
- Show active profile name during recording:
  ```
  ● Recording (Professional Mode)
  ```

---

## Implementation Phases

### Phase 1: Core Backend Infrastructure (Priority: High)
**Estimated Time**: 4-6 hours

**Tasks**:
1. Create `src-tauri/src/managers/profile.rs`
   - Define `Profile` struct
   - Implement built-in profiles (6 profiles)
   - Add profile helper methods

2. Create `src-tauri/src/managers/summarization.rs`
   - Define `SummarizationManager` struct
   - Implement HTTP client for Ollama
   - Implement `process_with_profile()` method
   - Add error handling and fallback logic
   - Implement connection testing

3. Extend `src-tauri/src/settings.rs`
   - Add new settings fields
   - Add default value functions
   - Update `AppSettings` struct

4. Create `src-tauri/src/commands/summarization.rs`
   - Implement all Tauri commands listed in Technical Requirements
   - Add to command handler registration in `lib.rs`

**Acceptance Criteria**:
- [ ] All 6 built-in profiles defined and accessible
- [ ] Can make successful HTTP request to Ollama
- [ ] Settings load/save correctly with new fields
- [ ] All commands registered and callable from frontend
- [ ] Error handling returns raw text on failure

**Testing**:
```bash
# Unit tests
cargo test summarization

# Manual test with Ollama
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "System: You are a professional writer.\n\nUser: Convert to formal text: hey whats up",
  "stream": false
}'
```

---

### Phase 2: Integration with Transcription Flow (Priority: High)
**Estimated Time**: 2-3 hours

**Tasks**:
1. Modify `src-tauri/src/actions.rs`
   - Add post-processing step in `TranscribeAction::stop()`
   - Import `SummarizationManager`
   - Add conditional processing based on settings
   - Maintain error handling and fallback

2. Initialize `SummarizationManager` in `src-tauri/src/lib.rs`
   - Create manager instance in `setup()`
   - Add to managed state

3. Update history database schema
   - Create migration for `processed_text` column
   - Update SQL queries

4. Modify `src-tauri/src/managers/history.rs`
   - Update `save_transcription` to include processed text
   - Add `save_transcription_with_processed()` method
   - Update `HistoryEntry` struct

**Acceptance Criteria**:
- [ ] Transcriptions processed when feature enabled
- [ ] Raw text used when feature disabled or error occurs
- [ ] Both raw and processed text saved to history
- [ ] No breaking changes to existing functionality
- [ ] Processing adds <500ms latency on average

**Testing**:
```rust
// Integration test
#[tauri::test]
async fn test_transcription_with_summarization() {
    // 1. Enable summarization
    // 2. Set profile to "professional"
    // 3. Trigger transcription
    // 4. Verify processed text differs from raw
    // 5. Verify both saved to history
}
```

---

### Phase 3: Frontend UI Components (Priority: Medium)
**Estimated Time**: 6-8 hours

**Tasks**:
1. Create `src/components/settings/SummarizationSettings.tsx`
   - Toggle for enable/disable
   - Profile dropdown selector
   - LLM configuration (endpoint, model)
   - Connection test button
   - "Manage Profiles" button

2. Create `src/components/settings/ProfileManager.tsx`
   - Two-column layout (list + details)
   - Display built-in and custom profiles
   - Enable edit/delete/duplicate for custom profiles
   - "New Profile" button

3. Create `src/components/settings/ProfileEditor.tsx`
   - Form for profile fields
   - Validation logic
   - Save/cancel functionality

4. Add to sidebar navigation
   - New "AI Summarization" menu item
   - Icon selection

5. Create hooks (if needed)
   - `src/hooks/useSummarization.ts`
   - `src/hooks/useProfiles.ts`

**Acceptance Criteria**:
- [ ] Can toggle summarization on/off
- [ ] Can select profile from dropdown
- [ ] Can test LLM connection
- [ ] Can create/edit/delete custom profiles
- [ ] All form validations working
- [ ] UI follows existing Handy design patterns

**Testing**:
- Manual testing of all UI interactions
- Test with Ollama running and not running
- Test with invalid endpoints
- Test profile CRUD operations

---

### Phase 4: History Panel Enhancement (Priority: Low)
**Estimated Time**: 2-3 hours

**Tasks**:
1. Modify `src/components/settings/HistorySettings.tsx`
   - Add toggle/expand for processed text view
   - Display both raw and processed text
   - Style processed text display
   - Handle entries without processed text (backward compatibility)

**Acceptance Criteria**:
- [ ] Can view both raw and processed text in history
- [ ] Toggle expands/collapses smoothly
- [ ] Old entries (no processed text) display correctly
- [ ] Profile name shown with processed text

**Testing**:
- View history entries with and without processing
- Expand/collapse multiple entries
- Check backward compatibility with old data

---

### Phase 5: Polish & Optional Features (Priority: Low)
**Estimated Time**: 3-4 hours

**Optional Tasks**:
1. Tray menu quick-switch
   - Add submenu to tray: "AI Profile: Professional >"
   - List profiles in submenu
   - Clicking changes active profile

2. Keyboard shortcut for profile switching
   - Add new binding: "Next Profile"
   - Cycles through available profiles
   - Shows notification of current profile

3. Visual feedback during processing
   - Update overlay: "Processing with [Profile Name]..."
   - Show spinner or progress indication

4. Profile import/export
   - Export custom profiles as JSON
   - Import profiles from file
   - Share profiles with community

5. Advanced settings
   - Temperature control
   - Max tokens
   - Streaming support (show text as it generates)

**Acceptance Criteria**:
- [ ] Selected optional features implemented and tested
- [ ] No performance degradation
- [ ] Maintains UI consistency

---

## Testing Requirements

### Unit Tests

**Backend**:

```rust
// src-tauri/src/managers/summarization.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_profile_prompt_formatting() {
        let profile = Profile {
            id: "test".to_string(),
            name: "Test".to_string(),
            description: "Test profile".to_string(),
            system_prompt: "You are a tester".to_string(),
            user_prompt_template: "Process: {transcription}".to_string(),
            is_built_in: true,
            created_at: None,
            updated_at: None,
        };

        let formatted = profile.format_prompt("hello world");
        assert!(formatted.contains("hello world"));
    }

    #[tokio::test]
    async fn test_summarization_fallback_on_error() {
        // Test that raw text returned when LLM unavailable
        // Mock HTTP client failure
        // Verify raw text returned
    }

    #[test]
    fn test_built_in_profiles_exist() {
        let profiles = get_built_in_profiles();
        assert_eq!(profiles.len(), 6);
        assert!(profiles.iter().any(|p| p.id == "professional"));
        assert!(profiles.iter().any(|p| p.id == "llm_agent"));
        assert!(profiles.iter().any(|p| p.id == "raw"));
    }
}
```

**Frontend**:

```typescript
// src/components/settings/__tests__/SummarizationSettings.test.tsx

describe('SummarizationSettings', () => {
  test('disables controls when summarization disabled', () => {
    // Render with enable_summarization: false
    // Verify profile dropdown disabled
    // Verify other controls disabled
  });

  test('validates LLM endpoint format', () => {
    // Enter invalid URL
    // Verify error message shown
  });

  test('fetches available models on refresh', async () => {
    // Mock API response
    // Click refresh button
    // Verify models loaded into dropdown
  });
});
```

### Integration Tests

**E2E Transcription Flow**:

```rust
#[tauri::test]
async fn test_full_summarization_flow() {
    // 1. Start app
    // 2. Enable summarization in settings
    // 3. Select "professional" profile
    // 4. Trigger transcription with test audio
    // 5. Wait for processing
    // 6. Verify clipboard contains processed text
    // 7. Check history has both raw and processed
}

#[tauri::test]
async fn test_fallback_when_ollama_unavailable() {
    // 1. Enable summarization
    // 2. Set invalid endpoint
    // 3. Trigger transcription
    // 4. Verify raw text still pasted
    // 5. Verify error logged but no crash
}
```

### Manual Testing Checklist

**Setup**:
- [ ] Install Ollama: `curl https://ollama.ai/install.sh | sh`
- [ ] Pull model: `ollama pull llama3.2`
- [ ] Verify running: `curl http://localhost:11434/api/version`

**Feature Testing**:
- [ ] Toggle summarization on/off
- [ ] Test each built-in profile (6 profiles)
- [ ] Create custom profile
- [ ] Edit custom profile
- [ ] Delete custom profile
- [ ] Test with Ollama running
- [ ] Test with Ollama stopped (verify fallback)
- [ ] Test with invalid endpoint
- [ ] Test with invalid model name
- [ ] View history with processed text
- [ ] Verify both raw and processed saved
- [ ] Switch profiles mid-session
- [ ] Test connection button
- [ ] Fetch available models

**Performance Testing**:
- [ ] Measure processing time with 50-word transcription
- [ ] Measure processing time with 200-word transcription
- [ ] Verify < 500ms average latency
- [ ] Check memory usage (should not leak)

**Edge Cases**:
- [ ] Empty transcription
- [ ] Very long transcription (1000+ words)
- [ ] Special characters in transcription
- [ ] LLM timeout (simulate slow response)
- [ ] Rapid successive transcriptions
- [ ] Switch profiles during transcription (should use profile at start time)

---

## Configuration Examples

### Example Settings JSON

```json
{
  "bindings": { ... },
  "push_to_talk": true,
  "audio_feedback": false,
  "start_hidden": false,
  "selected_model": "whisper_small",
  "enable_summarization": true,
  "active_profile_id": "professional",
  "llm_endpoint": "http://localhost:11434",
  "llm_model": "llama3.2",
  "llm_timeout_seconds": 10,
  "custom_profiles": [
    {
      "id": "my_casual",
      "name": "My Casual Style",
      "description": "Friendly, conversational tone",
      "system_prompt": "Convert speech to casual, friendly text. Use contractions and keep it conversational.",
      "user_prompt_template": "Make this casual and friendly:\n\n{transcription}",
      "is_built_in": false,
      "created_at": "2025-10-09T10:00:00Z",
      "updated_at": "2025-10-09T10:00:00Z"
    }
  ]
}
```

### Ollama Setup Guide (for documentation)

```bash
# Install Ollama (macOS/Linux)
curl https://ollama.ai/install.sh | sh

# Or on macOS with Homebrew
brew install ollama

# Start Ollama service
ollama serve

# Pull recommended model
ollama pull llama3.2

# Alternative models
ollama pull mistral
ollama pull phi3

# Verify installation
curl http://localhost:11434/api/tags
```

### Example LLM Prompt Execution

**Input** (Raw Transcription):
```
um hey john so like i wanted to ask you about that thing we talked about yesterday
you know the project deadline and stuff uh could you maybe send me the files when
you get a chance thanks
```

**Profile**: Professional

**System Prompt**:
```
You are a professional writing assistant. Convert casual speech into polished,
professional text suitable for workplace communication. Fix grammar, remove filler
words, and use formal tone while maintaining the original meaning.
```

**User Prompt**:
```
Convert this speech transcription into professional text:

um hey john so like i wanted to ask you about that thing we talked about yesterday
you know the project deadline and stuff uh could you maybe send me the files when
you get a chance thanks
```

**Output** (Processed):
```
Hi John,

I wanted to follow up on our discussion yesterday regarding the project deadline.
Could you please send me the relevant files at your earliest convenience?

Thank you.
```

---

## Migration & Compatibility

### Backward Compatibility

**Database**:
- New column `processed_text` is nullable
- Existing entries work without modification
- No data migration required

**Settings**:
- All new settings have defaults
- Existing settings files load without error
- Default: `enable_summarization: false` (opt-in)

**UI**:
- History panel shows only raw text if no processed version exists
- No UI changes visible if feature not enabled
- Settings panel hidden behind new sidebar item (doesn't clutter existing UI)

### Upgrade Path

**From Previous Version**:
1. App loads normally with existing settings
2. New settings get default values
3. History database automatically adds column on first run
4. User sees new "AI Summarization" option in sidebar
5. Feature disabled by default - existing behavior unchanged

### Rollback Plan

If feature needs to be disabled:
1. User can toggle `enable_summarization: false` in settings
2. No code changes required - feature dormant
3. History data preserved (both raw and processed)
4. Can re-enable anytime without data loss

---

## Performance Considerations

### Latency Budget

**Target**: Total time from "stop recording" to "text pasted" < 2 seconds

**Breakdown**:
- Transcription: ~500ms (existing)
- LLM Processing: ~500ms (new)
- Clipboard operations: ~50ms (existing)
- **Total**: ~1050ms (within budget)

### Optimization Strategies

1. **Async Processing**: Use Tokio async runtime for all LLM calls
2. **Timeout Enforcement**: Hard 10-second timeout to prevent hanging
3. **Connection Pooling**: Reuse HTTP client across requests
4. **Profile Caching**: Load profiles once, cache in memory
5. **Fallback Fast**: Immediate fallback to raw text on error

### Resource Usage

**Memory**:
- HTTP client: ~5MB
- Cached profiles: <1KB
- Request/response buffers: ~100KB per request
- **Total overhead**: <10MB

**Network**:
- Local only (localhost:11434)
- No external network traffic
- Bandwidth: ~1-5KB per request/response

---

## Documentation Requirements

### User-Facing Documentation

**README Update**:
```markdown
## AI Summarization (Optional)

Handy can optionally process your transcriptions with a local AI to improve
formatting, grammar, and tone. This feature requires [Ollama](https://ollama.ai)
or compatible LLM service running locally.

### Setup
1. Install Ollama: `curl https://ollama.ai/install.sh | sh`
2. Pull a model: `ollama pull llama3.2`
3. Enable in Settings > AI Summarization
4. Choose your profile and start transcribing!

### Profiles
- **Professional**: Formal workplace communication
- **LLM Agent**: Clear instructions for AI
- **Email**: Well-formatted emails
- **Notes**: Concise bullet points
- **Code Comments**: Technical documentation
- **Raw**: No processing (bypass)

You can also create custom profiles for your specific needs.
```

**In-App Help Text**:
- Tooltip on "Enable AI Summarization": "Process transcriptions with local AI for better formatting and tone. Requires Ollama or compatible LLM."
- Connection test failure: "Could not connect to LLM service. Make sure Ollama is running: `ollama serve`"
- Profile selector: Show profile description on hover

### Developer Documentation

**Code Comments**:
- Document all public methods in `SummarizationManager`
- Add rustdoc comments with examples
- Document profile template syntax

**Architecture Doc**:
- Update CLAUDE.md with summarization flow
- Add sequence diagram for post-processing pipeline
- Document extension points for future enhancements

---

## Security Considerations

### Threat Model

**Local-Only Processing**:
- ✅ No data leaves user's machine
- ✅ No API keys required
- ✅ No telemetry or tracking

**User-Controlled**:
- ✅ User chooses LLM endpoint
- ✅ User provides prompts
- ✅ Feature opt-in

**Potential Risks**:
- ⚠️ Malicious custom profiles (user shoots own foot)
- ⚠️ Prompt injection (user's own prompts)
- ✅ Mitigated by local-only processing

### Input Validation

**Settings**:
- Validate URL format for `llm_endpoint`
- Sanitize profile names (no special characters in IDs)
- Limit prompt lengths (prevent memory issues)

**LLM Responses**:
- Validate response is valid UTF-8
- Limit response length (max 10x input length)
- Handle malformed JSON gracefully

---

## Success Metrics

### Adoption Metrics
- % of users who enable summarization
- Most popular profiles (telemetry opt-in)
- Average profiles per user

### Quality Metrics
- Success rate (LLM processing vs. fallback)
- Average processing latency
- User satisfaction (via feedback form)

### Technical Metrics
- Error rate (<1% target)
- Timeout rate (<0.1% target)
- Fallback rate (<5% target)

---

## Future Enhancements (Out of Scope for v1)

1. **Profile Marketplace**: Share profiles with community
2. **Multi-Step Processing**: Chain profiles (e.g., transcribe → translate → summarize)
3. **Custom LLM Providers**: Support OpenAI, Anthropic (for users who prefer cloud)
4. **Smart Context Detection**: Auto-select profile based on active application
5. **Learning Mode**: Improve profiles based on user edits
6. **Streaming Mode**: Show processed text as it generates
7. **Voice Commands**: "Use professional mode" during recording
8. **A/B Testing**: Compare profile effectiveness
9. **Diff View**: Highlight changes between raw and processed
10. **Undo Processing**: Replace with raw text after paste

---

## Appendix A: Complete File List

### New Files

**Backend**:
- `src-tauri/src/managers/summarization.rs` (~400 lines)
- `src-tauri/src/managers/profile.rs` (~200 lines)
- `src-tauri/src/commands/summarization.rs` (~150 lines)

**Frontend**:
- `src/components/settings/SummarizationSettings.tsx` (~250 lines)
- `src/components/settings/ProfileManager.tsx` (~300 lines)
- `src/components/settings/ProfileEditor.tsx` (~200 lines)
- `src/components/settings/LLMConfiguration.tsx` (~150 lines)
- `src/hooks/useSummarization.ts` (~100 lines)
- `src/hooks/useProfiles.ts` (~100 lines)

### Modified Files

**Backend**:
- `src-tauri/src/lib.rs` (~20 lines changed)
- `src-tauri/src/actions.rs` (~40 lines changed)
- `src-tauri/src/settings.rs` (~50 lines added)
- `src-tauri/src/managers/history.rs` (~30 lines changed)
- `src-tauri/Cargo.toml` (~5 lines added)

**Frontend**:
- `src/components/Sidebar.tsx` (~10 lines added)
- `src/components/settings/HistorySettings.tsx` (~50 lines added)
- `src/App.tsx` (minor routing changes)

**Documentation**:
- `README.md` (new section)
- `CLAUDE.md` (architecture update)
- `CHANGELOG.md` (version entry)

**Estimated Total**: ~2,000 lines of new code

---

## Appendix B: Dependencies

### Rust Crates to Add

```toml
[dependencies]
# Existing dependencies...

# For HTTP requests to Ollama
reqwest = { version = "0.11", features = ["json"] }

# Already present in project:
# - tokio (async runtime)
# - serde (serialization)
# - anyhow (error handling)
```

### TypeScript Packages

No new packages required. Existing dependencies sufficient:
- React (UI components)
- Tauri API (commands)
- Tailwind CSS (styling)

---

## Appendix C: Example Usage Scenarios

### Scenario 1: Professional Email

**User Action**: Press transcription shortcut (Alt+Space)

**User Says**:
> "hey sarah um i wanted to check in about the quarterly report you know
> the one we discussed last week uh when do you think you'll have that ready
> also can you include the sales figures thanks"

**Settings**:
- Summarization: Enabled
- Profile: Email
- Model: llama3.2

**Result Pasted**:
```
Hi Sarah,

I wanted to follow up on the quarterly report we discussed last week.
Could you please provide an update on when it will be ready? Please
include the sales figures in your report.

Thank you.
```

---

### Scenario 2: LLM Agent Instructions

**User Action**: Press transcription shortcut

**User Says**:
> "so like i want you to look through all the typescript files and um
> find any places where we're using the old api you know the v1 stuff
> and then update them to use v2 but make sure you test everything first"

**Settings**:
- Summarization: Enabled
- Profile: LLM Agent
- Model: llama3.2

**Result Pasted**:
```
Search all TypeScript files for v1 API usage. Update each occurrence to
use v2 API. Test all changes before committing.

Requirements:
- Scan: *.ts, *.tsx files
- Pattern: v1 API calls
- Action: Replace with v2 API equivalents
- Verify: Run test suite after changes
```

---

### Scenario 3: Quick Notes

**User Action**: Press transcription shortcut

**User Says**:
> "okay so for the meeting tomorrow we need to cover like the budget stuff
> and then talk about the new hires um also don't forget to mention the
> office move and when that's happening oh and the team building event"

**Settings**:
- Summarization: Enabled
- Profile: Notes
- Model: llama3.2

**Result Pasted**:
```
Meeting Agenda (Tomorrow):
• Budget review
• New hires discussion
• Office move timeline
• Team building event planning
```

---

## Appendix D: Troubleshooting Guide

### Common Issues

**Issue**: "Could not connect to LLM service"

**Solutions**:
1. Check Ollama is running: `curl http://localhost:11434/api/version`
2. Start Ollama: `ollama serve`
3. Verify endpoint in settings matches Ollama URL
4. Check firewall not blocking localhost:11434

---

**Issue**: "Model not found"

**Solutions**:
1. Pull the model: `ollama pull llama3.2`
2. List available models: `ollama list`
3. Update model name in settings to match available model
4. Click "Refresh" button next to model selector

---

**Issue**: "Processing taking too long"

**Solutions**:
1. Check Ollama model loaded: `ollama ps`
2. Try smaller model: `llama3.2` instead of `llama3.2:70b`
3. Increase timeout in settings (if implemented)
4. Check system resources (CPU/RAM)

---

**Issue**: "Processed text is nonsense"

**Solutions**:
1. Review profile prompts - may need adjustment
2. Try different profile
3. Check model quality - some models better than others
4. Provide more context in system prompt

---

**Issue**: "Feature not working, falling back to raw text"

**Solutions**:
1. Check Settings > AI Summarization is enabled (toggle on)
2. Verify active profile is not "Raw"
3. Check Ollama connection (test button)
4. Review logs for specific error messages

---

## Appendix E: Implementation Checklist

**Phase 1: Backend Core**
- [ ] Create `profile.rs` with 6 built-in profiles
- [ ] Create `summarization.rs` with manager
- [ ] Implement Ollama HTTP client
- [ ] Add settings fields
- [ ] Create Tauri commands
- [ ] Register commands in `lib.rs`
- [ ] Write unit tests

**Phase 2: Integration**
- [ ] Modify `actions.rs` with post-processing hook
- [ ] Initialize manager in `lib.rs::setup()`
- [ ] Create history DB migration
- [ ] Update `history.rs` methods
- [ ] Test E2E flow
- [ ] Verify fallback behavior

**Phase 3: Frontend**
- [ ] Create `SummarizationSettings.tsx`
- [ ] Create `ProfileManager.tsx`
- [ ] Create `ProfileEditor.tsx`
- [ ] Add sidebar navigation item
- [ ] Implement hooks
- [ ] Add form validations
- [ ] Style components

**Phase 4: History UI**
- [ ] Modify `HistorySettings.tsx`
- [ ] Add processed text toggle
- [ ] Style processed text display
- [ ] Test backward compatibility

**Phase 5: Polish**
- [ ] Add helpful error messages
- [ ] Write user documentation
- [ ] Update README.md
- [ ] Update CLAUDE.md
- [ ] Add tooltips/help text
- [ ] Final testing

**Documentation & Release**
- [ ] Update CHANGELOG.md
- [ ] Create migration guide
- [ ] Test upgrade from previous version
- [ ] Performance benchmarks
- [ ] Create demo video (optional)

---

## End of Requirements Specification

**Document Status**: Complete and ready for implementation

**Next Steps**:
1. Review this spec with stakeholders
2. Estimate development time per phase
3. Begin Phase 1 implementation
4. Iterate based on testing feedback

**Questions?** Contact the specification author for clarifications.
