import { createMachine } from 'xstate';

export const voiceAssistantMachine = createMachine({
  id: 'voiceAssistant',
  initial: 'idle',
  states: {
    idle: {
      on: { START: 'listening' }
    },
    listening: {
      on: { SPEECH_END: 'processing', INTERRUPT: 'interrupted' }
    },
    processing: {
      on: { RESPONSE_READY: 'responding', ERROR: 'error' }
    },
    responding: {
      on: { END: 'idle', REPEAT: 'listening' }
    },
    interrupted: {
      on: { RESUME: 'listening', CANCEL: 'idle' }
    },
    error: {
      on: { RETRY: 'listening', CANCEL: 'idle' }
    }
  }
});