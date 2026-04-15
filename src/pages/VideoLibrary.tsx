import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import VideoCard from "@/components/VideoCard";
import NeuButton from "@/components/NeuButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAccessControl } from "@/hooks/useAccessControl";
import { LogOut, Shield, Film } from "lucide-react";

interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  video_url: string;
  duration: string;
}

const VideoLibrary = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const { signOut, user } = useAuth();
  const { isAdmin } = useAccessControl();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVideos = async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setVideos(data);
      }
      setLoading(false);
    };

    fetchVideos();
  }, []);

  const handlePlay = (video: Video) => {
    navigate(`/player/${video.id}`, { state: { video } });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm"
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-background neu-raised-sm flex items-center justify-center">
              <Film className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Video Vault</h1>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <NeuButton size="sm" onClick={() => navigate("/admin")}>
                <Shield className="w-4 h-4" />
                Admin
              </NeuButton>
            )}
            <NeuButton size="sm" variant="ghost" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </NeuButton>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-background neu-raised animate-pulse-soft"
              >
                <div className="aspect-video bg-secondary rounded-t-2xl" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-8 bg-secondary rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background neu-raised mb-4">
              <Film className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium text-foreground mb-1">No videos yet</h2>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Add videos from the admin panel." : "Videos will appear here once added."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video, i) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <VideoCard video={video} onPlay={handlePlay} />
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default VideoLibrary;
