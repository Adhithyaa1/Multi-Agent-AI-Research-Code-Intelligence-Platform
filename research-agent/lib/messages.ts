import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";

export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function getToolInvocations(message: UIMessage) {
  return message.parts.filter((part) => isToolUIPart(part));
}

export function formatToolName(raw: string): string {
  return raw
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}
