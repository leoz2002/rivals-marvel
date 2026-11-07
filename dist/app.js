import { GameAudio } from "./audio.js";
const gameAudio = new GameAudio();
import { ArenaEngine, OFFICIAL } from "./engine.js";
const $ = (id) => document.getElementById(id),
  engine = new ArenaEngine();
const characters = [
  {
    name: "Loki",
    file: "01-1000247873.jpg",
    crop: [70, 290, 1156, 1156],
    note: "Deus da trapaça",
  },
  {
    name: "Bruce Banner",
    file: "04-1000247418.jpg",
    crop: [133, 529, 470, 470],
    note: "Forma humana",
  },
  {
    name: "Hulk",
    file: "03-1000247410.jpg",
    crop: [127, 521, 480, 480],
    note: "Gigante esmeralda",
  },
  {
    name: "Sentry",
    file: "06-1000247401.jpg",
    crop: [168, 533, 388, 388],
    note: "Sentinela dourado",
  },
  {
    name: "Void",
    file: "05-1000247404.jpg",
    crop: [194, 579, 388, 388],
    note: "O lado sombrio",
  },
  {
    name: "Homem de Ferro",
    file: "02-1000247424.jpg",
    crop: [133, 529, 470, 470],
    note: "Vingador blindado",
  },
  {name:"Homem-Aranha",file:"spider-token.jpg",crop:[76,494,560,560],note:"Teias, mobilidade e controle"},
];
const attackArt = {};
let soundOn = true;
const teams = ["Azul", "Coral", "Verde", "Violeta"],
  colors = ["#78baff", "#ff897d", "#9bd476", "#bb9cff"];
let state = "prep",
  speed = 1,
  selected = null,
  zoom = 1,
  formation = null,
  drag = null,
  acc = 0,
  last = 0,
  toastTimer;
const canvas = $("arena"),
  ctx = canvas.getContext("2d");
function toast(t) {
  $("toast").textContent = t;
  $("toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").style.display = "none"), 2800);
}
let lightweight = true;
const spriteCache = new Map();
function sprite(context, index, x, y, r, gray = false) {
  const key = index + ":" + gray;
  if (!spriteCache.has(key)) {
    const cached = document.createElement("canvas");
    cached.width = cached.height = 160;
    sourceSprite(cached.getContext("2d"), index, 80, 80, 76, gray);
    spriteCache.set(key, cached);
  }
  const size = (r * 160) / 76;
  context.drawImage(
    spriteCache.get(key),
    x - size / 2,
    y - size / 2,
    size,
    size,
  );
}
function sourceSprite(context, index, x, y, r, gray = false) {
  const c = characters[index];
  context.save();
  if (gray) context.filter = "grayscale(80%) saturate(35%)";
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "#000";
  context.fillRect(x - r, y - r, r * 2, r * 2);
  if (c.image?.complete && c.image.naturalWidth)
    context.drawImage(c.image, ...c.crop, x - r, y - r, r * 2, r * 2);
  context.restore();
  context.strokeStyle = "#000";
  context.lineWidth = Math.max(2, r * 0.07);
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2);
  context.stroke();
}
function portrait(index) {
  const el = document.createElement("canvas");
  el.width = el.height = 128;
  sprite(el.getContext("2d"), index, 64, 64, 61);
  return el;
}
function resize() {
  const available = Math.max(220, $("viewport").clientWidth - 42),
    height = $("viewport").clientHeight - 42;
  const scale =
    Math.min(available / engine.width, height / engine.height) * zoom;
  canvas.style.width = engine.width * scale + "px";
  canvas.style.height = engine.height * scale + "px";
  const pixelRatio = lightweight ? 1 : Math.min(devicePixelRatio, 2);
  canvas.width = engine.width * pixelRatio;
  canvas.height = engine.height * pixelRatio;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  $("zoomLabel").textContent = Math.round(zoom * 100) + "%";
  $("dimensions").textContent = engine.width + " × " + engine.height;
}
function selection() {
  const el = $("selected");
  el.replaceChildren();
  const b = engine.balls.find((b) => b.id === selected);
  if (!b) {
    el.innerHTML =
      '<p class="empty">Clique em uma bolinha na arena para alterar sua equipe ou removê-la.</p>';
    return;
  }
  el.dataset.visual = (b.form?.character ?? b.character) + ":" + b.cloneOf;
  const info = document.createElement("div");
  info.className = "selection";
  info.append(portrait(b.form?.character ?? b.character));
  const text = document.createElement("div");
  text.innerHTML =
    "<b>" +
    characters[b.character].name +
    (b.cloneOf ? " · Clone" : "") +
    "</b><small>" +
    Math.ceil(b.hp) +
    " / " +
    b.maxHp +
    " HP · #" +
    b.id +
    "</small>";
  info.append(text);
  el.append(info);
  const actions = document.createElement("div");
  actions.className = "selected-actions";
  const sel = document.createElement("select");
  sel.setAttribute("aria-label", "Equipe do personagem");
  teams.forEach((name, i) => sel.add(new Option("Equipe " + name, i)));
  sel.value = b.team;
  sel.disabled = state !== "prep";
  sel.onchange = () => {
    b.team = +sel.value;
    stats();
  };
  const remove = document.createElement("button");
  remove.textContent = "Remover";
  remove.disabled = state !== "prep";
  remove.onclick = () => {
    engine.balls = engine.balls.filter((x) => x.id !== b.id);
    selected = null;
    selection();
    stats();
  };
  actions.append(sel, remove);
  el.append(actions);
  const details = document.createElement("div");
  details.id = "abilityDetails";
  el.append(details);
  showDetails(b);
}
function stats() {
  const live = engine.balls.filter((b) => b.alive);
  $("alive").textContent = live.length;
  $("hits").textContent = engine.hits;
  $("totalDamage").textContent = engine.damage;
  $("clock").textContent =
    Math.floor(engine.time / 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    Math.floor(engine.time % 60)
      .toString()
      .padStart(2, "0");
  renderHud();
  $("teams").innerHTML = teams
    .map((name, t) => {
      const all = engine.balls.filter((b) => b.team === t);
      if (!all.length) return "";
      const hp = all.reduce((s, b) => s + (b.alive ? b.hp : 0), 0),
        max = all.reduce((s, b) => s + b.maxHp, 0);
      return (
        '<div class="team-line"><div><span style="color:' +
        colors[t] +
        '">● Equipe ' +
        name +
        "</span><span>" +
        all.filter((b) => b.alive).length +
        " / " +
        all.length +
        '</span></div><div class="track"><i style="width:' +
        (hp / max) * 100 +
        "%;background:" +
        colors[t] +
        '"></i></div></div>'
      );
    })
    .join("");
}
function controls() {
  const prep = state === "prep";
  document.body.classList.toggle("combat-mode", !prep);
  requestAnimationFrame(resize);
  $("mode").textContent = {
    prep: "PREPARAÇÃO",
    running: "EM COMBATE",
    paused: "PAUSADO",
    ended: "FINALIZADO",
  }[state];
  $("start").textContent = {
    prep: "▶ START",
    running: "Ⅱ Pausar",
    paused: "▶ Continuar",
    ended: "▶ NOVA BATALHA",
  }[state];
  for (const id of [
    "size",
    "hp",
    "damage",
    "cooldown",
    "velocity",
    "load",
    "clear",
    "save",
  ])
    $(id).disabled = !prep;
  document.querySelectorAll(".character").forEach((b) => (b.disabled = !prep));
  selection();
  stats();
}
function add(index, team = +$("addTeam").value, x, y) {
  if (state !== "prep") return;
  if (engine.balls.length >= 60)
    return toast("Limite de 60 personagens por arena.");
  if (x === undefined) {
    for (let i = 0; i < 500; i++) {
      x = 40 + Math.random() * (engine.width - 80);
      y = 40 + Math.random() * (engine.height - 80);
      if (
        engine.balls.every(
          (b) =>
            Math.hypot(b.x - x, b.y - y) > b.r + (index === 2 ? 38 : 27) + 5,
        )
      )
        break;
      if (i === 499)
        return toast("Expanda a arena para adicionar mais personagens.");
    }
  }
  selected = engine.add(index, team, x, y).id;
  selection();
  stats();
}
function start() {
  gameAudio.unlock();
  if (state === "running") {
    state = "paused";
    gameAudio.stop();
    controls();
    return;
  }
  if (state === "paused") {
    state = "running";
    controls();
    return;
  }
  if (state === "ended") {
    restart();
    return;
  }
  if (new Set(engine.balls.map((b) => b.team)).size < 2)
    return toast("Adicione personagens de pelo menos duas equipes.");
  formation = engine.snapshot();
  state = "running";
  acc = 0;
  $("result").hidden = true;
  controls();
}
function restart() {
  gameAudio.stop();
  if (!formation) return start();
  engine.restore(formation);
  state = "running";
  acc = 0;
  $("result").hidden = true;
  resize();
  controls();
}
function prepare() {
  gameAudio.stop();
  if (formation) engine.restore(formation);
  state = "prep";
  acc = 0;
  $("result").hidden = true;
  syncInputs();
  resize();
  controls();
}
function syncInputs() {
  for (const [id, key] of [
    ["hp", "hp"],
    ["damage", "damage"],
    ["cooldown", "cooldown"],
    ["velocity", "velocity"],
  ])
    $(id).value = engine.config[key];
  $("size").value = engine.width;
}
function draw() {
  ctx.clearRect(0, 0, engine.width, engine.height);
  ctx.strokeStyle = "#213044";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 9]);
  ctx.beginPath();
  ctx.moveTo(engine.width / 2, 0);
  ctx.lineTo(engine.width / 2, engine.height);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(engine.width / 2, engine.height / 2, 80, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#223247";
  ctx.textAlign = "center";
  ctx.font = "600 13px sans-serif";
  ctx.fillText("MULTIVERSE", engine.width / 2, engine.height / 2 - 4);
  ctx.font = "9px sans-serif";
  ctx.fillText("B A L L  A R E N A", engine.width / 2, engine.height / 2 + 14);
  for (const b of engine.balls) {
    if (!b.alive) continue;
    const jumpHeight = b.jump
      ? Math.sin(Math.min(1, (engine.time - b.jump.start) / 1.5) * Math.PI)
      : 0;
    let renderR = b.r * (1 + jumpHeight * 0.65),
      renderY = b.y - jumpHeight * 45;
    if (b.transformUntil) {
      const t = Math.min(1, (engine.time - b.transformStart) / 1.2);
      renderR = b.r * (1 + t * 0.4) * (1 + Math.sin(t * Math.PI * 6) * 0.22);
    }
    ctx.save();
    if (b.invisibleUntil > engine.time) ctx.globalAlpha = 0.24;
    if (b.jump) {
      ctx.fillStyle = "#0008";
      ctx.beginPath();
      ctx.ellipse(
        b.x,
        b.y,
        b.r * (1 - jumpHeight * 0.3),
        b.r * 0.32,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.shadowColor =
      engine.time < b.flashUntil ? b.flashColor : colors[b.team];
    ctx.shadowBlur =
      engine.time < b.flashUntil ? 30 : selected === b.id ? 19 : 8;
    ctx.strokeStyle =
      engine.time < b.flashUntil ? b.flashColor : colors[b.team];
    ctx.lineWidth = selected === b.id ? 3 : 2;
    ctx.beginPath();
    ctx.arc(b.x, renderY, renderR + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    sprite(
      ctx,
      b.form?.character ?? b.character,
      b.x,
      renderY,
      renderR,
      !!b.cloneOf,
    );
    drawSpider(b);
    if ((b.form?.character ?? b.character) === 5) drawIron(b,renderY,renderR);
    if ((b.form?.character ?? b.character) === 0 && attackArt.scepter) {
      ctx.save();
      ctx.translate(b.x, renderY);
      ctx.rotate(
        (b.castAngle ?? -0.5) +
          Math.PI / 4 +
          engine.time * 2 +
          (engine.time < b.flashUntil
            ? (1 - (b.flashUntil - engine.time) / 0.5) * Math.PI * 2
            : 0),
      );
      const glow = engine.time < b.flashUntil;
      ctx.shadowColor = b.flashColor || "#68dfff";
      ctx.shadowBlur = !lightweight && glow ? 20 : 0;
      ctx.drawImage(
        attackArt.scepter,
        renderR * 0.25,
        -renderR * 1.4,
        renderR * 1.7,
        renderR * 1.3,
      );
      if (glow) {
        ctx.fillStyle = b.flashColor;
        ctx.globalAlpha *= 0.9;
        ctx.beginPath();
        ctx.arc(renderR * 0.68, -renderR * 0.96, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (b.punchUntil > engine.time && attackArt.arm) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.punchAngle);
      const reach = (1 - (b.punchUntil - engine.time) / 0.45) * 28;
      ctx.drawImage(
        attackArt.arm,
        renderR * 0.4 + reach,
        -renderR * 0.75,
        renderR * 1.7,
        renderR * 1.5,
      );
      ctx.restore();
    }
    if (b.smashUntil > engine.time && attackArt.smash) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, (b.smashUntil - engine.time) * 2);
      ctx.drawImage(
        attackArt.smash,
        b.x - renderR * 1.3,
        b.y - renderR * 1.3,
        renderR * 2.6,
        renderR * 2.6,
      );
      ctx.restore();
    }
    ctx.fillStyle = "#070c14";
    ctx.fillRect(b.x - 25, b.y + b.r + 10, 50, 5);
    ctx.fillStyle = colors[b.team];
    ctx.fillRect(b.x - 25, b.y + b.r + 10, (50 * b.hp) / b.maxHp, 5);
    ctx.fillStyle = "#aab8ca";
    ctx.font = "10px sans-serif";
    ctx.fillText(Math.ceil(b.hp), b.x, b.y + b.r + 28);
    if (b.character === 1) {
      ctx.fillStyle = "#38212a";
      ctx.fillRect(b.x - 25, b.y + b.r + 32, 50, 3);
      ctx.fillStyle = "#ff6d71";
      ctx.fillRect(b.x - 25, b.y + b.r + 32, b.fury / 2, 3);
    }
    if (b.cloneOf) {
      ctx.fillStyle = "#a3b3bb";
      ctx.font = "8px sans-serif";
      ctx.fillText("ILUSÃO", b.x, b.y - b.r - 8);
    } else if (b.form) {
      ctx.fillStyle = "#c5a5ff";
      ctx.font = "9px sans-serif";
      ctx.fillText("LOKI · 50%", b.x, b.y - renderR - 12);
    }
    ctx.restore();
  }
  for (const p of engine.projectiles) {
    ctx.save();
    ctx.strokeStyle = p.kind === "heal" ? "#85ffb2" : p.kind === "repulsor" ? "#fff1ae" : "#68dfff";
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = lightweight ? 0 : 12;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
  }
  for (const e of engine.effects) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, e.life / (e.maxLife || 0.7));
    ctx.fillStyle = e.color || "#ffe2a3";
    if (e.type === "text") {
      ctx.font = "bold 19px sans-serif";
      ctx.fillText(e.text, e.x, e.y);
    } else {
      const t = 1 - e.life / e.maxLife;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3 * (1 - t) + 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, Math.max(1, e.radius * t), 0, Math.PI * 2);
      ctx.stroke();
      if (e.type === "smash") {
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("SMASH!", e.x, e.y - 40);
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5;
          ctx.beginPath();
          ctx.moveTo(e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20);
          ctx.lineTo(
            e.x + Math.cos(a) * e.radius * t,
            e.y + Math.sin(a) * e.radius * t,
          );
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}
let ui = 0;
function frame(now) {
  const delta = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  if (state === "running") {
    acc += delta * speed;
    while (acc >= 1 / 120) {
      engine.step(1 / 120);
      acc -= 1 / 120;
      const living = new Set(
        engine.balls.filter((b) => b.alive).map((b) => b.team),
      );
      if (living.size <= 1) {
        state = "ended";
        $("result").hidden = false;
        $("result").textContent = living.size
          ? "🏆 Equipe " + teams[[...living][0]] + " venceu!"
          : "Empate!";
        controls();
        acc = 0;
        break;
      }
    }
  }
  gameAudio.syncMorphs(engine.balls,engine.time,state === "running");
  gameAudio.syncBeams(engine.balls,engine.time,state === "running");
  draw();
  if (state !== "prep" && now - combatUi > 80) { renderCombatHud(); combatUi = now; }
  if (now - ui > 350) {
    stats();
    ui = now;
  }
  requestAnimationFrame(frame);
}
function point(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * engine.width,
    y: ((e.clientY - rect.top) / rect.height) * engine.height,
  };
}
canvas.onpointerdown = (e) => {
  const p = point(e),
    b = [...engine.balls]
      .reverse()
      .find((b) => b.alive && Math.hypot(b.x - p.x, b.y - p.y) <= b.r + 5);
  selected = b?.id ?? null;
  selection();
  if (b && state === "prep") {
    drag = { b, dx: b.x - p.x, dy: b.y - p.y };
    canvas.setPointerCapture(e.pointerId);
  }
};
canvas.onpointermove = (e) => {
  if (!drag || state !== "prep") return;
  $("trash").classList.toggle("over", overTrash(e));
  const p = point(e);
  drag.b.x = Math.min(
    engine.width - drag.b.r,
    Math.max(drag.b.r, p.x + drag.dx),
  );
  drag.b.y = Math.min(
    engine.height - drag.b.r,
    Math.max(drag.b.r, p.y + drag.dy),
  );
};
function overTrash(event) {
  const r = $("trash").getBoundingClientRect();
  return (
    event.clientX >= r.left &&
    event.clientX <= r.right &&
    event.clientY >= r.top &&
    event.clientY <= r.bottom
  );
}
function removeBall(id) {
  if (state !== "prep" || id == null) return;
  engine.balls = engine.balls.filter((b) => b.id !== id);
  selected = null;
  formation = null;
  selection();
  stats();
  toast("Bolinha removida.");
}
canvas.onpointerup = (event) => {
  if (drag && overTrash(event)) removeBall(drag.b.id);
  drag = null;
  $("trash").classList.remove("over");
};
canvas.onpointercancel = () => {
  drag = null;
  $("trash").classList.remove("over");
};
$("trash").onclick = () => {
  if (state !== "prep")
    return toast("Volte à preparação para remover bolinhas.");
  if (selected == null)
    return toast("Selecione uma bolinha ou arraste até a lixeira.");
  removeBall(selected);
};
$("quality").onclick = () => {
  lightweight = !lightweight;
  $("quality").textContent = lightweight
    ? "Modo leve: ligado"
    : "Modo leve: desligado";
  $("quality").setAttribute("aria-pressed", String(lightweight));
  resize();
};
$("start").onclick = start;
$("restart").onclick = restart;
$("prepare").onclick = prepare;
$("clear").onclick = () => {
  engine.balls = [];
  formation = null;
  selected = null;
  controls();
};
$("plus").onclick = () => {
  zoom = Math.min(3, zoom + 0.25);
  resize();
};
$("minus").onclick = () => {
  zoom = Math.max(0.5, zoom - 0.25);
  resize();
};
$("fit").onclick = () => {
  zoom = 1;
  resize();
};
document.querySelectorAll("[data-speed]").forEach(
  (b) =>
    (b.onclick = () => {
      speed = +b.dataset.speed;
      document
        .querySelectorAll("[data-speed]")
        .forEach((x) => x.classList.toggle("active", x === b));
    }),
);
$("size").onchange = () => {
  const scale = +$("size").value / engine.width;
  engine.width = +$("size").value;
  engine.height = engine.width * 0.6;
  engine.balls.forEach((b) => {
    b.x *= scale;
    b.y *= scale;
  });
  resize();
};
for (const id of ["hp", "damage", "cooldown", "velocity"])
  $(id).onchange = () => {
    const el = $(id),
      value = Math.min(+el.max, Math.max(+el.min, +el.value || +el.min));
    el.value = value;
    engine.config[id] = value;
    engine.balls.forEach((b) => {
      engine.configure(b);
      b.hp = b.maxHp;
    });
    stats();
    selection();
  };
$("save").onclick = () => {
  try {
    localStorage.setItem(
      "multiverse-formation-v1",
      JSON.stringify(engine.snapshot()),
    );
    toast("Formação salva neste navegador.");
  } catch {
    toast("Não foi possível salvar neste navegador.");
  }
};
$("load").onclick = () => {
  try {
    const s = JSON.parse(localStorage.getItem("multiverse-formation-v1"));
    if (!s) return toast("Nenhuma formação salva ainda.");
    if (
      ![900, 1200, 1600].includes(s.width) ||
      !Array.isArray(s.balls) ||
      s.balls.length > 60 ||
      s.balls.some(
        (b) =>
          !Number.isInteger(b.character) ||
          b.character < 0 ||
          b.character >= characters.length ||
          !Number.isInteger(b.team) ||
          b.team < 0 ||
          b.team > 3 ||
          !Number.isFinite(b.x) ||
          !Number.isFinite(b.y),
      )
    )
      throw Error();
    engine.restore(s);
    engine.balls.forEach((b) => engine.wall(b));
    formation = null;
    selected = null;
    syncInputs();
    resize();
    controls();
    toast("Formação carregada.");
  } catch {
    toast("Não foi possível carregar a formação.");
  }
};
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "running") {
    state = "paused";
    gameAudio.stop();
    controls();
  }
});
$("sound").onclick = () => {
  soundOn = !soundOn;
  $("sound").textContent = soundOn ? "♫ Som ligado" : "♫ Som desligado";
  gameAudio.setEnabled(soundOn);
};
engine.listeners.push((event, ball, context) => {
  if (state !== "running") return;
  if(event === "special" && context.type === "concentrationInterrupted") gameAudio.stopFor(ball.id,["arcPrepare","arcPulse"]);
  if(event === "special" && ["web0","web1","web2","spiderUlt","spiderPunch","webImpact"].includes(context.type)) gameAudio.play(context.type,0,ball.id);
  if(event === "special" && ["arcPrepare","repulsorPrepare","repulsorShot","shieldHit","shieldUp","boost"].includes(context.type)) {
    gameAudio.play(context.type,0,ball.id);
    if(context.type==="arcPrepare")gameAudio.play("arcPulse",0,ball.id);
    if(context.type==="boost")gameAudio.play("boostFire");
  }
  if (event === "special" && context.type === "wallHit") gameAudio.play("wall",context.speed);
  if(event === "special" && context.type === "hulkTransformed")gameAudio.play("transform");
  if(event === "special" && context.type === "healed")gameAudio.play("heal");
  if (event === "abilityActivated") {
    if (context.ability === "HULK PUNCH") gameAudio.play("punch");
    if (context.ability === "SALTO") gameAudio.play("jump");
    if (context.ability === "FALSOS LOKI") gameAudio.play("clone");
    if (context.ability === "RAIO DE ENERGIA") gameAudio.play("ray");
  }
});
await loadAttackArt();
await loadSpiderArms();
await new Promise(resolve=>{const img=new Image();img.onload=()=>{const hand=document.createElement("canvas");hand.width=128;hand.height=144;const c=hand.getContext("2d");c.beginPath();c.ellipse(64,72,62,70,0,0,Math.PI*2);c.clip();c.drawImage(img,382,112,270,300,0,0,128,144);attackArt.ironHand=hand;resolve();};img.onerror=resolve;img.src="assets/958524298ee96fc9b1047b6698b53021.jpg";});
await Promise.all(
  characters.map(
    (c) =>
      new Promise((resolve) => {
        c.image = new Image();
        c.image.onload = resolve;
        c.image.onerror = () => {
          toast("Uma imagem não carregou. Atualize a página.");
          resolve();
        };
        c.image.src = "assets/" + c.file;
      }),
  ),
);
characters.forEach((c, i) => {

  const b = document.createElement("button");
  b.className = "character";
  b.dataset.category = i===2||i===4 ? "Super" : "Marvel";
  b.hidden = b.dataset.category !== $("universe").value;
  b.setAttribute("aria-label", "Adicionar " + c.name);
  b.append(portrait(i));
  const text = document.createElement("div");
  text.innerHTML =
    '<span class="add">+</span><b>' +
    c.name +
    "</b><small>" +
    c.note +
    '</small><small class="card-stats">' +
    (OFFICIAL[i]
      ? OFFICIAL[i].hp + " HP · " + OFFICIAL[i].damage + " DANO"
      : "Ficha base") +
    "</small>";
  b.append(text);
  b.onclick = () => add(i);
  $("roster").append(b);
});
$("universe").onchange = () => {
  const category=$("universe").value;
  document.querySelectorAll("#roster .character").forEach(button=>button.hidden=button.dataset.category!==category);
  $("rosterCount").textContent=category==="Super"?"2 FORMAS SUPER":"5 PERSONAGENS";
};
[0, 1, 3, 0, 3, 5].forEach((c, i) =>
  add(c, i < 3 ? 0 : 1, i < 3 ? 230 : 670, 130 + (i % 3) * 140),
);
selected = null;
controls();
resize();
requestAnimationFrame(frame);

function showDetails(b) {
  const el = $("abilityDetails");
  if (!el) return;
  const kind = b.form?.character ?? b.character;
  const names = {
    0: [
      ["ray", "Raio de Energia", 2.5],
      ["heal", "Tiro de Cura", 3],
      ["clone", "Falsos Loki", 7],
      ["blink", "Piscar", 16],

    ],
    2: [
      ["smash", "Smash", 8],
      ["punch", "Hulk Punch", 0.5],

    ],
  };
  const info =
    kind === 1
      ? '<p class="settings-note">Fúria: +1–5% por segundo e +2–10% ao receber dano de contato. Aos 100%, transformação em 1,2 s. Morrendo antes, Bruce é eliminado.</p>'
      : kind === 0
        ? '<p class="settings-note">Clones a cada 7 s, máximo 5, 5 HP e velocidade 11. Um clone vivo recebe o golpe fatal no lugar do Loki. Raio: alcance 540, velocidade 520 e perseguição de 35% por segundo. Metamorfose copia qualquer outro personagem do catálogo, incluindo Hulk e Homem de Ferro, mesmo fora da arena. Dura 10 s, com poderes a 50%: +3% de carga/s e +1% a cada 2 de dano causado. Cura aliados ou a si mesmo. Piscar dura até 6 s; lançar magia revela Loki.</p>'
        : kind === 2
          ? '<p class="settings-note">Smash: 18 em área. Soco automático ao entrar no alcance: 10 + até 3 impactos de 5; sem delay e recarga 0,5 s. Salto: interrompe ults de concentração na área de impacto; carrega com 8 socos acertados; 35 direto ou 18 em área, raio 150 e correção de trajetória de 40%. Massa 20 · tamanho 1,4×.</p>'
          : kind===6 ? '<p class="settings-note">400 HP · Soco 8, recarga 0,5 s. Teias: recarga geral 5 s; arremesso 10 s e prisão 12 s. Aproximação em 0,65 s e puxão em 0,75 s. Soco de puxão: 16 e impulso. Arremesso: até 3 impactos de 5. Prisão: 2 s. Ultimate: 15 usos de teia, combo em estrela por 2 s, 8 de dano por passagem acertada.</p><div class="iron-gallery"><img src="assets/mar-1-comeuppance.jpg" alt="Soco"><img src="assets/78a0b5a356c2112c0e75b6029824f430.jpg" alt="Teias"><img src="assets/291b074457defd43fd91c016c203bf51.jpg" alt="Web Shooter"><img src="assets/8b80a68902d42d1ac1eada7f2e2d88b7.jpg" alt="Homem-Aranha"></div>' : kind===5 ? '<p class="settings-note">Rajadas: 3 × 3 de dano, intervalo 0,15 s e recarga 2,5 s. Escudo: 30 HP, recupera em 10 s após desativar ou quebrar. Propulsores: 3 s. Reator Arc: 12 acertos, preparação 1 s, feixe 8 s, 7 de dano a cada 0,5 s, rotação 55°/s.</p><div class="iron-gallery"><img src="assets/958524298ee96fc9b1047b6698b53021.jpg" alt="Repulsores e escudo"><img src="assets/f527ab675e6faddc20abc6ffa1e6146d.jpg" alt="Propulsores"><img src="assets/326e48ce0407e20e69e4d1f418367839.jpg" alt="Ataques de energia"><img src="assets/homem-ferro.jpg" alt="Reator Arc"></div>' : '<p class="settings-note">Habilidades exclusivas ainda não definidas.</p>';
  let rows = names[kind] || [];
  if (b.cloneOf) rows = rows.filter((x) => ["ray", "heal"].includes(x[0]));
  el.innerHTML =
    '<div class="official-stats"><span>' +
    b.maxHp +
    " HP</span><span>" +
    b.attack +
    " dano</span><span>Massa " +
    b.mass +
    "</span></div>" +
    info +
    (b.form
      ? '<div class="form-note">Metamorfose · ' +
        Math.max(0, b.form.until - engine.time).toFixed(1) +
        " s · potência 50%</div>"
      : "") +
    (b.invisibleUntil > engine.time
      ? '<div class="form-note">Invisível · ' +
        (b.invisibleUntil - engine.time).toFixed(1) +
        " s</div>"
      : "") +
    rows
      .map(([key, name, cd]) => {
        const remaining = Math.max(0, b.next[key] - engine.time);
        return (
          '<div class="cooldown-row"><span>' +
          name +
          "</span><span>" +
          (state === "prep"
            ? cd + " s"
            : !Number.isFinite(remaining)
              ? "Em uso"
              : remaining > 0
                ? remaining.toFixed(1) + " s"
                : "Pronta") +
          "</span></div>"
        );
      })
      .join("");
}
function renderHud() {
  const bruces = engine.balls.filter(
    (b) => b.alive && b.character === 1 && !b.cloneOf,
  );
  $("furyHud").innerHTML = bruces
    .map(
      (b) =>
        '<div class="fury-entry"><div><b>BRUCE #' +
        b.id +
        "</b><span>" +
        (b.transformUntil ? "TRANSFORMANDO" : Math.floor(b.fury) + "%") +
        '</span></div><div class="fury-track"><i style="width:' +
        b.fury +
        '%"></i></div></div>',
    )
    .join("");
  $("furyHud").hidden = !bruces.length;
  $("battleLog").innerHTML = engine.log.length
    ? engine.log
        .slice(0, 5)
        .map(
          (l) =>
            "<div><time>" +
            Math.floor(l.time) +
            "s</time><span>" +
            characters[l.character].name +
            " #" +
            l.id +
            "<b>" +
            l.name +
            "</b></span></div>",
        )
        .join("")
    : "As habilidades começam com o combate.";
  const b = engine.balls.find((b) => b.id === selected);
  if (b) {
    if (
      $("selected").dataset.visual !==
      (b.form?.character ?? b.character) + ":" + b.cloneOf
    )
      selection();
    showDetails(b);
    const hp = $("selected").querySelector(".selection small");
    if (hp)
      hp.textContent = Math.ceil(b.hp) + " / " + b.maxHp + " HP · #" + b.id;
  }
}
async function loadAttackArt() {
  const load = (src) =>
    new Promise((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = "assets/" + src;
    });
  const images = await Promise.all([
    load("loki-scepter.jpg"),
    load("hulk-arms.jpg"),
    load("hulk-smash.jpg"),
  ]);
  function cut(img, box, polygon) {
    if (!img) return null;
    const [sx, sy, w, h] = box,
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    cx.beginPath();
    polygon.forEach(([x, y], i) =>
      i ? cx.lineTo(x - sx, y - sy) : cx.moveTo(x - sx, y - sy),
    );
    cx.closePath();
    cx.clip();
    cx.drawImage(img, -sx, -sy);
    return c;
  }
  attackArt.scepter = cut(
    images[0],
    [18, 90, 1482, 1010],
    [
      [18, 103],
      [142, 88],
      [291, 102],
      [455, 207],
      [462, 241],
      [560, 285],
      [821, 498],
      [1257, 850],
      [1468, 958],
      [1495, 1021],
      [1480, 1089],
      [1424, 1054],
      [1248, 915],
      [780, 566],
      [609, 480],
      [391, 464],
      [279, 410],
      [205, 306],
      [197, 260],
      [290, 309],
      [267, 207],
      [126, 151],
    ],
  );
  attackArt.arm = cut(
    images[1],
    [20, 565, 265, 255],
    [
      [24, 675],
      [50, 635],
      [81, 608],
      [128, 566],
      [195, 577],
      [221, 619],
      [211, 658],
      [254, 675],
      [278, 718],
      [267, 765],
      [236, 798],
      [177, 815],
      [96, 803],
      [48, 774],
      [21, 732],
    ],
  );
  if (images[2]) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const cx = c.getContext("2d");
    cx.beginPath();
    cx.arc(128, 128, 126, 0, Math.PI * 2);
    cx.clip();
    cx.drawImage(images[2], 25, 205, 650, 650, 0, 0, 256, 256);
    attackArt.smash = c;
  }
}

let combatUi = 0;
function renderCombatHud() {
  const meter = (name, value, text, cls="") => `<div class="combat-meter ${cls}"><div class="meter-label"><span>${name}</span><b>${text}</b></div><div class="meter-track"><i style="width:${Math.max(0,Math.min(100,value))}%"></i></div></div>`;
  $("combatHud").innerHTML = engine.balls.filter(b=>!b.cloneOf).map(b=>{
    const kind=b.form?.character??b.character;
    const moves=kind===0?[["ray","Raio de Energia",2.5],["heal","Tiro de Cura",3],["clone","Falsos Loki",7],["blink","Piscar",16]]:kind===2?[["punch","Hulk Punch",.5],["smash","Smash",8]]:[];
    if(kind===6 && b.spider) moves.push(["spiderPunch","Soco",.5],["web","Web Shooter",5],["webThrow","Arremesso",10],["webPrison","Prisão",12]);
    if(kind===5 && b.iron) moves.push(["repulsor","Rajadas Repulsoras",2.5],["boost","Propulsores",3]);
    const cds=moves.map(([key,name,cd])=>{const spiderKey={spiderPunch:"nextPunch",web:"nextWeb",webThrow:"nextThrow",webPrison:"nextPrison"}[key];const deadline=spiderKey?b.spider[spiderKey]:key==="repulsor"?b.iron.burstAt:key==="boost"?b.iron.boostAt:b.next[key];const left=Math.max(0,deadline-engine.time);return meter(name,100*(1-left/cd),!Number.isFinite(left)?"RAJADA":left>0?left.toFixed(1)+" s":"PRONTO");}).join("");
    let ultimate="";
    if(b.character===0){const active=!!b.form;ultimate=meter("❄ ULT · METAMORFOSE",active?100*(b.form.until-engine.time)/10:b.ultCharge,active?(b.form.until-engine.time).toFixed(1)+" s":Math.floor(b.ultCharge)+"%","ult-loki");}
    if(kind===2) ultimate+=meter("◆ ULT · QUEDA DEVASTADORA",b.jump?100:b.punchCount/8*100,b.jump?"NO AR":b.punchCount+" / 8 SOCOS","ult-hulk");
    if(b.character===1) ultimate=meter("FÚRIA · TRANSFORMAÇÃO",b.fury,b.transformUntil?"TRANSFORMANDO":Math.floor(b.fury)+"%","ult-fury");
    if(kind===5){const iron=b.iron;ultimate+=meter("◉ ULT · REATOR ARC",b.arc?100*(b.arc.end-engine.time)/9:(iron?.hits||0)/12*100,b.arc?(engine.time<b.arc.fireAt?"PREPARANDO":(b.arc.end-engine.time).toFixed(1)+" s"):(iron?.hits||0)+" / 12 ACERTOS","ult-iron");ultimate+=meter("ESCUDO DE ENERGIA",(iron?.shield??30)/30*100,iron?.active?(iron.shield+" / 30 HP"):iron?.ready>engine.time?"RECARGA "+(iron.ready-engine.time).toFixed(1)+" s":"30 HP · PRONTO","shield-meter");}
    if(kind===6)ultimate+=meter("✶ DON'T MESS WITH SPIDER-MAN",b.star?100*(1-(engine.time-b.star.start)/2):(b.spider?.uses||0)/15*100,b.star?"COMBO EM ESTRELA":(b.spider?.uses||0)+" / 15 TEIAS","ult-spider");
    if(b.stunUntil>engine.time)ultimate+=meter("PRESO NA TEIA",100*(b.stunUntil-engine.time)/2,(b.stunUntil-engine.time).toFixed(1)+" s","web-stun");
    const clones=engine.balls.filter(c=>c.cloneOf===b.id && c.alive).map(c=>{
      const rows=[["ray","Raio",2.5],["heal","Cura",3]].map(([key,name,cd])=>{const left=Math.max(0,c.next[key]-engine.time);return meter(name,100*(1-left/cd),left?left.toFixed(1)+" s":"PRONTO");}).join("");
      return `<section class="clone-mini"><div class="combat-name"><strong>Falso Loki #${c.id}</strong><span>Clone de #${b.id}</span></div>${meter("VIDA",c.hp/c.maxHp*100,Math.ceil(c.hp)+" / "+c.maxHp,"health-meter")}${rows}</section>`;
    }).join("");
    return `<article class="combat-card ${b.alive?"":"eliminated"}"><div class="combat-name"><strong>${characters[kind].name} <small>#${b.id}</small></strong><span>${b.alive?teams[b.team]:"ELIMINADO"}</span></div>${meter("VIDA",b.hp/b.maxHp*100,Math.ceil(Math.max(0,b.hp))+" / "+b.maxHp,"health-meter")}${cds}${ultimate}${clones?`<div class="clone-squad">${clones}</div>`:""}</article>`;
  }).join("");
}

function drawIron(b,y,r){
 ctx.save();const iron=b.iron;
 if(iron?.active){ctx.strokeStyle=b.shieldFlash>engine.time?"#fff":"#6edfff";ctx.fillStyle="#69cfff18";ctx.lineWidth=3;ctx.beginPath();ctx.arc(b.x,y,r+11,0,Math.PI*2);ctx.fill();ctx.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3+engine.time*.3;ctx.beginPath();ctx.arc(b.x+Math.cos(a)*(r+6),y+Math.sin(a)*(r+6),6,0,Math.PI*2);ctx.stroke();}}
 if(b.boostUntil>engine.time){const a=Math.atan2(b.vy,b.vx);ctx.translate(b.x,y);ctx.rotate(a);ctx.fillStyle="#63d9ff";ctx.beginPath();ctx.moveTo(-r,-9);ctx.lineTo(-r-35,-2);ctx.lineTo(-r,9);ctx.fill();ctx.fillStyle="#fff6b9";ctx.fillRect(-r-18,-3,19,6);ctx.restore();ctx.save();}
 if(b.repulsorUntil>engine.time){const a=b.castAngle;if(attackArt.ironHand){ctx.save();ctx.translate(b.x+Math.cos(a)*r,y+Math.sin(a)*r);ctx.rotate(a+Math.PI/2);ctx.drawImage(attackArt.ironHand,-15,-18,30,34);ctx.restore();}ctx.fillStyle="#fff4ca";ctx.beginPath();ctx.arc(b.x+Math.cos(a)*r,y+Math.sin(a)*r,9,0,Math.PI*2);ctx.fill();}
 if(b.arc){const a=b.arc;ctx.translate(b.x,y);ctx.rotate(a.angle);if(engine.time>=a.fireAt){const length=Math.hypot(engine.width,engine.height);ctx.strokeStyle="#55d9ff66";ctx.lineWidth=38;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(length,0);ctx.stroke();ctx.strokeStyle="#a2f3ff";ctx.lineWidth=22;ctx.stroke();ctx.strokeStyle="#fff";ctx.lineWidth=8;ctx.stroke();}ctx.fillStyle="#fff";ctx.shadowColor="#68eaff";ctx.shadowBlur=15;ctx.beginPath();ctx.arc(0,0,9+Math.sin(engine.time*16)*2,0,Math.PI*2);ctx.fill();}
 ctx.restore();
}

function drawSpider(b){
 ctx.save();
 const target=b.webLine&&engine.balls.find(t=>t.id===b.webLine.target);
 if(target&&(b.webLine.until>engine.time||target.webMotion?.source.id===b.id||target.launched?.web&&target.launched.source.id===b.id)){
 ctx.strokeStyle="#e0f1ff";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(target.x,target.y);ctx.stroke();}
 if(b.stunUntil>engine.time||b.launched?.web){ctx.strokeStyle="#dfebf0";ctx.lineWidth=1;for(let k=0;k<8;k++){const a=k*Math.PI/4;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x+Math.cos(a)*(b.r+12),b.y+Math.sin(a)*(b.r+12));ctx.stroke();}for(let r=10;r<=b.r+10;r+=10){ctx.beginPath();for(let k=0;k<=8;k++){const a=k*Math.PI/4;ctx.lineTo(b.x+Math.cos(a)*r,b.y+Math.sin(a)*r);}ctx.stroke();}}
 if(b.star){const a=b.star;ctx.strokeStyle="#ed7189";ctx.lineWidth=2;ctx.beginPath();for(let k=0;k<=5;k++){const angle=k*4*Math.PI/5+a.rotation+(engine.time-a.start)*.6;ctx.lineTo(a.x+Math.cos(angle)*105,a.y+Math.sin(angle)*105);}ctx.stroke();}
 if(target && b.webLine.until>engine.time){
   const elapsed=engine.time-b.webLine.start,angle=Math.atan2(target.y-b.y,target.x-b.x);
   const shooting=elapsed<.2,art=shooting?attackArt.spiderShoot:attackArt.spiderGrip;
   if(art){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(angle+(shooting?Math.PI/2:Math.PI));
     if(shooting)ctx.drawImage(art,-11,-b.r-42,22,55);
     else ctx.drawImage(art,-b.r-30+Math.sin(elapsed*12)*5,-15,40,30);
     ctx.restore();}
 }
 if(b.spiderPunchUntil>engine.time){
   const duration=b.spiderCombo?.4:.3,q=1-(b.spiderPunchUntil-engine.time)/duration,reach=Math.sin(q*Math.PI)*8;
   const art=b.spiderCombo?attackArt.spiderCombo:attackArt.spiderStrike;
   if(art){ctx.save();ctx.translate(b.x,b.y);ctx.rotate((b.spiderPunchAngle||0)+(b.spiderCombo?-2.45:0));
     if(b.spiderCombo)ctx.drawImage(art,-35-reach,-21,48,41);else ctx.drawImage(art,b.r*.3+reach,-9,42,18);
     ctx.restore();}
   ctx.strokeStyle="#ffcab9";ctx.lineWidth=5;ctx.beginPath();ctx.arc(b.x,b.y,b.r+13,-.7,.7);ctx.stroke();}
 ctx.restore();
}

async function loadSpiderArms(){
 const specs=[
  ["spiderStrike","02-1000249280.jpg",[[360,330],[780,70],[1480,0],[1535,60],[1535,230],[1330,260],[1250,215],[950,290],[600,385]]],
  ["spiderShoot","01-1000249291.jpg",[[255,150],[330,0],[570,0],[650,130],[540,350],[530,650],[710,900],[480,940],[320,650],[280,350]]],
  ["spiderGrip","04-1000249308.jpg",[[30,380],[300,250],[460,105],[670,160],[850,240],[1535,350],[1535,1000],[1050,875],[820,1100],[350,1120],[170,900],[25,650]]],
  ["spiderCombo","03-1000249313.jpg",[[100,1150],[170,970],[380,850],[800,430],[1200,50],[1490,0],[1370,270],[1050,580],[650,890],[420,1220],[220,1250]]]
 ];
 await Promise.all(specs.map(([key,file,polygon])=>new Promise(resolve=>{const img=new Image();img.onload=()=>{
  const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
  const c=document.createElement('canvas');c.width=256;c.height=Math.round(256*h/w);const g=c.getContext('2d');g.scale(256/w,256/w);g.translate(-x,-y);g.beginPath();polygon.forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py));g.closePath();g.clip();g.drawImage(img,0,0);attackArt[key]=c;resolve();};img.onerror=resolve;img.src='assets/'+file;})));
}
