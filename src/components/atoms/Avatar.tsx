import * as AvatarPrimitive from '@rn-primitives/avatar';
import { cn } from '@/lib/utils';
import { TextClassContext } from './Text';

function Avatar({ className, ...props }: AvatarPrimitive.RootProps & { className?: string }) {
  return (
    <AvatarPrimitive.Root
      className={cn('relative items-center justify-center overflow-hidden rounded-full', className)}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.ImageProps & { className?: string }) {
  return <AvatarPrimitive.Image className={cn('h-full w-full', className)} {...props} />;
}

function AvatarFallback({
  className,
  children,
  textClassName,
  ...props
}: AvatarPrimitive.FallbackProps & { className?: string; textClassName?: string }) {
  return (
    <AvatarPrimitive.Fallback
      className={cn('h-full w-full items-center justify-center rounded-full bg-brand', className)}
      {...props}
    >
      <TextClassContext.Provider
        value={cn('text-sm font-bold text-brand-foreground', textClassName)}
      >
        {children}
      </TextClassContext.Provider>
    </AvatarPrimitive.Fallback>
  );
}

export { Avatar, AvatarFallback, AvatarImage };
