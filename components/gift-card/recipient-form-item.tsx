import { UserRound, Trash2, X } from 'lucide-react-native'
import { memo, useCallback, useState } from 'react'
import { useDebounce } from 'use-debounce'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from 'react-hook-form'

import { Input } from '@/components/ui'
import { colors } from '@/constants'
import { useUserByPhone } from '@/hooks/use-users'
import type { CheckoutFormValues } from '@/app/gift-card/checkout'

const MIN_QTY = 1
const MAX_QTY = 10

interface RecipientFormItemProps {
  index: number
  control: Control<CheckoutFormValues>
  errors: FieldErrors<CheckoutFormValues>
  setValue: UseFormSetValue<CheckoutFormValues>
  primaryColor: string
  onRemove: (index: number) => void
}

export const RecipientFormItem = memo(function RecipientFormItem({
  index,
  control,
  errors,
  setValue,
  primaryColor,
  onRemove,
}: RecipientFormItemProps) {
  const isDark = useColorScheme() === 'dark'
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const bgColor = isDark ? colors.gray[900] : colors.white.light
  const textAreaBg = isDark ? colors.gray[800] : colors.gray[50]
  const textAreaBorder = isDark ? colors.gray[700] : colors.gray[200]
  const suggestionBg = isDark ? colors.gray[800] : colors.gray[50]
  const qtyBtnBorder = isDark ? colors.gray[600] : colors.gray[300]
  const qtyBtnText = isDark ? colors.gray[300] : colors.gray[700]
  const qtyText = isDark ? colors.gray[50] : colors.gray[900]

  const { t } = useTranslation('giftCard')

  const handleRemove = useCallback(() => onRemove(index), [index, onRemove])

  const phoneError = errors.recipients?.[index]?.phone?.message
  const recipientSlugError = errors.recipients?.[index]?.recipientSlug?.message
  const quantityError = errors.recipients?.[index]?.quantity?.message

  const phoneValue = useWatch({ control, name: `recipients.${index}.phone` })
  const currentName = useWatch({ control, name: `recipients.${index}.name` })

  const [debouncedPhone] = useDebounce(phoneValue ?? '', 500)
  const { data: suggestedUser, isFetching } = useUserByPhone(debouncedPhone)

  const fullName = suggestedUser
    ? `${suggestedUser.firstName} ${suggestedUser.lastName}`.trim()
    : null

  // true khi tên đã được lock từ suggestion
  const [nameLocked, setNameLocked] = useState(false)

  const showSuggestion = !!fullName && !nameLocked && !currentName

  const handleSelectSuggestion = useCallback(() => {
    if (fullName && suggestedUser) {
      Keyboard.dismiss()
      setValue(`recipients.${index}.recipientSlug`, suggestedUser.slug, { shouldValidate: true })
      setValue(`recipients.${index}.name`, fullName, { shouldValidate: false })
      setNameLocked(true)
    }
  }, [fullName, suggestedUser, index, setValue])

  const handleUnlockName = useCallback(() => {
    setValue(`recipients.${index}.recipientSlug`, '', { shouldValidate: false })
    setValue(`recipients.${index}.name`, '', { shouldValidate: false })
    setValue(`recipients.${index}.phone`, '', { shouldValidate: false })
    setNameLocked(false)
  }, [index, setValue])

  return (
    <View style={[s.container, { borderColor, backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={s.headerRow}>
        <Text style={[s.recipientLabel, { color: textColor }]}>
          {t('recipientForm.recipientTitle', { index: index + 1 })}
        </Text>
        <Pressable onPress={handleRemove} hitSlop={8} style={s.removeBtn}>
          <Trash2 size={16} color={colors.destructive.light} />
        </Pressable>
      </View>

      {/* Phone */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: subColor }]}>
          {t('recipientForm.phone')} <Text style={{ color: colors.destructive.light }}>*</Text>
        </Text>
        <Controller
          control={control}
          name={`recipients.${index}.phone`}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('recipientForm.phonePlaceholder')}
              keyboardType="phone-pad"
              maxLength={11}
              error={!!phoneError}
            />
          )}
        />
        {!!phoneError && <Text style={s.errorText}>{phoneError}</Text>}
        {!phoneError && !!recipientSlugError && (
          <Text style={s.errorText}>{recipientSlugError}</Text>
        )}

        {/* Suggestion / loading */}
        {isFetching && (
          <View style={[s.suggestion, { backgroundColor: suggestionBg, borderColor }]}>
            <ActivityIndicator size="small" color={subColor} />
            <Text style={[s.suggestionHint, { color: subColor }]}>{t('recipientForm.searching')}</Text>
          </View>
        )}
        {!isFetching && showSuggestion && (
          <Pressable
            onPress={handleSelectSuggestion}
            style={[s.suggestion, { backgroundColor: suggestionBg, borderColor }]}
          >
            <View style={[s.suggestionAvatar, { backgroundColor: `${primaryColor}20` }]}>
              <UserRound size={14} color={primaryColor} />
            </View>
            <View style={s.suggestionText}>
              <Text style={[s.suggestionName, { color: textColor }]}>{fullName}</Text>
              <Text style={[s.suggestionHint, { color: subColor }]}>{t('recipientForm.tapToFill')}</Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Name */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: subColor }]}>{t('recipientForm.name')}</Text>
        {nameLocked ? (
          /* Readonly — autofill từ suggestion */
          <View style={[s.nameLockedWrap, { borderColor: `${primaryColor}60`, backgroundColor: `${primaryColor}10` }]}>
            <UserRound size={14} color={primaryColor} />
            <Text style={[s.nameLockedText, { color: primaryColor }]} numberOfLines={1}>
              {currentName}
            </Text>
            <Pressable onPress={handleUnlockName} hitSlop={8}>
              <X size={14} color={subColor} />
            </Pressable>
          </View>
        ) : (
          <Controller
            control={control}
            name={`recipients.${index}.name`}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('recipientForm.namePlaceholder')}
              />
            )}
          />
        )}
      </View>

      {/* Quantity — stepper */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: subColor }]}>
          {t('recipientForm.quantityLabel')} <Text style={{ color: colors.destructive.light }}>*</Text>
        </Text>
        <Controller
          control={control}
          name={`recipients.${index}.quantity`}
          render={({ field: { onChange, value } }) => {
            const qty = typeof value === 'number' ? value : 1
            return (
              <View style={s.qtyRow}>
                <Pressable
                  onPress={() => onChange(Math.max(MIN_QTY, qty - 1))}
                  disabled={qty <= MIN_QTY}
                  style={[
                    s.qtyBtn,
                    { borderColor: qtyBtnBorder },
                    qty <= MIN_QTY && s.qtyBtnDisabled,
                  ]}
                >
                  <Text style={[s.qtyBtnText, { color: qtyBtnText }]}>−</Text>
                </Pressable>
                <Text style={[s.qtyValue, { color: qtyText }]}>{qty}</Text>
                <Pressable
                  onPress={() => onChange(Math.min(MAX_QTY, qty + 1))}
                  disabled={qty >= MAX_QTY}
                  style={[
                    s.qtyBtn,
                    { borderColor: qtyBtnBorder },
                    qty >= MAX_QTY && s.qtyBtnDisabled,
                  ]}
                >
                  <Text style={[s.qtyBtnText, { color: qtyBtnText }]}>+</Text>
                </Pressable>
              </View>
            )
          }}
        />
        {!!quantityError && <Text style={s.errorText}>{quantityError}</Text>}
      </View>

      {/* Message */}
      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: subColor }]}>{t('recipientForm.messageLabel')}</Text>
        <Controller
          control={control}
          name={`recipients.${index}.message`}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={t('recipientForm.messagePlaceholder')}
              placeholderTextColor={subColor}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={200}
              style={[
                s.textArea,
                {
                  color: textColor,
                  backgroundColor: textAreaBg,
                  borderColor: textAreaBorder,
                },
              ]}
            />
          )}
        />
      </View>
    </View>
  )
})

const s = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipientLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  removeBtn: {
    padding: 4,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 11,
    color: colors.destructive.light,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  suggestionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    gap: 1,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '600',
  },
  suggestionHint: {
    fontSize: 11,
  },
  nameLockedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  nameLockedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyBtnText: { fontSize: 18, fontWeight: '600', lineHeight: 20 },
  qtyValue: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
    fontFamily: 'BeVietnamPro_400Regular',
  },
})
