/** Placeholder — test transition hãm phanh. React.memo giảm re-render khi back. */
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { ScreenContainer } from '@/components/layout'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { TouchableOpacity } from 'react-native'
import { colors } from '@/constants'

function ProfileHistoryPlaceholder() {
  const router = useRouter()
  const { t } = useTranslation('profile')

  return (
    <ScreenContainer edges={['top']} className="flex-1">
      <View style={{ padding: 24 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}
        >
          <ChevronLeft size={24} color={colors.gray[700]} />
          <Text style={{ marginLeft: 4, fontSize: 16 }}>{t('backToMenu')}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '600' }}>{t('orderHistory.title')}</Text>
        <Text style={{ marginTop: 8, color: colors.gray[500] }}>Trang rỗng — test transition</Text>
      </View>
    </ScreenContainer>
  )
}

export default React.memo(ProfileHistoryPlaceholder)
