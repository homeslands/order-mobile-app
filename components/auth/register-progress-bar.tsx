import { cn } from '@/lib/utils'
import { View } from 'react-native'

export function RegisterProgressBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View className="mb-6 flex-row gap-1">
      {([1, 2, 3] as const).map((s) => (
        <View
          key={s}
          className={cn(
            'h-1 flex-1 rounded-full',
            s <= step ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700',
          )}
        />
      ))}
    </View>
  )
}
