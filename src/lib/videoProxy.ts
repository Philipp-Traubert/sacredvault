import { supabase } from "@/integrations/supabase/client";

/**
 * Build a proxied video URL that routes through our edge function,
 * bypassing CORS restrictions from hosts like Wix.
 */
export async function getProxiedVideoUrl(videoUrl: string, forDownload = false): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return videoUrl; // fallback

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const params = new URLSearchParams({ url: videoUrl });
  if (forDownload) params.set("download", "true");
  return `${supabaseUrl}/functions/v1/video-proxy?${params.toString()}`;
}

/**
 * Get the auth token for use with proxied video fetch requests.
 */
export async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
