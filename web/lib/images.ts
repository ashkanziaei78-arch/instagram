/**
 * عکس‌های سایت.
 *
 * انتخاب اصلی از Shutterstock است، ولی پیش‌نمایش‌های Shutterstock واترمارک دارند و
 * استفاده‌ی تجاری بدون خرید لایسنس مجاز نیست. تا خرید، معادل رایگان Unsplash
 * نمایش داده می‌شود. بعد از خرید، فایل را با همان نام در public/img بگذارید و
 * `licensed` را true کنید.
 */
export interface SiteImage {
  /** فایل محلی بعد از خرید لایسنس */
  local: string
  licensed: boolean
  /** جایگزین رایگان تا آن موقع */
  fallback: string
  credit: string
  shutterstock: string
}

const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`

export const IMAGES = {
  hero: {
    local: '/img/hero-neon.jpg',
    licensed: false,
    fallback: unsplash('photo-1576176243977-7c62b6472a31', 1200),
    credit: 'Victor Larracuente / Unsplash',
    shutterstock: 'https://www.shutterstock.com/image-photo/vlogging-cinematic-portrait-handsome-stylish-woman-1629730711'
  },
  night: {
    local: '/img/night-shop.jpg',
    licensed: false,
    fallback: unsplash('photo-1718985342149-7178154e0aee', 1600),
    credit: 'Laura Peruchi / Unsplash',
    shutterstock: 'https://www.shutterstock.com/image-photo/unlock-achievements-asian-male-online-shop-2351507029'
  }
} satisfies Record<string, SiteImage>

export const imgSrc = (i: SiteImage): string => (i.licensed ? i.local : i.fallback)
