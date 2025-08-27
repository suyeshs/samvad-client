# 🎤 Sahamati Samvad - Multilingual Voice Assistant

A real-time multilingual voice assistant built with Next.js, featuring voice activity detection, speech-to-text, text-to-speech, and AI-powered responses. The application supports multiple Indian languages and provides a seamless conversational experience.

## ✨ Features

- 🗣️ **Real-time Voice Recognition** - Voice Activity Detection (VAD) for natural conversation flow
- 🌍 **Multilingual Support** - Supports multiple Indian languages including Hindi, English, Kannada, Tamil, Telugu, and more
- 🎯 **AI-Powered Responses** - Intelligent responses using RAG (Retrieval-Augmented Generation)
- 🔊 **Text-to-Speech** - Natural-sounding voice responses in the selected language
- 🎨 **Modern UI** - Beautiful, responsive interface with real-time audio visualization
- ⚡ **Low Latency** - Optimized for fast response times
- 🔒 **Privacy-First** - Client-side voice processing with secure WebSocket communication

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **State Management**: MobX, XState
- **Voice Processing**: @ricky0123/vad-web, Web Audio API
- **Styling**: Tailwind CSS 4
- **Backend**: Cloudflare Workers (WebSocket)
- **AI/ML**: ONNX Runtime, Silero VAD
- **Deployment**: Cloudflare Pages

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git**
- **Modern web browser** with microphone support (Chrome, Firefox, Safari, Edge)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/suyeshs/samvad-client.git
cd sahamati-samvad
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```bash
# Development environment
NEXTJS_ENV=development

# WebSocket endpoint (update with your Cloudflare Worker URL)
NEXT_PUBLIC_WS_ENDPOINT=wss://bolbachan-ekbachan.suyesh.workers.dev
```

### 4. Start Development Server

```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000` (or the next available port).

## 🎯 Usage Guide

### First Time Setup

1. **Open the Application**
   - Navigate to `http://localhost:3000` in your browser
   - Allow microphone permissions when prompted

2. **Select Your Language**
   - Choose your preferred language from the available options
   - The app supports multiple Indian languages with native names

3. **Start Conversation**
   - Click the "Start" button to begin
   - The system will connect to the voice assistant server

### Using the Voice Assistant

1. **Listening Mode**
   - The assistant will show "Listening..." when ready
   - Speak naturally in your selected language
   - The audio visualizer will show your voice activity

2. **Processing**
   - Your speech is converted to text
   - The AI processes your request and generates a response
   - Status shows "Processing..." during this time

3. **Response**
   - The assistant responds with synthesized speech
   - Status shows "Drishthi is Speaking..." during playback
   - You can interrupt by speaking again

4. **Continuous Conversation**
   - The cycle continues automatically
   - Click "Change Language" to switch languages
   - Use the reset button to start over

### Supported Languages

- 🇮🇳 **Hindi** (हिंदी)
- 🇺🇸 **English**
- 🇮🇳 **Kannada** (ಕನ್ನಡ)
- 🇮🇳 **Tamil** (தமிழ்)
- 🇮🇳 **Telugu** (తెలుగు)
- 🇮🇳 **Bengali** (বাংলা)
- 🇮🇳 **Marathi** (मराठी)
- 🇮🇳 **Gujarati** (ગુજરાતી)
- 🇮🇳 **Punjabi** (ਪੰਜਾਬੀ)
- 🇮🇳 **Odia** (ଓଡ଼ିଆ)
- 🇮🇳 **Malayalam** (മലയാളം)
- 🇮🇳 **Assamese** (অসমীয়া)

## 🔧 Development

### Project Structure

```
sahamati-samvad/
├── src/
│   ├── app/
│   │   ├── components/          # React components
│   │   ├── services/           # Business logic services
│   │   ├── machines/           # XState state machines
│   │   ├── utils/              # Utility functions
│   │   └── VADVoiceClient.tsx  # Main voice assistant component
│   ├── api/                    # API routes
│   └── utils/                  # Shared utilities
├── public/                     # Static assets
├── lib/                        # Library functions
└── package.json
```

### Key Components

- **VADVoiceClient.tsx** - Main voice assistant component
- **LanguageDetectionService.ts** - Language detection and configuration
- **AudioService.ts** - Audio processing utilities
- **voiceAssistantMachine.ts** - State management for conversation flow
- **StatusDisplay.tsx** - Real-time status and feedback
- **AudioVisualizer.tsx** - Voice activity visualization

### Available Scripts

```bash
# Development
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Deployment
npm run deploy       # Deploy to Cloudflare Pages
npm run preview      # Preview deployment
```

## 🌐 Deployment

### Cloudflare Pages Deployment

1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Deploy to Cloudflare**
   ```bash
   npm run deploy
   ```

3. **Environment Variables**
   - Set `NEXTJS_ENV=production` in Cloudflare Pages
   - Configure WebSocket endpoint in environment variables

### Alternative Deployment

The application can also be deployed to:
- Vercel
- Netlify
- Any static hosting service

## 🔍 Troubleshooting

### Common Issues

1. **Microphone Not Working**
   - Ensure browser has microphone permissions
   - Check if microphone is not being used by other applications
   - Try refreshing the page

2. **WebSocket Connection Failed**
   - Check internet connection
   - Verify WebSocket endpoint is correct
   - Ensure Cloudflare Worker is running

3. **Audio Playback Issues**
   - Check browser audio settings
   - Ensure audio is not muted
   - Try a different browser

4. **Language Detection Issues**
   - Speak clearly and at normal volume
   - Ensure good microphone quality
   - Check if language is supported

### Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Performance Tips

- Use a high-quality microphone for better voice recognition
- Ensure stable internet connection for WebSocket communication
- Close unnecessary browser tabs to free up resources
- Use headphones for better audio experience

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [@ricky0123/vad-web](https://github.com/ricky0123/vad-web) for Voice Activity Detection
- [XState](https://xstate.js.org/) for state management
- [Cloudflare Workers](https://workers.cloudflare.com/) for backend services
- [Tailwind CSS](https://tailwindcss.com/) for styling

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section above
- Review the project documentation

---

**Made with ❤️ for multilingual voice assistance**
