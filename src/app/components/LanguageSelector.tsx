// src/components/LanguageSelector.tsx
import React from "react";
import { LanguageConfig } from "../services/LanguageDetectionService";

const LanguageSelector = ({
  languages,
  currentLanguage,
  onLanguageChange,
  onClose
}: {
  languages: LanguageConfig[];
  currentLanguage: LanguageConfig;
  onLanguageChange: (language: LanguageConfig) => void;
  onClose: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto border border-cyan-500/30 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-cyan-100">
            Select AI Agent
          </h3>
          <button
            onClick={onClose}
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => {
                onLanguageChange(language);
                onClose();
              }}
              className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${
                currentLanguage.code === language.code
                  ? "bg-cyan-500/20 border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/20"
                  : "bg-gray-800/50 hover:bg-gray-700/50 border-2 border-transparent hover:border-cyan-500/30"
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{language.flag || "🇮🇳"}</span>
                <div className="flex-1">
                  <div className="font-semibold text-cyan-100">
                    {language.agentName} • {language.code.toUpperCase()}
                  </div>
                  <div className="text-sm text-cyan-300/80">
                    {language.agentDescription || "Your AI assistant"}
                  </div>
                  <div className="text-xs text-cyan-300/60 mt-1">
                    {language.name}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
