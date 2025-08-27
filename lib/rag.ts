// lib/rag.ts (export for DO import)
import { Ai } from 'cloudflare:ai';  // AI binding

interface Env {
  AI: Ai;
  VECTORIZE_INDEX: VectorizeIndex;
  SARVAM_API_KEY: string;
}

export async function getResponse(env: Env, query: string, history: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<string> {
  // Embeddings: Use CF AI multilingual model (replaces HuggingFace)
  const embeddingsResponse = await env.AI.run('@cf/baai/bge-m3', { text: query });
  const queryEmbedding = embeddingsResponse.data[0];  // Assuming single query

  // Retrieval: From Vectorize (k=3, like your retriever)
  const matches = await env.VECTORIZE_INDEX.query(queryEmbedding, { topK: 3 });
  const context = matches.matches.map(match => match.metadata?.content || '').join('\n');  // Concat retrieved docs

  // Custom MCP Prompt (with history for conversational)
  const fullHistory = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  const prompt = `You are a multilingual finance expert in Hindi and Kannada. Use this context: ${context}
  
  History: ${fullHistory}
  
  Query: ${query}
  
  Think step-by-step (MCP):
  1. Analyze the query in the user's language.
  2. Retrieve and summarize relevant facts from context.
  3. Provide educational advice on credit/fraud risks.
  4. Respond in the query's language.
  
  Response:`;

  // LLM: Sarvam via fetch (OpenAI-compatible)
  const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SARVAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sarvam-m',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 512,
    }),
  });

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content || 'Response generation failed';
}