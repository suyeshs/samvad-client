// src/components/ResetButton.tsx
import React from 'react';

export const ResetButton = ({ isProcessing, isProcessingState, resetConversation }: {
    isProcessing: boolean;
    isProcessingState: boolean;
    resetConversation: () => void;
  }) => {
    if (!(isProcessing || isProcessingState)) return null;
    
    return (
        <div className="text-center mb-4">
          <button 
            onClick={resetConversation}
            className="w-full py-2 px-4 rounded-lg font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-xs border border-orange-500/50"
          >
            🔄 Reset Conversation State
          </button>
        </div>
      );
  };