import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import NeuButton from "./NeuButton";
import { Play, Download, Check, Loader2, Trash2 } from "lucide-react";
import { useOfflineVideo } from "@/hooks/useOfflineVideo";
import { getProxiedVideoUrl, getAuthToken } from "@/lib/videoProxy";

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    thumbnail_url: string;
    video_url: string;
    duration: string;
  };
  onPlay: (video: any) => void;
}

const VideoCard = ({ video, onPlay }: VideoCardProps) => {
  const { downloadVideo, removeOfflineVideo, isVideoOffline, downloadProgress, downloading } =
    useOfflineVideo();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    isVideoOffline(video.id).then(setOffline);
  }, [video.id, downloadProgress[video.id]]);

  const progress = downloadProgress[video.id] || 0;
  const isDownloading = downloading[video.id] || false;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const proxyUrl = await getProxiedVideoUrl(video.video_url);
      const token = await getAuthToken();
      await downloadVideo(video.id, proxyUrl, token || undefined);
      setOffline(true);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await removeOfflineVideo(video.id);
    setOffline(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl bg-background neu-raised overflow-hidden cursor-pointer group"
      onClick={() => onPlay(video)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-secondary overflow-hidden">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-10 h-10 text-muted-foreground" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-all duration-200 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1, opacity: 1 }}
            className="w-14 h-14 rounded-full bg-background/80 neu-raised-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <Play className="w-6 h-6 text-primary ml-1" />
          </motion.div>
        </div>

        {/* Offline badge */}
        {offline && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/90 neu-raised-sm text-xs font-medium text-primary flex items-center gap-1">
            <Check className="w-3 h-3" />
            Offline
          </div>
        )}

        {/* Duration */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-foreground/70 text-primary-foreground text-xs font-medium">
          {video.duration}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-foreground text-sm truncate mb-3">
          {video.title}
        </h3>

        {/* Download progress */}
        {isDownloading && (
          <div className="mb-3">
            <div className="h-1.5 rounded-full bg-background neu-inset-sm overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 animate-shimmer"
                style={{
                  width: `${progress}%`,
                  backgroundImage: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7), hsl(var(--primary)))`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{progress}% downloaded</p>
          </div>
        )}

        <div className="flex gap-2">
          {offline ? (
            <NeuButton
              size="sm"
              variant="ghost"
              onClick={handleRemove}
              className="text-xs text-muted-foreground"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </NeuButton>
          ) : (
            <NeuButton
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="text-xs"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {isDownloading ? "Downloading..." : "Save Offline"}
            </NeuButton>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default VideoCard;
