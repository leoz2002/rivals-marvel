import { isSpider, spiderState, updateSpider, restrained, advanceWeb, advanceStar } from "./spider.js";
import { isIron, ironState, updateIron, absorb, boost, anchored } from "./iron.js";
export const EVENTS = [
  "collision",
  "interval",
  "health",
  "damageReceived",
  "damageDealt",
  "special",
  "abilityActivated",
  "death",
];
export const OFFICIAL = {
  6: { hp:400, damage:8, speed:16, mass:8, size:1 },
  5: { hp:250, damage:4, speed:13, mass:12, size:1 },
  0: { hp: 250, damage: 3, speed: 15, mass: 8, size: 1 },
  1: { hp: 60, damage: 1, speed: 10, mass: 6, size: 1 },
  2: { hp: 800, damage: 10, speed: 12, mass: 20, size: 1.4 },
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export class ArenaEngine {
  constructor(config = {}, random = Math.random) {
    this.config = {
      hp: 100,
      damage: 10,
      cooldown: 2,
      velocity: 180,
      minSpeed: 65,
      maxSpeed: 440,
      ...config,
    };
    this.random = random;
    this.width = 900;
    this.height = 540;
    this.balls = [];
    this.time = 0;
    this.hits = 0;
    this.damage = 0;
    this.contacts = new Set();
    this.listeners = [];
    this.effects = [];
    this.projectiles = [];
    this.log = [];
    this.nextId = 1;
    this.castDepth = 0;
  }
  randomInt(a, b) {
    return a + Math.floor(this.random() * (b - a + 1));
  }
  add(character, team, x, y, cloneOf = null) {
    // Super forms can also be placed directly during preparation.
    const a = this.random() * Math.PI * 2,
      b = {
        id: this.nextId++,
        character,
        originalCharacter: character,
        team,
        x,
        y,
        r: 27,
        vx: Math.cos(a) * this.config.velocity,
        vy: Math.sin(a) * this.config.velocity,
        cooldowns: {},
        abilityCooldowns: {},
        abilities: [],
        alive: true,
        cloneOf,
        fury: 0,
        ultCharge: 0,
        punchCount: 0,
        nextFury: this.time + 1,
        invisibleUntil: 0,
        flashUntil: 0,
        form: null,
        jump: null,
        transformUntil: 0,
        launched: null,
      };
    this.configure(b);
    b.hp = b.maxHp;
    this.schedule(b);
    this.balls.push(b);
    return b;
  }
  configure(b) {
    const s = OFFICIAL[b.character] || {
      hp: this.config.hp,
      damage: this.config.damage,
      speed: 10,
      mass: 8,
      size: 1,
    };
    b.maxHp = b.cloneOf ? 5 : s.hp;
    b.attack = b.cloneOf ? 1 : s.damage;
    b.mass = b.cloneOf ? 8 : s.mass;
    b.r = 27 * s.size;
    b.speed = ((b.cloneOf ? 11 : s.speed) * this.config.velocity) / 10;
    const angle = Math.atan2(b.vy, b.vx);
    b.vx = Math.cos(angle) * b.speed;
    b.vy = Math.sin(angle) * b.speed;
  }
  schedule(b) {
    b.next = {
      smash: this.time + 8,
      punch: this.time,
      jump: this.time + 12,
      ray: this.time + 2.5,
      heal: this.time + 3,
      clone: this.time + 7,
      blink: this.time + 16,
      morph: this.time + 25,
    };
  }
  emit(event, ball, context = {}) {
    if (this.castDepth >= 8) return;
    this.castDepth++;
    try {
      for (const fn of this.listeners) fn(event, ball, context);
      for (const ability of ball.abilities) {
        if (
          !ability.enabled ||
          ability.trigger !== event ||
          (ball.abilityCooldowns[ability.id] ?? -Infinity) > this.time ||
          (ability.condition && !ability.condition(ball, context, this))
        )
          continue;
        ball.abilityCooldowns[ability.id] =
          this.time + Math.max(0.001, ability.cooldown ?? 0);
        ability.execute({ ball, context, engine: this });
        this.emit("abilityActivated", ball, { ability: ability.id });
      }
    } finally {
      this.castDepth--;
    }
  }
  effect(type, x, y, extra = {}) {
    this.effects.push({ type, x, y, life: 0.7, maxLife: 0.7, ...extra });
  }
  cast(b, name, color = "#b4ff78") {
    b.invisibleUntil = 0;
    b.flashUntil = this.time + 0.5;
    b.flashColor = color;
    this.log.unshift({
      time: this.time,
      id: b.id,
      character: b.character,
      name,
    });
    this.log = this.log.slice(0, 6);
    this.emit("abilityActivated", b, { ability: name });
  }
  target(b, range = Infinity) {
    return this.balls
      .filter(
        (t) =>
          t.alive &&
          t.hp > 0 &&
          t.team !== b.team &&
          t.invisibleUntil <= this.time &&
          !t.jump &&
          distance(t, b) <= range,
      )
      .sort((a, c) => distance(a, b) - distance(c, b))[0];
  }
  startTransformation(b) {
    if (!b.alive || b.hp <= 0 || b.transformUntil) return;
    b.fury = 100;
    b.transformStart = this.time;
    b.transformUntil = this.time + 1.2;
    this.cast(b, "Fúria máxima", "#ff7b5b");
  }
  hurt(source, b, amount, kind = "ability") {
    if (!b.alive || b.hp <= 0 || b.transformUntil > this.time || b.jump || b.star)
      return 0;
    // A living personal decoy takes the lethal hit before damage is applied.
    if (b.character === 0 && !b.cloneOf && amount >= b.hp) {
      const substitute = this.balls.filter(c => c.alive && c.hp > 0 && c.cloneOf === b.id && c.team === b.team && !c.jump)
        .sort((a,c) => distance(a,b)-distance(c,b))[0];
      if (substitute) {
        [b.x,substitute.x]=[substitute.x,b.x];
        [b.y,substitute.y]=[substitute.y,b.y];
        this.cast(b,"SUBSTITUIÇÃO!","#b8f5e0");
        this.effect("ring",b.x,b.y,{radius:75,color:"#b8f5e0"});
        this.effect("text",b.x,b.y-b.r-20,{text:"SUBSTITUIÇÃO!",color:"#b8f5e0",life:1.5,maxLife:1.5});
        this.hurt(source,substitute,amount,kind);
        return 0;
      }
    }
    const blocked = absorb(this,b,Math.max(0,amount));
    amount = Math.min(b.hp, Math.max(0, amount-blocked));
    if (!amount) return blocked;
    b.hp -= amount;
    if (source.character === 0 && !source.cloneOf && !source.form) source.ultCharge = Math.min(100, source.ultCharge + amount / 2);
    this.hits++;
    this.damage += amount;
    this.effect("text", b.x, b.y - b.r, {
      text: "−" + amount,
      color: kind === "contact" ? "#ffe2a3" : "#ffaf7b",
    });
    this.emit("damageDealt", source, { target: b, amount, kind });
    this.emit("damageReceived", b, { source, amount, kind });
    this.emit("health", b, { ratio: b.hp / b.maxHp });
    if (
      b.character === 1 &&
      !b.form &&
      !b.cloneOf &&
      kind === "contact" &&
      b.hp > 0
    ) {
      b.fury = Math.min(100, b.fury + this.randomInt(2, 10));
      if (b.fury >= 100) this.startTransformation(b);
    }
    if (b.hp <= 0) {
      this.emit("death", b);
      if (b.hp <= 0 && b.character === 3 && !b.form) {
        b.character = 4;
        this.configure(b);
        b.hp = b.maxHp;
        this.cast(b, "VOID DESPERTA", "#b285ff");
        this.effect("ring", b.x, b.y, {
          radius: 120,
          color: "#b285ff",
          life: 1,
          maxLife: 1,
        });
      } else if (b.hp <= 0) {
        b.alive = false;
        b.jump = null;
        this.effect("ring", b.x, b.y, { radius: b.r * 2, color: "#8d99aa" });
      }
    }
    return amount+blocked;
  }
  interruptConcentration(b, source) {
    if (!b.alive || b.team === source.team || b.jump) return false;
    if (!b.arc && !b.concentration) return false;
    const angle = b.arc?.angle ?? Math.atan2(b.vy,b.vx);
    b.arc = null;
    if (b.concentration) { b.concentration.cancel?.(); b.concentration = null; }
    if (b.iron) { b.iron.shots=0; b.iron.burstAt=this.time+2.5; }
    b.vx=Math.cos(angle+Math.PI/2)*b.speed;
    b.vy=Math.sin(angle+Math.PI/2)*b.speed;
    this.effect("text",b.x,b.y-b.r-18,{text:"INTERROMPIDO!",color:"#ffd78a",life:1.2,maxLife:1.2});
    this.emit("special",b,{type:"concentrationInterrupted",source});
    return true;
  }
  area(b, radius, amount, kind = "ability", except = null) {
    for (const t of this.balls)
      if (
        t.alive &&
        t.id !== except &&
        t.team !== b.team &&
        distance(t, b) <= radius + t.r
      )
        this.hurt(b, t, amount, kind);
  }
  impact(b) {
    if (
      !b.launched ||
      b.launched.until < this.time ||
      b.launched.remaining <= 0 ||
      this.time - b.launched.last < 0.12
    )
      return;
    const launch = b.launched;
    if(launch.web)this.emit("special",launch.source,{type:"webImpact"});
    launch.last = this.time;
    launch.remaining--;
    this.hurt(launch.source, b, launch.damage, "impact");
    this.effect("ring", b.x, b.y, { radius: 50, color: "#ffca67" });
    if (!launch.remaining) b.launched = null;
  }
  limit(b) {
    const boosted = b.launched && b.launched.until > this.time,
      max = boosted ? 800 : this.config.maxSpeed;
    let v = Math.hypot(b.vx, b.vy);
    if (!v) {
      b.vx = b.speed;
      v = b.speed;
    }
    const target = Math.max(
      Math.min(b.cloneOf ? b.speed * .8 : this.config.minSpeed, b.speed),
      Math.min(max, v),
    );
    b.vx *= target / v;
    b.vy *= target / v;
  }
  wall(b) {
    let hit = false;
    if (b.x < b.r) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
      hit = true;
    }
    if (b.x > this.width - b.r) {
      b.x = this.width - b.r;
      b.vx = -Math.abs(b.vx);
      hit = true;
    }
    if (b.y < b.r) {
      b.y = b.r;
      b.vy = Math.abs(b.vy);
      hit = true;
    }
    if (b.y > this.height - b.r) {
      b.y = this.height - b.r;
      b.vy = -Math.abs(b.vy);
      hit = true;
    }
    if (hit) {
      boost(this,b);
      this.impact(b);
      this.emit("special", b, { type: "wallHit", speed: Math.hypot(b.vx,b.vy) });
    }
  }
  hit(a, b, nx, ny) {
    if (!a.alive || a.transformUntil > this.time || a.jump) return;
    if (restrained(a,this.time)||a.star) return;
    if(isSpider(a)) {if(distance(a,b)>a.r+b.r+6)return;const s=spiderState(a);if(this.time<s.nextPunch)return;s.nextPunch=this.time+.5;this.hurt(a,b,8*(a.form?.5:1),'contact');a.spiderPunchUntil=this.time+.3;a.spiderPunchAngle=Math.atan2(b.y-a.y,b.x-a.x);a.spiderCombo=false;this.emit('special',a,{type:'spiderPunch'});return;}
    const isHulk = (a.form?.character ?? a.character) === 2;
    if (isHulk) {
      if (a.pendingPunch || this.time < a.next.punch) return;
      a.pendingPunch = {target:b.id, at:this.time, factor:a.form?.5:1};
      a.punchAngle = Math.atan2(ny,nx);
      a.windupUntil = this.time;
      this.resolvePunch(a);
      return;
    }
    if ((a.cooldowns[b.id] ?? -Infinity)>this.time) return;
    a.cooldowns[b.id]=this.time+this.config.cooldown;
    if(this.hurt(a,b,a.attack,'contact')) {b.vx+=nx*28;b.vy+=ny*28;}
  }
  resolvePunch(a) {
    if(restrained(a,this.time)){a.pendingPunch=null;return;}
    const pending=a.pendingPunch;
    if(!pending || this.time<pending.at)return;
    a.pendingPunch=null;a.next.punch=this.time+.5;
    if(!a.alive || a.jump || (a.form?.character??a.character)!==2)return;
    const b=this.balls.find(b=>b.id===pending.target&&b.alive);
    a.punchUntil=this.time+.25;
    if(!b || b.team===a.team)return;
    const d=distance(a,b)||1,nx=(b.x-a.x)/d,ny=(b.y-a.y)/d;
    a.punchAngle=Math.atan2(ny,nx);
    if(this.hurt(a,b,10*pending.factor,'contact')) {
      a.punchCount = Math.min(8, a.punchCount + 1);
      this.cast(a,'HULK PUNCH','#d4ff6b');
      b.vx=nx*650;b.vy=ny*650;
      if(b.alive)b.launched={source:a,remaining:3,damage:5*pending.factor,until:this.time+4,last:this.time};
    }
  }
  projectile(b, t, kind, amount) {
    const dx = t.x - b.x,
      dy = t.y - b.y,
      d = Math.hypot(dx, dy) || 1;
    const speed = kind === "ray" ? 520 : 440;
    this.projectiles.push({
      x: b.x,
      y: b.y,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      source: b,
      team: b.team,
      targetId: t.id,
      kind,
      amount,
      life: kind === "heal" ? 2 : 540 / speed,
    });
    b.castAngle = Math.atan2(dy, dx);
  }
  updatePowers(b, dt) {
    if(restrained(b,this.time))return;
    if (b.character === 0 && !b.cloneOf && !b.form) b.ultCharge = Math.min(100, b.ultCharge + 3 * dt);
    if (b.transformUntil) {
      if (this.time >= b.transformUntil) {
        b.character = 2;
        b.transformUntil = 0;
        this.configure(b);
        b.hp = 800;
        this.schedule(b);
        this.cast(b, "HULK SMASH!", "#c5ff65");
        this.effect("ring", b.x, b.y, {
          radius: 150,
          color: "#b4ff78",
          life: 1,
          maxLife: 1,
        });
        this.emit("special", b, { type: "hulkTransformed" });
        this.wall(b);
      }
      return;
    }
    if (b.form && this.time >= b.form.until) {
      b.star = null;
      b.spider = null;
      b.form = null;
      b.jump = null;
      b.arc = null;
      b.iron = null;
      b.next.morph = this.time + 25;
      this.effect("ring", b.x, b.y, { radius: 70, color: "#bd8aff" });
    }
    if (b.character === 1 && !b.form && !b.cloneOf) {
      while (this.time >= b.nextFury) {
        b.nextFury += 1;
        b.fury = Math.min(100, b.fury + this.randomInt(1, 5));
      }
      if (b.fury >= 100) this.startTransformation(b);
      return;
    }
    if (isSpider(b)) {updateSpider(this,b);return;}
    if (isIron(b)) { updateIron(this,b,dt); return; }
    if (b.arc) b.arc=null;
    const kind = b.form?.character ?? b.character,
      factor = b.cloneOf || b.form ? 0.5 : 1;
    if (kind === 2) {
      if (b.jump) return;
      if (b.punchCount >= 8) {
        const target = this.target(b);
        if (target) {
          b.punchCount = 0;
          b.jump = {
            start: this.time,
            end: this.time + 1.5,
            x: b.x,
            y: b.y,
            tx: Math.max(b.r, Math.min(this.width - b.r, target.x)),
            ty: Math.max(b.r, Math.min(this.height - b.r, target.y)),
            targetId: target.id,
            factor,
          };
          this.cast(b, "SALTO", "#f7d578");
          return;
        }
      }
      if (this.time >= b.next.smash) {
        b.next.smash = this.time + 8;
        this.cast(b, "SMASH", "#c5ff65");
        b.smashUntil = this.time + 0.7;
        const range = 3 * 27 * 1.4;
        this.effect("smash", b.x, b.y, {
          radius: range,
          color: "#c5ff65",
          life: 0.8,
          maxLife: 0.8,
        });
        this.area(b, range, 18 * factor);
      }
    }
    if (kind !== 0) return;
    if (!b.cloneOf && !b.form && this.time >= b.next.blink) {
      const clones = this.balls
        .filter((c) => c.alive && c.cloneOf === b.id && distance(c, b) < 400)
        .sort((a, c) => distance(a, b) - distance(c, b));
      if (clones.length) {
        const c = clones[0];
        [b.x, c.x] = [c.x, b.x];
        [b.y, c.y] = [c.y, b.y];
        this.cast(b, "PISCAR", "#c39dff");
        b.invisibleUntil = this.time + 6;
        b.next.blink = this.time + 16;
        this.effect("ring", b.x, b.y, { radius: 70, color: "#c39dff" });
        this.effect("ring", c.x, c.y, { radius: 70, color: "#c39dff" });
        return;
      }
    }
    if (!b.cloneOf && !b.form && b.ultCharge >= 100) {
      // Catalog forms, independent of which fighters are in this match.
      // Exclude Loki himself to prevent chained metamorphosis.
      const candidates = [1, 2, 3, 4, 5, 6];
      if (candidates.length) {
        const target = candidates[this.randomInt(0, candidates.length - 1)];
        b.ultCharge = 0;
        b.punchCount = 0;
        b.spider = null;
        b.iron = null;
        b.arc = null;
        b.form = { character: target, until: this.time + 10 };
        b.next.morph = Infinity;
        b.next.smash = this.time + 2;
        b.next.jump = this.time + 4;
        b.next.punch = this.time;
        this.cast(b, "METAMORFOSE", "#bc91ff");
        this.effect("ring", b.x, b.y, { radius: 80, color: "#bc91ff" });
        return;
      }
    }
    if (!b.cloneOf && !b.form && this.time >= b.next.clone) {
      b.next.clone = this.time + 7;
      const clones = this.balls.filter((c) => c.alive && c.cloneOf === b.id);
      if (clones.length < 5 && this.balls.filter((c) => c.alive).length < 180) {
        const angle = this.random() * Math.PI * 2,
          c = this.add(
            0,
            b.team,
            b.x + Math.cos(angle) * 60,
            b.y + Math.sin(angle) * 60,
            b.id,
          );
        // Spawn in free space, then launch away from the summoner.
        for(let attempt=0;attempt<32;attempt++) {
          const direction=angle+attempt*Math.PI/16;
          const radius=70+Math.floor(attempt/16)*50;
          c.x=Math.max(c.r,Math.min(this.width-c.r,b.x+Math.cos(direction)*radius));
          c.y=Math.max(c.r,Math.min(this.height-c.r,b.y+Math.sin(direction)*radius));
          c.vx=Math.cos(direction)*c.speed;c.vy=Math.sin(direction)*c.speed;
          if(this.balls.every(other=>other===c||!other.alive||distance(c,other)>c.r+other.r+2))break;
        }
        this.wall(c);
        this.cast(b, "FALSOS LOKI", "#aab3ad");
        this.effect("ring", c.x, c.y, { radius: 45, color: "#aab3ad" });
      }
    }
    if (this.time >= b.next.ray) {
      const t = this.target(b, 540);
      if (t) {
        const approaching =
          (t.x - b.x) * (t.vx - b.vx) + (t.y - b.y) * (t.vy - b.vy) < 0;
        const amount = Math.floor((approaching ? 4 : 6) * factor);
        this.projectile(b, t, "ray", amount);
        b.next.ray = this.time + 2.5;
        this.cast(b, "RAIO DE ENERGIA", "#68dfff");
      }
    }
    if (this.time >= b.next.heal) {
      const t = this.balls
        .filter(
          (t) =>
            t.alive &&
            t.team === b.team &&
            t.hp < t.maxHp &&
            distance(t, b) <= 360,
        )
        .sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
      if (t) {
        const amount = Math.floor(3 * factor);
        b.next.heal = this.time + 3;
        this.cast(b, "TIRO DE CURA", "#85ffb2");
        if (t.id === b.id) this.heal(t, amount);
        else this.projectile(b, t, "heal", amount);
      }
    }
  }
  heal(b, amount) {
    const healed = Math.min(amount, b.maxHp - b.hp);
    if (healed > 0) {
      b.hp += healed;
      this.emit("special", b, {type:"healed", amount:healed});
      this.effect("text", b.x, b.y - b.r, {
        text: "+" + healed,
        color: "#85ffb2",
      });
    }
  }
  step(dt) {
    this.time += dt;
    for (const b of [...this.balls]) {
      if (!b.alive) continue;
      if(b.launched && b.launched.until < this.time)b.launched=null;
      this.emit("interval", b, { dt });
      this.updatePowers(b, dt);
      if ((b.form?.character ?? b.character) === 2 && !b.jump && !b.pendingPunch && this.time >= b.next.punch) {
        const nearby = this.balls.filter(t => t.alive && t.team !== b.team && !t.jump && t.invisibleUntil <= this.time && distance(b,t) <= b.r+t.r+120).sort((a,c) => distance(b,a)-distance(b,c))[0];
        if (nearby) this.hit(b, nearby, nearby.x-b.x, nearby.y-b.y);
      }
      if(isSpider(b)&&!restrained(b,this.time)&&!b.star){const t=this.target(b);if(t && distance(b,t)<=b.r+t.r+6)this.hit(b,t,1,0);}
      this.resolvePunch(b);
      if (!b.alive) continue;
      if(b.webMotion){advanceWeb(this,b);} else if(b.stunUntil>this.time){b.x=b.stunX;b.y=b.stunY;b.vx=b.vy=0;} else if(b.star){advanceStar(this,b);} else if (anchored(b)) { b.vx=b.vy=0; b.x=b.arc.x; b.y=b.arc.y; } else if (b.jump) {
        const j = b.jump,
          t = Math.min(1, (this.time - j.start) / 1.5);
        const tracked=this.balls.find(other=>other.id===j.targetId&&other.alive&&other.invisibleUntil<=this.time);
        if(tracked){
          j.guidedX=Math.max(b.r,Math.min(this.width-b.r,j.tx+(tracked.x-j.tx)*.4));
          j.guidedY=Math.max(b.r,Math.min(this.height-b.r,j.ty+(tracked.y-j.ty)*.4));
        }
        b.x = j.x + ((j.guidedX??j.tx) - j.x) * t;
        b.y = j.y + ((j.guidedY??j.ty) - j.y) * t;
        if (this.time >= j.end) {
          b.jump = null;
          this.effect("smash", b.x, b.y, {
            radius: 150,
            color: "#f7d578",
            life: 0.8,
            maxLife: 0.8,
          });
          // Landing interrupts channelled ultimates even if a shield absorbs damage.
          for (const enemy of this.balls) {
            if (enemy.alive && enemy.team !== b.team && !enemy.jump && distance(enemy,b)<=150+enemy.r)
              this.interruptConcentration(enemy,b);
          }
          const target = this.balls.find((t) => t.id === j.targetId && t.alive);
          let direct = null;
          if (target && distance(target, b) <= b.r + target.r + 30) {
            this.hurt(b, target, 35 * j.factor);
            direct = target.id;
          }
          this.area(b, 150, 18 * j.factor, "ability", direct);
          b.smashUntil = this.time + 0.5;
        }
      } else {
        this.limit(b);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        this.wall(b);
        if (Math.floor(this.time / 4) !== Math.floor((this.time - dt) / 4)) {
          const angle = (this.random() - 0.5) * 0.15,
            c = Math.cos(angle),
            s = Math.sin(angle),
            vx = b.vx;
          b.vx = vx * c - b.vy * s;
          b.vy = vx * s + b.vy * c;
        }
      }
    }
    const live = this.balls.filter((b) => b.alive && !b.jump && !b.star && !restrained(b,this.time)),
      contacts = new Set();
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i],
          b = live[j];
        if (!a.alive || !b.alive) continue;
        let dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy),
          r = a.r + b.r;
        if (d > r + 0.3) continue;
        const key = a.id + ":" + b.id;
        contacts.add(key);
        if (d < 0.001) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const nx = dx / d,
          ny = dy / d,
          overlap = Math.max(0, r - d),
          sum = a.mass + b.mass;
        a.x -= (nx * (overlap + 0.04) * b.mass) / sum;
        a.y -= (ny * (overlap + 0.04) * b.mass) / sum;
        b.x += (nx * (overlap + 0.04) * a.mass) / sum;
        b.y += (ny * (overlap + 0.04) * a.mass) / sum;
        const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (relative < 0) {
          const impulse = (2 * relative) / (1 / a.mass + 1 / b.mass);
          a.vx += (impulse * nx) / a.mass;
          a.vy += (impulse * ny) / a.mass;
          b.vx -= (impulse * nx) / b.mass;
          b.vy -= (impulse * ny) / b.mass;
        }
        if (!this.contacts.has(key)) {
          this.impact(a);
          this.impact(b);
          this.emit("collision", a, { target: b, enemy: a.team !== b.team });
          this.emit("collision", b, { target: a, enemy: a.team !== b.team });
          if (a.team !== b.team) {
            this.hit(a, b, nx, ny);
            this.hit(b, a, -nx, -ny);
          }
        }
      }
    this.contacts = contacts;
    for (const b of live) {
      this.wall(b);
      if (anchored(b)) {b.x=b.arc.x;b.y=b.arc.y;b.vx=b.vy=0;} else this.limit(b);
    }
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.kind === "ray") {
        const target = this.balls.find(b => b.id === p.targetId && b.alive && b.team !== p.team && b.invisibleUntil <= this.time);
        if (target) {
          const desired = Math.atan2(target.y-p.y,target.x-p.x);
          const current = Math.atan2(p.vy,p.vx);
          const delta = Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
          // Correct 35% of heading error per second, independent of FPS.
          const heading = current + delta * (1-Math.pow(.65,dt));
          const speed = Math.hypot(p.vx,p.vy);
          p.vx=Math.cos(heading)*speed;p.vy=Math.sin(heading)*speed;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      for (const b of this.balls) {
        if (
          !b.alive ||
          b.jump ||
          b.id === p.source.id ||
          (p.kind === "heal" && (b.id !== p.targetId || b.team !== p.team)) ||
          (p.kind !== "heal" && b.team === p.team)
        )
          continue;
        if (distance(p, b) <= b.r + 5) {
          if (p.kind === "heal") this.heal(b, p.amount);
          else {
            const before=this.damage;
            const hit=this.hurt(p.source,b,p.amount,"projectile");
            if(p.kind==="repulsor"&&!p.counted&&(hit>0||this.damage>before)&&!p.source.arc){
              p.counted=true;const reactor=ironState(p.source);reactor.hits=Math.min(12,reactor.hits+1);
            }
          }
          p.life = 0;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter(
      (p) =>
        p.life > 0 &&
        p.x >= 0 &&
        p.y >= 0 &&
        p.x <= this.width &&
        p.y <= this.height,
    );
    this.effects = this.effects.filter((e) => (e.life -= dt) > 0);
    for (const e of this.effects) if (e.type === "text") e.y -= dt * 22;
    // Dead clones do not accumulate indefinitely in long matches.
    this.balls = this.balls.filter((b) => b.alive || !b.cloneOf);
  }
  snapshot() {
    return {
      width: this.width,
      height: this.height,
      config: { ...this.config },
      balls: this.balls
        .filter((b) => !b.cloneOf)
        .map(({ originalCharacter, team, x, y }) => ({
          character: originalCharacter,
          team,
          x,
          y,
        })),
    };
  }
  restore(s) {
    this.width = s.width;
    this.height = s.height;
    this.config = { ...this.config, ...s.config };
    this.balls = [];
    this.time = 0;
    this.hits = 0;
    this.damage = 0;
    this.effects = [];
    this.projectiles = [];
    this.log = [];
    this.contacts.clear();
    this.nextId = 1;
    for (const b of s.balls) this.add(b.character, b.team, b.x, b.y);
  }
}
