import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const language = formData.get("language") as string;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    if (!language) {
      return NextResponse.json(
        { error: "No language provided" },
        { status: 400 }
      );
    }

    console.log("[API] Processing voice request:", {
      audioSize: audioFile.size,
      language,
      audioType: audioFile.type,
      timestamp: new Date().toISOString()
    });

    // Convert audio file to base64 for server processing
    const audioBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    // Create WebSocket connection to external service (same as original)
    console.log("[API] Creating WebSocket connection to external service...");

    return new Promise((resolve, reject) => {
      const session = randomUUID();
      const wsUrl = `wss://bolbachan-ekbachan.suyesh.workers.dev/api/ws?session=${session}`;

      const ws = new WebSocket(wsUrl);
      let responseReceived = false;

      ws.onopen = () => {
        console.log("[API] WebSocket connected to external service");

        // Send the audio data exactly as the original client did
        const audioMessage = {
          type: "audio_chunk",
          data: `data:audio/wav;base64,${base64Audio}`,
          language: language,
          languageGoogle: language, // Simplified for now
          languageSarvam: language // Simplified for now
        };

        console.log("[API] 📤 Sending audio to external service:", {
          type: audioMessage.type,
          language: audioMessage.language,
          dataLength: audioMessage.data.length,
          timestamp: new Date().toISOString()
        });
        ws.send(JSON.stringify(audioMessage));

        // Send end_audio message
        const endMessage = {
          type: "end_audio",
          language: language,
          languageGoogle: language,
          languageSarvam: language
        };

        console.log("[API] 📤 Sending end_audio message:", endMessage);
        ws.send(JSON.stringify(endMessage));
      };

      ws.onmessage = (event) => {
        if (responseReceived) return;

        try {
          const data = JSON.parse(event.data);
          console.log("[API] Received response from external service:", data);

          // Log all message types for debugging
          if (data.type === "stt_result") {
            console.log("[API] 🎤 STT Result - User said:", data.text);
          } else if (data.type === "llm_response") {
            console.log("[API] 🤖 LLM Response - AI generated:", data.text);
          } else if (data.type === "tts_stream_url") {
            console.log(
              "[API] 🔊 TTS Stream - Final response text:",
              data.text
            );
          } else if (data.type === "error") {
            console.log("[API] ❌ Error from external service:", data.message);
            console.log(
              "[API] 🔍 Debug info - Last STT text:",
              data.lastSttText || "N/A"
            );
            console.log(
              "[API] 🔍 Debug info - Last LLM text:",
              data.lastLlmText || "N/A"
            );
          }

          if (data.type === "tts_stream_url" && data.url) {
            responseReceived = true;
            ws.close();

            resolve(
              NextResponse.json({
                success: true,
                audioUrl: data.url,
                text: data.text || "",
                language: data.language || language
              })
            );
          } else if (data.type === "error") {
            responseReceived = true;
            ws.close();

            resolve(
              NextResponse.json({
                success: false,
                error: data.message || "External service error",
                debugInfo: {
                  lastSttText: data.lastSttText,
                  lastLlmText: data.lastLlmText
                }
              })
            );
          }
        } catch (error) {
          console.error("[API] Error parsing WebSocket response:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[API] WebSocket error:", error);
        if (!responseReceived) {
          responseReceived = true;
          reject(
            NextResponse.json(
              { success: false, error: "WebSocket connection failed" },
              { status: 500 }
            )
          );
        }
      };

      ws.onclose = () => {
        console.log("[API] WebSocket connection closed");
        if (!responseReceived) {
          responseReceived = true;
          reject(
            NextResponse.json(
              {
                success: false,
                error: "WebSocket connection closed without response"
              },
              { status: 500 }
            )
          );
        }
      };

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!responseReceived) {
          responseReceived = true;
          ws.close();
          reject(
            NextResponse.json(
              { success: false, error: "Request timeout" },
              { status: 408 }
            )
          );
        }
      }, 30000);
    });
  } catch (error) {
    console.error("[API] Voice processing error:", error);
    return NextResponse.json(
      {
        error: "Voice processing failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
