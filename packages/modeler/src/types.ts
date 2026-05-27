/** Minimal tool context — no external agent dependency */
export interface ToolContext {
  agentId: string;
  variables: Map<string, unknown>;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, context: ToolContext): Promise<string>;
}
