// Decode once, reuse buffers, and limit overlapping effects in crowded arenas.
export class GameAudio {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.buffers = new Map();
    this.active = new Set();
    this.last = new Map();
    this.wallIndex = 0;
    this.loops = new Map();
    this.beamLoops = new Map();
    this.files = {
      web0:"man-web.mp3",web1:"web-shooter.mp3",web2:"spider-man-customized-web-thwip-sound-effect-1_ybmate.mp3",
      spiderUlt:"Voicy_dont mess with the amazing spider man.mp3",spiderPunch:"crazy-diamond-punch.mp3",webImpact:"breaking-the-wall-sounds.mp3",
      arcBeam:"laser-beam.mp3",
      arcPrepare:"xf-09-ares-getting-enraged.mp3", arcPulse:"maximum-pulse_vfQwHu8.mp3",
      repulsorPrepare:"iron-man-s-repulsion-beam.mp3", repulsorShot:"roblox-laser-gun.mp3",
      shieldHit:"fortnite-shield-break.mp3", shieldUp:"sci-fi-energy-shield-up-3.mp3",
      boost:"magic-sound-jump-fire.mp3", boostFire:"battle-sounds-se-btl-cmn-fire-jump.mp3",
      wall0: "door-slam.mp3",
      wall1: "door-slamming-sound-effect-no-repeats-or-silence-2016.mp3",
      punch: "jojo-punch.mp3",
      jump: "mega-knight-huuu.mp3",
      transform: "smash.mp3",
      heal:"flask-of-crimson-tears.mp3", clone:"spirit-calling-bell-sound-effect.mp3", ray:"elden-ring---glintstone-pebble-made-with-Voicemod.mp3", morph:"loki-edit.mp3",
    };
  }
  async unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.loading = Promise.all(
        Object.entries(this.files).map(async ([name, file]) => {
          try {
            const response = await fetch("assets/audio/" + file);
            if (!response.ok) return;
            this.buffers.set(
              name,
              await this.context.decodeAudioData(await response.arrayBuffer()),
            );
          } catch (error) {
            console.warn("Audio unavailable:", name);
          }
        }),
      );
    }
    await this.context.resume();
  }
  stop() {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {}
    }
    this.active.clear();
    for(const source of this.loops.values()){try{source.stop();}catch{}}
    this.loops.clear();
    for(const source of this.beamLoops.values()){try{source.stop();}catch{}}
    this.beamLoops.clear();
  }
  setEnabled(value) {
    this.enabled = value;
    if (!value) this.stop();
    else this.unlock();
  }
  stopFor(owner, names) {
    for (const source of this.active) if (source.owner===owner && names.includes(source.soundName)) { try { source.stop(); } catch {} }
  }
  play(name, impactSpeed=0, owner=null) {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    const wall = name === "wall";
    const now = this.context.currentTime;
    if (now - (this.last.get(name) ?? -Infinity) < (wall ? 0.1 : 0.08)) return;
    const key = wall ? "wall" + this.wallIndex : name,
      buffer = this.buffers.get(key);
    if (!buffer) return;
    if (this.active.size >= 8) {
      if (wall) return;
      this.active.values().next().value.stop();
    }
    this.last.set(name, now);
    if (wall) this.wallIndex = 1 - this.wallIndex;
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    source.owner=owner; source.soundName=name;
    gain.gain.value = wall ? (impactSpeed>=350 ? .65 : .08+Math.min(impactSpeed/350,1)*.1) : name === "transform" ? 0.8 : 0.55;
    source.connect(gain);
    gain.connect(this.context.destination);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    this.active.add(source);
    source.start();
  }
  syncBeams(balls,time,running) {
    const wanted=new Set(running&&this.enabled?balls.filter(b=>b.alive&&b.arc&&time>=b.arc.fireAt&&time<b.arc.end).map(b=>b.id):[]);
    for(const [id,source] of this.beamLoops)if(!wanted.has(id)){try{source.stop();}catch{}this.beamLoops.delete(id);}
    const buffer=this.buffers.get("arcBeam");
    if(!buffer||!this.context||this.context.state!=="running")return;
    for(const id of wanted)if(!this.beamLoops.has(id)){
      const source=this.context.createBufferSource(),gain=this.context.createGain();
      source.buffer=buffer;source.loop=true;gain.gain.value=.4/Math.sqrt(wanted.size);
      source.connect(gain);gain.connect(this.context.destination);
      source.onended=()=>{source.disconnect();gain.disconnect();};
      const ball=balls.find(b=>b.id===id);
      source.start(0,Math.max(0,time-ball.arc.fireAt)%buffer.duration);
      this.beamLoops.set(id,source);
    }
  }
  syncMorphs(balls, time, running) {
    const wanted=new Set(running&&this.enabled?balls.filter(b=>b.alive&&b.form&&b.form.until>time).map(b=>b.id):[]);
    for(const [id,source] of this.loops)if(!wanted.has(id)){source.stop();this.loops.delete(id);}
    if(!this.context||this.context.state!=='running'||!this.buffers.has('morph'))return;
    for(const id of wanted)if(!this.loops.has(id)){
      const source=this.context.createBufferSource(),gain=this.context.createGain();
      source.buffer=this.buffers.get('morph');source.loop=true;gain.gain.value=.3/Math.sqrt(wanted.size);
      source.connect(gain);gain.connect(this.context.destination);
      source.onended=()=>{source.disconnect();gain.disconnect();};
      const ball=balls.find(b=>b.id===id), elapsed=Math.max(0,10-(ball.form.until-time));
      source.start(0,elapsed%source.buffer.duration);this.loops.set(id,source);
    }
  }

}
