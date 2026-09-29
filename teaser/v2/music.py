"""Soundtrack for teaser v2 ("boarding pass"): 120 BPM, A minor, disco-pop.

Timeline matches v2/teaser.html (same scene grid as v1):
  title 0-6 | need 3s / course 5s x4 | end 38-46
Sound design hooks:
  - split-flap clatter while board letters flip
  - airport "ding-dong" chime at the start of every need scene
  - whoosh as the boarding pass slides in, stamp thud 1.5s into each course
Run: python3 music.py out.wav
"""
import sys, wave
import numpy as np

SR = 44100
BEAT = 0.5
DUR = 46.0
N = int(SR * DUR)
rng = np.random.default_rng(11)

SECTIONS = [(0, 6, "title")]
t0 = 6
for _ in range(4):
    SECTIONS += [(t0, t0 + 3, "need"), (t0 + 3, t0 + 8, "course")]
    t0 += 8
SECTIONS += [(38, 46, "end")]
FLIPS = [(0.2, 2.4)] + [(a + 0.05, a + 0.9) for a, b, k in SECTIONS if k == "need"] + [(38.1, 39.3)]
STAMP = 1.5  # seconds into each course


def kind_at(t):
    for a, b, k in SECTIONS:
        if a <= t < b:
            return k
    return "end"


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def env(n, a, d):
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def lowpass(x, cutoff):
    cutoff = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y


def add(buf, sig, t):
    i = int(t * SR)
    if i >= len(buf) or i < 0:
        return
    sig = sig[: len(buf) - i]
    buf[i : i + len(sig)] += sig


# Am7 - Fmaj7 - C - G(add6)
CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 60, 64, 67], [55, 59, 62, 64]]
ROOTS = [33, 29, 36, 31]

keys = np.zeros(N); drums = np.zeros(N); bass = np.zeros(N)
lead = np.zeros(N); fx = np.zeros(N)
t_all = np.arange(N) / SR
full = lambda t: (kind_at(t) in ("course", "end") and t < 44) or (kind_at(t) == "title" and t >= 2)

# --- electric-piano style stabs on the offbeats (full) / held chord (need)
for b in range(int(DUR / BEAT)):
    t = b * BEAT
    ch = CHORDS[(b // 4) % 4]
    k = kind_at(t + 1e-3)
    if full(t):
        for off in (BEAT / 2,) if b % 2 == 0 else (BEAT / 2, 3 * BEAT / 4):
            n = int(0.25 * SR); tt = np.arange(n) / SR
            s = sum(np.sin(2 * np.pi * midi(m) * tt) + .35 * np.sin(2 * np.pi * 2 * midi(m) * tt) for m in ch)
            add(keys, s * env(n, .003, .09) * .07, t + off)
    elif b % 4 == 0 and (k == "need" or k == "title"):
        n = int(2 * SR); tt = np.arange(n) / SR
        s = sum(np.sin(2 * np.pi * midi(m) * tt) for m in ch)
        trem = 1 + .25 * np.sin(2 * np.pi * 5 * tt)
        add(keys, s * env(n, .15, 1.1) * trem * (.05 if k == "need" else .06), t)


# --- drums
def kick():
    n = int(.3 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(50 + 120 * np.exp(-t / .03)) / SR) * np.exp(-t / .13)


def noise_hit(dur, hp, dec):
    n = int(dur * SR); x = rng.standard_normal(n)
    return (x - lowpass(x, hp)) * np.exp(-np.arange(n) / SR / dec)


K = kick(); SN = noise_hit(.2, 1500, .06) * .6; HH = noise_hit(.04, 8000, .01); OH = noise_hit(.2, 7000, .07)
SHK = noise_hit(.06, 5000, .02)
duck = np.ones(N)
for b in range(int(DUR / BEAT)):
    t = b * BEAT
    if full(t):
        add(drums, K * .95, t)
        i = int(t * SR); dn = int(.25 * SR)
        d = 1 - .5 * np.exp(-np.arange(dn) / SR / .08)
        duck[i:i + dn] = np.minimum(duck[i:i + dn], d[:len(duck[i:i + dn])])
        if b % 2 == 1:
            add(drums, SN, t)
        add(drums, OH * .14, t + BEAT / 2)
        for q in (1, 3):
            add(drums, SHK * .12, t + q * BEAT / 4)
    elif kind_at(t + 1e-3) == "need":
        # heartbeat-ish muffled kick on beat 1 only
        if b % 2 == 0:
            add(drums, lowpass(K, 300) * .5, t)

# --- octave disco bass (16ths alternating low/high) in full sections
for s16 in range(int(DUR / (BEAT / 4))):
    t = s16 * BEAT / 4
    if not full(t):
        continue
    root = ROOTS[(s16 // 16) % 4] + (12 if s16 % 2 else 0)
    if s16 % 4 == 0:
        continue  # leave room for the kick
    n = int(.11 * SR); tt = np.arange(n) / SR
    f = midi(root)
    s = np.tanh(2 * (np.sin(2 * np.pi * f * tt) + .4 * np.sin(2 * np.pi * 2 * f * tt))) * env(n, .003, .06)
    add(bass, s * .3, t)

# --- marimba-ish lead hook, one phrase per bar in course/end
HOOK = [(0, 76), (.75, 74), (1.5, 72), (2.5, 74), (3, 76), (3.5, 79)]
for bar in range(int(DUR / 2)):
    tb = bar * 2.0
    if not (kind_at(tb + 1e-3) in ("course", "end") and tb < 44):
        continue
    shift = [0, -3, 0, -1][bar % 4]
    for beat, note in HOOK:
        t = tb + beat * BEAT
        n = int(.35 * SR); tt = np.arange(n) / SR
        f = midi(note + shift)
        s = (np.sin(2 * np.pi * f * tt) + .5 * np.sin(2 * np.pi * 4 * f * tt) * np.exp(-tt / .02)) * env(n, .001, .12)
        add(lead, s * .12, t)

# --- sound design
for a, b in FLIPS:  # split-flap clatter
    t = a
    while t < b:
        add(fx, noise_hit(.012, 2500, .003) * (.18 + .08 * rng.random()), t)
        t += .028 + .02 * rng.random()
    add(fx, noise_hit(.03, 1500, .008) * .35, b)  # final settle clack

for a, b, k in SECTIONS:
    if k == "need":  # airport chime: E5 -> C5, bell partials
        for dt, m in ((0.0, 76), (0.45, 72)):
            n = int(1.6 * SR); tt = np.arange(n) / SR; f = midi(m)
            s = sum(amp * np.sin(2 * np.pi * f * r * tt) for r, amp in ((1, 1), (2.76, .3), (5.4, .12)))
            add(fx, s * env(n, .005, .6) * .12, a + dt)
        # riser into the drop
        n = int(1.4 * SR); tt = np.arange(n) / SR
        x = rng.standard_normal(n); sw = 300 + 6000 * (tt / tt[-1]) ** 2
        add(fx, (lowpass(x, sw) - lowpass(x, sw * .3)) * (tt / tt[-1]) ** 2 * .22, b - 1.4)
    if k == "course":
        # whoosh (card slides in)
        n = int(.7 * SR); tt = np.arange(n) / SR
        x = rng.standard_normal(n); sw = 3000 * np.exp(-tt / .25) + 300
        add(fx, (lowpass(x, sw)) * np.sin(np.pi * tt / tt[-1]) * .5, a - .1)
        # stamp thud
        n = int(.4 * SR); tt = np.arange(n) / SR
        thud = np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-tt / .02)) / SR) * np.exp(-tt / .09)
        add(fx, thud * .6, a + STAMP)
        add(fx, noise_hit(.06, 800, .015) * .4, a + STAMP)
    if k == "end":
        n = int(.4 * SR); tt = np.arange(n) / SR
        add(fx, np.sin(2 * np.pi * np.cumsum(60 + 80 * np.exp(-tt / .03)) / SR) * np.exp(-tt / .2) * .5, a)

# end: CTA stamp at 41.0, final chord at 44
n = int(.4 * SR); tt = np.arange(n) / SR
add(fx, np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-tt / .02)) / SR) * np.exp(-tt / .09) * .5, 41.0)
n = int(2.2 * SR); tt = np.arange(n) / SR
add(fx, sum(np.sin(2 * np.pi * midi(m) * tt) for m in CHORDS[0] + [69, 76]) * env(n, .01, .9) * .06, 44.0)
add(fx, K * .8, 44.0)

mix = (keys + lead) * duck + drums + bass * duck + fx
mix *= np.minimum(1, t_all / .2) * np.clip((DUR - t_all) / 1.5, 0, 1)
mix = np.tanh(mix * 1.5) / np.tanh(1.5)
mix = mix / (np.max(np.abs(mix)) + 1e-9) * .89
out = sys.argv[1] if len(sys.argv) > 1 else "music.wav"
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.stack([mix, mix], 1) * 32767).astype(np.int16).tobytes())
print("wrote", out)
