import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ComponentProps<"button"> & {
  asChild?: boolean;
};

export function Button({ asChild = false, className, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      data-slot="button"
      className={cn(
        "inline-flex h-10 items-center justify-center border border-foreground bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}
