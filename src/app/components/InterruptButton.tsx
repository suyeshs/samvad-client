// src/components/InterruptButton.tsx
import React from 'react';
import { VoiceUIStore } from '../stores';

export const InterruptButton = ({ voiceUIStore, handleInterruption }: {
    voiceUIStore: VoiceUIStore;
    handleInterruption: () => void;
  }) => {
    if (!voiceUIStore.isInterruptible) return null;
    
    return (
        <div className="text-center mb-4">
          <button 
            onClick={handleInterruption}
            className="w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-sm border border-red-500/50"
          >
            ⏸️ Interrupt AI
          </button>
        </div>
      );
  };