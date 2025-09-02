// src/components/DebugPanel.tsx
import React from "react";
import { PermissionsState } from "../hooks/usePermissions";

export const DebugPanel = ({
  permissions,
  handleCheckMediaDevices
}: {
  permissions: PermissionsState;
  handleCheckMediaDevices: () => void;
}) => {
  return (
    <div className="bg-gray-800/50 border border-gray-600/30 rounded-lg p-3 mb-4 backdrop-blur-sm">
      <div className="text-gray-300 text-xs mb-2">
        <div>🎤 Audio Permission: {permissions.audioPermission}</div>
        <div>📹 Video Permission: {permissions.videoPermission}</div>
        <div>
          🔄 Requesting Audio: {permissions.isRequestingAudio ? "✅" : "❌"}
        </div>
        <div>✅ Can Use Audio: {permissions.canUseAudio ? "✅" : "❌"}</div>
        <div>
          ❓ Needs Audio Permission:{" "}
          {permissions.needsAudioPermission ? "✅" : "❌"}
        </div>
      </div>
      <button
        onClick={handleCheckMediaDevices}
        className="w-full py-2 px-4 rounded-lg font-semibold bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-xs border border-gray-500/50"
      >
        🔍 Check Media Devices Support
      </button>
      <button
        onClick={() => {
          console.log("[Debug] Force checking media devices...");
          console.log("[Debug] navigator:", typeof navigator);
          console.log(
            "[Debug] navigator.mediaDevices:",
            typeof navigator.mediaDevices
          );
          console.log(
            "[Debug] navigator.mediaDevices.getUserMedia:",
            typeof navigator.mediaDevices?.getUserMedia
          );
          permissions.checkMediaDevicesSupport();
        }}
        className="w-full mt-2 py-2 px-4 rounded-lg font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-xs border border-blue-500/50"
      >
        🔧 Force Check Media Devices
      </button>
    </div>
  );
};
