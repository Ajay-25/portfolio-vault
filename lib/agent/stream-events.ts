export type AgentToolCall = {
  name:   string;
  result: string;
};

export type AgentStreamEvent =
  | { type: "status"; message: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_end"; name: string; result: string }
  | {
      type:      "done";
      chatId:    string;
      reply:     string;
      toolCalls: AgentToolCall[];
      refreshed: boolean;
      model:     string;
      cancelled?: boolean;
    }
  | { type: "error"; message: string };

export function encodeSseEvent(event: AgentStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
