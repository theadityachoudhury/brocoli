export interface PostMeta {
  slug: string;
  title: string;
  date: string;         // ISO date string e.g. "2025-03-24"
  description: string;
  tags: string[];
  readingTime: number;  // minutes, computed at build time
  draft: boolean;
}

export interface Post extends PostMeta {
  content: string;      // raw markdown, frontmatter stripped
}
