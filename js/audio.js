let ctx = null;
let masterGain = null;
let osc = null;
let oscGain = null;
let muted = false;
let volume = 0.3;
let currentFreq = 440;
let micStream = null;
let micAnalyser = null;

export const audio = {
  isSupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  },

  _ensureCtx() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : volume;
      masterGain.connect(ctx.destination);
      return true;
    } catch (e) {
      console.error('[audio] init falhou:', e);
      return false;
    }
  },

  async unlock() {
    if (!this._ensureCtx()) return false;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (_) { return false; }
    }
    return true;
  },

  setMuted(m) {
    muted = m;
    if (masterGain && ctx) {
      const amp = this._ampAtual || 1;
      const volumeFinal = m ? 0 : (volume * amp);
      masterGain.gain.setTargetAtTime(volumeFinal, ctx.currentTime, 0.03);
    }
  },

  isMuted() { return muted; },

  setAmplitude(amp) {
    // amp: 0..1 (10% a 100% no slider)
    // Mantemos o volume máximo em 30% por segurança, mas a amplitude
    // percebida varia de 10% a 100% do limite.
    const ampClamped = Math.max(0.1, Math.min(1, Number(amp) || 1));
    if (masterGain && ctx) {
      const volumeFinal = muted ? 0 : (volume * ampClamped);
      masterGain.gain.setTargetAtTime(volumeFinal, ctx.currentTime, 0.03);
    }
    // Guarda para reaplicar ao trocar mute
    this._ampAtual = ampClamped;
  },


  setFrequency(f) {
    currentFreq = f;
    if (osc && ctx) {
      osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.02);
    }
  },

  startContinuous(freq) {
    if (!this._ensureCtx()) return false;
    if (freq !== undefined) currentFreq = freq;
    if (!osc) {
      osc = ctx.createOscillator();
      oscGain = ctx.createGain();
      oscGain.gain.value = 0;
      osc.type = 'sine';
      osc.frequency.value = currentFreq;
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start();
    } else {
      osc.frequency.setTargetAtTime(currentFreq, ctx.currentTime, 0.02);
    }
    oscGain.gain.setTargetAtTime(1, ctx.currentTime, 0.03);
    return true;
  },

  stopContinuous() {
    if (oscGain && ctx) {
      oscGain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    }
  },

  async startMic() {
    if (micStream) return micAnalyser;
    if (!this._ensureCtx()) throw new Error('Web Audio não suportada');
    await this.unlock();
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const source = ctx.createMediaStreamSource(micStream);
      micAnalyser = ctx.createAnalyser();
      micAnalyser.fftSize = 2048;
      micAnalyser.smoothingTimeConstant = 0.1;
      source.connect(micAnalyser);
      return micAnalyser;
    } catch (e) {
      if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
      throw e;
    }
  },

  stopMic() {
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
      micAnalyser = null;
    }
  },

  isMicActive() { return !!micStream; },
  getMicAnalyser() { return micAnalyser; },

  cleanup() {
    this.stopContinuous();
    this.stopMic();
    if (osc) { try { osc.stop(); } catch (_) {} osc = null; oscGain = null; }
  }
};
