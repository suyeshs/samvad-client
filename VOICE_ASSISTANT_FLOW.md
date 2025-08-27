# Voice Assistant Flow Diagram

## 🎤 User Interaction Flow

```
┌─────────────────┐
│   User Speaks   │
│   (Any Language)│
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Voice Activity │
│   Detection     │
│  (VAD)          │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Audio Recording│
│  & Processing   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Send Audio to  │
│   Server        │
└─────────┬───────┘
          │
          ▼
```

## 🖥️ Server-Side Processing

```
┌─────────────────┐
│  WebSocket      │
│  Connection     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Speech-to-Text │
│  (STT)          │
│  Converts audio │
│  to text        │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Language       │
│  Detection      │
│  (Auto-detect   │
│   language)     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Translation    │
│  (if needed)    │
│  Convert to     │
│  English for    │
│  processing     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  RAG System     │
│  ┌─────────────┐│
│  │ 1. Create   ││
│  │    Embedding││
│  │ 2. Search   ││
│  │    Database ││
│  │ 3. Retrieve ││
│  │    Context  ││
│  └─────────────┘│
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  AI Processing  │
│  ┌─────────────┐│
│  │ 1. Analyze  ││
│  │    Query    ││
│  │ 2. Use      ││
│  │    Context  ││
│  │ 3. Generate ││
│  │    Response ││
│  └─────────────┘│
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Translation    │
│  (Back to User's│
│   Language)     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Text-to-Speech │
│  (TTS)          │
│  Convert text   │
│  to audio       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Send Audio     │
│  Response to    │
│  User           │
└─────────┬───────┘
          │
          ▼
```

## 🔊 User Receives Response

```
┌─────────────────┐
│  Audio Player   │
│  Receives &     │
│  Plays Response │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  User Hears     │
│  Response in    │
│  Their Language │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  System Returns │
│  to Listening   │
│  Mode           │
└─────────────────┘
```

## 🔄 Complete Conversation Loop

```
┌─────────────────┐
│  User Speaks    │
│  ↓              │
│  Audio → Text   │
│  ↓              │
│  Language Detect│
│  ↓              │
│  RAG Search     │
│  ↓              │
│  AI Response    │
│  ↓              │
│  Text → Audio   │
│  ↓              │
│  User Hears     │
│  ↓              │
│  Repeat...      │
└─────────────────┘
```

## 🛠️ Key Technologies Used

### Frontend (Browser)
- **Voice Activity Detection (VAD)**: Detects when user starts/stops speaking
- **Audio Recording**: Captures microphone input
- **WebSocket**: Real-time communication with server
- **Audio Playback**: Plays server responses

### Backend (Server)
- **Speech-to-Text (STT)**: Converts audio to text
- **Language Detection**: Identifies user's language
- **Translation**: Converts between languages
- **RAG (Retrieval-Augmented Generation)**:
  - Creates embeddings of user query
  - Searches knowledge database
  - Retrieves relevant context
- **Large Language Model (LLM)**: Generates intelligent responses
- **Text-to-Speech (TTS)**: Converts response back to audio

### Data Flow
1. **Audio Input** → **STT** → **Text**
2. **Text** → **Language Detection** → **Translation** (if needed)
3. **Query** → **RAG Search** → **Context + AI** → **Response**
4. **Response** → **Translation** → **TTS** → **Audio Output**

This creates a seamless multilingual voice assistant that can understand, process, and respond in the user's preferred language while leveraging AI and knowledge databases for intelligent responses. 