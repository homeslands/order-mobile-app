/**
 * Order-level note input — displayed at end of cart list.
 * Memo'd + debounced to avoid re-renders on every keystroke.
 */
import { colors } from '@/constants'
import { cartActions } from '@/stores/cart.store'
import { useOrderFlowStore } from '@/stores'
import { NotebookText } from 'lucide-react-native'
import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, TextInput, View } from 'react-native'

const DEBOUNCE_MS = 400

export const CartOrderNote = memo(function CartOrderNote({
  isDark,
}: {
  isDark: boolean
}) {
  const { t } = useTranslation('menu')
  const initialNote = useOrderFlowStore(
    (s) => s.orderingData?.description ?? '',
  )
  const [localNote, setLocalNote] = useState(initialNote)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback((text: string) => {
    setLocalNote(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      cartActions.setDescription(text)
      debounceRef.current = null
    }, DEBOUNCE_MS)
  }, [])

  // Flush pending write + cleanup timer on unmount — prevents memory leak
  // and stale-closure write after component is gone.
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [])

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          { backgroundColor: isDark ? colors.gray[800] : colors.white.light },
        ]}
      >
        <View style={styles.titleRow}>
          <NotebookText
            size={14}
            color={isDark ? colors.gray[400] : colors.gray[500]}
          />
          <Text
            style={[
              styles.title,
              { color: isDark ? colors.gray[300] : colors.gray[600] },
            ]}
          >
            {t('order.orderNote')}
          </Text>
        </View>
        <TextInput
          value={localNote}
          onChangeText={handleChange}
          placeholder={t('cart.orderNotePlaceholder')}
          placeholderTextColor={isDark ? colors.gray[600] : colors.gray[400]}
          style={[
            styles.input,
            {
              color: isDark ? colors.gray[200] : colors.gray[700],
              borderColor: isDark ? colors.gray[700] : colors.gray[200],
              backgroundColor: isDark ? colors.gray[900] : colors.gray[50],
            },
          ]}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 16,
  },
  container: {
    marginHorizontal: 10,
    borderRadius: 16,
    padding: 8,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    fontSize: 13,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 60,
    fontFamily: 'BeVietnamPro_400Regular',
  },
})
