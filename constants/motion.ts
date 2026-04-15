/**
 * SPRING_CONFIGS — Chuẩn vật lý Telegram cho từng loại tương tác.
 * Đợt 1: The Core Physics — thống nhất thông số Spring.
 *
 * @see docs/NATURAL_INTERACTION_ANALYSIS.md
 */
export const SPRING_CONFIGS = {
  /** Button — phản hồi nhanh, rất ít nảy */
  press: {
    damping: 24,
    stiffness: 350,
    mass: 0.5,
    overshootClamping: true,
  } as const,

  /** Sheet/Dialog — ít nảy, trả về nhanh */
  modal: {
    damping: 30,
    stiffness: 380,
    mass: 0.6,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  } as const,

  /** Pagination — mượt, ít nảy */
  dot: {
    damping: 28,
    stiffness: 400,
    mass: 0.3,
    overshootClamping: true,
  } as const,

  /** Dropdown — nhanh, ít nảy */
  popover: {
    damping: 32,
    stiffness: 420,
    mass: 0.4,
    overshootClamping: true,
  } as const,

  /**
   * Banner dot width expand — softer spring for width morph between inactive
   * (7px) and active (20px) pill. Lower damping allows gentle overshoot.
   */
  dotExpand: {
    damping: 15,
    stiffness: 220,
  } as const,

  /**
   * Cart badge bounce-in — low damping for intentional scale overshoot when
   * an item is added to the cart.
   */
  bounceIn: {
    damping: 8,
    stiffness: 300,
  } as const,

  /**
   * Cart badge bounce-settle — higher damping to snap back to rest scale=1
   * quickly after the overshoot phase.
   */
  bounceSettle: {
    damping: 15,
    stiffness: 200,
  } as const,

  /**
   * Swipeable row snap — gesture-driven pan snap to open/closed position.
   * Moderate damping keeps the snap feel snappy without jarring overshoot.
   */
  swipe: {
    damping: 25,
    stiffness: 180,
  } as const,
} as const

/**
 * TIMING_CONFIGS — withTiming duration presets.
 * Use these instead of inline `{ duration: N }` objects.
 */
export const TIMING_CONFIGS = {
  /**
   * Banner dot fade — opacity cross-fade between active/inactive dot states.
   */
  dotFade: { duration: 180 } as const,
} as const

/** Scale active cho PaginationDot — 1.25 thay vì 2–3 để tránh méo hình */
export const DOT_SCALE_ACTIVE = 1.25

/**
 * Motion tokens — Single source of truth cho animation/navigation.
 * Dùng cho: NativeGesturePressable, ParallaxDriver, transition duration.
 *
 * @see docs/IMPLEMENTATION_TASKS.md T-401
 */
export const MOTION = {
  /** Tab transition duration (~200ms) — dùng cho useRunAfterTransition, tab overlay */
  transitionDurationMs: 200,

  /** Press scale khi tap (NativeGesturePressable) */
  pressScale: 0.97,
  pressScaleSpring: SPRING_CONFIGS.press,

  /** Parallax — background dịch theo hướng slide (Telegram feel) */
  parallaxFactor: 0.3,
  shadowOpacityEnd: 0.15,

  /** Parallax background scale range */
  parallaxBgScaleStart: 0.97,
  parallaxBgScaleEnd: 1,

  /** Parallax spring config (Reanimated) */
  parallaxSpring: {
    damping: 18,
    stiffness: 220,
    mass: 0.9,
    overshootClamping: false,
    energyThreshold: 1e-6,
  } as const,

  /** Stack transition — Telegram style: stiffness 300, damping 30 (Native Stack dùng animationDuration) */
  stackTransition: {
    stiffness: 300,
    damping: 30,
    /** Thời gian tương đương spring (~350ms) — Native Stack chỉ hỗ trợ duration */
    durationMs: 350,
  } as const,

  // Dành cho Native Stack (CustomStack)
  nativeStack: {
    stiffness: 300,
    damping: 30,
    /**
     * 320ms: duration dài hơn → hành trình slide cảm giác xa hơn (Native Stack không hỗ trợ
     * tùy chỉnh vị trí bắt đầu — animation chạy trên native code).
     */
    durationMs: 360,
  },
  /**
   * JS Stack (Home, Menu, Root, Auth, Profile, Payment, UpdateOrder)
   * Spring physics — velocity-aware, không cố định duration.
   * Spring configs nằm trong lib/navigation/interactive-transition.ts (OPEN_SPEC, CLOSE_SPEC).
   */
  jsStack: {
    parallaxFactor: -0.25,
  } as const,

  /** Alias cho SPRING_CONFIGS — backward compatibility */
  modalSpring: SPRING_CONFIGS.modal,
  dotSpring: SPRING_CONFIGS.dot,
  dotScaleActive: DOT_SCALE_ACTIVE,
  popoverSpring: SPRING_CONFIGS.popover,
} as const
