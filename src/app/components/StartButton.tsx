// src/components/StartButton.tsx
import React from "react";
import { PermissionsState } from "../hooks/usePermissions";

export const StartButton = ({
  isStarted,
  status,
  permissions,
  startVoiceAssistant,
  stopVoiceAssistant,
  isListening
}: {
  isStarted: boolean;
  status: string;
  permissions: PermissionsState;
  startVoiceAssistant: () => void;
  stopVoiceAssistant: () => void;
  isListening: boolean;
}) => {
  // Show stop button when listening (check actual state, not status text)
  if (isStarted && isListening) {
    return (
      <div className="text-center mb-4">
        <button
          onClick={stopVoiceAssistant}
          className="py-3 px-8 rounded-xl font-bold text-base transition-all duration-200 inline-block bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 border border-red-500/50"
        >
          Stop Voice Assistant
        </button>
      </div>
    );
  }

  // Don't show start button if already started
  if (isStarted) return null;

  return (
    <div className="text-center mb-4">
      <button
        onClick={startVoiceAssistant}
        disabled={
          status === "Starting..." ||
          permissions.isRequestingAudio ||
          !permissions.mediaDevicesSupported ||
          !permissions.canUseAudio
        }
        className={`
              py-3 px-8 rounded-xl font-bold text-base transition-all duration-200 inline-block
              ${
                status === "Starting..." ||
                permissions.isRequestingAudio ||
                !permissions.mediaDevicesSupported ||
                !permissions.canUseAudio
                  ? "bg-gray-600/50 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 border border-cyan-500/50"
              }
            `}
      >
        {status === "Starting..." || permissions.isRequestingAudio
          ? "Starting..."
          : !permissions.mediaDevicesSupported
          ? "Not Supported"
          : !permissions.canUseAudio
          ? "Permission Required"
          : "Start Voice Assistant"}
      </button>
    </div>
  );
};
