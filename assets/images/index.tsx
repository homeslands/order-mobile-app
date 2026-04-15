// images/index.ts
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports */
import type { ImageAssets } from './types'

export const Images: ImageAssets = {
  Auth: {
    LoginBackground: require('./auth/login-background.jpg'),
  },

  Brand: {
    Logo: require('./trend/logo.png'),
    LogoWhite: require('./trend/logo-white.png'),
    LogoIcon: require('./trend/logo-icon.png'),
    HomelandLogo: require('./trend/homeland-logo.png'),
  },

  Flags: {
    US: require('./flag/us-flag.png'),
    VI: require('./flag/vi-flag.png'),
  },

  Food: {
    ProductImage: require('./food/ProductImage.png'),
    /** Ảnh mặc định khi món không có ảnh (alias của ProductImage) */
    DefaultProductImage: require('./food/ProductImage.png'),
    NewProductIcon: require('./food/new-product-icon.png'),
    PromotionTag: require('./food/promotion-tag.svg'),
  },

  Landing: {
    Desktop: require('./landing/landing-page-background.webp'),
    Mobile: require('./landing/landing-page-background-mobile.jpg'),
  },

  Highlight: {
    Menu2: require('./highlight/highlight_menu_2.webp'),
    Menu3: require('./highlight/highlight_menu_3.webp'),
    Menu4: require('./highlight/highlight_menu_4.webp'),
    Menu5: require('./highlight/highlight_menu_5.webp'),
  },

  Featured: {
    Services1: require('./highlight/featured-services-1.webp'),
    Services2: require('./highlight/featured-services-2.webp'),
    Services3: require('./highlight/featured_service_3.webp'),
    Services4: require('./highlight/featured_service_4.webp'),
  },

  News: {
    Article1_1: require('./news/news_article_1_1.webp'),
    Article1_2: require('./news/news_article_1_2.webp'),
    Article1_3: require('./news/news_article_1_3.webp'),
    Article2_2: require('./news/news_article_2_2.webp'),
    Article2_3: require('./news/news_article_2_3.webp'),
    Article3_2: require('./news/news_article_3_2.webp'),
    Article3_3: require('./news/news_article_3_3.webp'),
    Article3_4: require('./news/news_article_3_4.webp'),
  },

  Order: {
    Success: require('./food/order-success.png'),
    SuccessSVG: require('./icon/order-success.svg'),
  },

  Error: {
    Illustration: require('./icon/error-page-logo.svg'),
    NotFound: require('./icon/404-page-logo.svg'),
    ChuaThoaDieuKien: require('./icon/chua-thoa-dieu-kien.svg'),
  },

  Icons: {
    Icon: require('./icon/icon.png'),
    Splash: require('./icon/splash.png'),
    PromotionTag: require('./icon/promotion-tag.svg'),
  },
}
