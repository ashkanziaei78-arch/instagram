'use client'

import { useEffect, useState } from 'react'

/**
 * امضای صفحه: همان لحظه‌ای که محصول می‌فروشد.
 * یک نفر زیر پست «۱» می‌نویسد، سه‌نقطه‌ی نوشتن (همان سه نقطه‌ی لوگو) می‌آید و
 * دایرکت لینک خودش را می‌نویسد. هر مرحله یک عدد است و صحنه از روی همان ساخته می‌شود.
 */
const STEPS = [0, 1100, 2300, 3100, 4300, 5900, 6800, 7900, 11500]
const LABELS = ['', 'کامنت رسید', 'دایرکتینو دید', 'در حال نوشتن…', 'دایرکت رفت، در ۲ ثانیه', 'مشتری جواب داد', 'در حال نوشتن…', 'جواب سوال هم رفت', '']

export function PhoneDemo() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(7)
      return
    }
    let timers: ReturnType<typeof setTimeout>[] = []
    const run = () => {
      timers = STEPS.map((t, i) => setTimeout(() => (i === STEPS.length - 1 ? run() : setStep(i)), t))
    }
    run()
    return () => timers.forEach(clearTimeout)
  }, [])

  const inDm = step >= 2

  return (
    <div className="relative mx-auto w-[290px] sm:w-[310px]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-brand opacity-25 blur-3xl" aria-hidden />
      <div
        className="relative h-[600px] overflow-hidden rounded-[46px] border border-white/10 bg-[#0b0816] p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]"
        role="img"
        aria-label="نمایش: کسی زیر پست عدد ۱ را کامنت می‌کند و دایرکتینو همان لحظه برایش دایرکت لینک می‌فرستد"
      >
        <div className="absolute left-1/2 top-3 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-full overflow-hidden rounded-[38px] bg-[#120d22]">
          {/* صفحه‌ی پست */}
          <div
            className="absolute inset-0 transition-transform duration-500 ease-out"
            style={{ transform: inDm ? 'translateX(100%)' : 'none' }}
            aria-hidden={inDm}
          >
            <PostScreen showComment={step >= 1} />
          </div>
          {/* صفحه‌ی دایرکت */}
          <div
            className="absolute inset-0 transition-transform duration-500 ease-out"
            style={{ transform: inDm ? 'none' : 'translateX(-100%)' }}
            aria-hidden={!inDm}
          >
            <DmScreen step={step} />
          </div>
        </div>
      </div>
      <p className="mt-5 h-5 text-center text-[13px] text-mist" aria-live="polite">
        {LABELS[step] && (
          <span key={step} className="pop inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-tangerine" />
            {LABELS[step]}
          </span>
        )}
      </p>
    </div>
  )
}

function Avatar({ hue, letter }: { hue: string; letter: string }) {
  return (
    <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ' + hue}>
      {letter}
    </span>
  )
}

function PostScreen({ showComment }: { showComment: boolean }) {
  return (
    <div className="flex h-full flex-col pt-10 text-[13px]">
      <div className="flex items-center gap-2 px-4 pb-3">
        <span className="rounded-full bg-brand p-[2px]">
          <span className="block h-7 w-7 rounded-full border-2 border-[#120d22] bg-[#3a2a5c]" />
        </span>
        <span className="font-bold">mahtab.manto</span>
      </div>
      <div className="relative mx-0 aspect-square bg-gradient-to-br from-[#3b2160] via-[#5a2350] to-[#7a3b2a]">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="text-[13px] text-white/70">کالکشن پاییزه</span>
          <span className="text-2xl font-bold leading-snug text-white">مانتو کتان<br />۷ رنگ</span>
          <span className="mt-2 rounded-full bg-white/15 px-3 py-1 text-[12px] text-white">برای لینک خرید «۱» کامنت کن</span>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-hidden px-4 pt-3">
        <p className="text-[12px] text-mist">۲۴۸ لایک</p>
        <Comment user="neda.k" text="رنگ طوسی هم داره؟" hue="bg-[#6b4bd8]" />
        <Comment user="ali_rz" text="۱" hue="bg-[#c0478a]" />
        {showComment && (
          <div className="pop flash -mx-2 rounded-xl px-2 py-1">
            <Comment user="sara.style" text="۱" hue="bg-[#e0782f]" />
          </div>
        )}
      </div>
    </div>
  )
}

function Comment({ user, text, hue }: { user: string; text: string; hue: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Avatar hue={hue} letter={user[0].toUpperCase()} />
      <p className="pt-1.5 leading-5">
        <span className="ml-1.5 font-bold">{user}</span>
        {text}
      </p>
    </div>
  )
}

function DmScreen({ step }: { step: number }) {
  return (
    <div className="flex h-full flex-col pt-10 text-[13px]">
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 pb-3">
        <Avatar hue="bg-[#e0782f]" letter="S" />
        <div>
          <p className="font-bold leading-4">sara.style</p>
          <p className="text-[11px] text-mist">از کامنت پست شما</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2.5 p-3 pb-5">
        {step === 3 && <Typing />}
        {step >= 4 && (
          <div className="pop max-w-[85%] self-end overflow-hidden rounded-[20px] rounded-bl-md bg-brand text-white">
            <p className="px-3.5 pb-2 pt-2.5 leading-6">سلام سارا 👋 لینک خرید مانتو کتان اینجاست. کد <b>PAEEZ</b> هم ۱۰٪ تخفیف دارد.</p>
            <span className="block border-t border-white/25 bg-black/10 py-2 text-center font-bold">دیدن محصول</span>
          </div>
        )}
        {step >= 5 && (
          <p className="pop max-w-[75%] self-start rounded-[20px] rounded-br-md bg-[#2a2140] px-3.5 py-2.5 leading-6">مرسی! سایز L هم داره؟</p>
        )}
        {step === 6 && <Typing />}
        {step >= 7 && (
          <p className="pop max-w-[80%] self-end rounded-[20px] rounded-bl-md bg-brand px-3.5 py-2.5 leading-6 text-white">
            بله، M و L و XL موجوده ✨
          </p>
        )}
      </div>
    </div>
  )
}

function Typing() {
  return (
    <span className="dots pop inline-flex w-fit gap-1 self-end rounded-[20px] rounded-bl-md bg-[#2a2140] px-4 py-3.5 text-mist">
      <span />
      <span />
      <span />
    </span>
  )
}
