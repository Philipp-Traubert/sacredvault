import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // Get video URL from query param
    const url = new URL(req.url);
    const videoUrl = url.searchParams.get("url");
    if (!videoUrl) {
      return new Response("Missing url parameter", { status: 400, headers: corsHeaders });
    }

    // Forward range header for seeking support
    const fetchHeaders: Record<string, string> = {};
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const response = await fetch(videoUrl, { headers: fetchHeaders });

    if (!response.ok && response.status !== 206) {
      return new Response(`Upstream error: ${response.status}`, {
        status: response.status,
        headers: corsHeaders,
      });
    }

    // Build response headers
    const responseHeaders = new Headers(corsHeaders);
    const contentType = response.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    const contentLength = response.headers.get("content-length");
    if (contentLength) responseHeaders.set("content-length", contentLength);
    const contentRange = response.headers.get("content-range");
    if (contentRange) responseHeaders.set("content-range", contentRange);
    const acceptRanges = response.headers.get("accept-ranges");
    if (acceptRanges) responseHeaders.set("accept-ranges", acceptRanges);

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Video proxy error:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
