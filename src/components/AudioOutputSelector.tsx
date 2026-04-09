import { useState, useEffect } from "react";
import { Volume1 } from "lucide-react";

interface AudioOutputSelectorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

const AudioOutputSelector = ({ videoRef }: AudioOutputSelectorProps) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Request permission first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = allDevices.filter((d) => d.kind === "audiooutput");
        setDevices(audioOutputs);
        if (audioOutputs.length > 0 && !selectedDevice) {
          setSelectedDevice(audioOutputs[0].deviceId);
        }
      } catch {
        // setSinkId not supported or no permission
      }
    };

    loadDevices();
    navigator.mediaDevices?.addEventListener("devicechange", loadDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", loadDevices);
    };
  }, []);

  const handleSelect = async (deviceId: string) => {
    setSelectedDevice(deviceId);
    setOpen(false);
    try {
      if (videoRef.current && "setSinkId" in videoRef.current) {
        await (videoRef.current as any).setSinkId(deviceId);
      }
    } catch (error) {
      console.error("Failed to set audio output:", error);
    }
  };

  if (devices.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-xl bg-background/80 neu-raised-sm hover:scale-105 transition-transform"
      >
        <Volume1 className="w-4 h-4 text-foreground" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl bg-background neu-raised p-2 z-50">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
            Audio Output
          </p>
          {devices.map((device) => (
            <button
              key={device.deviceId}
              onClick={() => handleSelect(device.deviceId)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-150 ${
                selectedDevice === device.deviceId
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioOutputSelector;
