import { Star } from 'lucide-react-native'
import { View } from 'react-native'

interface RatingProps {
  rating: number | null
}

export default function Rating({ rating }: RatingProps) {
  const maxStars: number = 5

  return (
    <View className="flex items-center gap-1">
      {Array.from({ length: maxStars }, (_, index) => (
        <View
          key={index}
        >
          <Star size={20} color={index < (rating || 0) ? 'primary' : 'gray'} />
        </View>
      ))}
    </View>
  )
}
