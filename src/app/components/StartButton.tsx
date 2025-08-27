// src/components/StartButton.tsx
import React from 'react';
import { observer } from 'mobx-react-lite';
import { PermissionsStore } from '../stores';

export const StartButton = observer(({ isStarted, status, permissionsStore, startVoiceAssistant }: {
    isStarted: boolean;
    status: string;
    permissionsStore: PermissionsStore;
    startVoiceAssistant: () => void;
  }) => {
    console.log('[StartButton] Rendering with state:', {
      isStarted,
      status,
      mediaDevicesSupported: permissionsStore.mediaDevicesSupported,
      canUseAudio: permissionsStore.canUseAudio,
      isRequestingAudio: permissionsStore.isRequestingAudio,
      audioPermission: permissionsStore.audioPermission
    });
    
    if (isStarted) return null;
    
    return (
        <div className="text-center mb-4">
          <button 
            onClick={startVoiceAssistant}
            disabled={status === 'Starting...' || permissionsStore.isRequestingAudio || !permissionsStore.mediaDevicesSupported || !permissionsStore.canUseAudio}
            className={`
              py-3 px-8 rounded-xl font-bold text-base transition-all duration-200 inline-block
              ${status === 'Starting...' || permissionsStore.isRequestingAudio || !permissionsStore.mediaDevicesSupported || !permissionsStore.canUseAudio
                ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 border border-cyan-500/50'
              }
            `}
          >
            {status === 'Starting...' || permissionsStore.isRequestingAudio ? 'Starting...' : 
             !permissionsStore.mediaDevicesSupported ? 'Not Supported' :
             !permissionsStore.canUseAudio ? 'Permission Required' :
             'Start Voice Assistant'}
          </button>
       
          
         
        </div>
      );
  });