/**
 * ExamSetu — RAG Chat API (Cloudflare Pages Function)
 * 
 * This runs as a Cloudflare Pages Function at /api/chat
 * It:
 *   1. Generates an embedding for the user's question (via Gemini)
 *   2. Queries Supabase pgvector for similar document chunks
 *   3. Calls Groq (Llama 3.3 70B) with retrieved context
 *   4. Returns the answer with citations
 * 
 * Note: For static export, this file is included for reference.
 * In production, deploy as a Cloudflare Pages Function or 
 * implement as a separate API endpoint.
 */

// This is the Pages Function handler shape for Cloudflare
// In a static export, the chat functionality can also be 
// implemented client-side by calling Groq/Gemini directly
// from the browser (with the keys exposed via NEXT_PUBLIC_*)

interface ChatRequest {
  question: string;
  notificationId: string;
}

interface ChatResponse {
  answer: string;
  citations: Array<{ page_ref: number; text_snippet: string }>;
  pdfUrl?: string;
}

// For Cloudflare Pages Functions, export as:
// export async function onRequestPost(context) { ... }

// For local development or alternative deployment, 
// this logic can be called from a Next.js API route
// or implemented directly in the browser.

export async function handleChatRequest(request: ChatRequest): Promise<ChatResponse> {
  const { question, notificationId } = request;

  // Step 1: Generate embedding for the question
  const embeddingResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-exp-03-07:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: question }] },
        outputDimensionality: 768,
      }),
    }
  );

  const embeddingData = await embeddingResponse.json();
  const queryEmbedding = embeddingData.embedding?.values;

  if (!queryEmbedding) {
    return { answer: "Failed to process your question. Please try again.", citations: [] };
  }

  // Step 2: Query Supabase pgvector for similar chunks
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/match_documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey!,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      query_embedding: queryEmbedding,
      match_count: 5,
      filter_notification_id: notificationId,
    }),
  });

  let chunks: Array<{ chunk_text: string; page_ref: number; similarity: number }> = [];

  if (rpcResponse.ok) {
    chunks = await rpcResponse.json();
  } else {
    // Fallback: fetch chunks without vector search
    const fallbackResponse = await fetch(
      `${supabaseUrl}/rest/v1/document_chunks?notification_id=eq.${notificationId}&select=chunk_text,page_ref&limit=5`,
      {
        headers: {
          apikey: supabaseKey!,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    if (fallbackResponse.ok) {
      chunks = (await fallbackResponse.json()).map((c: { chunk_text: string; page_ref: number }) => ({
        ...c,
        similarity: 0,
      }));
    }
  }

  if (chunks.length === 0) {
    return {
      answer: "I don't have any information about this notification yet. The document may still be processing.",
      citations: [],
    };
  }

  // Step 3: Build context and call Groq
  const context = chunks
    .map((c, i) => `[Source: Page ${c.page_ref || "?"}]\n${c.chunk_text}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are ExamSetu, a helpful assistant for Indian government exam aspirants.
Answer the user's question ONLY based on the provided notification context.
If the answer is not in the context, say "I couldn't find this information in the notification."
Always cite the page number when referencing information, like [Page 3].
Be concise and accurate. If mentioning eligibility criteria, be precise about numbers.
Respond in English, but you can include Hindi terms if they appear in the source.`;

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Context from the notification:\n\n${context}\n\nQuestion: ${question}` },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!groqResponse.ok) {
    // Fallback to Cerebras
    const cerebrasResponse = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-70b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Context from the notification:\n\n${context}\n\nQuestion: ${question}` },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!cerebrasResponse.ok) {
      return { answer: "Service is temporarily busy. Please try again in a moment.", citations: [] };
    }

    const cerebrasData = await cerebrasResponse.json();
    return {
      answer: cerebrasData.choices[0].message.content,
      citations: chunks.map((c) => ({ page_ref: c.page_ref, text_snippet: c.chunk_text.slice(0, 100) })),
    };
  }

  const groqData = await groqResponse.json();
  const answer = groqData.choices[0].message.content;

  return {
    answer,
    citations: chunks.map((c) => ({
      page_ref: c.page_ref,
      text_snippet: c.chunk_text.slice(0, 100),
    })),
  };
}
