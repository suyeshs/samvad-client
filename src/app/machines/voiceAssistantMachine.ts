/**
 * Voice Assistant State Machine
 *
 * XState machine that manages the conversation flow and state transitions
 * for the voice assistant. Handles all possible states from idle to error
 * recovery, ensuring smooth user experience during voice interactions.
 *
 * @author Developer Team
 * @version 1.0.0
 */
import { createMachine, assign } from "xstate";

/**
 * Context interface for the voice assistant state machine
 *
 * Contains error state that can be set during any state transition
 * to handle and display error messages to the user.
 */
interface VoiceAssistantContext {
  error: string | null;
}

type VoiceAssistantEvent =
  | { type: "START" }
  | { type: "READY" }
  | { type: "LISTEN" }
  | { type: "SPEECH_START" }
  | { type: "SPEECH_END" }
  | { type: "RESPONSE_READY" }
  | { type: "END" }
  | { type: "REPEAT" }
  | { type: "INTERRUPT" }
  | { type: "RESUME" }
  | { type: "CANCEL" }
  | { type: "RETRY" }
  | { type: "CLEAR_ERROR" }
  | { type: "ERROR"; error: string };

/**
 * Voice Assistant State Machine Configuration
 *
 * Defines the complete state machine with all possible states and transitions:
 * - idle: Initial state, waiting for user to start
 * - starting: Establishing connection and permissions
 * - ready: System ready to listen
 * - listening: Actively listening for user speech
 * - processing: Processing user input and generating response
 * - responding: Playing AI response audio
 * - interrupted: User interrupted the conversation
 * - error: Error state with recovery options
 */
export const voiceAssistantMachine = createMachine({
  id: "voiceAssistant",
  initial: "idle",
  context: {
    error: null
  } as VoiceAssistantContext,
  states: {
    idle: {
      entry: assign({
        error: null
      }),
      on: {
        START: "starting",
        RESPONSE_READY: "responding",
        CLEAR_ERROR: { actions: assign({ error: null }) }
      }
    },
    starting: {
      entry: assign({
        error: null
      }),
      after: {
        10000: {
          target: "error",
          actions: assign({ error: "Failed to start: Connection timeout" })
        }
      },
      on: {
        READY: "ready",
        ERROR: {
          target: "error",
          actions: assign({ error: "An error occurred" })
        }
      }
    },
    ready: {
      entry: assign({
        error: null
      }),
      on: {
        LISTEN: "listening",
        SPEECH_START: "listening", // Allow direct transition from ready to listening
        RESPONSE_READY: "responding",
        CLEAR_ERROR: { actions: assign({ error: null }) },
        ERROR: {
          target: "error",
          actions: assign({ error: "An error occurred" })
        }
      }
    },
    listening: {
      entry: [
        assign({
          error: null
        }),
        () => console.log("[XState] Entered listening state")
      ],
      on: {
        SPEECH_START: {
          target: "listening",
          actions: () =>
            console.log("[XState] SPEECH_START received in listening state")
        },
        SPEECH_END: {
          target: "processing",
          actions: () =>
            console.log(
              "[XState] SPEECH_END received, transitioning to processing"
            )
        },
        RESPONSE_READY: "responding",
        INTERRUPT: "interrupted",
        CANCEL: "idle",
        CLEAR_ERROR: { actions: assign({ error: null }) },
        ERROR: {
          target: "error",
          actions: assign({ error: "An error occurred" })
        }
      }
    },
    processing: {
      entry: [
        assign({
          error: null
        }),
        () => console.log("[XState] Entered processing state")
      ],
      on: {
        RESPONSE_READY: {
          target: "responding",
          actions: () =>
            console.log(
              "[XState] RESPONSE_READY received, transitioning to responding"
            )
        },
        READY: {
          target: "ready",
          actions: () =>
            console.log(
              "[XState] READY received in processing, transitioning to ready"
            )
        },
        LISTEN: {
          target: "listening",
          actions: () =>
            console.log(
              "[XState] LISTEN received in processing, transitioning to listening"
            )
        },
        INTERRUPT: "interrupted",
        CLEAR_ERROR: { actions: assign({ error: null }) },
        ERROR: {
          target: "error",
          actions: assign({ error: "An error occurred" })
        }
      }
    },
    responding: {
      entry: assign({
        error: null
      }),
      on: {
        END: "ready",
        LISTEN: "listening",
        INTERRUPT: "interrupted",
        CLEAR_ERROR: { actions: assign({ error: null }) },
        ERROR: {
          target: "error",
          actions: assign({ error: "An error occurred" })
        }
      }
    },
    interrupted: {
      entry: assign({
        error: null
      }),
      on: {
        RESUME: "listening",
        CANCEL: "idle",
        CLEAR_ERROR: { actions: assign({ error: null }) },
        ERROR: {
          target: "error",
          actions: assign({ error: "An error occurred" })
        }
      }
    },
    error: {
      entry: assign({
        error: null
      }),
      on: {
        RETRY: "listening",
        READY: "ready",
        CANCEL: "idle",
        START: "starting",
        CLEAR_ERROR: { actions: assign({ error: null }) }
      }
    }
  }
});
