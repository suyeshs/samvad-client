// src/components/Greeting.tsx
import React from "react";
import { LanguagePreferences } from "../hooks/useLanguagePreferences";

export const Greeting = ({
  languagePrefs
}: {
  languagePrefs: LanguagePreferences;
}) => {
  return (
    <div className="px-6 py-6 text-center">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-cyan-100 mb-2">
          {languagePrefs.currentLanguage?.agentName || "Drishthi"}
        </h2>
        <p className="text-lg text-cyan-300">
          {languagePrefs.currentLanguage?.greeting || "How May I Help You"}
        </p>
      </div>
    </div>
  );
};
