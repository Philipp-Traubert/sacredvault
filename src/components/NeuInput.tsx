import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface NeuInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const NeuInput = forwardRef<HTMLInputElement, NeuInputProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-muted-foreground pl-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-3 rounded-xl bg-background neu-inset-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-200 text-sm",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

NeuInput.displayName = "NeuInput";

export default NeuInput;
