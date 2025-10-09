import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile } from "../lib/types";
import { useSettings } from "./useSettings";

interface UseSummarizationReturn {
  // Connection testing
  testConnection: () => Promise<boolean>;
  connectionStatus: "idle" | "testing" | "success" | "error";
  connectionError: string | null;

  // Model management
  fetchAvailableModels: () => Promise<string[]>;
  availableModels: string[];
  isFetchingModels: boolean;

  // Profile management
  getAllProfiles: () => Promise<Profile[]>;
  saveProfile: (profile: Profile) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  profiles: Profile[];
  isLoadingProfiles: boolean;

  // Settings helpers
  enabledSummarization: boolean;
  activeProfileId: string;
  llmEndpoint: string;
  llmModel: string;
}

export const useSummarization = (): UseSummarizationReturn => {
  const { getSetting, updateSetting } = useSettings();

  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  const testConnection = useCallback(async () => {
    setConnectionStatus("testing");
    setConnectionError(null);

    try {
      const result = await invoke<boolean>("check_llm_connection");
      setConnectionStatus(result ? "success" : "error");
      if (!result) {
        setConnectionError("Could not connect to LLM service. Make sure Ollama is running: `ollama serve`");
      }
      return result;
    } catch (error) {
      setConnectionStatus("error");
      const errorMessage = error instanceof Error ? error.message : "Failed to test connection";
      setConnectionError(errorMessage);
      return false;
    }
  }, []);

  const fetchAvailableModels = useCallback(async () => {
    setIsFetchingModels(true);
    try {
      const models = await invoke<string[]>("get_llm_models");
      setAvailableModels(models);
      return models;
    } catch (error) {
      console.error("Failed to fetch available models:", error);
      setAvailableModels([]);
      return [];
    } finally {
      setIsFetchingModels(false);
    }
  }, []);

  const getAllProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    try {
      const allProfiles = await invoke<Profile[]>("get_all_profiles");
      setProfiles(allProfiles);
      return allProfiles;
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
      setProfiles([]);
      return [];
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  const saveProfile = useCallback(async (profile: Profile) => {
    try {
      await invoke("save_custom_profile", { profile });
      // Refresh profiles after save
      await getAllProfiles();
    } catch (error) {
      console.error("Failed to save profile:", error);
      throw error;
    }
  }, [getAllProfiles]);

  const deleteProfile = useCallback(async (profileId: string) => {
    try {
      await invoke("delete_custom_profile", { profileId });
      // Refresh profiles after delete
      await getAllProfiles();
    } catch (error) {
      console.error("Failed to delete profile:", error);
      throw error;
    }
  }, [getAllProfiles]);

  return {
    testConnection,
    connectionStatus,
    connectionError,
    fetchAvailableModels,
    availableModels,
    isFetchingModels,
    getAllProfiles,
    saveProfile,
    deleteProfile,
    profiles,
    isLoadingProfiles,
    enabledSummarization: getSetting("enable_summarization") ?? false,
    activeProfileId: getSetting("active_profile_id") ?? "raw",
    llmEndpoint: getSetting("llm_endpoint") ?? "http://localhost:11434",
    llmModel: getSetting("llm_model") ?? "llama3.2",
  };
};
