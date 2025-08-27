// src/components/StatusDisplay.tsx
import React from 'react';
import { VoiceUIStore } from '../stores';

export const StatusDisplay = ({ status, isProcessingState, voiceUIStore }: {
    status: string;
    isProcessingState: boolean;
    voiceUIStore: VoiceUIStore;
  }) => {
    return (
      <div className="text-center mb-6">
        <div className="text-xl font-bold text-cyan-100 mb-2">
          {status === 'Not Started' && 'Ready to Start'}
          {status === 'Starting...' && 'Starting...'}
          {status === 'Listening...' && 'Listening...'}
          {status === 'Processing...' && 'Processing Your Request...'}
          {status === 'Responding...' && 'Drishthi is Speaking...'}
          {status === 'System Ready' && 'Ready'}
          {status === 'Interrupted' && 'Interrupted'}
          {status === 'Error' && 'Error'}
        </div>
        <div className="text-xs text-cyan-300/80">
          {status === 'Not Started' && 'Click Start to begin your voice assistant'}
          {status === 'Starting...' && 'Requesting permissions and connecting...'}
          {status === 'System Ready' && 'Speak now to interact with your assistant'}
          {status === 'Listening...' && 'I can hear you...'}
          {status === 'Processing...' && 'Drishthi is analyzing your request and preparing a response...'}
          {status === 'Responding...' && 'Drishthi is speaking your response...'}
          {status === 'Interrupted' && 'Conversation interrupted'}
        </div>
        
        {voiceUIStore.isInterruptible && (
          <div className="mt-2 text-xs text-red-400 font-medium bg-red-500/10 px-3 py-1 rounded-full inline-block">
            You can interrupt by speaking
          </div>
        )}
        
        {isProcessingState && (
          <div className="mt-3 flex flex-col items-center">
            <div className="flex space-x-1 mb-2">
              <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce shadow-lg shadow-cyan-500/50"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce shadow-lg shadow-blue-500/50" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-magenta-500 rounded-full animate-bounce shadow-lg shadow-magenta-500/50" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <div className="text-xs text-cyan-300/60 font-medium">
              Processing your request...
            </div>
          </div>
        )}
        
        {status === 'Responding...' && (
          <div className="mt-3 flex flex-col items-center">
            <div className="flex space-x-1 mb-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
              <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse shadow-lg shadow-red-400/50" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-3 h-3 bg-red-300 rounded-full animate-pulse shadow-lg shadow-red-300/50" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <div className="text-xs text-red-300/80 font-medium">
              Drishthi is speaking...
            </div>
          </div>
        )}
      </div>
    );
  };