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
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
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
  conversationId?: string;
  totalTokens: number;
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

export type AgentEvent =
  | { type: 'chunk'; content: string }
  | { type: 'reasoning_chunk'; content: string }
  | { type: 'tool_call_start'; name: string; args: any; callId: string }
  | { type: 'tool_call_end'; name: string; result: string; error?: boolean; callId: string }
  | { type: 'status'; text: string }
  | { type: 'finish'; finishReason: string; totalTokens?: number }
  | { type: 'error'; message: string };
