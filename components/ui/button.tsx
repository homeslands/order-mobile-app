import { PressableWithFeedback } from '@/components/navigation/pressable-with-feedback'
import { cn } from '@/utils/cn'
import { colors } from '@/constants'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { ActivityIndicator, Text } from 'react-native'

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-full',
  {
    variants: {
      variant: {
        default: 'bg-black',
        primary: 'bg-primary',
        secondary: 'border border-border bg-transparent',
        outline: 'border border-zinc-300 bg-transparent',
        destructive: 'bg-red-600',
        ghost: 'bg-transparent',
      },
      size: {
        sm: 'h-9 px-3',
        md: 'h-11 px-5',
        lg: 'h-14 px-8',
        icon: 'h-10 w-10 p-0',
      },
      disabled: {
        true: 'opacity-50',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

const textVariants = cva('font-medium', {
  variants: {
    variant: {
      default: 'text-white',
      primary: 'text-primary-foreground',
      secondary: 'text-foreground',
      outline: 'text-black',
      destructive: 'text-white',
      ghost: 'text-gray-900 dark:text-gray-50',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      icon: 'text-base',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})

export interface ButtonProps
  extends
    Omit<
      React.ComponentPropsWithoutRef<typeof PressableWithFeedback>,
      'children' | 'disabled'
    >,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  disabled?: boolean
  children?: React.ReactNode
}

export const Button = React.forwardRef<
  React.ElementRef<typeof PressableWithFeedback>,
  ButtonProps
>((props, ref) => {
  const { className, variant, size, loading, disabled, children, onPress, ...rest } =
    props

  const isDisabled = disabled || loading

  const content = loading ? (
    <ActivityIndicator
      color={
        variant === 'secondary' ? colors.mutedForeground.light :
        variant === 'ghost' ? colors.gray[900] :
        variant === 'primary' ? colors.white.light :
        colors.white.light
      }
    />
  ) : typeof children === 'function' ? (
    (children as (props: { pressed: boolean }) => React.ReactNode)({
      pressed: false,
    })
  ) : Array.isArray(children) ? (
    <>
      {children.map((child: React.ReactNode, index: number) => {
        if (React.isValidElement(child)) {
          return <React.Fragment key={index}>{child}</React.Fragment>
        }
        if (typeof child === 'string' || typeof child === 'number') {
          return (
            <Text key={index} className={cn(textVariants({ variant, size }))}>
              {child}
            </Text>
          )
        }
        return null
      })}
    </>
  ) : React.isValidElement(children) ? (
    children
  ) : (
    <Text className={cn(textVariants({ variant, size }))}>
      {children}
    </Text>
  )

  return (
    <PressableWithFeedback
      ref={ref}
      disabled={isDisabled}
      onPress={onPress}
      className={cn(
        buttonVariants({ variant, size, disabled: isDisabled }),
        className,
      )}
      {...rest}
    >
      {content}
    </PressableWithFeedback>
  )
})

Button.displayName = 'Button'
