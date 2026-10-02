export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  output: string;
  error?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoningContent?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
  filePath?: string;
  added?: number;
  removed?: number;
  isInternal?: boolean;
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
}

export type SandboxMode = 'bypass' | 'local' | 'helper' | 'ask';

export interface CommandPermissionRequest {
  requestId: string;
  command: string;
  cwd: string;
}

export interface DefaultChatSettings {
  deadMode?: boolean;
  agentMode?: boolean;
  thinking?: boolean;
  search?: boolean;
  planMode?: boolean;
  sandboxMode?: SandboxMode;
  debugMode?: boolean;
  pacingDelayMs?: number;
  requestDelayMs?: number;
  connectTimeoutSec?: number;
  readTimeoutSec?: number;
  thinkingTimeoutSec?: number;
  commandTimeoutSec?: number;
  maxRetries?: number;
  contextLimitTokens?: number;
  compactThresholdTokens?: number;
  cyrillicCharsPerToken?: number;
  latinCharsPerToken?: number;
}

export interface ChatSession {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  model: string;
  autoMode: boolean;
  deadMode: boolean;
  agentMode: boolean;
  thinking: boolean;
  search: boolean;
  planMode?: boolean;
  planConfirmed?: boolean;
  planExplicitlyDemanded?: boolean;
  sandboxMode?: SandboxMode;
  debugMode?: boolean;
  allowedCommands?: string[];
  conversationId?: string;
  totalTokens: number;
  promptTokens?: number;
  completionTokens?: number;
  userTokens?: number;
  lastCompactTimestamp?: number;
  compactedSummary?: string;
  compactedAtMessageId?: string;
  rootPrompt?: string;
  compactedBlocks?: string[];
  rawTokensProcessedTotal?: number;
  cumulativeTokensSpent?: number;
  epochSummaries?: string[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface AgentActivityStep {
  type: 'create' | 'edit' | 'command' | 'search' | 'analyze' | 'explore' | 'diagnostics' | 'unstuck' | 'compact' | 'compact_done';
  title?: string;
  path?: string;
  added?: number;
  removed?: number;
  command?: string;
  cwd?: string;
  output?: string;
  exitCode?: number;
  query?: string;
  resultCount?: number;
  startLine?: number;
  endLine?: number;
  detail?: string;
  status?: 'running' | 'completed' | 'error';
  id?: string;
  attempt?: number;
  maxAttempts?: number;
  startTime?: number;
  code?: string;
  reason?: string;
}

export type AgentEvent =
  | { type: 'chunk'; content: string }
  | { type: 'reasoning_chunk'; content: string }
  | { type: 'tool_call_start'; name: string; args: any; callId: string }
  | { type: 'tool_call_end'; name: string; result: string; error?: boolean; callId: string }
  | { type: 'status'; text: string }
  | { type: 'finish'; finishReason: string; totalTokens?: number }
  | { type: 'token_usage'; promptTokens: number; completionTokens: number; totalTokens: number; maxTokens: number; percent: number }
  | { type: 'error'; message: string };
