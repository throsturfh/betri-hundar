/* ===== Synthesised sound (WebAudio, no assets) ===== */
const Snd = (() => {
  let ctx = null, master = null, noiseBuf = null, lastCrunch = 0;
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const ok = () => !save.mute && ensure();
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(f, dur, type = 'sine', vol = 0.3, f2 = null, delay = 0, attack = 0.008) {
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, attack, vol, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, ftype, f1, f2, q = 1, delay = 0) {
    const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f1, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, 0.004, vol, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.05);
  }
  function bark(p = 1, delay = 0, vol = 0.5) {
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), o2 = ctx.createOscillator();
    const bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.setValueAtTime(330 * p, t); o.frequency.exponentialRampToValueAtTime(560 * p, t + 0.035); o.frequency.exponentialRampToValueAtTime(210 * p, t + 0.17);
    o2.frequency.setValueAtTime(165 * p, t); o2.frequency.exponentialRampToValueAtTime(280 * p, t + 0.035); o2.frequency.exponentialRampToValueAtTime(105 * p, t + 0.17);
    bp.type = 'bandpass'; bp.Q.value = 1.6; bp.frequency.setValueAtTime(1300 * p, t); bp.frequency.exponentialRampToValueAtTime(700 * p, t + 0.17);
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    env(g, t, 0.012, vol, 0.2);
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o.connect(bp); o2.connect(g2); g2.connect(bp); bp.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + 0.25); o2.stop(t + 0.25);
    noise(0.07, vol * 0.5, 'bandpass', 1800 * p, 900 * p, 1.2, delay);
  }
  return {
    unlock: ensure,
    tap() { if (!ok()) return; tone(660, 0.07, 'square', 0.12, 990); },
    place() { if (!ok()) return; tone(240, 0.12, 'triangle', 0.35, 120); noise(0.05, 0.2, 'lowpass', 900, 300); tone(880, 0.06, 'square', 0.06, 1320, 0.05); },
    deny() { if (!ok()) return; tone(140, 0.18, 'square', 0.18, 90); tone(120, 0.18, 'square', 0.12, 80, 0.09); },
    crunch(chain = 0) {
      if (!ok()) return; const now = ctx.currentTime; if (now - lastCrunch < 0.03) return; lastCrunch = now;
      const f = 1800 + Math.random() * 1400 + Math.min(chain, 30) * 40;
      noise(0.06, 0.38, 'bandpass', f, f * 0.6, 2.2); noise(0.035, 0.25, 'highpass', 3000, 5000, 0.7, 0.025);
      tone(150 + Math.min(chain, 30) * 6, 0.06, 'sine', 0.22, 60);
    },
    pop(i = 0) { if (!ok()) return; tone(500 + i * 40, 0.08, 'triangle', 0.18, 900 + i * 60); },
    sled() { if (!ok()) return; noise(0.6, 0.35, 'bandpass', 600, 3500, 1.4); tone(520, 0.12, 'square', 0.1, 780); bark(1.25, 0.05, 0.3); },
    clear() { if (!ok()) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, null, i * 0.07)); tone(1568, 0.4, 'sine', 0.12, null, 0.28); },
    combo(n) { if (!ok()) return; [0, 4, 7, 12, 16].forEach((s, i) => tone(523 * Math.pow(2, (s + n * 2) / 12), 0.18, 'square', 0.08, null, i * 0.05)); },
    win() { if (!ok()) return; [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.6 : 0.16, 'triangle', 0.25, null, i * 0.11)); bark(1.15, 0.85, 0.5); bark(1.3, 1.07, 0.45); },
    lose() { if (!ok()) return; [392, 370, 349, 311].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.25, 'sawtooth', 0.12, i === 3 ? 230 : null, i * 0.26)); },
    peg(i) { if (!ok()) return; tone(420 * Math.pow(2, Math.min(i, 24) / 12), 0.16, 'sine', 0.25); tone(840 * Math.pow(2, Math.min(i, 24) / 12), 0.08, 'triangle', 0.06); },
    bone() { if (!ok()) return; [1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.25, 'sine', 0.15, null, i * 0.045)); noise(0.2, 0.1, 'highpass', 6000, 9000, 0.7); },
    launch() { if (!ok()) return; noise(0.3, 0.3, 'bandpass', 400, 2400, 1.5); tone(300, 0.2, 'square', 0.1, 900); },
    bounce() { if (!ok()) return; tone(200, 0.08, 'sine', 0.2, 120); },
    star(i) { if (!ok()) return; tone(880 * Math.pow(2, i * 4 / 12), 0.3, 'triangle', 0.25); tone(1760 * Math.pow(2, i * 4 / 12), 0.2, 'sine', 0.1, null, 0.04); },
    coin() { if (!ok()) return; tone(1320, 0.05, 'square', 0.08); tone(1760, 0.12, 'square', 0.08, null, 0.05); },
    bark(p = 1, d = 0, v = 0.5) { if (!ok()) return; bark(p, d, v); },
    happyBark() { if (!ok()) return; bark(1.18, 0, 0.55); bark(1.32, 0.2, 0.5); bark(1.45, 0.42, 0.45); },
    whoosh() { if (!ok()) return; noise(0.25, 0.2, 'bandpass', 800, 2400, 1); },
  };
})();
