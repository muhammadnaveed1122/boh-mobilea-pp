import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import * as TabsPrimitive from '@rn-primitives/tabs';
import { cn } from '@/lib/utils';
import { TextClassContext } from './Text';

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: TabsPrimitive.ListProps & { className?: string }) {
  return (
    <TabsPrimitive.List
      className={cn('flex-row rounded-full bg-muted p-1', className)}
      {...props}
    />
  );
}

type TabsTriggerProps = Omit<PressableProps, 'children'> & {
  value: string;
  children?: ReactNode;
  className?: string;
  activeClassName?: string;
  activeTextClassName?: string;
  inactiveTextClassName?: string;
};

function TabsTrigger({
  className,
  value,
  children,
  activeClassName = 'bg-brand',
  activeTextClassName = 'text-brand-foreground',
  inactiveTextClassName = 'text-muted-foreground',
  ...props
}: TabsTriggerProps) {
  const { value: rootValue, onValueChange } = TabsPrimitive.useRootContext();
  const active = rootValue === value;

  return (
    <Pressable
      onPress={() => onValueChange(value)}
      className={cn(
        'flex-1 items-center justify-center rounded-full py-2',
        active && activeClassName,
        className,
      )}
      {...props}
    >
      <TextClassContext.Provider
        value={cn('text-sm font-semibold', active ? activeTextClassName : inactiveTextClassName)}
      >
        {children}
      </TextClassContext.Provider>
    </Pressable>
  );
}

function TabsContent({
  className,
  value,
  ...props
}: TabsPrimitive.ContentProps & { className?: string }) {
  return <TabsPrimitive.Content value={value} className={cn(className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
