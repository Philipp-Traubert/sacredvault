import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import NeuCard from "@/components/NeuCard";
import NeuButton from "@/components/NeuButton";
import NeuInput from "@/components/NeuInput";
import { supabase } from "@/integrations/supabase/client";
import { useAccessControl } from "@/hooks/useAccessControl";
import {
  ArrowLeft,
  Check,
  X,
  Trash2,
  Plus,
  Users,
  Mail,
  Film,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Tab = "requests" | "users" | "videos";

interface AccessRequest {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  user_email?: string;
}

interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  video_url: string;
  duration: string;
}

const Admin = () => {
  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<UserRole[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [newVideo, setNewVideo] = useState({ title: "", thumbnail_url: "", video_url: "", duration: "" });
  const [saving, setSaving] = useState(false);

  const { isAdmin } = useAccessControl();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    loadData();
  }, [isAdmin, tab]);

  const loadData = async () => {
    setLoading(true);
    if (tab === "requests") {
      const { data } = await supabase
        .from("access_requests")
        .select("*")
        .order("created_at", { ascending: false });
      setRequests(data || []);
    } else if (tab === "users") {
      const { data } = await supabase
        .from("user_roles")
        .select("*");
      setUsers(data || []);
    } else {
      const { data } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });
      setVideos(data || []);
    }
    setLoading(false);
  };

  const approveRequest = async (request: AccessRequest) => {
    // Create user account via Supabase auth (admin would need to set up the user)
    // For now, update status
    const { error } = await supabase
      .from("access_requests")
      .update({ status: "approved" })
      .eq("id", request.id);

    if (!error) {
      toast({ title: "Request approved" });
      loadData();
    }
  };

  const rejectRequest = async (id: string) => {
    const { error } = await supabase
      .from("access_requests")
      .update({ status: "rejected" })
      .eq("id", id);

    if (!error) {
      toast({ title: "Request rejected" });
      loadData();
    }
  };

  const revokeAccess = async (id: string) => {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", id);

    if (!error) {
      toast({ title: "Access revoked" });
      loadData();
    }
  };

  const addVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("videos").insert(newVideo);
    if (!error) {
      toast({ title: "Video added" });
      setNewVideo({ title: "", thumbnail_url: "", video_url: "", duration: "" });
      setShowAddVideo(false);
      loadData();
    } else {
      toast({ title: "Failed to add video", description: error.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const deleteVideo = async (id: string) => {
    const { error } = await supabase.from("videos").delete().eq("id", id);
    if (!error) {
      toast({ title: "Video deleted" });
      loadData();
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "requests", label: "Requests", icon: <Mail className="w-4 h-4" /> },
    { key: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { key: "videos", label: "Videos", icon: <Film className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm"
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <NeuButton size="icon" variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </NeuButton>
          <h1 className="text-lg font-semibold text-foreground">Admin Panel</h1>
        </div>
      </motion.header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 rounded-xl bg-background neu-inset-sm w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                tab === t.key
                  ? "bg-background neu-raised-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* Requests Tab */}
            {tab === "requests" && (
              <>
                {requests.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No access requests</p>
                ) : (
                  requests.map((req) => (
                    <NeuCard key={req.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{req.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()} · {req.status}
                        </p>
                      </div>
                      {req.status === "pending" && (
                        <div className="flex gap-2">
                          <NeuButton size="sm" variant="primary" onClick={() => approveRequest(req)}>
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </NeuButton>
                          <NeuButton size="sm" variant="danger" onClick={() => rejectRequest(req.id)}>
                            <X className="w-3.5 h-3.5" />
                          </NeuButton>
                        </div>
                      )}
                    </NeuCard>
                  ))
                )}
              </>
            )}

            {/* Users Tab */}
            {tab === "users" && (
              <>
                {users.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No users</p>
                ) : (
                  users.map((u) => (
                    <NeuCard key={u.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.user_id}</p>
                        <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                      </div>
                      {u.role !== "admin" && (
                        <NeuButton size="sm" variant="danger" onClick={() => revokeAccess(u.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                          Revoke
                        </NeuButton>
                      )}
                    </NeuCard>
                  ))
                )}
              </>
            )}

            {/* Videos Tab */}
            {tab === "videos" && (
              <>
                <div className="flex justify-end mb-4">
                  <NeuButton size="sm" variant="primary" onClick={() => setShowAddVideo(!showAddVideo)}>
                    <Plus className="w-4 h-4" />
                    Add Video
                  </NeuButton>
                </div>

                {showAddVideo && (
                  <NeuCard className="mb-4">
                    <form onSubmit={addVideo} className="space-y-3">
                      <NeuInput
                        label="Title"
                        value={newVideo.title}
                        onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })}
                        required
                      />
                      <NeuInput
                        label="Video URL"
                        value={newVideo.video_url}
                        onChange={(e) => setNewVideo({ ...newVideo, video_url: e.target.value })}
                        placeholder="https://..."
                        required
                      />
                      <NeuInput
                        label="Thumbnail URL"
                        value={newVideo.thumbnail_url}
                        onChange={(e) => setNewVideo({ ...newVideo, thumbnail_url: e.target.value })}
                        placeholder="https://..."
                      />
                      <NeuInput
                        label="Duration"
                        value={newVideo.duration}
                        onChange={(e) => setNewVideo({ ...newVideo, duration: e.target.value })}
                        placeholder="12:34"
                      />
                      <div className="flex gap-2 pt-2">
                        <NeuButton type="submit" variant="primary" size="sm" disabled={saving}>
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                        </NeuButton>
                        <NeuButton size="sm" variant="ghost" onClick={() => setShowAddVideo(false)}>
                          Cancel
                        </NeuButton>
                      </div>
                    </form>
                  </NeuCard>
                )}

                {videos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No videos added yet</p>
                ) : (
                  videos.map((v) => (
                    <NeuCard key={v.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        {v.thumbnail_url && (
                          <img
                            src={v.thumbnail_url}
                            alt={v.title}
                            className="w-16 h-10 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">{v.title}</p>
                          <p className="text-xs text-muted-foreground">{v.duration}</p>
                        </div>
                      </div>
                      <NeuButton size="sm" variant="danger" onClick={() => deleteVideo(v.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </NeuButton>
                    </NeuCard>
                  ))
                )}
              </>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Admin;
