/**
 * DeepSeek Tokenizer & Token Counter
 * 
 * Implements high-fidelity Byte-Pair Encoding (BPE) token estimation calibrated
 * for DeepSeek-V3 and DeepSeek-R1 (128k vocabulary, byte-level BPE).
 * Supports Code, English, Russian (Cyrillic multi-byte), Numbers, and ChatML overhead.
 */

import { ChatMessage, ToolDefinition } from './types';

// BPE token splitting regex matching contractions, words, 1-3 digit numbers, punctuation, whitespace runs
const BPE_SPLIT_REGEX = /'s|'t|'re|'ve|'m|'ll|'d|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;

export const DEFAULT_CONTEXT_LIMIT = 1000000;

export interface TokenizerConfig {
  contextLimitTokens?: number;
  compactThresholdTokens?: number;
  cyrillicCharsPerToken?: number;
  latinCharsPerToken?: number;
}

let activeTokenizerConfig: TokenizerConfig = {
  contextLimitTokens: DEFAULT_CONTEXT_LIMIT,
  compactThresholdTokens: 80000,
  cyrillicCharsPerToken: 1.7,
  latinCharsPerToken: 3.8
};

export function updateTokenizerConfig(cfg: TokenizerConfig): void {
  activeTokenizerConfig = { ...activeTokenizerConfig, ...cfg };
}

export function getTokenizerConfig(): TokenizerConfig {
  return activeTokenizerConfig;
}

// Hierarchical Compaction Thresholds
export const LOCAL_COMPACT_THRESHOLD = 80000;    // 80k uncompacted raw messages -> Local milestone (~3k tokens)
export const GENERAL_COMPACT_THRESHOLD = 256000;  // 256k accumulated milestones -> General consolidation (~32k tokens)
export const ULTRA_COMPACT_THRESHOLD = 900000;    // 900k mega-context ceiling -> Ground truth snapshot (~75k tokens)

/**
 * Calculates target summary size for general / ultra compaction.
 */
export function calculateTargetCompactedTokens(currentTokens: number): number {
  const MIN_TOKENS = 80_000;
  const MAX_TOKENS = 900_000;
  const MIN_SUMMARY = 3_000;   // Micro milestone target
  const MAX_SUMMARY = 80_000;  // Ultra ground truth target

  if (currentTokens <= MIN_TOKENS) return MIN_SUMMARY;
  if (currentTokens >= MAX_TOKENS) return MAX_SUMMARY;

  const progress = (currentTokens - MIN_TOKENS) / (MAX_TOKENS - MIN_TOKENS);
  const targetTokens = MIN_SUMMARY + (MAX_SUMMARY - MIN_SUMMARY) * Math.pow(progress, 0.65);
  return Math.round(targetTokens);
}

/**
 * Calculates retention stats: ratio of active tokens to total raw tokens processed.
 */
export function calculateRetentionStats(rawTokensTotal: number, currentActiveTokens: number) {
  if (rawTokensTotal <= 0) return { retentionPercent: 100, savedPercent: 0 };
  const retentionPercent = (currentActiveTokens / rawTokensTotal) * 100;
  const savedPercent = Math.max(0, 100 - retentionPercent);
  return {
    retentionPercent: Number(retentionPercent.toFixed(2)),
    savedPercent: Number(savedPercent.toFixed(2))
  };
}

export interface TokenUsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  maxTokens: number;
  percent: number;
  userTokens?: number;
  systemTokens?: number;
  contextTokens?: number;
  lastCompactTimestamp?: number;
  retentionPercent?: number;
  rawTokensProcessedTotal?: number;
  cumulativeTokensSpent?: number;
}

/**
 * Counts the estimated tokens for a given string of text.
 */
export function countTokens(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  if (text.length === 0) return 0;

  const matches = text.match(BPE_SPLIT_REGEX);
  if (!matches) {
    // Fallback if regex fails: roughly 3.5 chars per token
    return Math.max(1, Math.ceil(text.length / 3.5));
  }

  let tokens = 0;
  const cyrRatio = activeTokenizerConfig.cyrillicCharsPerToken || 1.7;
  const latRatio = activeTokenizerConfig.latinCharsPerToken || 3.8;

  for (let i = 0; i < matches.length; i++) {
    const chunk = matches[i];

    // 1. Cyrillic / Russian text: UTF-8 multi-byte (2 bytes per char).
    // In DeepSeek/BPE vocab, Russian syllables are ~1.5 - 1.8 chars per token.
    if (/[\u0400-\u04FF]/.test(chunk)) {
      const clean = chunk.trim();
      tokens += Math.max(1, Math.ceil(clean.length / cyrRatio));
    }
    // 2. Whitespace runs / newlines / indents (spaces, tabs, newlines)
    else if (/^[\s\r\n]+$/.test(chunk)) {
      tokens += Math.max(1, Math.ceil(chunk.length / 3));
    }
    // 3. English / Latin words and subwords
    else if (/[a-zA-Z]/.test(chunk)) {
      tokens += Math.max(1, Math.ceil(chunk.length / latRatio));
    }
    // 4. Numbers: already sliced into 1-3 digits by \p{N}{1,3}
    else if (/^\p{N}+$/u.test(chunk)) {
      tokens += Math.max(1, Math.ceil(chunk.length / 3));
    }
    // 5. Code symbols, brackets, punctuation
    else {
      tokens += 1;
    }
  }

  return Math.max(1, tokens);
}

/**
 * Calculates token usage for a single chat message including ChatML framing overhead.
 */
export function countMessageTokens(message: ChatMessage): number {
  if (!message) return 0;

  // ChatML overhead: <|im_start|>{role}\n ... <|im_end|>\n is ~4 tokens
  let tokens = 4;

  if (message.content) {
    tokens += countTokens(message.content);
  }

  if (message.reasoningContent) {
    // Reasoning tokens inside <think>...</think>
    tokens += countTokens(message.reasoningContent) + 2;
  }

  if (message.toolCalls && message.toolCalls.length > 0) {
    for (const tc of message.toolCalls) {
      const fnName = tc.function?.name || '';
      const fnArgs = tc.function?.arguments || '';
      tokens += countTokens(fnName) + 3;
      if (fnArgs) {
        tokens += countTokens(typeof fnArgs === 'string' ? fnArgs : JSON.stringify(fnArgs));
      }
    }
  }

  return tokens;
}

/**
 * Estimates token overhead for tool schemas passed to the model.
 */
export function countToolsTokens(tools?: ToolDefinition[]): number {
  if (!tools || tools.length === 0) return 0;
  let tokens = 10; // Tool system framing
  for (const t of tools) {
    tokens += countTokens(t.function.name) + countTokens(t.function.description);
    if (t.function.parameters) {
      tokens += countTokens(JSON.stringify(t.function.parameters));
    }
  }
  return tokens;
}

/**
 * Computes complete token usage for a list of conversation messages.
 */
export function countConversationTokens(
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  maxTokens?: number
): TokenUsageStats {
  const effectiveMaxTokens = maxTokens ?? (activeTokenizerConfig.contextLimitTokens || DEFAULT_CONTEXT_LIMIT);
  const baseTools = tools && tools.length > 0 ? countToolsTokens(tools) : 0;
  if (!messages || messages.length === 0) {
    return {
      promptTokens: baseTools,
      completionTokens: 0,
      totalTokens: baseTools,
      maxTokens: effectiveMaxTokens,
      percent: 0,
      userTokens: 0,
      systemTokens: baseTools,
      contextTokens: baseTools
    };
  }

  let systemTokens = baseTools;
  let userTokens = 0;
  let completionTokens = 0;
  let otherTokens = 0;

  for (const msg of messages) {
    const msgTokens = countMessageTokens(msg);
    if (msg.role === 'assistant') {
      completionTokens += msgTokens;
    } else if (msg.role === 'user') {
      userTokens += msgTokens;
    } else if (msg.role === 'system') {
      systemTokens += msgTokens;
    } else {
      otherTokens += msgTokens;
    }
  }

  // Priming tokens for next turn
  systemTokens += 3;

  const promptTokens = systemTokens;
  const contextTokens = systemTokens + userTokens + completionTokens + otherTokens;
  const totalTokens = contextTokens;
  const percent = Math.min(100, Math.round((totalTokens / maxTokens) * 100));

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    maxTokens,
    percent,
    userTokens,
    systemTokens,
    contextTokens
  };
}

/**
 * Human-readable token formatter (e.g. 1.2k, 64k).
 */
export function formatTokens(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1000000) {
    if (num < 10000) return (num / 1000).toFixed(1) + 'k';
    return Math.round(num / 1000) + 'k';
  }
  return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + 'M';
}
