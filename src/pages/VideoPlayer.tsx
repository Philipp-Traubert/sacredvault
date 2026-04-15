import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import PlayerControls from "@/components/PlayerControls";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { readOfflineVideoMeta } from "@/lib/opfs";

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

  useEffect(() => {
    if (!id) return;

    const fetchVideo = async () => {
      const localVideo = routeVideo?.id === id ? routeVideo : await readOfflineVideoMeta(id);

      if (localVideo) {
        setVideo(localVideo);
        setLoading(false);

        if (!navigator.onLine) {
          return;
        }
      }

      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        setVideo(data);
      } else if (!localVideo) {
        setVideo(null);
      }
      setLoading(false);
    };

    fetchVideo();
  }, [id, routeVideo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Video not found</p>
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
