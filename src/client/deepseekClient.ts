import { ChatMessage, ToolCall, ToolDefinition } from '../agent/types';
import { logger } from '../logger';

export interface StreamOptions {
  model: string;
  thinking: boolean;
  search: boolean;
  deadMode: boolean;
  agentMode: boolean;
  sandboxMode?: string;
  conversationId?: string;
  _isRetry?: boolean;
}

export interface StreamCallbacks {
  onChunk: (delta: string) => void;
  onReasoningChunk: (delta: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onConversationId?: (convId: string) => void;
  onUsage?: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => void;
  onError: (error: Error) => void;
  onComplete: (finishReason: string) => void;
  onStatus?: (status: string) => void;
  onApiDelay?: (remainingMs: number, totalMs: number, reason: string) => void;
}

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 75000): Promise<Response> {
  const controller = new AbortController();
  const parentSignal = options.signal;

  let timer: NodeJS.Timeout | null = null;
  const onParentAbort = () => {
    controller.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (err: any) {
    if (parentSignal?.aborted) {
      throw new Error('Operation cancelled by user');
    }
    if (controller.signal.aborted) {
      throw new Error(`Connection timeout: server did not respond within ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
}

function readWithTimeout(
  r: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number = 45000,
  signal?: AbortSignal,
  onProgress?: (elapsedSec: number) => void,
  timeoutMessage?: string
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout | null = null;
    let progressInterval: NodeJS.Timeout | null = null;
    let finished = false;
    const startTime = Date.now();

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (progressInterval) clearInterval(progressInterval);
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (finished) return;
      finished = true;
      cleanup();
      try {
        r.cancel().catch(() => {});
      } catch {}
      reject(new Error('Operation cancelled by user'));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    if (onProgress) {
      progressInterval = setInterval(() => {
        if (finished) return;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        if (elapsed >= 3) {
          onProgress(elapsed);
        }
      }, 2000);
    }

    timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      try {
        r.cancel().catch(() => {});
      } catch {}
      const fallbackMsg = timeoutMessage || `Stream stalled: no data received from server for ${Math.round(timeoutMs / 1000)}s (socket hung)`;
      reject(new Error(fallbackMsg));
    }, timeoutMs);

    r.read().then(
      res => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(res);
      },
      err => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(err);
      }
    );
  });
}

/**
 * Delay execution before dispatching a new request to the API.
 * Allows the agent to pause between turns/requests (rate-limiting / cooldown).
 */
export async function delayForNewRequest(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (!delayMs || delayMs <= 0) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export async function delayWithCountdown(
  waitMs: number,
  reason: string,
  callbacks?: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  if (waitMs <= 0) return;
  const startTime = Date.now();
  const endTime = startTime + waitMs;

  while (Date.now() < endTime) {
    if (signal?.aborted) return;
    const remainingMs = Math.max(0, endTime - Date.now());
    callbacks?.onApiDelay?.(remainingMs, waitMs, reason);
    const secStr = (remainingMs / 1000).toFixed(1);
    callbacks?.onStatus?.(`API Delay: ${secStr}s (${reason})`);

    const stepMs = Math.min(100, remainingMs);
    if (stepMs <= 0) break;
    await new Promise<void>(r => {
      const tm = setTimeout(r, stepMs);
      signal?.addEventListener('abort', () => {
        clearTimeout(tm);
        r();
      }, { once: true });
    });
  }

  if (!signal?.aborted) {
    callbacks?.onApiDelay?.(0, waitMs, reason);
  }
}

export class DeepSeekClient {
  private baseUrl: string;
  private apiKey: string;
  private lastStreamEndTime: number = 0;
  private pacingDelayMs: number = 1500;
  private requestDelayMs: number = 0;
  private connectTimeoutMs: number = 75000;
  private readTimeoutMs: number = 45000;
  private thinkingTimeoutMs: number = 9000;

  constructor(baseUrl: string = 'https://api.thenck4.ru/v1', apiKey: string = '') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  public updateConfig(baseUrl: string, apiKey: string, timeouts?: {
    pacingDelayMs?: number;
    requestDelayMs?: number;
    connectTimeoutSec?: number;
    readTimeoutSec?: number;
    thinkingTimeoutSec?: number;
  }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    if (timeouts) {
      if (timeouts.pacingDelayMs !== undefined) this.pacingDelayMs = timeouts.pacingDelayMs;
      if (timeouts.requestDelayMs !== undefined) this.requestDelayMs = timeouts.requestDelayMs;
      if (timeouts.connectTimeoutSec !== undefined) this.connectTimeoutMs = timeouts.connectTimeoutSec * 1000;
      if (timeouts.readTimeoutSec !== undefined) this.readTimeoutMs = timeouts.readTimeoutSec * 1000;
      if (timeouts.thinkingTimeoutSec !== undefined) this.thinkingTimeoutMs = timeouts.thinkingTimeoutSec * 1000;
    }
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
    signal?: AbortSignal,
    toolDefinitions?: ToolDefinition[]
  ): Promise<void> {
    const url = `${this.baseUrl}/chat/completions`;

    const formattedMessages = messages.map(m => {
      let content = m.content || '';

      // Wrap user messages in clear structured boundaries so the model strictly distinguishes intent
      if (m.role === 'user' && content) {
        if (!content.startsWith('[')) {
          if (m.isInternal) {
            content = `[AGENT DIRECTIVE]\n${content}`;
          } else {
            content = `[USER REQUEST]\n${content}`;
          }
        }
      } else if (m.role === 'tool' && content) {
        if (!content.startsWith('[') && !content.startsWith('File:') && !content.startsWith('Command:')) {
          content = `[TOOL OBSERVATION]\n${content}`;
        }
      }

      const msg: any = {
        role: m.role,
        content
      };
      // Include tool_call_id for tool-result messages (OpenAI format)
      if (m.role === 'tool') {
        msg.tool_call_id = m.toolCallId || ('call_' + m.id);
      }
      // Include tool_calls for assistant messages that had native tool calls
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        }));
        if (!msg.content || !msg.content.includes('<tool_call')) {
          const xmlCalls = m.toolCalls.map(tc => {
            let argsStr = '';
            try {
              const parsed = JSON.parse(tc.function.arguments || '{}');
              argsStr = Object.entries(parsed).map(([k, v]) => `<${k}>${typeof v === 'object' ? JSON.stringify(v) : v}</${k}>`).join('');
            } catch {
              argsStr = tc.function.arguments || '';
            }
            return `<tool_call name="${tc.function.name}">${argsStr}</tool_call>`;
          }).join('\n');
          msg.content = (msg.content ? msg.content + '\n' : '') + xmlCalls;
        }
      }
      return msg;
    });

    const payload: any = {
      model: options.model || 'deepseek-chat',
      stream: true,
      stream_options: { include_usage: true },
      thinking: options.thinking ?? true,
      search: options.search ?? false,
      mode: options.deadMode ? 'dead' : 'normal',
      dead_mode: options.deadMode ?? false,
      agent_mode: false // Strictly FALSE so thenck4 proxy never injects its hardcoded Russian reminder into user messages
    };

    // FIX: Include tool definitions in the API request so the model knows
    // which tools are available and can return native function_call / tool_calls
    if (toolDefinitions && toolDefinitions.length > 0) {
      payload.tools = toolDefinitions;
    }

    let messagesForPayload = formattedMessages;
    if (options.conversationId && !options.conversationId.startsWith('chat_')) {
      let convId = options.conversationId.trim();
      // In DeepSeek Web conversation tree:
      // Turn 1: user msg = 1, asst msg = 2.
      // Turn 2: user msg = 3, asst msg = 4.
      // The upstream API returns <uuid>:<parentIdx> (e.g. uuid:2, uuid:4).
      // We preserve this exact conversation_id so subsequent turns append cleanly to the SAME chat.
      if (!convId.includes(':')) {
        const asstCount = formattedMessages.filter(m => m.role === 'assistant').length;
        if (asstCount > 0) {
          // Default to the first turn output if missing index
          convId = `${convId}:2`;
        }
      }
      payload.conversation_id = convId;

      // Resuming an existing conversation: send ONLY the latest turn messages as a new message, never re-sending system prompt or full history
      const lastAsstIdx = formattedMessages.map(m => m.role).lastIndexOf('assistant');
      if (lastAsstIdx !== -1 && lastAsstIdx < formattedMessages.length - 1) {
        messagesForPayload = formattedMessages.slice(lastAsstIdx + 1);
      } else if (lastAsstIdx !== -1 && lastAsstIdx === formattedMessages.length - 1) {
        // Last message was assistant (unstuck / continue turn) — send continuation as a clean new user message
        messagesForPayload = [{
          role: 'user',
          content: '[USER REQUEST]\nContinue your work and proceed to the next step.'
        }];
      } else if (lastAsstIdx === -1 && formattedMessages.length > 0) {
        const nonSystem = formattedMessages.filter(m => m.role !== 'system');
        if (nonSystem.length > 0) {
          messagesForPayload = nonSystem;
        }
      }

      // Explicitly notify the model about the active sandbox mode so it knows when mode changed in multi-turn chats
      if (options.sandboxMode && messagesForPayload.length > 0) {
        let modeNotice = '';
        const toolContract = ' Invoke tools directly using XML format: <tool_call name="run_command"><command>...</command></tool_call>, <tool_call name="read_file"><path>...</path><start_line>1</start_line><end_line>65</end_line></tool_call>, <tool_call name="edit_file"><path>...</path><search>...</search><replace>...</replace></tool_call>, <tool_call name="create_file"><path>...</path><content>...</content></tool_call>. Do NOT output commands or files inside conversational markdown blocks.';
        if (options.sandboxMode === 'helper') {
          modeNotice = `[SYSTEM NOTIFICATION: Sandbox Security mode is currently HELPER (RW: Read & Write allowed, terminal execution disabled). You CAN create and edit project files.${toolContract}]\n`;
        } else if (options.sandboxMode === 'local') {
          modeNotice = `[SYSTEM NOTIFICATION: Sandbox Security mode is currently LOCAL (RWX: Read, Write & Execute allowed). You CAN create, edit files and run terminal commands.${toolContract}]\n`;
        } else if (options.sandboxMode === 'bypass') {
          modeNotice = `[SYSTEM NOTIFICATION: Sandbox Security mode is currently BYPASS (Full unrestricted RWX). You CAN create, edit files and run terminal commands.${toolContract}]\n`;
        } else if (options.sandboxMode === 'ask') {
          modeNotice = '[SYSTEM NOTIFICATION: Sandbox Security mode is currently ASK (Read-Only: r--). File creation, editing, and terminal commands are disabled. Answer user questions directly in plain text.]\n';
        }

        const firstUser = messagesForPayload.find(m => m.role === 'user');
        if (firstUser && modeNotice && !firstUser.content.includes('[SYSTEM NOTIFICATION: Sandbox Security mode')) {
          firstUser.content = modeNotice + firstUser.content;
        }
      }
    }
    payload.messages = messagesForPayload;

    if (signal?.aborted) {
      callbacks.onComplete('cancelled');
      return;
    }

    let abortHandler: (() => void) | null = null;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    const toolCallAccumulators: Map<number, { id: string; name: string; arguments: string }> = new Map();
    const requestStartTime = Date.now();

    try {
      const cleanKey = (this.apiKey || '').trim();
      if (cleanKey && /[^\x00-\x7F]/.test(cleanKey)) {
        throw new Error('API-токен содержит русские или недопустимые символы. Пожалуйста, откройте Settings и введите корректный ключ в английской раскладке (sk-...).');
      }

      // Ensure minimum delay between consecutive turns in the same conversation
      // so DeepSeek Web proxy finishes flushing session state to its database
      if (payload.conversation_id && this.lastStreamEndTime > 0 && this.pacingDelayMs > 0) {
        const elapsedSinceLast = Date.now() - this.lastStreamEndTime;
        if (elapsedSinceLast < this.pacingDelayMs) {
          const waitMs = this.pacingDelayMs - elapsedSinceLast;
          logger.log('API', `Pacing: waiting ${waitMs}ms before sending turn to conversation ${payload.conversation_id}...`);
          await delayWithCountdown(waitMs, 'pacing', callbacks, signal);
          if (signal?.aborted) {
            callbacks.onComplete('cancelled');
            return;
          }
        }
      }

      // Configurable delay before dispatching each new request to the API
      if (this.requestDelayMs > 0) {
        logger.log('API', `Request delay: waiting ${this.requestDelayMs}ms before sending request to API...`);
        await delayWithCountdown(this.requestDelayMs, 'request delay', callbacks, signal);
        if (signal?.aborted) {
          callbacks.onComplete('cancelled');
          return;
        }
      }

      logger.log('API', `POST ${url} (model: ${payload.model}, thinking: ${payload.thinking}, messages: ${payload.messages.length})`);

      let response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanKey}`,
          'User-Agent': DEFAULT_USER_AGENT
        },
        body: JSON.stringify(payload),
        signal
      }, this.connectTimeoutMs);

      logger.log('API', `HTTP ${response.status} ${response.statusText} in ${Date.now() - requestStartTime}ms`);

      // If server returned 502/404/400/401 when conversation_id was set, the server session might have expired.
      // Reset conversation_id and retry with full message history so execution never halts.
      if (!response.ok && payload.conversation_id && (response.status === 502 || response.status === 404 || response.status === 400 || response.status === 401) && !signal?.aborted) {
        callbacks.onStatus?.('Сессия на сервере обновлена, повторная отправка полного контекста...');
        delete payload.conversation_id;
        payload.messages = formattedMessages;
        if (callbacks.onConversationId) {
          callbacks.onConversationId('');
        }
        response = await fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanKey}`,
            'User-Agent': DEFAULT_USER_AGENT
          },
          body: JSON.stringify(payload),
          signal
        }, this.connectTimeoutMs);
      }

      // Transient 429 / 502 / 503 / 504 retry
      if (!response.ok && (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) && !signal?.aborted) {
        let retryDelaySec = 3;
        const retryAfterHeader = response.headers.get('Retry-After');
        if (retryAfterHeader) {
          const parsedSec = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsedSec) && parsedSec > 0) {
            retryDelaySec = parsedSec;
          }
        }
        callbacks.onStatus?.(response.status === 429 ? `Лимит запросов (429). Ожидание ${retryDelaySec} сек...` : `Шлюз вернул ${response.status}. Повторная попытка через ${retryDelaySec} сек...`);
        await new Promise(r => setTimeout(r, retryDelaySec * 1000));
        if (!signal?.aborted) {
          response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cleanKey}`,
              'User-Agent': DEFAULT_USER_AGENT
            },
            body: JSON.stringify(payload),
            signal
          }, this.connectTimeoutMs);
        }
      }

      if (!response.ok) {
        let errBody = '';
        let cleanErrMsg = '';
        try {
          errBody = await response.text();
          const parsed = JSON.parse(errBody);
          if (parsed.error?.message) {
            cleanErrMsg = parsed.error.message;
          } else if (parsed.message) {
            cleanErrMsg = parsed.message;
          } else if (parsed.detail) {
            cleanErrMsg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
          }
        } catch {}

        if (!cleanErrMsg) {
          if (errBody.includes('<html') || errBody.includes('502: Bad gateway') || response.status === 502) {
            cleanErrMsg = `Прокси-сервер (${url}) временно недоступен (502 Bad Gateway). Бэкенд перезагружается или перегружен Cloudflare. Пожалуйста, повторите запрос через пару секунд.`;
          } else if (response.status === 504) {
            cleanErrMsg = `Таймаут шлюза (504 Gateway Timeout). Сервер не успел обработать запрос вовремя.`;
          } else {
            cleanErrMsg = `API error (${response.status}): ${response.statusText || errBody.slice(0, 200)}`;
          }
        }
        throw new Error(cleanErrMsg);
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
      let thinkTagBuffer = '';
      let totalEventsReceived = 0;
      let firstChunkReceived = false;
      let reasoningStartTime = 0;
      let lastReasoningChunkTime = 0;
      let reasoningChars = 0;
      let reasoningFinished = false;
      let firstContentReceived = false;

      while (true) {
        if (signal?.aborted) {
          callbacks.onComplete('cancelled');
          return;
        }

        const isWaitingContentAfterReasoning = reasoningStartTime > 0 && !firstContentReceived && toolCallAccumulators.size === 0;
        const currentReadTimeout = isWaitingContentAfterReasoning ? this.thinkingTimeoutMs : this.readTimeoutMs;
        const timeoutReason = isWaitingContentAfterReasoning
          ? `Stream stalled: модель завершила рассуждения, но не прислала контент/вызов инструмента в течение ${Math.round(this.thinkingTimeoutMs / 1000)} сек (пустой ответ).`
          : undefined;

        const { done, value } = await readWithTimeout(reader, currentReadTimeout, signal, (elapsedSec) => {
          if (reasoningStartTime && !reasoningFinished) {
            const idleSec = lastReasoningChunkTime ? Math.round((Date.now() - lastReasoningChunkTime) / 1000) : elapsedSec;
            logger.log('API Wait', `Waiting for server model response (${idleSec}s after reasoning)...`);
            callbacks.onStatus?.(`Waiting for server response (${idleSec}s)...`);
          } else {
            logger.log('API Wait', `Waiting for server chunk (${elapsedSec}s)...`);
            callbacks.onStatus?.(`Waiting for server response (${elapsedSec}s)...`);
          }
        }, timeoutReason);

        if (done) {
          if (thinkTagBuffer) {
            if (inThinkingBlock) callbacks.onReasoningChunk(thinkTagBuffer);
            else callbacks.onChunk(thinkTagBuffer);
            thinkTagBuffer = '';
          }
          if (reasoningStartTime && !reasoningFinished) {
            reasoningFinished = true;
            const dur = ((Date.now() - reasoningStartTime) / 1000).toFixed(2);
            logger.log('Reasoning', `Thinking finished in ${dur}s (${reasoningChars} chars)`);
          }
          this.lastStreamEndTime = Date.now();
          const totalDur = ((Date.now() - requestStartTime) / 1000).toFixed(2);
          logger.log('API', `Stream completed in ${totalDur}s (events: ${totalEventsReceived}, finish_reason: ${finishReason})`);

          // Fast detector: if the stream closed after reasoning but with NO content and NO tool calls:
          if (reasoningStartTime && !firstContentReceived && toolCallAccumulators.size === 0) {
            throw new Error('DeepSeek вернул пустой ответ после рассуждений (0 токенов контента).');
          }
          break;
        }

        if (!firstChunkReceived) {
          firstChunkReceived = true;
          const ttft = ((Date.now() - requestStartTime) / 1000).toFixed(2);
          logger.log('API', `First stream chunk received (TTFT: ${ttft}s)`);
        }

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

              if (data.error) {
                const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
                throw new Error(errMsg);
              }

              const bizMsg = data.biz_msg || data.data?.biz_msg || (data.code && data.code !== 200 && data.code !== 0 ? data.msg : null);
              if (bizMsg) {
                throw new Error(`DeepSeek: ${bizMsg}`);
              }

              // Capture DeepSeek's conversation_id from stream chunk
              const convId = data.conversation_id || (data.data && data.data.conversation_id);
              if (convId && callbacks.onConversationId) {
                callbacks.onConversationId(convId);
              }

              if (data.usage && callbacks.onUsage) {
                callbacks.onUsage({
                  prompt_tokens: data.usage.prompt_tokens || 0,
                  completion_tokens: data.usage.completion_tokens || 0,
                  total_tokens: data.usage.total_tokens || 0
                });
              }

              const choice = data.choices?.[0];
              if (!choice) continue;

              if (choice.finish_reason) {
                finishReason = choice.finish_reason;
              }

              const delta = choice.delta;
              if (!delta) continue;

              // 1. Native reasoning_content: strictly for reasoning, NEVER emit into chat onChunk
              if (delta.reasoning_content) {
                totalEventsReceived++;
                if (!reasoningStartTime) {
                  reasoningStartTime = Date.now();
                  logger.log('Reasoning', 'Thinking started...');
                }
                lastReasoningChunkTime = Date.now();
                reasoningChars += delta.reasoning_content.length;
                callbacks.onReasoningChunk(delta.reasoning_content);
              }

              // 2. FIX: Parse native tool_calls from SSE delta
              // DeepSeek API (and OpenAI-compatible) can return tool_calls in the delta
              // as incremental fragments that need to be accumulated per index
              if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                totalEventsReceived++;
                if (reasoningStartTime && !reasoningFinished) {
                  reasoningFinished = true;
                  const durSec = ((Date.now() - reasoningStartTime) / 1000).toFixed(2);
                  logger.log('Reasoning', `Thinking finished in ${durSec}s (${reasoningChars} chars). Model emitted tool call.`);
                }
                for (const tcDelta of delta.tool_calls) {
                  const idx = tcDelta.index ?? 0;

                  if (!toolCallAccumulators.has(idx)) {
                    // First fragment for this tool call — initialize accumulator
                    toolCallAccumulators.set(idx, {
                      id: tcDelta.id || `call_native_${Date.now()}_${idx}`,
                      name: tcDelta.function?.name || '',
                      arguments: tcDelta.function?.arguments || ''
                    });
                  } else {
                    // Subsequent fragment — append to accumulator
                    const acc = toolCallAccumulators.get(idx)!;
                    if (tcDelta.id) acc.id = tcDelta.id;
                    if (tcDelta.function?.name) acc.name += tcDelta.function.name;
                    if (tcDelta.function?.arguments) acc.arguments += tcDelta.function.arguments;
                  }
                }
              }

              // 3. Content streaming with inline <think> tags and boundary support
              if (delta.content) {
                totalEventsReceived++;
                if (reasoningStartTime && !reasoningFinished && !inThinkingBlock && !delta.content.includes('<think>')) {
                  reasoningFinished = true;
                  const durSec = ((Date.now() - reasoningStartTime) / 1000).toFixed(2);
                  logger.log('Reasoning', `Thinking finished in ${durSec}s (${reasoningChars} chars). Model started generating content.`);
                }
                if (!firstContentReceived && !inThinkingBlock && !delta.content.includes('<think>')) {
                  firstContentReceived = true;
                  const sinceReasoning = lastReasoningChunkTime ? ((Date.now() - lastReasoningChunkTime) / 1000).toFixed(2) : '0';
                  logger.log('Content', `First content token received (${sinceReasoning}s after reasoning).`);
                }

                thinkTagBuffer += delta.content;

                while (thinkTagBuffer.length > 0) {
                  if (!inThinkingBlock) {
                    const thinkIdx = thinkTagBuffer.indexOf('<think>');
                    if (thinkIdx !== -1) {
                      const pre = thinkTagBuffer.slice(0, thinkIdx);
                      if (pre) callbacks.onChunk(pre);
                      thinkTagBuffer = thinkTagBuffer.slice(thinkIdx + 7);
                      inThinkingBlock = true;
                      continue;
                    }
                    const partialMatch = thinkTagBuffer.match(/<t?h?i?n?k?$/i);
                    if (partialMatch) {
                      const pre = thinkTagBuffer.slice(0, partialMatch.index);
                      if (pre) callbacks.onChunk(pre);
                      thinkTagBuffer = partialMatch[0];
                      break;
                    } else {
                      callbacks.onChunk(thinkTagBuffer);
                      thinkTagBuffer = '';
                    }
                  } else {
                    const endThinkIdx = thinkTagBuffer.indexOf('</think>');
                    if (endThinkIdx !== -1) {
                      const pre = thinkTagBuffer.slice(0, endThinkIdx);
                      if (pre) callbacks.onReasoningChunk(pre);
                      thinkTagBuffer = thinkTagBuffer.slice(endThinkIdx + 8);
                      inThinkingBlock = false;
                      continue;
                    }
                    const partialEndMatch = thinkTagBuffer.match(/<(?:(?:\/t?h?i?n?k?)|\/)?$/i);
                    if (partialEndMatch) {
                      const pre = thinkTagBuffer.slice(0, partialEndMatch.index);
                      if (pre) callbacks.onReasoningChunk(pre);
                      thinkTagBuffer = partialEndMatch[0];
                      break;
                    } else {
                      callbacks.onReasoningChunk(thinkTagBuffer);
                      thinkTagBuffer = '';
                    }
                  }
                }
              }
            } catch (parseErr: any) {
              if (parseErr.message && !parseErr.message.includes('JSON')) {
                throw parseErr;
              }
            }
          }
        }
      }

      // If stream ended with 0 tokens/events received, the proxy/server silently closed the stream.
      // 1. First retry with a 1500ms pacing delay with the SAME conversation_id (prevents proxy race condition).
      // 2. Only if the retry also returns 0 events, perform fallback to ensure work never halts.
      if (totalEventsReceived === 0 && !signal?.aborted) {
        if (payload.conversation_id && !options._isRetry) {
          logger.log('API', `Stream closed with 0 events for conversation_id ${payload.conversation_id}. Retrying after ${this.pacingDelayMs}ms pacing delay in SAME conversation...`);
          await new Promise<void>(r => {
            const tm = setTimeout(r, this.pacingDelayMs);
            signal?.addEventListener('abort', () => { clearTimeout(tm); r(); }, { once: true });
          });
          if (signal?.aborted) {
            callbacks.onComplete('cancelled');
            return;
          }
          return await this.streamChatCompletion(
            messages,
            { ...options, _isRetry: true },
            callbacks,
            signal,
            toolDefinitions
          );
        }

        let errMessage = 'API returned an empty stream (0 bytes). Пожалуйста, проверьте статус токена или сессии в настройках.';
        try {
          const fallbackResp = await fetchWithTimeout(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cleanKey}`,
              'User-Agent': DEFAULT_USER_AGENT
            },
            body: JSON.stringify({ ...payload, stream: false }),
            signal
          }, 20000);
          const bodyText = await fallbackResp.text();
          try {
            const parsed = JSON.parse(bodyText);
            const choiceMsg = parsed.choices?.[0]?.message;
            if (choiceMsg) {
              if (choiceMsg.reasoning_content && callbacks.onReasoningChunk) {
                callbacks.onReasoningChunk(choiceMsg.reasoning_content);
              }
              if (choiceMsg.tool_calls && Array.isArray(choiceMsg.tool_calls) && callbacks.onToolCall) {
                for (const tc of choiceMsg.tool_calls) {
                  callbacks.onToolCall(tc);
                }
              }
              if (choiceMsg.content && callbacks.onChunk) {
                callbacks.onChunk(choiceMsg.content);
              }
              if (choiceMsg.content || (choiceMsg.tool_calls && choiceMsg.tool_calls.length > 0)) {
                return;
              }
            }
            if (parsed.error?.message) {
              errMessage = parsed.error.message;
            } else if (parsed.biz_msg || parsed.data?.biz_msg) {
              errMessage = `DeepSeek: ${parsed.biz_msg || parsed.data?.biz_msg}`;
            } else if (parsed.message) {
              errMessage = parsed.message;
            } else if (parsed.detail) {
              errMessage = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
            } else if (parsed.choices && (!parsed.choices[0]?.message?.content)) {
              errMessage = `DeepSeek вернул пустой ответ (0 токенов). Временный сбой шлюза прокси. Пожалуйста, повторите запрос.`;
            }
          } catch {
            if (bodyText) errMessage = bodyText;
          }
        } catch (e: any) {
          if (e.message) errMessage = e.message;
        }
        throw new Error(errMessage);
      }

      // After stream ends, emit any accumulated native tool calls
      if (toolCallAccumulators.size > 0 && callbacks.onToolCall) {
        for (const [_idx, acc] of toolCallAccumulators) {
          if (acc.name) {
            callbacks.onToolCall({
              id: acc.id,
              type: 'function',
              function: {
                name: acc.name,
                arguments: acc.arguments || '{}'
              }
            });
          }
        }
      }

      // If we got native tool calls, report finish_reason as tool_calls if not already set
      if (toolCallAccumulators.size > 0 && finishReason === 'stop') {
        finishReason = 'tool_calls';
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
