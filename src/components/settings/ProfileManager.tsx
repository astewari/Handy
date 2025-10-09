import React, { useState } from "react";
import { Profile } from "../../lib/types";
import { Button } from "../ui/Button";
import { ProfileEditor } from "./ProfileEditor";
import { useSummarization } from "../../hooks/useSummarization";
import { X, Edit, Trash2, Copy } from "lucide-react";

interface ProfileManagerProps {
  onClose: () => void;
  profiles: Profile[];
  onProfilesChange: () => Promise<void>;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  onClose,
  profiles,
  onProfilesChange,
}) => {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(
    profiles.length > 0 ? profiles[0] : null
  );
  const [showEditor, setShowEditor] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | undefined>(
    undefined
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { saveProfile, deleteProfile } = useSummarization();

  const builtInProfiles = profiles.filter((p) => p.is_built_in);
  const customProfiles = profiles.filter((p) => !p.is_built_in);

  const handleNewProfile = () => {
    setEditingProfile(undefined);
    setShowEditor(true);
  };

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setShowEditor(true);
  };

  const handleDuplicateProfile = (profile: Profile) => {
    const duplicatedProfile: Profile = {
      ...profile,
      id: `${profile.id}_copy_${Date.now()}`,
      name: `${profile.name} (Copy)`,
      is_built_in: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setEditingProfile(duplicatedProfile);
    setShowEditor(true);
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile || selectedProfile.is_built_in) return;

    try {
      await deleteProfile(selectedProfile.id);
      await onProfilesChange();
      setShowDeleteConfirm(false);
      // Select first profile after deletion
      if (profiles.length > 1) {
        setSelectedProfile(profiles[0]);
      } else {
        setSelectedProfile(null);
      }
    } catch (error) {
      console.error("Failed to delete profile:", error);
    }
  };

  const handleSaveProfile = async (profile: Profile) => {
    await saveProfile(profile);
    await onProfilesChange();
    setShowEditor(false);
    setSelectedProfile(profile);
  };

  const existingProfileIds = profiles.map((p) => p.id);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-background border border-mid-gray/20 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-mid-gray/20">
            <h2 className="text-lg font-semibold">Manage Profiles</h2>
            <button
              onClick={onClose}
              className="text-mid-gray hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex">
            {/* Left sidebar - Profile list */}
            <div className="w-1/3 border-r border-mid-gray/20 flex flex-col">
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Built-in profiles */}
                {builtInProfiles.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-mid-gray uppercase tracking-wide px-2">
                      Built-in Profiles
                    </p>
                    {builtInProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => setSelectedProfile(profile)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          selectedProfile?.id === profile.id
                            ? "bg-logo-primary/20 font-semibold"
                            : "hover:bg-mid-gray/10"
                        }`}
                      >
                        {profile.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom profiles */}
                {customProfiles.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-mid-gray uppercase tracking-wide px-2">
                      Custom Profiles
                    </p>
                    {customProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => setSelectedProfile(profile)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          selectedProfile?.id === profile.id
                            ? "bg-logo-primary/20 font-semibold"
                            : "hover:bg-mid-gray/10"
                        }`}
                      >
                        {profile.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* New Profile button */}
              <div className="p-3 border-t border-mid-gray/20">
                <Button
                  variant="secondary"
                  onClick={handleNewProfile}
                  className="w-full"
                >
                  + New Profile
                </Button>
              </div>
            </div>

            {/* Right side - Profile details */}
            <div className="flex-1 flex flex-col">
              {selectedProfile ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {selectedProfile.name}
                      </h3>
                      {selectedProfile.is_built_in && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-mid-gray/20 rounded">
                          Built-in
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Description</p>
                      <p className="text-sm text-mid-gray">
                        {selectedProfile.description}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">System Prompt</p>
                      <div className="bg-mid-gray/10 rounded p-3 text-sm text-mid-gray whitespace-pre-wrap">
                        {selectedProfile.system_prompt}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">User Prompt Template</p>
                      <div className="bg-mid-gray/10 rounded p-3 text-sm text-mid-gray whitespace-pre-wrap">
                        {selectedProfile.user_prompt_template}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="p-4 border-t border-mid-gray/20 flex items-center justify-end gap-2">
                    {!selectedProfile.is_built_in && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => handleEditProfile(selectedProfile)}
                          size="sm"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => setShowDeleteConfirm(true)}
                          size="sm"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => handleDuplicateProfile(selectedProfile)}
                      size="sm"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Duplicate
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-mid-gray">
                  Select a profile to view details
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-mid-gray/20">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>

      {/* Profile Editor Modal */}
      {showEditor && (
        <ProfileEditor
          profile={editingProfile}
          onSave={handleSaveProfile}
          onClose={() => setShowEditor(false)}
          existingProfileIds={existingProfileIds}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-background border border-mid-gray/20 rounded-lg shadow-lg max-w-md w-full p-4 space-y-4">
            <h3 className="text-lg font-semibold">Delete Profile</h3>
            <p className="text-sm">
              Are you sure you want to delete "{selectedProfile?.name}"? This
              action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteProfile}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
