import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import AudioOutputSelector from "./AudioOutputSelector";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Trash2 } from "lucide-react";
import { useOfflineVideo } from "@/hooks/useOfflineVideo";
import { getProxiedVideoUrl, getAuthToken } from "@/lib/videoProxy";

interface PlayerControlsProps {
  video: {
    id: string;
    title: string;
    video_url: string;
  };
  onBack: () => void;
}

const PlayerControls = ({ video, onBack }: PlayerControlsProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [offline, setOffline] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [loadError, setLoadError] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const objectUrlRef = useRef<string | null>(null);

  const { downloadVideo, getOfflineVideoBlob, removeOfflineVideo, isVideoOffline, downloadProgress, downloading } =
    useOfflineVideo();

  const isDownloading = downloading[video.id] || false;
  const progress = downloadProgress[video.id] || 0;

  // Single source rule: pick once on mount. Offline copy wins. No swapping.
  const loadSource = useCallback(async () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setLoadError(false);

    const blob = await getOfflineVideoBlob(video.id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setVideoSrc(url);
      setOffline(true);
      return;
    }

    setOffline(false);
    if (!navigator.onLine) {
      // No offline copy and no network — show clear error
      setVideoSrc("");
      setLoadError(true);
      return;
    }

    // Online: route through proxy
    try {
      const proxied = await getProxiedVideoUrl(video.video_url, false);
      setVideoSrc(proxied);
    } catch {
      setVideoSrc(video.video_url);
    }
  }, [getOfflineVideoBlob, video.id, video.video_url]);

  useEffect(() => {
    loadSource();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch((e) => console.warn("Play failed:", e));
    } else {
      v.pause();
    }
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };

    const videoElement = videoRef.current;
    const onWebkitBeginFullscreen = () => setFullscreen(true);
    const onWebkitEndFullscreen = () => setFullscreen(false);

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    videoElement?.addEventListener("webkitbeginfullscreen", onWebkitBeginFullscreen as EventListener);
    videoElement?.addEventListener("webkitendfullscreen", onWebkitEndFullscreen as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      videoElement?.removeEventListener("webkitbeginfullscreen", onWebkitBeginFullscreen as EventListener);
      videoElement?.removeEventListener("webkitendfullscreen", onWebkitEndFullscreen as EventListener);
    };
  }, []);

  const toggleFullscreen = async () => {
    const vid = videoRef.current;
    if (!vid) return;

    if (typeof (vid as any).webkitEnterFullscreen === "function" && !fullscreen) {
      try {
        (vid as any).webkitEnterFullscreen();
        setFullscreen(true);
        return;
      } catch { /* fall through */ }
    }

    if (!fullscreen) {
      try {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any)?.webkitRequestFullscreen) {
          (containerRef.current as any).webkitRequestFullscreen();
        }
        try {
          await (screen.orientation as any).lock("landscape");
        } catch { /* not supported */ }
        setFullscreen(true);
      } catch (e) {
        console.warn("Fullscreen failed:", e);
      }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
        try {
          screen.orientation.unlock();
        } catch { /* ignore */ }
        setFullscreen(false);
      } catch { /* ignore */ }
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const proxyUrl = await getProxiedVideoUrl(video.video_url, true);
      const token = await getAuthToken();
      await downloadVideo(video.id, proxyUrl, token || undefined, {
        id: video.id,
        title: video.title,
        thumbnail_url: null,
        video_url: video.video_url,
        duration: null,
      });
      // Reload from offline blob now that it's saved
      await loadSource();
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleRemoveOffline = async () => {
    await removeOfflineVideo(video.id);
    await loadSource();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-foreground/5 rounded-2xl overflow-hidden neu-raised"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: showControls ? 1 : 0 }}
        className="absolute top-4 left-4 z-20 p-2 rounded-xl backdrop-blur-md bg-white/10 border border-white/20 shadow-lg transition-opacity hover:bg-white/20"
        onClick={onBack}
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </motion.button>

      {/* Video or error */}
      {loadError ? (
        <div className="w-full aspect-video bg-foreground/10 flex items-center justify-center p-4">
          <p className="text-sm text-center text-muted-foreground">
            Offline copy unavailable. Connect to the internet or download this video first.
          </p>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full aspect-video bg-foreground/10 cursor-pointer"
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            // If the video element fails (e.g. lost network mid-play with no offline copy)
            if (!offline) setLoadError(true);
          }}
          playsInline
        />
      )}

      {/* Controls overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showControls ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-foreground/30 to-transparent"
      >
        {/* Seek bar */}
        <div className="mb-3">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 rounded-full appearance-none cursor-pointer bg-background/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:neu-raised-sm"
          />
          <div className="flex justify-between text-xs text-primary-foreground/70 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="p-2 rounded-xl backdrop-blur-md bg-white/10 border border-white/20 shadow-lg hover:bg-white/20 hover:scale-105 transition-all"
          >
            {playing ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" />
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2 group">
            <button onClick={toggleMute} className="text-primary-foreground/80 hover:text-primary-foreground">
              {muted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={handleVolume}
              className="w-20 h-1 rounded-full appearance-none cursor-pointer bg-background/30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-foreground"
            />
          </div>

          {/* Title */}
          <span className="text-sm text-primary-foreground/80 truncate flex-1">
            {video.title}
          </span>

          {/* Audio Output */}
          <AudioOutputSelector videoRef={videoRef} />

          {/* Offline toggle */}
          {offline ? (
            <button
              onClick={handleRemoveOffline}
              className="flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-md bg-white/10 border border-white/20 shadow-lg text-xs text-white hover:bg-red-500/30 hover:border-red-400/40 transition-all"
              title="Remove offline copy"
            >
              <Trash2 className="w-3 h-3" />
              Remove Offline
            </button>
          ) : (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="p-2 rounded-xl backdrop-blur-md bg-white/10 border border-white/20 shadow-lg hover:bg-white/20 hover:scale-105 transition-all disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-white" />
              )}
            </button>
          )}

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl backdrop-blur-md bg-white/10 border border-white/20 shadow-lg hover:bg-white/20 hover:scale-105 transition-all"
          >
            {fullscreen ? (
              <Minimize className="w-4 h-4 text-white" />
            ) : (
              <Maximize className="w-4 h-4 text-white" />
            )}
          </button>
        </div>

        {/* Download progress */}
        {isDownloading && (
          <div className="mt-2">
            <div className="h-1 rounded-full bg-background/20 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PlayerControls;
