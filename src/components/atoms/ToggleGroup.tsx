import * as React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import * as ToggleGroupPrimitive from '@rn-primitives/toggle-group';
import { cn } from '@/lib/utils';
import { TextClassContext } from './Text';

const ToggleGroup = ToggleGroupPrimitive.Root;

type ToggleGroupItemProps = Omit<PressableProps, 'children'> &
  Omit<ToggleGroupPrimitive.ItemProps, 'children'> & {
    children?: React.ReactNode;
    className?: string;
    activeClassName?: string;
    inactiveClassName?: string;
    activeTextClassName?: string;
    inactiveTextClassName?: string;
  };

function ToggleGroupItem({
  className,
  activeClassName = 'bg-brand border-brand',
  inactiveClassName = 'bg-transparent border-border',
  activeTextClassName = 'text-brand-foreground',
  inactiveTextClassName = 'text-muted-foreground',
  children,
  value,
  ...props
}: ToggleGroupItemProps) {
  const { value: rootValue } = ToggleGroupPrimitive.useRootContext();
  const active = Array.isArray(rootValue) ? rootValue.includes(value) : rootValue === value;

  return (
    <ToggleGroupPrimitive.Item value={value} asChild {...props}>
      <Pressable
        className={cn(
          'flex-row items-center justify-center rounded-full border px-4 py-2',
          active ? activeClassName : inactiveClassName,
          className,
        )}
      >
        <TextClassContext.Provider
          value={cn('text-sm font-medium', active ? activeTextClassName : inactiveTextClassName)}
        >
          {children}
        </TextClassContext.Provider>
      </Pressable>
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
