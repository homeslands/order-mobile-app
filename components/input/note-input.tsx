import { NotepadText } from 'lucide-react-native'
import { View } from 'react-native'

import { Textarea } from '@/components/ui'

export interface NoteInputProps {
  value?: string
  placeholder?: string
  onChange: (text: string) => void
  className?: string
}

export function NoteInput({
  value,
  placeholder,
  onChange,
  className,
}: NoteInputProps) {
  return (
    <View className="flex w-full flex-row items-start gap-2.5">
      <View className="mt-2">
        <NotepadText color="#6b7280" size={20} />
      </View>
      <View className="flex-1">
        <Textarea
          value={value}
          defaultValue={value}
          className={className || 'min-h-[60px] text-sm shadow-none dark:border-gray-700'}
          placeholder={placeholder}
          onChangeText={onChange}
        />
      </View>
    </View>
  )
}

