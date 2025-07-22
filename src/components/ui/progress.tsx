
import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  segments?: Array<{
    value: number;
    className?: string;
  }>;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, segments, ...props }, ref) => {
  // Se segments está presente, usamos o modo de múltiplos segmentos
  const useSegments = Array.isArray(segments) && segments.length > 0;
  
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      {useSegments ? (
        // Renderiza múltiplos segmentos de progresso
        <div className="flex h-full w-full">
          {segments.map((segment, index) => (
            <div
              key={index}
              className={cn("h-full transition-all", segment.className)}
              style={{ width: `${segment.value}%` }}
            />
          ))}
        </div>
      ) : (
        // Renderiza o indicador de progresso padrão
        <ProgressPrimitive.Indicator
          className="h-full w-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      )}
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
