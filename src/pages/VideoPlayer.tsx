import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import PlayerControls from "@/components/PlayerControls";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { readOfflineVideoMeta, isVideoOffline } from "@/lib/opfs";

interface Video {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string;
  duration: string | null;
}

const VideoPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routeVideo = (location.state as { video?: Video } | null)?.video;
  const [video, setVideo] = useState<Video | null>(routeVideo ?? null);
  const [loading, setLoading] = useState(!routeVideo);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      // 1. If we have an offline blob, prefer offline metadata and skip backend
      const offline = await isVideoOffline(id);
      if (offline) {
        const localMeta = await readOfflineVideoMeta(id);
        if (localMeta && !cancelled) {
          setVideo(localMeta);
          setLoading(false);
          return;
        }
      }

      // 2. We already have route state — use it
      if (routeVideo?.id === id) {
        if (!cancelled) setLoading(false);
        return;
      }

      // 3. Fall back to backend
      try {
        const { data, error } = await supabase
          .from("videos")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (cancelled) return;

        if (!error && data) {
          setVideo(data);
        } else {
          setNotFound(true);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id, routeVideo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (notFound || !video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">
            {navigator.onLine
              ? "Video not found"
              : "Offline copy unavailable. Connect to the internet or download this video."}
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-primary underline"
          >
            Back to library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex items-start justify-center overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl w-full mt-[12vh]"
      >
        <PlayerControls video={video} onBack={() => navigate("/")} />
      </motion.div>
    </div>
  );
};

export default VideoPlayer;
