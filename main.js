gsap.registerPlugin(ScrollTrigger);

/* ---------- Preloader ---------- */
const preloader = document.getElementById("preloader");
window.addEventListener("load", () => {
  setTimeout(() => preloader.classList.add("done"), 1200);
});
setTimeout(() => preloader.classList.add("done"), 4000);

/* ---------- Paint film: frame-sequence scrub ---------- */
const FRAME_COUNT = 122;
const paintCanvas = document.getElementById("paintCanvas");
const ctx = paintCanvas.getContext("2d");
const paintLayer = document.getElementById("paintLayer");
const paintPct = document.getElementById("paintPct");
const expHead = document.getElementById("expHead");
const galleryHint = document.getElementById("galleryHint");

const frames = [];
let framesReady = 0;
for (let i = 1; i <= FRAME_COUNT; i++) {
  const img = new Image();
  img.src = `assets/frames/f_${String(i).padStart(3, "0")}.jpg`;
  img.onload = () => { framesReady++; if (framesReady === 1) drawFrame(0); };
  frames.push(img);
}

let currentFrame = -1;
function sizeCanvas() {
  paintCanvas.width = paintCanvas.clientWidth * devicePixelRatio;
  paintCanvas.height = paintCanvas.clientHeight * devicePixelRatio;
  currentFrame = -1;
}
window.addEventListener("resize", () => { sizeCanvas(); drawFrame(lastIdx); });

function drawFrame(idx) {
  const img = frames[idx];
  if (!img || !img.complete || !img.naturalWidth) return;
  if (idx === currentFrame) return;
  currentFrame = idx;
  const cw = paintCanvas.width, ch = paintCanvas.height;
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
}
sizeCanvas();

/* ---------- Experience choreography ----------
   0.00 – 0.45 : paint scrub
   0.45 – 0.62 : cross-zoom through the film into the 3D gallery
   0.62 – 1.00 : gallery settled, interactive                     */
const stages = [
  { el: ".film-stage--1", enter: 0.05, exit: 0.16 },
  { el: ".film-stage--2", enter: 0.2,  exit: 0.31 },
  { el: ".film-stage--3", enter: 0.35, exit: 0.45 },
];
const stageEls = stages.map((s) => document.querySelector(s.el));
let lastIdx = 0;

ScrollTrigger.create({
  trigger: ".experience",
  start: "top top",
  end: "bottom bottom",
  scrub: true,
  onUpdate: (self) => {
    const p = self.progress;

    // frame scrub
    const fp = Math.min(1, p / 0.45);
    lastIdx = Math.min(FRAME_COUNT - 1, Math.round(fp * (FRAME_COUNT - 1)));
    drawFrame(lastIdx);
    paintPct.textContent = Math.round(fp * 100);

    // headline fades out as painting starts
    expHead.style.opacity = Math.max(0, 1 - p / 0.05);

    // quote pills
    stages.forEach(({ enter, exit }, i) => {
      const node = stageEls[i];
      const fade = 0.03;
      let o = 0;
      if (p >= enter && p <= exit) o = Math.min(1, (p - enter) / fade, (exit - p) / fade);
      node.style.opacity = o;
      node.style.transform = `translateY(${(1 - o) * 10}px)`;
    });

    // cross-zoom: fly through the film into the gallery
    const t = Math.min(1, Math.max(0, (p - 0.45) / 0.17));
    paintLayer.style.opacity = 1 - t;
    paintLayer.style.transform = `scale(${1 + t * 0.9})`;
    paintLayer.style.pointerEvents = t > 0.4 ? "none" : "auto";
    galleryHint.style.opacity = p > 0.62 ? 1 : 0;

    // scene fly-in as the film dissolves
    const st = Math.min(1, Math.max(0, (p - 0.45) / 0.25));
    if (focusedBoard === null) {
      sceneZoom.classList.add("free");
      setStageTransform(scaleAboutViewportCenter(1.22 - st * 0.22));
    }
    galleryActive = p > 0.55;
    scene.classList.toggle("active", galleryActive);
    if (!galleryActive && focusedBoard !== null) unfocusBoard();
  },
});

/* ---------- Rendered gallery: spotlight hover / zoom / collect ---------- */
const scene = document.getElementById("scene");
const sceneZoom = document.getElementById("sceneZoom");
const SCENE_ASPECT = 3168 / 1344;
let stageW = 0, stageH = 0, baseTx = 0, baseTy = 0;

function layoutStage() {
  stageW = Math.max(innerWidth, innerHeight * SCENE_ASPECT);
  stageH = stageW / SCENE_ASPECT;
  baseTx = (innerWidth - stageW) / 2;
  baseTy = (innerHeight - stageH) / 2;
  sceneZoom.style.width = stageW + "px";
  sceneZoom.style.height = stageH + "px";
}
layoutStage();
window.addEventListener("resize", () => { layoutStage(); if (focusedBoard === null) setStageTransform(scaleAboutViewportCenter(1)); });

function scaleAboutViewportCenter(s) {
  const cx = innerWidth / 2, cy = innerHeight / 2;
  return `translate(${cx - s * (cx - baseTx)}px, ${cy - s * (cy - baseTy)}px) scale(${s})`;
}
function setStageTransform(t) { sceneZoom.style.transform = t; }
setStageTransform(scaleAboutViewportCenter(1.22));
const chip = document.getElementById("boardChip");
const chipName = document.getElementById("chipName");
const chipDetail = document.getElementById("chipDetail");
const chipPrice = document.getElementById("chipPrice");
const litImgs = [...document.querySelectorAll(".scene-lit")];
const GALLERY_BOARDS = [
  { slug: "hibiscus",   name: "Hibiscus Trio", origin: 21 },
  { slug: "sakura",     name: "Sakura",        origin: 40 },
  { slug: "stargazer",  name: "Stargazer",     origin: 60 },
  { slug: "wildflower", name: "Wildflower",    origin: 79 },
];
let galleryActive = false;
let focusedBoard = null;

let focusedScreenX = 0;
let focusAnchorX = 0, focusAnchorY = 0;
let lastPointerX = 0, lastPointerY = 0;

function focusBoard(i) {
  focusedBoard = i;
  focusAnchorX = lastPointerX;
  focusAnchorY = lastPointerY;
  scene.classList.add("focused");
  litImgs.forEach((img, j) => img.classList.toggle("on", j === i));
  sceneZoom.classList.remove("free");
  // Adaptive zoom: edge boards need a deeper zoom before they can reach
  // viewport center while the image still covers the screen.
  const b = GALLERY_BOARDS[i].origin / 100;
  const minEdge = Math.min(b, 1 - b);
  const s = Math.min(2.1, Math.max(1.55, innerWidth / (2 * stageW * minEdge)));
  const bx = b * stageW;
  const by = 0.54 * stageH;
  let tx = innerWidth / 2 - s * bx;
  let ty = innerHeight * 0.5 - s * by;
  tx = Math.min(0, Math.max(innerWidth - s * stageW, tx));
  ty = Math.min(0, Math.max(innerHeight - s * stageH, ty));
  sceneZoom.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  focusedScreenX = tx + s * bx;
  // info card follows the board
  chip.style.left = `${Math.min(innerWidth * 0.78, Math.max(innerWidth * 0.22, focusedScreenX))}px`;
  chipName.textContent = GALLERY_BOARDS[i].name;
  chipDetail.textContent = "acrylic on maple · signed · 1/1";
  chipPrice.textContent = "$499";
  chip.classList.add("show");
}

function unfocusBoard() {
  focusedBoard = null;
  unfocusedAt = performance.now();
  scene.classList.remove("focused");
  litImgs.forEach((img) => img.classList.remove("on"));
  sceneZoom.classList.remove("free");
  setStageTransform(scaleAboutViewportCenter(1));
  chip.classList.remove("show");
  chip.style.left = "50%";
}

/* Intentional hover only: focus requires the pointer to DWELL on a board
   (~190ms) — passing over, or the zoom animation sliding a board under a
   stationary cursor, never triggers it. Deselection is measured from the
   focused board's own screen position, so edge boards can't flicker. */
let hoverTimer = null;
let hoverTarget = null;
let unfocusedAt = 0;

scene.addEventListener("pointermove", (e) => {
  lastPointerX = e.clientX;
  lastPointerY = e.clientY;
  if (!galleryActive) return;
  if (focusedBoard === null) {
    if (performance.now() - unfocusedAt < 260) return; // cooldown after deselect
    const h = e.target.closest(".hotspot");
    const i = h ? parseInt(h.dataset.i, 10) : null;
    if (i !== hoverTarget) {
      clearTimeout(hoverTimer);
      hoverTarget = i;
      if (i !== null) {
        hoverTimer = setTimeout(() => {
          if (hoverTarget === i && focusedBoard === null && galleryActive) focusBoard(i);
        }, 190);
      }
    }
  } else {
    hoverTarget = null;
    // Stay focused while the pointer is near where it selected (the board may
    // have zoomed away to center) OR near the board's new centered position.
    const nearAnchor = Math.hypot(e.clientX - focusAnchorX, e.clientY - focusAnchorY) < innerWidth * 0.18;
    const nearBoard = Math.abs(e.clientX - focusedScreenX) < innerWidth * 0.3 && e.clientY > innerHeight * 0.08;
    if (!nearAnchor && !nearBoard) unfocusBoard();
  }
});

scene.addEventListener("click", () => {
  if (galleryActive && focusedBoard !== null) {
    window.waterTo(`checkout.html?board=${GALLERY_BOARDS[focusedBoard].slug}`);
  }
});

document.querySelectorAll(".hotspot").forEach((h) => {
  const i = parseInt(h.dataset.i, 10);
  h.addEventListener("focus", () => { if (galleryActive) focusBoard(i); });
  h.addEventListener("blur", () => { if (focusedBoard === i) unfocusBoard(); });
});

/* ---------- Soft reveal-on-scroll ---------- */
document.querySelectorAll(".reveal").forEach((el) => {
  gsap.to(el, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power2.out",
    scrollTrigger: { trigger: el, start: "top 88%" },
  });
});

/* ---------- Collection: gentle stagger, click → checkout ---------- */
gsap.from(".piece", {
  opacity: 0,
  y: 40,
  duration: 0.9,
  ease: "power2.out",
  stagger: 0.12,
  scrollTrigger: { trigger: ".pieces", start: "top 82%" },
});
document.querySelectorAll(".piece").forEach((piece) => {
  piece.style.cursor = "pointer";
  piece.addEventListener("click", () => window.waterTo(`checkout.html?board=${piece.dataset.board}`));
});

/* ---------- Water transition (shared) ---------- */
window.waterTo = (url) => {
  const wipe = document.getElementById("waterWipe");
  wipe.classList.add("active");
  setTimeout(() => { location.href = url; }, 1300);
};

/* ---------- Process clips: play only when visible ---------- */
document.querySelectorAll(".process-card video").forEach((v) => {
  ScrollTrigger.create({
    trigger: v,
    start: "top 90%",
    end: "bottom 10%",
    onEnter: () => v.play().catch(() => {}),
    onLeave: () => v.pause(),
    onEnterBack: () => v.play().catch(() => {}),
    onLeaveBack: () => v.pause(),
  });
});

/* ---------- Deep-link / QA scroll (?at=px) ---------- */
const atParam = new URLSearchParams(location.search).get("at");
if (atParam) {
  window.addEventListener("load", () => {
    setTimeout(() => window.scrollTo({ top: parseInt(atParam, 10), behavior: "instant" }), 300);
  });
}

/* ---------- Nav hide on scroll down ---------- */
let lastY = 0;
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  const y = window.scrollY;
  nav.classList.toggle("hidden", y > lastY && y > 300);
  lastY = y;
}, { passive: true });
