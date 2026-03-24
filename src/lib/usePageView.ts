import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function usePageView(slug: string): { count: number | null } {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    // No-op if Supabase isn't configured or slug is empty
    if (!supabase || !slug) return;

    const client = supabase; // narrowed reference for use inside async fn
    const sessionKey = `viewed:${slug}`;
    let mounted = true;

    async function trackView() {
      try {
        // Increment once per browser session per post
        if (!sessionStorage.getItem(sessionKey)) {
          const { error } = await client.rpc('increment_view', { post_slug: slug });
          if (!error) sessionStorage.setItem(sessionKey, '1');
        }

        // Fetch current count from posts table
        const { data } = await client
          .from('posts')
          .select('view_count')
          .eq('slug', slug)
          .single();

        if (mounted && data) {
          setCount((data as { view_count: number }).view_count);
        }
      } catch {
        // View count is non-critical — fail silently
      }
    }

    void trackView();

    return () => {
      mounted = false;
    };
  }, [slug]);

  return { count };
}
