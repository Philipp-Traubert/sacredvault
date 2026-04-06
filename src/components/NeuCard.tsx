import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";

interface NeuCardProps extends HTMLMotionProps<"div"> {
  variant?: "raised" | "inset" | "flat";
  hover?: boolean;
  children: React.ReactNode;
}

const NeuCard = ({ variant = "raised", hover = false, className, children, ...props }: NeuCardProps) => {
  const variantClasses = {
    raised: "neu-raised",
    inset: "neu-inset",
    flat: "neu-flat",
  };

  return (
    <motion.div
      className={cn(
        "rounded-2xl bg-background p-6",
        variantClasses[variant],
        hover && "transition-all duration-200 hover:scale-[1.02] hover:neu-raised-lg cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default NeuCard;
