import { ChatMessage } from '../agent/types';

export interface StreamOptions {
  model: string;
  thinking: boolean;
  search: boolean;
  deadMode: boolean;
  agentMode: boolean;
  conversationId?: string;
}

export interface StreamCallbacks {
  onChunk: (delta: string) => void;
  onReasoningChunk: (delta: string) => void;
  onConversationId?: (convId: string) => void;
  onError: (error: Error) => void;
  onComplete: (finishReason: string) => void;
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class DeepSeekClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string = 'https://api.thenck4.ru/v1', apiKey: string = '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  public updateConfig(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public async checkHealth(): Promise<{ ok: boolean; status: number; pingMs: number; error?: string }> {
    const startTime = Date.now();
    try {
      const cleanBase = this.baseUrl.replace(/\/v1$/, '');
      const healthUrl = `${cleanBase}/healthz`;

      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT
        }
      });

      const pingMs = Date.now() - startTime;
      if (response.ok) {
        return { ok: true, status: response.status, pingMs };
      }

      // If /healthz is blocked, check /v1/models with auth
      const modelsUrl = `${this.baseUrl}/models`;
      const mResp = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
        }
      });

      const mPing = Date.now() - startTime;
      if (mResp.ok) {
        return { ok: true, status: mResp.status, pingMs: mPing };
      }

      return {
        ok: false,
        status: mResp.status,
        pingMs: mPing,
        error: `HTTP ${mResp.status}: ${mResp.statusText}`
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 0,
        pingMs: Date.now() - startTime,
        error: err.message || String(err)
      };
    }
  }

  public async streamChatCompletion(
    messages: ChatMessage[],
    options: StreamOptions,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const url = `${this.baseUrl}/chat/completions`;

    const formattedMessages = messages.map(m => ({
      role: m.role,
      content: m.content || ''
    }));

    const payload: any = {
      model: options.model || 'deepseek-chat',
      messages: formattedMessages,
      stream: true,
      thinking: options.thinking ?? true,
      search: options.search ?? false,
      mode: options.deadMode ? 'dead' : 'normal',
      dead_mode: options.deadMode ?? false,
      agent_mode: options.agentMode ?? true
    };

    if (options.conversationId && !options.conversationId.startsWith('sess_')) {
      payload.conversation_id = options.conversationId;
    }

    if (signal?.aborted) {
      callbacks.onComplete('cancelled');
      return;
    }

    let abortHandler: (() => void) | null = null;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': DEFAULT_USER_AGENT
        },
        body: JSON.stringify(payload),
        signal
      });

      if (!response.ok) {
        let errBody = '';
        try {
          errBody = await response.text();
        } catch {}
        throw new Error(`API error (${response.status}): ${errBody || response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      reader = response.body.getReader();

      abortHandler = () => {
        try {
          reader?.cancel().catch(() => {});
        } catch {}
      };

      if (signal) {
        if (signal.aborted) {
          abortHandler();
          callbacks.onComplete('cancelled');
          return;
        }
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let finishReason = 'stop';

      let inThinkingBlock = false;

      while (true) {
        if (signal?.aborted) {
          callbacks.onComplete('cancelled');
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') {
              continue;
            }

            try {
              const data = JSON.parse(dataStr);

              if (data.conversation_id && callbacks.onConversationId) {
                callbacks.onConversationId(data.conversation_id);
              }

              const choice = data.choices?.[0];
              if (!choice) continue;

              if (choice.finish_reason) {
                finishReason = choice.finish_reason;
              }

              const delta = choice.delta;
              if (!delta) continue;

              // 1. Native reasoning_content
              if (delta.reasoning_content) {
                callbacks.onReasoningChunk(delta.reasoning_content);
              }

              // 2. Content streaming with inline <think> tags support
              if (delta.content) {
                let contentText = delta.content;

                if (contentText.includes('<think>')) {
                  inThinkingBlock = true;
                  const parts = contentText.split('<think>');
                  if (parts[0]) callbacks.onChunk(parts[0]);
                  contentText = parts[1] || '';
                }

                if (inThinkingBlock) {
                  if (contentText.includes('</think>')) {
                    const parts = contentText.split('</think>');
                    callbacks.onReasoningChunk(parts[0]);
                    inThinkingBlock = false;
                    if (parts[1]) callbacks.onChunk(parts[1]);
                  } else {
                    callbacks.onReasoningChunk(contentText);
                  }
                } else {
                  callbacks.onChunk(contentText);
                }
              }
            } catch (parseErr) {
              // Ignore partial JSON lines
            }
          }
        }
      }

      callbacks.onComplete(finishReason);
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted || err.message?.includes('aborted') || err.message?.includes('cancelled')) {
        callbacks.onComplete('cancelled');
      } else {
        callbacks.onError(err);
      }
    } finally {
      if (signal && abortHandler) {
        try {
          signal.removeEventListener('abort', abortHandler);
        } catch {}
      }
    }
  }
}
