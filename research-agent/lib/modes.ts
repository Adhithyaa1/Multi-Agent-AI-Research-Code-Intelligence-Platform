export type AppMode = "chat" | "research" | "code" | "pipeline" | "agent";

export type AppTab = "workspace" | "metrics";

export interface ModeDefinition {
  id: AppMode;
  title: string;
  description: string;
  detail: string;
  icon: string;
}

export const APP_MODES: ModeDefinition[] = [
  {
    id: "chat",
    title: "Chat",
    description: "Talk to your research assistant",
    detail:
      "Stream answers from your local model. Uses the document from your session library when one is loaded.",
    icon: "💬",
  },
  {
    id: "research",
    title: "Research notes",
    description: "Structured analysis of a topic",
    detail:
      "Get concepts, evidence, limitations, and future work — grounded in your session document when available.",
    icon: "📚",
  },
  {
    id: "code",
    title: "Code intelligence",
    description: "Explore GitHub repos and source code",
    detail:
      "Map structure, explain files, find bugs, and ask questions using the repository in your session library.",
    icon: "🧩",
  },
  {
    id: "pipeline",
    title: "Full report",
    description: "Multi-agent research pipeline",
    detail:
      "Planner, researcher, coder, critic, and writer collaborate on a detailed report from your prompt and document.",
    icon: "🔬",
  },
  {
    id: "agent",
    title: "Smart assistant",
    description: "AI that picks the right tools for you",
    detail:
      "Ask one question — the assistant searches your session document and indexed repository automatically.",
    icon: "✨",
  },
];

export function getModeDefinition(id: AppMode): ModeDefinition {
  const mode = APP_MODES.find((item) => item.id === id);
  if (!mode) {
    throw new Error(`Unknown mode: ${id}`);
  }
  return mode;
}
