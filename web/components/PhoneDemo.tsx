'use client'

import { useEffect, useState } from 'react'
import type { Dict } from '@/lib/dict'

/**
 * امضای صفحه: همان لحظه‌ای که محصول می‌فروشد.
 * یک نفر زیر پست «۱» می‌نویسد، سه‌نقطه‌ی نوشتن (همان سه نقطه‌ی لوگو) می‌آید و
 * دایرکت لینک خودش را می‌نویسد. هر مرحله یک عدد است و صحنه از روی همان ساخته می‌شود.
 *
 * جهت: پیام‌های پیج همیشه سمت «پایان» خط‌اند (چپ در فارسی، راست در انگلیسی)،
 * همان‌طور که خود اینستاگرام در هر زبان نشان می‌دهد.
 */
const STEPS = [0, 1100, 2300, 3100, 4300, 5900, 6800, 7900, 11500]

export function PhoneDemo({ d, rtl }: { d: Dict['demo']; rtl: boolean }) {
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
  // صفحه‌ی بعدی از سمت «پایان» وارد می‌شود
  const s = rtl ? 1 : -1

  return (
    <div className="relative mx-auto w-[290px] sm:w-[310px]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-brand opacity-25 blur-3xl" aria-hidden />
      <div
        className="relative h-[600px] overflow-hidden rounded-[46px] border border-white/10 bg-[#0b0816] p-2 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]"
        role="img"
        aria-label={d.aria}
      >
        <div className="absolute left-1/2 top-3 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-full overflow-hidden rounded-[38px] bg-[#120d22]">
          <div
            className="absolute inset-0 transition-transform duration-500 ease-out"
            style={{ transform: inDm ? `translateX(${100 * s}%)` : 'none' }}
            aria-hidden={inDm}
          >
            <PostScreen d={d} showComment={step >= 1} />
          </div>
          <div
            className="absolute inset-0 transition-transform duration-500 ease-out"
            style={{ transform: inDm ? 'none' : `translateX(${-100 * s}%)` }}
            aria-hidden={!inDm}
          >
            <DmScreen d={d} step={step} />
          </div>
        </div>
      </div>
      <p className="mt-5 h-5 text-center text-[13px] text-mist" aria-live="polite">
        {d.labels[step] && (
          <span key={step} className="pop inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-tangerine" />
            {d.labels[step]}
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

function PostScreen({ d, showComment }: { d: Dict['demo']; showComment: boolean }) {
  return (
    <div className="flex h-full flex-col pt-10 text-[13px]">
      <div className="flex items-center gap-2 px-4 pb-3">
        <span className="rounded-full bg-brand p-[2px]">
          <span className="block h-7 w-7 rounded-full border-2 border-[#120d22] bg-[#3a2a5c]" />
        </span>
        <span className="font-bold" dir="ltr">{d.account}</span>
      </div>
      <div className="relative aspect-square bg-gradient-to-br from-[#3b2160] via-[#5a2350] to-[#7a3b2a]">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="text-[13px] text-white/70">{d.postKicker}</span>
          <span className="text-2xl font-bold leading-snug text-white">
            {d.postTitle}
            <br />
            {d.postSub}
          </span>
          <span className="mt-2 rounded-full bg-white/15 px-3 py-1 text-[12px] text-white">{d.postCta}</span>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-hidden px-4 pt-3">
        <p className="text-[12px] text-mist">{d.likes}</p>
        <Comment user="neda.k" text={d.c1} hue="bg-[#6b4bd8]" />
        <Comment user="ali_rz" text={d.one} hue="bg-[#c0478a]" />
        {showComment && (
          <div className="pop flash -mx-2 rounded-xl px-2 py-1">
            <Comment user="sara.style" text={d.one} hue="bg-[#e0782f]" />
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
        <span className="me-1.5 font-bold">{user}</span>
        {text}
      </p>
    </div>
  )
}

function DmScreen({ d, step }: { d: Dict['demo']; step: number }) {
  return (
    <div className="flex h-full flex-col pt-10 text-[13px]">
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 pb-3">
        <Avatar hue="bg-[#e0782f]" letter="S" />
        <div>
          <p className="font-bold leading-4">sara.style</p>
          <p className="text-[11px] text-mist">{d.fromComment}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2.5 p-3 pb-5">
        {step === 3 && <Typing />}
        {step >= 4 && (
          <div className="pop max-w-[85%] self-end overflow-hidden rounded-[20px] rounded-ee-md bg-brand text-white">
            <p className="px-3.5 pb-2 pt-2.5 leading-6">
              {d.dm1a}
              <b>{d.code}</b>
              {d.dm1b}
            </p>
            <span className="block border-t border-white/25 bg-black/10 py-2 text-center font-bold">{d.button}</span>
          </div>
        )}
        {step >= 5 && (
          <p className="pop max-w-[75%] self-start rounded-[20px] rounded-es-md bg-[#2a2140] px-3.5 py-2.5 leading-6">{d.reply}</p>
        )}
        {step === 6 && <Typing />}
        {step >= 7 && (
          <p className="pop max-w-[80%] self-end rounded-[20px] rounded-ee-md bg-brand px-3.5 py-2.5 leading-6 text-white">{d.dm2}</p>
        )}
      </div>
    </div>
  )
}

function Typing() {
  return (
    <span className="dots pop inline-flex w-fit gap-1 self-end rounded-[20px] rounded-ee-md bg-[#2a2140] px-4 py-3.5 text-mist">
      <span />
      <span />
      <span />
    </span>
  )
}
