import React, { useEffect, useState } from "react";
import { SettingsGroup } from "../ui/SettingsGroup";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { Dropdown } from "../ui/Dropdown";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useSettings } from "../../hooks/useSettings";
import { useSummarization } from "../../hooks/useSummarization";
import { ProfileManager } from "./ProfileManager";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";

export const SummarizationSettings: React.FC = () => {
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const {
    testConnection,
    connectionStatus,
    connectionError,
    fetchAvailableModels,
    availableModels,
    isFetchingModels,
    getAllProfiles,
    profiles,
    isLoadingProfiles,
  } = useSummarization();

  const [showProfileManager, setShowProfileManager] = useState(false);
  const [localEndpoint, setLocalEndpoint] = useState("");
  const [localModel, setLocalModel] = useState("");

  const enabled = getSetting("enable_summarization") ?? false;
  const activeProfileId = getSetting("active_profile_id") ?? "raw";
  const llmEndpoint = getSetting("llm_endpoint") ?? "http://localhost:11434";
  const llmModel = getSetting("llm_model") ?? "llama3.2";

  // Initialize local state
  useEffect(() => {
    setLocalEndpoint(llmEndpoint);
    setLocalModel(llmModel);
  }, [llmEndpoint, llmModel]);

  // Load profiles on mount
  useEffect(() => {
    getAllProfiles();
  }, [getAllProfiles]);

  // Test connection when enabled
  useEffect(() => {
    if (enabled) {
      testConnection();
    }
  }, [enabled]);

  const handleEnableToggle = async (newEnabled: boolean) => {
    await updateSetting("enable_summarization", newEnabled);
    if (newEnabled) {
      testConnection();
    }
  };

  const handleProfileChange = async (profileId: string) => {
    await updateSetting("active_profile_id", profileId);
  };

  const handleEndpointBlur = async () => {
    if (localEndpoint !== llmEndpoint) {
      await updateSetting("llm_endpoint", localEndpoint);
      if (enabled) {
        testConnection();
      }
    }
  };

  const handleModelBlur = async () => {
    if (localModel !== llmModel) {
      await updateSetting("llm_model", localModel);
    }
  };

  const handleRefreshModels = async () => {
    await fetchAvailableModels();
  };

  const handleTestConnection = async () => {
    await testConnection();
  };

  // Get active profile details
  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // Build profile dropdown options
  const builtInProfiles = profiles.filter((p) => p.is_built_in);
  const customProfiles = profiles.filter((p) => !p.is_built_in);

  const profileOptions = [
    ...builtInProfiles.map((p) => ({ value: p.id, label: p.name })),
    ...(customProfiles.length > 0
      ? [{ value: "separator", label: "──────────" }]
      : []),
    ...customProfiles.map((p) => ({ value: p.id, label: p.name })),
  ];

  const renderConnectionStatus = () => {
    if (connectionStatus === "idle") return null;

    if (connectionStatus === "testing") {
      return (
        <div className="flex items-center gap-2 text-sm text-mid-gray">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Testing connection...</span>
        </div>
      );
    }

    if (connectionStatus === "success") {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          <span>Connected</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-red-600">
          <XCircle className="w-4 h-4" />
          <span>Not Connected</span>
        </div>
        {connectionError && (
          <p className="text-xs text-red-600">{connectionError}</p>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="AI Summarization">
        <div className="p-4 space-y-4">
          <ToggleSwitch
            checked={enabled}
            onChange={handleEnableToggle}
            isUpdating={isUpdating("enable_summarization")}
            label="Enable AI Summarization"
            description="Process transcriptions with local AI before pasting"
            descriptionMode="inline"
            grouped={false}
          />

          <div className="space-y-4 pt-4 border-t border-mid-gray/20">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Active Profile</label>
              <Dropdown
                options={profileOptions.filter((o) => o.value !== "separator")}
                selectedValue={activeProfileId}
                onSelect={handleProfileChange}
                disabled={!enabled || isLoadingProfiles}
                placeholder="Select a profile..."
              />
              {activeProfile && (
                <p className="text-xs text-mid-gray">{activeProfile.description}</p>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-mid-gray/20">
            <h3 className="text-sm font-medium">LLM Configuration</h3>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Endpoint</label>
              <Input
                value={localEndpoint}
                onChange={(e) => setLocalEndpoint(e.target.value)}
                onBlur={handleEndpointBlur}
                disabled={!enabled}
                placeholder="http://localhost:11434"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Model</label>
              <div className="flex gap-2">
                <Input
                  value={localModel}
                  onChange={(e) => setLocalModel(e.target.value)}
                  onBlur={handleModelBlur}
                  disabled={!enabled}
                  placeholder="llama3.2"
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={handleRefreshModels}
                  disabled={!enabled || isFetchingModels}
                  title="Refresh available models"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isFetchingModels ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
              {availableModels.length > 0 && (
                <div className="text-xs text-mid-gray">
                  Available: {availableModels.join(", ")}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleTestConnection}
                disabled={!enabled || connectionStatus === "testing"}
              >
                Test Connection
              </Button>
              {renderConnectionStatus()}
            </div>
          </div>

          <div className="pt-4 border-t border-mid-gray/20">
            <Button
              variant="secondary"
              onClick={() => setShowProfileManager(true)}
              disabled={!enabled}
            >
              Manage Profiles...
            </Button>
          </div>
        </div>
      </SettingsGroup>

      {showProfileManager && (
        <ProfileManager
          onClose={() => setShowProfileManager(false)}
          profiles={profiles}
          onProfilesChange={getAllProfiles}
        />
      )}
    </div>
  );
};
