use crate::managers::profile::Profile;
use crate::managers::summarization::{ApiType, SummarizationManager};
use crate::settings::{get_settings, write_settings};
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn change_summarization_enabled_setting(
    app: AppHandle,
    enabled: bool,
) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.enable_summarization = enabled;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_active_profile_setting(
    app: AppHandle,
    profile_id: String,
) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.active_profile_id = profile_id;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_llm_endpoint_setting(app: AppHandle, endpoint: String) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.llm_endpoint = endpoint;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_llm_model_setting(app: AppHandle, model: String) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.llm_model = model;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_llm_api_type_setting(app: AppHandle, api_type: ApiType) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.llm_api_type = api_type;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn change_llm_timeout_setting(app: AppHandle, timeout: u64) -> Result<(), String> {
    let mut settings = get_settings(&app);
    settings.llm_timeout_seconds = timeout;
    write_settings(&app, settings);
    Ok(())
}

#[tauri::command]
pub fn save_custom_profile(
    app: AppHandle,
    sm: State<Arc<SummarizationManager>>,
    profile: Profile,
) -> Result<(), String> {
    let mut settings = get_settings(&app);

    // Validate profile
    if profile.id.is_empty() {
        return Err("Profile ID cannot be empty".to_string());
    }
    if profile.name.is_empty() {
        return Err("Profile name cannot be empty".to_string());
    }
    if !profile.user_prompt_template.contains("{transcription}") {
        return Err(
            "User prompt template must contain {transcription} placeholder".to_string()
        );
    }

    // Check if updating existing or adding new
    if let Some(pos) = settings
        .custom_profiles
        .iter()
        .position(|p| p.id == profile.id)
    {
        settings.custom_profiles[pos] = profile;
    } else {
        settings.custom_profiles.push(profile);
    }

    write_settings(&app, settings);

    // Reload profiles in SummarizationManager
    sm.reload_profiles().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_custom_profile(
    app: AppHandle,
    sm: State<Arc<SummarizationManager>>,
    profile_id: String,
) -> Result<(), String> {
    let mut settings = get_settings(&app);

    // Check if trying to delete a built-in profile
    let profile = settings
        .custom_profiles
        .iter()
        .find(|p| p.id == profile_id);
    if let Some(p) = profile {
        if p.is_built_in {
            return Err("Cannot delete built-in profile".to_string());
        }
    }

    settings.custom_profiles.retain(|p| p.id != profile_id);

    // If the deleted profile was active, switch to raw
    if settings.active_profile_id == profile_id {
        settings.active_profile_id = "raw".to_string();
    }

    write_settings(&app, settings);

    // Reload profiles in SummarizationManager
    sm.reload_profiles().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_all_profiles(sm: State<Arc<SummarizationManager>>) -> Result<Vec<Profile>, String> {
    let profiles = sm.profiles.lock().map_err(|e| e.to_string())?;
    Ok(profiles.values().cloned().collect())
}

#[tauri::command]
pub async fn check_llm_connection(
    sm: State<'_, Arc<SummarizationManager>>,
) -> Result<bool, String> {
    Ok(sm.check_llm_availability().await)
}

#[tauri::command]
pub async fn get_llm_models(sm: State<'_, Arc<SummarizationManager>>) -> Result<Vec<String>, String> {
    sm.get_available_llm_models()
        .await
        .map_err(|e| e.to_string())
}
