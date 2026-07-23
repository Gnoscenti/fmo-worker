/**
 * LLM Router — routes agent calls to the correct provider
 * Atlas/Vox/Figaro → xAI Grok 4
 * Lux/Slate → Gemini 2.5 Pro
 * Canvi/Dobe/Tempo → Gemini 2.5 Flash
 */

export type LLMProvider = "grok" | "gemini-pro" | "gemini-flash" | "openai" | "anthropic";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallOptions {
  provider: LLMProvider;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface LLMCallResult {
  content: string;
  model: string;
  provider: LLMProvider;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  durationMs: number;
}

// Agent → provider mapping
export const AGENT_PROVIDER_MAP: Record<string, LLMProvider> = {
  ATLAS: "grok",
  VOX: "grok",
  LUX: "gemini-pro",
  SLATE: "gemini-pro",
  FIGARO: "grok",
  CANVI: "gemini-flash",
  DOBE: "gemini-flash",
  TEMPO: "gemini-flash",
};

export async function callLLM(
  messages: LLMMessage[],
  options: LLMCallOptions
): Promise<LLMCallResult> {
  const startTime = Date.now();
  const { provider } = options;

  switch (provider) {
    case "grok":
      return callGrok(messages, options, startTime);
    case "gemini-pro":
      return callGemini(messages, "gemini-2.5-pro", options, startTime);
    case "gemini-flash":
      return callGemini(messages, "gemini-2.5-flash", options, startTime);
    case "openai":
      return callOpenAI(messages, "gpt-4o", options, startTime);
    case "anthropic":
      return callAnthropic(messages, "claude-opus-4-5", options, startTime);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

async function callGrok(
  messages: LLMMessage[],
  options: LLMCallOptions,
  startTime: number
): Promise<LLMCallResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || apiKey === "xai-test") {
    // Fallback to OpenAI if xAI key is placeholder
    console.warn("[LLM] xAI key is placeholder — falling back to OpenAI GPT-4o");
    return callOpenAI(messages, "gpt-4o", options, startTime);
  }

  const model = "grok-4";
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 8192,
  };
  if (options.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok API error ${res.status}: ${err}`);
  }

  const json = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  return {
    content: json.choices[0].message.content,
    model,
    provider: "grok",
    usage: {
      inputTokens: json.usage.prompt_tokens,
      outputTokens: json.usage.completion_tokens,
      totalTokens: json.usage.total_tokens,
    },
    durationMs: Date.now() - startTime,
  };
}

async function callGemini(
  messages: LLMMessage[],
  model: string,
  options: LLMCallOptions,
  startTime: number
): Promise<LLMCallResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not configured");

  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const contents = conversationMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 8192,
      ...(options.responseFormat === "json" && {
        responseMimeType: "application/json",
      }),
    },
  };

  if (systemMessage) {
    body.systemInstruction = { parts: [{ text: systemMessage.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const json = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    usageMetadata: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
  };

  const provider: LLMProvider = model.includes("flash") ? "gemini-flash" : "gemini-pro";
  return {
    content: json.candidates[0].content.parts[0].text,
    model,
    provider,
    usage: {
      inputTokens: json.usageMetadata.promptTokenCount,
      outputTokens: json.usageMetadata.candidatesTokenCount,
      totalTokens: json.usageMetadata.totalTokenCount,
    },
    durationMs: Date.now() - startTime,
  };
}

async function callOpenAI(
  messages: LLMMessage[],
  model: string,
  options: LLMCallOptions,
  startTime: number
): Promise<LLMCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const baseUrl = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };
  if (options.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const json = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  return {
    content: json.choices[0].message.content,
    model,
    provider: "openai",
    usage: {
      inputTokens: json.usage.prompt_tokens,
      outputTokens: json.usage.completion_tokens,
      totalTokens: json.usage.total_tokens,
    },
    durationMs: Date.now() - startTime,
  };
}

async function callAnthropic(
  messages: LLMMessage[],
  model: string,
  options: LLMCallOptions,
  startTime: number
): Promise<LLMCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model,
    messages: conversationMessages,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
  };
  if (systemMessage) body.system = systemMessage.content;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const json = await res.json() as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  return {
    content: json.content[0].text,
    model,
    provider: "anthropic",
    usage: {
      inputTokens: json.usage.input_tokens,
      outputTokens: json.usage.output_tokens,
      totalTokens: json.usage.input_tokens + json.usage.output_tokens,
    },
    durationMs: Date.now() - startTime,
  };
}
