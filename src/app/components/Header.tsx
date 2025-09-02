// src/components/Header.tsx
import React from "react";
import Image from "next/image";
import { LanguagePreferences } from "../hooks/useLanguagePreferences";
import { AudioVisualizationState } from "../hooks/useAudioVisualization";

export const Header = ({
  languagePrefs,
  audioViz,
  isSpeaking,
  isListening,
  isProcessingState,
  dialectPreference,
  userLocation
}: {
  languagePrefs: LanguagePreferences;
  audioViz: AudioVisualizationState;
  isSpeaking: boolean;
  isListening: boolean;
  isProcessingState: boolean;
  dialectPreference?: string;
  userLocation?: string;
}) => {
  return (
    <div className="px-6 py-4 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isSpeaking
                ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50"
                : isListening
                ? "bg-cyan-500 animate-pulse shadow-lg shadow-cyan-500/50"
                : isProcessingState
                ? "bg-yellow-500 animate-spin shadow-lg shadow-yellow-500/50"
                : "bg-green-500 shadow-lg shadow-green-500/50"
            }`}
          ></div>
          <div className="flex items-center space-x-2">
            <Image
              src="/sahamati-logo.png"
              alt="Sahamati"
              width={80}
              height={80}
              className="object-contain"
            />
          </div>
        </div>
        <button
          onClick={() => audioViz.setShowLanguageSelector(true)}
          className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200"
        >
          <span className="text-lg">
            {languagePrefs.currentLanguage?.flag || "🇮🇳"}
          </span>
          <span className="text-xs font-medium text-blue-600">
            {languagePrefs.currentLanguage?.code?.toUpperCase() || "EN"}
          </span>
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800 mb-1">
            {languagePrefs.currentLanguage?.agentName || "Drishthi"}
          </h1>
          <p className="text-xs text-gray-600">
            {languagePrefs.currentLanguage?.agentDescription ||
              "Your AI assistant"}
          </p>

          {/* Enhanced language and dialect information */}
          <div className="flex items-center space-x-4 mt-2">
            {dialectPreference && dialectPreference !== "standard" && (
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500 capitalize">
                  {dialectPreference} dialect
                </span>
              </div>
            )}

            {userLocation && (
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500">{userLocation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Language and dialect status indicator */}
        <div className="text-right">
          <div className="flex flex-col items-end space-y-1">
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500">
                {languagePrefs.currentLanguage?.nativeName ||
                  languagePrefs.currentLanguage?.name ||
                  "English"}
              </span>
            </div>

            {dialectPreference && dialectPreference !== "standard" && (
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-400 capitalize">
                  {dialectPreference}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
