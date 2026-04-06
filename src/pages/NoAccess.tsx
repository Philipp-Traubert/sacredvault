import { motion } from "framer-motion";
import NeuCard from "@/components/NeuCard";
import NeuButton from "@/components/NeuButton";
import { useAuth } from "@/hooks/useAuth";
import { ShieldX, LogOut } from "lucide-react";

const NoAccess = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <NeuCard className="p-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-background neu-raised mb-4">
            <ShieldX className="w-7 h-7 text-muted-foreground animate-pulse-soft" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Access Pending</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Your account doesn't have access yet. An admin will review your request shortly.
          </p>
          <NeuButton variant="ghost" onClick={signOut}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </NeuButton>
        </NeuCard>
      </motion.div>
    </div>
  );
};

export default NoAccess;
