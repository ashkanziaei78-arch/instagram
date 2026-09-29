"""Synthesised soundtrack for the teaser: 120 BPM, D major, warm & upbeat.

Arrangement follows the scene timeline in teaser.html (1 bar = 2 s):
  title  0-6s   : pad + pluck, groove kicks in at 2s
  need   3s     : breakdown (muffled pad, no drums) + riser
  course 5s     : drop - full groove, impact on the first beat
  outro  38-46s : full groove, final chord rings out
Run: python3 music.py out.wav
"""
import sys, wave
import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
DUR = 46.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

# (start, end, kind) - must match SCENES in teaser.html
SECTIONS = [(0, 6, "title")]
t0 = 6
for _ in range(4):
    SECTIONS += [(t0, t0 + 3, "need"), (t0 + 3, t0 + 8, "course")]
    t0 += 8
SECTIONS += [(38, 46, "end")]


def kind_at(t):
    for a, b, k in SECTIONS:
        if a <= t < b:
            return k
    return "end"


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def env_ad(n, a, d):
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def lowpass(x, cutoff):
    # one-pole, cutoff may be an array (sweeps)
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
    if i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    buf[i : i + len(sig)] += sig


# chords per bar: Dmaj7, Bm7, Gmaj7, A6sus-ish
CHORDS = [
    [50, 57, 61, 64, 66],  # D  A C# E F#
    [47, 54, 57, 62, 66],  # B  F# A D F#
    [43, 50, 54, 59, 62],  # G  D F# B D
    [45, 52, 57, 61, 64],  # A  E A C# E
]
ROOTS = [38, 35, 31, 33]

pad = np.zeros(N)
drums = np.zeros(N)
bass = np.zeros(N)
pluck = np.zeros(N)
fx = np.zeros(N)
t_all = np.arange(N) / SR

# --- pad: detuned saws per bar
bar_len = int(4 * BEAT * SR)
for bar in range(int(DUR / (4 * BEAT)) + 1):
    t = bar * 4 * BEAT
    ch = CHORDS[bar % 4]
    tt = np.arange(bar_len) / SR
    sig = np.zeros(bar_len)
    for n in ch:
        for det in (-0.08, 0.0, 0.08):
            f = midi(n + det)
            ph = (tt * f + rng.random()) % 1.0
            sig += (2 * ph - 1) * 0.5
    e = np.minimum(1, tt / 0.06) * np.minimum(1, (bar_len / SR - tt) / 0.08)
    add(pad, sig * e / len(ch), t)

cut = np.array([
    {"need": 450, "title": 1800, "course": 2600, "end": 2600}[kind_at(x)]
    for x in t_all[::441]
])
cut = np.repeat(cut, 441)[:N]
cut = lowpass(cut, 3.0)  # glide between sections
pad = lowpass(pad, cut) * 0.16


# --- drums
def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)


def clap():
    n = int(0.22 * SR)
    x = rng.standard_normal(n)
    x = x - lowpass(x, 900)
    e = np.exp(-np.arange(n) / SR / 0.07)
    for d in (0.0, 0.012, 0.024):
        e[int(d * SR) : int(d * SR) + 200] += 0.6
    return x * e * 0.5


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    x = rng.standard_normal(n)
    x = x - lowpass(x, 7000)
    return x * np.exp(-np.arange(n) / SR / (0.06 if open_ else 0.012))


K, C, H, HO = kick(), clap(), hat(), hat(True)
duck = np.ones(N)
n_beats = int(DUR / BEAT)
for b in range(n_beats):
    t = b * BEAT
    k = kind_at(t + 0.001)
    full = k in ("course", "end") or (k == "title" and t >= 2)
    if k == "end" and t >= 44:
        full = False
    if full:
        add(drums, K * 0.9, t)
        dn = int(0.3 * SR)
        i = int(t * SR)
        d = 1 - 0.55 * np.exp(-np.arange(dn) / SR / 0.09)
        duck[i : i + dn] = np.minimum(duck[i : i + dn], d[: len(duck[i : i + dn])])
        if b % 2 == 1:
            add(drums, C * 0.55, t)
        add(drums, HO * 0.16, t + BEAT / 2)
        add(drums, H * 0.10, t + BEAT / 4)
        add(drums, H * 0.08, t + 3 * BEAT / 4)
    elif k in ("need", "title"):
        add(drums, H * 0.07, t + BEAT / 2)

# --- bass: offbeat 8ths on root in full sections
for b in range(n_beats):
    t = b * BEAT
    k = kind_at(t + 0.001)
    if k in ("course", "end") and t < 44 or (k == "title" and t >= 2):
        root = ROOTS[(b // 4) % 4]
        for off, ln in ((BEAT / 2, 0.22),):
            n = int(ln * SR)
            tt = np.arange(n) / SR
            f = midi(root)
            s = np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)
            s = np.tanh(1.6 * s) * env_ad(n, 0.005, 0.12)
            add(bass, s * 0.42, t + off)
    elif k == "need":
        # held low root, very soft
        if abs((t - round(t / 2) * 2)) < 1e-6:
            n = int(2 * SR)
            tt = np.arange(n) / SR
            s = np.sin(2 * np.pi * midi(ROOTS[(b // 4) % 4]) * tt) * env_ad(n, 0.2, 1.2)
            add(bass, s * 0.25, t)

# --- pluck arpeggio (16ths in course/end, 8ths in title)
ARP = [0, 2, 3, 4, 3, 2, 1, 2]
for s16 in range(int(DUR / (BEAT / 4))):
    t = s16 * BEAT / 4
    k = kind_at(t + 0.001)
    step = 1 if k in ("course", "end") else 2 if k == "title" else 0
    if not step or s16 % step or t >= 44.5:
        continue
    ch = CHORDS[(s16 // 16) % 4]
    note = ch[ARP[(s16 // step) % len(ARP)] % len(ch)] + 12
    n = int(0.3 * SR)
    tt = np.arange(n) / SR
    f = midi(note)
    s = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 3 * f * tt)) * env_ad(n, 0.002, 0.09)
    add(pluck, s * (0.11 if step == 1 else 0.13), t)

# --- fx: riser into each drop, soft impact on drop, final chord
for a, b, k in SECTIONS:
    if k == "need":
        n = int((b - a) * SR)
        tt = np.arange(n) / SR
        x = rng.standard_normal(n)
        sweep = 400 + 5000 * (tt / tt[-1]) ** 2
        x = lowpass(x, sweep) - lowpass(x, sweep * 0.3)
        add(fx, x * (tt / tt[-1]) ** 2 * 0.22, a)
    if k in ("course", "end"):
        n = int(1.2 * SR)
        tt = np.arange(n) / SR
        boom = np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-tt / 0.05)) / SR) * np.exp(-tt / 0.35)
        shimmer = sum(np.sin(2 * np.pi * midi(m + 24) * tt) for m in CHORDS[0][1:4]) * env_ad(n, 0.01, 0.5)
        add(fx, boom * 0.5 + shimmer * 0.03, a)
        if k == "end":
            continue

# final chord ring-out at 44s
n = int(2.0 * SR)
tt = np.arange(n) / SR
fin = sum(np.sin(2 * np.pi * midi(m + 12) * tt) for m in CHORDS[0]) * env_ad(n, 0.01, 0.9)
add(fx, fin * 0.07, 44.0)
add(fx, K * 0.8, 44.0)

mix = (pad + pluck) * duck + drums + bass * duck ** 0.5 + fx
# fades
fade_in = np.minimum(1, t_all / 0.3)
fade_out = np.clip((DUR - t_all) / 1.5, 0, 1)
mix *= fade_in * fade_out
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89

stereo = np.stack([mix, mix], axis=1)
out = sys.argv[1] if len(sys.argv) > 1 else "music.wav"
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())
print("wrote", out)
