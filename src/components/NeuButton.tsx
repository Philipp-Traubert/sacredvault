import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  children: React.ReactNode;
}

const NeuButton = ({ variant = "default", size = "md", className, children, disabled, ...props }: NeuButtonProps) => {
  const sizeClasses = {
    sm: "px-4 py-2 text-sm rounded-xl",
    md: "px-6 py-3 text-sm rounded-xl",
    lg: "px-8 py-4 text-base rounded-2xl",
    icon: "w-10 h-10 rounded-xl flex items-center justify-center",
  };

  const variantClasses = {
    default: "neu-raised-sm bg-background text-foreground hover:neu-raised active:neu-inset-sm",
    primary: "neu-raised-sm bg-primary text-primary-foreground hover:opacity-90 active:neu-inset-sm",
    ghost: "bg-transparent text-foreground hover:bg-secondary",
    danger: "neu-raised-sm bg-destructive text-destructive-foreground hover:opacity-90 active:neu-inset-sm",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      disabled={disabled}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
};

export default NeuButton;
