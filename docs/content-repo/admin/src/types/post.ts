export interface Post {
  slug: string;
  title: string;
  date: string;         // YYYY-MM-DD
  description: string;
  tags: string[];
  reading_time: number;
  draft: boolean;
  raw_url: string;      // raw.githubusercontent.com URL to the .md file
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostFormValues {
  title: string;
  slug: string;
  date: string;
  description: string;
  tags: string;         // comma-separated string in the form
  draft: boolean;
}
