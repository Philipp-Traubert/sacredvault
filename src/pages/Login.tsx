import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NeuCard from "@/components/NeuCard";
import NeuButton from "@/components/NeuButton";
import NeuInput from "@/components/NeuInput";
import { useAuth } from "@/hooks/useAuth";
import { Lock, Mail, UserPlus, LogIn, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Tab = "login" | "request";

const Login = () => {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const { signIn, requestAccess } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestAccess(email);
      setRequested(true);
      toast({
        title: "Request sent",
        description: "Your access request has been submitted for review.",
      });
    } catch (error: any) {
      toast({
        title: "Request failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background neu-raised mb-4"
          >
            <Lock className="w-7 h-7 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-semibold text-foreground">Video Vault</h1>
          <p className="text-sm text-muted-foreground mt-1">Encrypted offline video player</p>
        </div>

        <NeuCard className="p-8">
          {/* Tab Toggle */}
          <div className="flex gap-2 mb-6 p-1 rounded-xl bg-background neu-inset-sm">
            {(["login", "request"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setRequested(false); }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  tab === t
                    ? "bg-background neu-raised-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "login" ? "Sign In" : "Request Access"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "login" ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <NeuInput
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <NeuInput
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <NeuButton
                  type="submit"
                  variant="primary"
                  className="w-full mt-2"
                  disabled={loading}
                >
                  <LogIn className="w-4 h-4" />
                  {loading ? "Signing in..." : "Sign In"}
                </NeuButton>
              </motion.form>
            ) : (
              <motion.div
                key="request"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {requested ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-background neu-raised mb-4">
                      <Clock className="w-6 h-6 text-primary animate-pulse-soft" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">Request Submitted</h3>
                    <p className="text-sm text-muted-foreground">
                      Your request is being reviewed. You'll receive an email once approved.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleRequestAccess} className="space-y-4">
                    <NeuInput
                      label="Email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Submit your email to request access. An admin will review your request.
                    </p>
                    <NeuButton
                      type="submit"
                      variant="primary"
                      className="w-full mt-2"
                      disabled={loading}
                    >
                      <UserPlus className="w-4 h-4" />
                      {loading ? "Submitting..." : "Request Access"}
                    </NeuButton>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </NeuCard>
      </motion.div>
    </div>
  );
};

export default Login;
