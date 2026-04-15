// images/types.ts
import type { ImageSourcePropType } from 'react-native'

/**
 * Explicit asset map — bitmap files resolve to `number` (Metro module ID),
 * SVG files resolve to `ImageSourcePropType` (may be component or object).
 */
export type ImageAssets = {
  Auth: {
    LoginBackground: number
  }
  Brand: {
    Logo: number
    LogoWhite: number
    LogoIcon: number
    HomelandLogo: number
  }
  Flags: {
    US: number
    VI: number
  }
  Food: {
    ProductImage: number
    DefaultProductImage: number
    NewProductIcon: number
    PromotionTag: ImageSourcePropType
  }
  Landing: {
    Desktop: number
    Mobile: number
  }
  Highlight: {
    Menu2: number
    Menu3: number
    Menu4: number
    Menu5: number
  }
  Featured: {
    Services1: number
    Services2: number
    Services3: number
    Services4: number
  }
  News: {
    Article1_1: number
    Article1_2: number
    Article1_3: number
    Article2_2: number
    Article2_3: number
    Article3_2: number
    Article3_3: number
    Article3_4: number
  }
  Order: {
    Success: number
    SuccessSVG: ImageSourcePropType
  }
  Error: {
    Illustration: ImageSourcePropType
    NotFound: ImageSourcePropType
    ChuaThoaDieuKien: ImageSourcePropType
  }
  Icons: {
    Icon: number
    Splash: number
    PromotionTag: ImageSourcePropType
  }
}
