// src/components/Greeting.tsx
import React from 'react';
import { LanguageStore } from '../stores';

export const Greeting = ({ languageStore }: { languageStore: LanguageStore }) => {
    return (
      <div className="px-6 py-6 text-center">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-cyan-100 mb-2">
            {languageStore.currentLanguage?.agentName || 'Drishthi'}
          </h2>
          <p className="text-lg text-cyan-300">
            {languageStore.currentLanguage?.greeting || 'How May I Help You'}
          </p>
        </div>
      </div>
    );
  };