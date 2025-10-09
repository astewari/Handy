use chrono::Utc;
use serde::{Deserialize, Serialize};

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

impl Profile {
    /// Create a new custom profile
    pub fn new_custom(
        id: String,
        name: String,
        description: String,
        system_prompt: String,
        user_prompt_template: String,
    ) -> Self {
        let now = Utc::now().to_rfc3339();
        Profile {
            id,
            name,
            description,
            system_prompt,
            user_prompt_template,
            is_built_in: false,
            created_at: Some(now.clone()),
            updated_at: Some(now),
        }
    }

    /// Format the complete prompt for LLM by replacing {transcription} placeholder
    pub fn format_prompt(&self, raw_text: &str) -> String {
        self.user_prompt_template
            .replace("{transcription}", raw_text)
    }
}

/// Get all built-in profiles
pub fn get_built_in_profiles() -> Vec<Profile> {
    vec![
        Profile {
            id: "professional".to_string(),
            name: "Professional".to_string(),
            description: "Formal tone suitable for workplace communication".to_string(),
            system_prompt: "You are a professional writing assistant. Convert casual speech into polished, professional text suitable for workplace communication. Fix grammar, remove filler words, and use formal tone while maintaining the original meaning.".to_string(),
            user_prompt_template: "Convert this speech transcription into professional text:\n\n{transcription}".to_string(),
            is_built_in: true,
            created_at: None,
            updated_at: None,
        },
        Profile {
            id: "llm_agent".to_string(),
            name: "LLM Agent Instructions".to_string(),
            description: "Clear, structured instructions for AI agents".to_string(),
            system_prompt: "You are a technical instruction optimizer. Convert natural speech into clear, structured instructions for AI agents. Use imperative voice, be specific and unambiguous, and remove conversational elements.".to_string(),
            user_prompt_template: "Convert this speech into a clear instruction for an AI agent:\n\n{transcription}".to_string(),
            is_built_in: true,
            created_at: None,
            updated_at: None,
        },
        Profile {
            id: "email".to_string(),
            name: "Email".to_string(),
            description: "Well-formatted email with proper structure".to_string(),
            system_prompt: "You are an email writing assistant. Convert speech into a well-formatted email. Add appropriate greeting and closing if missing, use proper paragraphs, and maintain professional yet friendly tone.".to_string(),
            user_prompt_template: "Convert this speech into a well-formatted email:\n\n{transcription}".to_string(),
            is_built_in: true,
            created_at: None,
            updated_at: None,
        },
        Profile {
            id: "notes".to_string(),
            name: "Notes".to_string(),
            description: "Concise bullet points and key phrases".to_string(),
            system_prompt: "You are a note-taking assistant. Convert speech into concise, well-organized notes using bullet points. Extract key information and organize logically.".to_string(),
            user_prompt_template: "Convert this speech into organized notes:\n\n{transcription}".to_string(),
            is_built_in: true,
            created_at: None,
            updated_at: None,
        },
        Profile {
            id: "code_comments".to_string(),
            name: "Code Comments".to_string(),
            description: "Technical documentation style".to_string(),
            system_prompt: "You are a technical documentation assistant. Convert speech into clear, concise code comments or documentation. Use technical language appropriately and be precise.".to_string(),
            user_prompt_template: "Convert this speech into a code comment or technical documentation:\n\n{transcription}".to_string(),
            is_built_in: true,
            created_at: None,
            updated_at: None,
        },
        Profile {
            id: "raw".to_string(),
            name: "Raw (No Processing)".to_string(),
            description: "Bypass summarization, paste raw transcription".to_string(),
            system_prompt: "".to_string(),
            user_prompt_template: "".to_string(),
            is_built_in: true,
            created_at: None,
            updated_at: None,
        },
    ]
}

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
        assert_eq!(formatted, "Process: hello world");
    }

    #[test]
    fn test_built_in_profiles_exist() {
        let profiles = get_built_in_profiles();
        assert_eq!(profiles.len(), 6);
        assert!(profiles.iter().any(|p| p.id == "professional"));
        assert!(profiles.iter().any(|p| p.id == "llm_agent"));
        assert!(profiles.iter().any(|p| p.id == "email"));
        assert!(profiles.iter().any(|p| p.id == "notes"));
        assert!(profiles.iter().any(|p| p.id == "code_comments"));
        assert!(profiles.iter().any(|p| p.id == "raw"));
    }

    #[test]
    fn test_new_custom_profile_has_timestamps() {
        let profile = Profile::new_custom(
            "custom_1".to_string(),
            "My Custom Profile".to_string(),
            "Custom description".to_string(),
            "You are helpful".to_string(),
            "Do this: {transcription}".to_string(),
        );

        assert!(!profile.is_built_in);
        assert!(profile.created_at.is_some());
        assert!(profile.updated_at.is_some());
    }
}
