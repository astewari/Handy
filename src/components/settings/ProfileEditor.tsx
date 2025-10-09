import React, { useState, useEffect } from "react";
import { Profile } from "../../lib/types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { X } from "lucide-react";

interface ProfileEditorProps {
  profile?: Profile;
  onSave: (profile: Profile) => Promise<void>;
  onClose: () => void;
  existingProfileIds: string[];
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  profile,
  onSave,
  onClose,
  existingProfileIds,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPromptTemplate, setUserPromptTemplate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!profile;

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDescription(profile.description);
      setSystemPrompt(profile.system_prompt);
      setUserPromptTemplate(profile.user_prompt_template);
    }
  }, [profile]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!name.trim()) {
      newErrors.name = "Name is required";
    } else if (name.length > 50) {
      newErrors.name = "Name must be 50 characters or less";
    } else {
      // Check uniqueness (only for new profiles or if name changed)
      const profileId = profile?.id || name.toLowerCase().replace(/\s+/g, "_");
      if (
        (!isEditing || profileId !== profile?.id) &&
        existingProfileIds.includes(profileId)
      ) {
        newErrors.name = "A profile with this name already exists";
      }
    }

    // Description validation
    if (!description.trim()) {
      newErrors.description = "Description is required";
    } else if (description.length > 200) {
      newErrors.description = "Description must be 200 characters or less";
    }

    // System prompt validation
    if (!systemPrompt.trim()) {
      newErrors.systemPrompt = "System prompt is required";
    } else if (systemPrompt.length > 1000) {
      newErrors.systemPrompt = "System prompt must be 1000 characters or less";
    }

    // User prompt template validation
    if (!userPromptTemplate.trim()) {
      newErrors.userPromptTemplate = "User prompt template is required";
    } else if (!userPromptTemplate.includes("{transcription}")) {
      newErrors.userPromptTemplate =
        "User prompt template must contain {transcription}";
    } else if (userPromptTemplate.length > 500) {
      newErrors.userPromptTemplate =
        "User prompt template must be 500 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const profileData: Profile = {
        id: profile?.id || name.toLowerCase().replace(/\s+/g, "_"),
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
        user_prompt_template: userPromptTemplate.trim(),
        is_built_in: false,
        created_at: profile?.created_at || now,
        updated_at: now,
      };

      await onSave(profileData);
      onClose();
    } catch (error) {
      console.error("Failed to save profile:", error);
      setErrors({ general: "Failed to save profile. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-mid-gray/20 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mid-gray/20">
          <h2 className="text-lg font-semibold">
            {isEditing ? `Edit Profile: ${profile?.name}` : "New Profile"}
          </h2>
          <button
            onClick={onClose}
            className="text-mid-gray hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
              {errors.general}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Profile"
              className="w-full"
              maxLength={50}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
            <p className="text-xs text-mid-gray">{name.length}/50 characters</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Description <span className="text-red-500">*</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Custom formatting for my specific use case"
              className="w-full"
              maxLength={200}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description}</p>
            )}
            <p className="text-xs text-mid-gray">
              {description.length}/200 characters
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              System Prompt <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-mid-gray">
              Instructions for the AI about how to process text
            </p>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a writing assistant. Your task is to convert speech into..."
              className="w-full px-3 py-2 text-sm bg-mid-gray/10 border border-mid-gray/80 rounded resize-y min-h-[120px] focus:outline-none focus:bg-logo-primary/20 focus:border-logo-primary"
              maxLength={1000}
            />
            {errors.systemPrompt && (
              <p className="text-xs text-red-500">{errors.systemPrompt}</p>
            )}
            <p className="text-xs text-mid-gray">
              {systemPrompt.length}/1000 characters
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              User Prompt Template <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-mid-gray">
              Use {"{transcription}"} where the text should be inserted
            </p>
            <textarea
              value={userPromptTemplate}
              onChange={(e) => setUserPromptTemplate(e.target.value)}
              placeholder="Convert this speech:\n\n{transcription}"
              className="w-full px-3 py-2 text-sm bg-mid-gray/10 border border-mid-gray/80 rounded resize-y min-h-[100px] focus:outline-none focus:bg-logo-primary/20 focus:border-logo-primary"
              maxLength={500}
            />
            {errors.userPromptTemplate && (
              <p className="text-xs text-red-500">{errors.userPromptTemplate}</p>
            )}
            <p className="text-xs text-mid-gray">
              {userPromptTemplate.length}/500 characters
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-mid-gray/20">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};
