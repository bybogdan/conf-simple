export type SlashCommandId =
  | "text"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bullet-list"
  | "numbered-list"
  | "checklist"
  | "quote"
  | "code-block"
  | "divider"
  | "image"
  | "attachment";

export type SlashCommandDefinition = {
  id: SlashCommandId;
  label: string;
  description: string;
  keywords: string[];
};

export type SlashMatch = {
  query: string;
  range: { from: number; to: number };
};

export const slashCommands: SlashCommandDefinition[] = [
  { id: "text", label: "Text", description: "Plain paragraph", keywords: ["paragraph", "plain"] },
  { id: "heading-1", label: "Heading 1", description: "Large section title", keywords: ["h1", "title"] },
  { id: "heading-2", label: "Heading 2", description: "Medium section heading", keywords: ["h2", "subtitle"] },
  { id: "heading-3", label: "Heading 3", description: "Small section heading", keywords: ["h3"] },
  { id: "bullet-list", label: "Bullet list", description: "Unordered list", keywords: ["bullets", "list"] },
  { id: "numbered-list", label: "Numbered list", description: "Ordered list", keywords: ["numbers", "ordered", "list"] },
  { id: "checklist", label: "Checklist", description: "To-do items", keywords: ["todo", "task", "checkbox"] },
  { id: "quote", label: "Quote", description: "Quoted text", keywords: ["blockquote"] },
  { id: "code-block", label: "Code block", description: "Preformatted code", keywords: ["code", "pre"] },
  { id: "divider", label: "Divider", description: "Horizontal rule", keywords: ["rule", "separator", "line"] },
  { id: "image", label: "Image", description: "Upload a screenshot or image", keywords: ["photo", "picture", "upload"] },
  { id: "attachment", label: "File", description: "Attach a file for download", keywords: ["attachment", "upload", "document"] },
];

export function findSlashMatch(textBeforeCursor: string, textBlockStart: number, cursorPosition: number): SlashMatch | null {
  const match = /(^|\s)\/([a-zA-Z0-9 -]*)$/.exec(textBeforeCursor);
  if (!match) return null;

  const slashOffset = match.index + match[1].length;
  return {
    query: match[2],
    range: { from: textBlockStart + slashOffset, to: cursorPosition },
  };
}

export function filterSlashCommands(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return slashCommands;
  return slashCommands.filter((command) =>
    [command.label, command.description, ...command.keywords]
      .some((value) => {
        const candidate = value.toLowerCase();
        return candidate.startsWith(normalized)
          || candidate.split(/[^a-z0-9]+/).some((word) => word.startsWith(normalized));
      }),
  );
}
