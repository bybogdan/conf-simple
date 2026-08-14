import type { Page } from "./types";

export function pagePath(pages: Page[], page: Page) {
  const path = [page];
  const seen = new Set([page.id]);
  let parent = page.parentId ? pages.find((candidate) => candidate.id === page.parentId) : undefined;
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id);
    path.unshift(parent);
    parent = parent.parentId ? pages.find((candidate) => candidate.id === parent!.parentId) : undefined;
  }
  return path;
}

export function descendantIds(pages: Page[], pageId: string) {
  const result = new Set<string>();
  const visit = (parentId: string) => pages.filter((page) => page.parentId === parentId).forEach((page) => {
    if (result.has(page.id)) return;
    result.add(page.id);
    visit(page.id);
  });
  visit(pageId);
  return result;
}

export function sortedChildren(pages: Page[], parentId: string | null) {
  return pages.filter((page) => page.parentId === parentId)
    .sort((left, right) => left.position - right.position || left.createdAt.localeCompare(right.createdAt));
}
