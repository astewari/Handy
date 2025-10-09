use crate::managers::profile::{get_built_in_profiles, Profile};
use crate::settings::get_settings;
use anyhow::{anyhow, Result};
use log::{debug, error, info, warn};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{App, AppHandle};

/// Request format for Ollama API
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

/// Response format for Ollama API
#[derive(Debug, Serialize, Deserialize)]
struct OllamaResponse {
    #[serde(default)]
    model: String,
    #[serde(default)]
    created_at: String,
    response: String,
    done: bool,
}

/// Request format for OpenAI-compatible API (including Mistral)
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

/// Response format for OpenAI-compatible API
#[derive(Debug, Serialize, Deserialize)]
struct OpenAIResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Choice {
    message: Message,
}

/// API type configuration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ApiType {
    Ollama,
    OpenAI,
}

pub struct SummarizationManager {
    client: Arc<Client>,
    app_handle: AppHandle,
    pub profiles: Arc<Mutex<HashMap<String, Profile>>>,
}

impl SummarizationManager {
    /// Create a new SummarizationManager
    pub fn new(app: &App) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()?;

        let app_handle = app.handle().clone();

        // Load profiles (built-in + custom from settings)
        let profiles = Self::load_profiles_from_app(&app_handle);

        Ok(Self {
            client: Arc::new(client),
            app_handle,
            profiles: Arc::new(Mutex::new(profiles)),
        })
    }

    /// Load all profiles (built-in + custom)
    fn load_profiles_from_app(app_handle: &AppHandle) -> HashMap<String, Profile> {
        let mut profiles = HashMap::new();

        // Load built-in profiles
        for profile in get_built_in_profiles() {
            profiles.insert(profile.id.clone(), profile);
        }

        // Load custom profiles from settings
        let settings = get_settings(app_handle);
        for profile in settings.custom_profiles {
            profiles.insert(profile.id.clone(), profile);
        }

        info!("Loaded {} profiles", profiles.len());
        profiles
    }

    /// Reload profiles from settings (call after custom profile changes)
    pub fn reload_profiles(&self) -> Result<()> {
        let new_profiles = Self::load_profiles_from_app(&self.app_handle);
        let mut profiles = self
            .profiles
            .lock()
            .map_err(|e| anyhow!("Failed to lock profiles: {}", e))?;
        *profiles = new_profiles;
        Ok(())
    }

    /// Process text using specified profile
    pub async fn process_with_profile(&self, raw_text: &str, profile_id: &str) -> Result<String> {
        // Get profile
        let profile = {
            let profiles = self
                .profiles
                .lock()
                .map_err(|e| anyhow!("Failed to lock profiles: {}", e))?;
            profiles
                .get(profile_id)
                .ok_or_else(|| anyhow!("Profile not found: {}", profile_id))?
                .clone()
        };

        // Special case: "raw" profile bypasses processing
        if profile.id == "raw" {
            debug!("Raw profile selected, bypassing LLM processing");
            return Ok(raw_text.to_string());
        }

        // Get settings
        let settings = get_settings(&self.app_handle);
        let endpoint = settings.llm_endpoint;
        let model = settings.llm_model;

        // Detect API type based on endpoint
        let api_type = if endpoint.contains("/v1/") || settings.llm_api_type == ApiType::OpenAI {
            ApiType::OpenAI
        } else {
            ApiType::Ollama
        };

        debug!(
            "Processing with profile '{}', model '{}', API type: {:?}",
            profile.name, model, api_type
        );

        // Format prompt
        let user_prompt = profile.format_prompt(raw_text);

        // Call appropriate API
        match api_type {
            ApiType::Ollama => self.call_ollama(&endpoint, &model, &profile, &user_prompt).await,
            ApiType::OpenAI => {
                self.call_openai_compatible(&endpoint, &model, &profile, &user_prompt)
                    .await
            }
        }
    }

    /// Call Ollama API
    async fn call_ollama(
        &self,
        endpoint: &str,
        model: &str,
        profile: &Profile,
        user_prompt: &str,
    ) -> Result<String> {
        let url = format!("{}/api/generate", endpoint.trim_end_matches('/'));

        // Combine system and user prompts
        let combined_prompt = if !profile.system_prompt.is_empty() {
            format!(
                "System: {}\n\nUser: {}",
                profile.system_prompt, user_prompt
            )
        } else {
            user_prompt.to_string()
        };

        let request = OllamaRequest {
            model: model.to_string(),
            prompt: combined_prompt,
            stream: false,
            options: OllamaOptions {
                temperature: 0.3,
                top_p: 0.9,
            },
        };

        debug!("Sending Ollama request to {}", url);
        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                error!("Ollama request failed: {}", e);
                anyhow!("Failed to connect to Ollama: {}", e)
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!("Ollama returned error {}: {}", status, error_text);
            return Err(anyhow!("Ollama error {}: {}", status, error_text));
        }

        let ollama_response: OllamaResponse = response.json().await.map_err(|e| {
            error!("Failed to parse Ollama response: {}", e);
            anyhow!("Invalid response from Ollama: {}", e)
        })?;

        let processed_text = ollama_response.response.trim().to_string();
        debug!(
            "Ollama processing complete: {} chars -> {} chars",
            user_prompt.len(),
            processed_text.len()
        );

        Ok(processed_text)
    }

    /// Call OpenAI-compatible API (including Mistral)
    async fn call_openai_compatible(
        &self,
        endpoint: &str,
        model: &str,
        profile: &Profile,
        user_prompt: &str,
    ) -> Result<String> {
        let url = format!(
            "{}/chat/completions",
            endpoint.trim_end_matches('/').trim_end_matches("/v1")
        );

        let mut messages = Vec::new();

        // Add system prompt if present
        if !profile.system_prompt.is_empty() {
            messages.push(Message {
                role: "system".to_string(),
                content: profile.system_prompt.clone(),
            });
        }

        // Add user prompt
        messages.push(Message {
            role: "user".to_string(),
            content: user_prompt.to_string(),
        });

        let request = OpenAIRequest {
            model: model.to_string(),
            messages,
            temperature: 0.3,
            max_tokens: 1000,
        };

        debug!("Sending OpenAI-compatible request to {}", url);
        let response = self.client.post(&url).json(&request).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!("OpenAI API returned error {}: {}", status, error_text);
            return Err(anyhow!("OpenAI API error {}: {}", status, error_text));
        }

        let openai_response: OpenAIResponse = response.json().await?;

        let processed_text = openai_response
            .choices
            .first()
            .ok_or_else(|| anyhow!("No choices in OpenAI response"))?
            .message
            .content
            .trim()
            .to_string();

        debug!(
            "OpenAI processing complete: {} chars -> {} chars",
            user_prompt.len(),
            processed_text.len()
        );

        Ok(processed_text)
    }

    /// Check if LLM service is available
    pub async fn check_llm_availability(&self) -> bool {
        let settings = get_settings(&self.app_handle);
        let endpoint = settings.llm_endpoint;

        // Try Ollama version endpoint
        let url = format!("{}/api/version", endpoint.trim_end_matches('/'));

        match self.client.get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                info!("LLM service is available at {}", endpoint);
                true
            }
            Ok(response) => {
                warn!("LLM service returned status {}", response.status());
                false
            }
            Err(e) => {
                warn!("LLM service unavailable: {}", e);
                false
            }
        }
    }

    /// Get list of available models from LLM service
    pub async fn get_available_llm_models(&self) -> Result<Vec<String>> {
        let settings = get_settings(&self.app_handle);
        let endpoint = settings.llm_endpoint;
        let url = format!("{}/api/tags", endpoint.trim_end_matches('/'));

        debug!("Fetching available models from {}", url);

        let response = self.client.get(&url).send().await.map_err(|e| {
            error!("Failed to fetch models: {}", e);
            anyhow!("Failed to connect to LLM service: {}", e)
        })?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Failed to fetch models: HTTP {}",
                response.status()
            ));
        }

        // Parse Ollama tags response
        #[derive(Deserialize)]
        struct TagsResponse {
            models: Vec<ModelInfo>,
        }

        #[derive(Deserialize)]
        struct ModelInfo {
            name: String,
        }

        let tags: TagsResponse = response.json().await.map_err(|e| {
            error!("Failed to parse models response: {}", e);
            anyhow!("Invalid response format: {}", e)
        })?;

        let model_names: Vec<String> = tags.models.into_iter().map(|m| m.name).collect();

        info!("Found {} available models", model_names.len());
        Ok(model_names)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_type_detection() {
        // Ollama endpoint
        let ollama_endpoint = "http://localhost:11434";
        assert!(!ollama_endpoint.contains("/v1/"));

        // OpenAI endpoint
        let openai_endpoint = "http://localhost:8080/v1/chat/completions";
        assert!(openai_endpoint.contains("/v1/"));
    }
}
