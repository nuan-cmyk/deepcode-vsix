import * as fs from 'fs';
import * as path from 'path';
import { ChatMessage } from './types';
import { DeepSeekClient } from '../client/deepseekClient';
import { countTokens, getTokenizerConfig } from './tokenizer';

export interface CompactResult {
  summary: string;
  originalTokens: number;
  compactedTokens: number;
  compactedMessage: ChatMessage;
}

export const COMPACT_SYSTEM_PROMPT = 
`You are the Context Compaction Engine for an autonomous coding agent.
Your mission is to distill the preceding conversation into a dense, precise, and actionable state summary.
The downstream model must be able to continue executing the task without any loss of context.

Output your summary in this exact format:

=== COMPACTED AGENT CONTEXT ===
1. PRIMARY OBJECTIVE:
- Original user goal and current milestone.

2. ARCHITECTURE & CONSTRAINTS:
- Technology stack, frameworks, coding patterns, key rules established.

3. FILES & WORKSPACE STATE:
- Files created or modified (exact paths and purpose).
- Known errors fixed or tests passed.

4. CURRENT IMPLEMENTATION PLAN:
- Status of each task ([x] completed, [-] in progress, [ ] pending).

5. IMMEDIATE NEXT STEP:
- Exact instruction on what the agent was doing and what must be executed next.
=== END CONTEXT ===

RULES:
- Be dense, factual, and strictly technical.
- Preserve all exact file paths, function names, and plan items.
- Zero conversational fluff or introductory text.`;

export class ContextCompactor {
  public static get COMPACT_THRESHOLD(): number {
    return getTokenizerConfig().compactThresholdTokens || 80000;
  }
  public static readonly TARGET_SUMMARY_TOKENS = 3000;

  /**
   * Generates a dense compaction summary of the conversation using a standalone request.
   * Crucial: runs WITHOUT conversationId to avoid bloating proxy state.
   */
  public static async compact(
    client: DeepSeekClient,
    messages: ChatMessage[],
    model: string = 'deepseek-chat',
    signal?: AbortSignal
  ): Promise<CompactResult> {
    // Filter out internal system framing and collect actual history
    const conversationToSummarize = messages.filter(m => !m.isInternal && m.content);

    let promptText = COMPACT_SYSTEM_PROMPT;
    try {
      const filePath = path.join(__dirname, '..', 'prompts', 'modes', 'compact_summary.md');
      if (fs.existsSync(filePath)) {
        promptText = fs.readFileSync(filePath, 'utf-8').trim();
      }
    } catch {}

    const summarizationMessages: ChatMessage[] = [
      {
        id: `sys_compact_${Date.now()}`,
        role: 'system',
        content: promptText,
        timestamp: Date.now()
      },
      ...conversationToSummarize,
      {
        id: `user_compact_trigger_${Date.now()}`,
        role: 'user',
        content: 'Generate the structured === COMPACTED AGENT CONTEXT === for the above conversation now.',
        timestamp: Date.now()
      }
    ];

    let summary = '';

    await client.streamChatCompletion(
      summarizationMessages,
      {
        model,
        thinking: false, // Compaction is fast extraction, thinking can be disabled for speed
        search: false,
        deadMode: false,
        agentMode: false,
        conversationId: undefined // Never bind to current conversation session on proxy
      },
      {
        onChunk: (delta) => {
          summary += delta;
        },
        onReasoningChunk: () => {},
        onError: (err) => {
          throw err;
        },
        onComplete: () => {}
      },
      signal
    );

    const trimmedSummary = summary.trim();
    const compactedTokens = countTokens(trimmedSummary);
    let originalTokens = 0;
    for (const m of conversationToSummarize) {
      originalTokens += countTokens(m.content || '');
    }

    const compactedMessage: ChatMessage = {
      id: `compacted_${Date.now()}`,
      role: 'system',
      content: `[COMPACTED CONTEXT]\n${trimmedSummary}\n[/COMPACTED CONTEXT]`,
      timestamp: Date.now()
    };

    return {
      summary: trimmedSummary,
      originalTokens,
      compactedTokens,
      compactedMessage
    };
  }
}
