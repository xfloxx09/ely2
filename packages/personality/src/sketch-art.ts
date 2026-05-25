import type { TraitScores } from "./bfi2.js";

export type StorySceneInput = {
  beatIndex: number;
  totalBeats: number;
  chapter: number;
  chapterTitle: string;
  narrative: string;
  setting: string;
  heroName: string;
  scenePrompt: string;
  answerValue?: number;
  choiceLabel?: string;
  seed: number;
};

function hashSeed(seed: number): number {
  return (seed * 2654435761) >>> 0;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

type SettingKind = "coastal" | "library" | "garden" | "train" | "city" | "generic";

function detectSetting(setting: string): SettingKind {
  const s = setting.toLowerCase();
  if (/coast|harbor|lantern|shore|sea|tide/.test(s)) return "coastal";
  if (/library|book|ink|archive|shelf/.test(s)) return "library";
  if (/garden|cloud|float|bloom|petal/.test(s)) return "garden";
  if (/train|rail|track|station|star/.test(s)) return "train";
  if (/city|street|dream|window|alley/.test(s)) return "city";
  return "generic";
}

type StoryElement =
  | "threshold"
  | "path"
  | "stranger"
  | "mirror"
  | "storm"
  | "light"
  | "crossroads"
  | "door"
  | "water"
  | "gathering"
  | "desk"
  | "bridge";

function detectElements(narrative: string, scenePrompt: string, chapterTitle: string): StoryElement[] {
  const text = `${narrative} ${scenePrompt} ${chapterTitle}`.toLowerCase();
  const found: StoryElement[] = [];
  const rules: [StoryElement, RegExp][] = [
    ["threshold", /\b(threshold|beginning|first step|awakening|entrance)\b/],
    ["door", /\b(door|gate|portal|archway|opening)\b/],
    ["stranger", /\b(stranger|traveler|another|companion|crowd|gathering|market|voices|people)\b/],
    ["mirror", /\b(mirror|reflection|pool|echo|inner)\b/],
    ["storm", /\b(storm|dark|rain|tighten|shadow|uncertain|mist)\b/],
    ["light", /\b(light|lantern|glow|dawn|bright|radiant|sun|star)\b/],
    ["crossroads", /\b(crossroad|fork|choice|split|path twists|decide)\b/],
    ["water", /\b(lake|water|wave|coast|river|shore|tide)\b/],
    ["gathering", /\b(market|crowd|room|festival|together)\b/],
    ["desk", /\b(desk|map|plan|compass|order|task|list)\b/],
    ["bridge", /\b(bridge|connect|between|share|tea|harmony)\b/],
    ["path", /\b(road|path|journey|walk|continue|long road)\b/],
  ];
  for (const [el, re] of rules) {
    if (re.test(text)) found.push(el);
  }
  if (found.length === 0) found.push("path");
  return found.slice(0, 4);
}

function settingBackdrop(kind: SettingKind, progress: number): string {
  switch (kind) {
    case "coastal":
      return `
        <path d="M0 250 Q80 235 160 248 T320 242 T400 250 L400 320 L0 320 Z" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.2"/>
        <path d="M0 265 Q100 252 200 260 T400 255" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.8"/>
        <path d="M330 120 L350 70 L370 120 L350 95 Z" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
        ${progress > 0.15 ? `<circle cx="360" cy="55" r="14" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.8"/>` : ""}
      `;
    case "library":
      return `
        <line x1="30" y1="60" x2="30" y2="270" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
        <line x1="370" y1="60" x2="370" y2="270" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
        ${[0, 1, 2, 3, 4].map((i) => `<line x1="45" y1="${90 + i * 35}" x2="120" y2="${90 + i * 35}" stroke="rgba(255,255,255,0.1)" stroke-width="0.7"/>`).join("")}
        ${[0, 1, 2, 3, 4].map((i) => `<line x1="280" y1="${85 + i * 35}" x2="355" y2="${85 + i * 35}" stroke="rgba(255,255,255,0.1)" stroke-width="0.7"/>`).join("")}
        <path d="M160 270 Q200 110 240 270" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
      `;
    case "garden":
      return `
        <ellipse cx="200" cy="300" rx="180" ry="25" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        ${[60, 140, 260, 340].map((x, i) => `<path d="M${x} 280 L${x} ${200 - i * 8} Q${x - 15} ${180 - i * 8} ${x - 25} ${195 - i * 8}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>`).join("")}
        <path d="M40 140 Q200 80 360 130" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" stroke-dasharray="4 6"/>
      `;
    case "train":
      return `
        <line x1="0" y1="258" x2="400" y2="258" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
        ${[40, 120, 200, 280, 360].map((x) => `<line x1="${x}" y1="258" x2="${x - 8}" y2="268" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>`).join("")}
        ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${20 + i * 48}" cy="${40 + (i % 3) * 12}" r="1.2" fill="rgba(255,255,255,0.25)"/>`).join("")}
      `;
    case "city":
      return `
        ${[50, 110, 170, 230, 290, 350].map((x, i) => `<rect x="${x}" y="${150 - (i % 3) * 20}" width="35" height="${120 + (i % 2) * 15}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.9"/>`).join("")}
        ${[65, 125, 245, 305].map((x) => `<rect x="${x + 8}" y="${190}" width="8" height="10" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.5"/>`).join("")}
      `;
    default:
      return `
        <path d="M0 240 Q120 220 240 235 T400 228" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
        <circle cx="320" cy="70" r="28" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.8"/>
      `;
  }
}

function drawElement(el: StoryElement, heroX: number, hash: number): string {
  const jitter = (hash % 20) - 10;
  switch (el) {
    case "threshold":
    case "door":
      return `
        <path d="M${heroX + 55 + jitter} 270 L${heroX + 55 + jitter} 150 Q${heroX + 85 + jitter} 120 ${heroX + 115 + jitter} 150 L${heroX + 115 + jitter} 270" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.8"/>
        <circle cx="${heroX + 105 + jitter}" cy="210" r="3" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="0.8"/>
      `;
    case "stranger":
      return `
        <circle cx="${heroX + 70}" cy="198" r="9" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
        <path d="M${heroX + 70} 207 L${heroX + 70} 248 M${heroX + 70} 218 L${heroX + 58} 235 M${heroX + 70} 218 L${heroX + 82} 232" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="0.9"/>
      `;
    case "mirror":
      return `
        <ellipse cx="${heroX + 40}" cy="190" rx="22" ry="30" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.2"/>
        <path d="M${heroX + 28} 175 Q${heroX + 40} 185 ${heroX + 52} 175" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.7"/>
      `;
    case "storm":
      return `
        <path d="M${heroX - 30} 90 Q${heroX} 70 ${heroX + 40} 95 T${heroX + 90} 85" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
        <line x1="${heroX + 20}" y1="100" x2="${heroX + 15}" y2="120" stroke="rgba(255,255,255,0.15)" stroke-width="0.8"/>
      `;
    case "light":
      return `
        <circle cx="${heroX + 50}" cy="130" r="16" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
        ${[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x2 = heroX + 50 + Math.cos(rad) * 28;
          const y2 = 130 + Math.sin(rad) * 28;
          return `<line x1="${heroX + 50}" y1="130" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,0.12)" stroke-width="0.6"/>`;
        }).join("")}
      `;
    case "crossroads":
      return `
        <path d="M${heroX - 40} 270 Q${heroX} 240 ${heroX + 40} 270" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.2"/>
        <path d="M${heroX} 270 L${heroX} 230" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
        <path d="M${heroX - 25} 250 L${heroX + 25} 250" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="0.8"/>
      `;
    case "water":
      return `
        <path d="M${heroX - 50} 275 Q${heroX - 20} 260 ${heroX + 10} 275 T${heroX + 70} 272" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
      `;
    case "gathering":
      return `
        <circle cx="${heroX + 55}" cy="200" r="7" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="0.8"/>
        <circle cx="${heroX + 75}" cy="205" r="6" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.8"/>
        <circle cx="${heroX + 90}" cy="198" r="7" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.8"/>
      `;
    case "desk":
      return `
        <rect x="${heroX + 30}" y="230" width="50" height="6" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="0.9"/>
        <line x1="${heroX + 38}" y1="236" x2="${heroX + 38}" y2="255" stroke="rgba(255,255,255,0.15)" stroke-width="0.7"/>
        <line x1="${heroX + 70}" y1="236" x2="${heroX + 70}" y2="255" stroke="rgba(255,255,255,0.15)" stroke-width="0.7"/>
        <rect x="${heroX + 42}" y="218" width="22" height="14" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.7"/>
      `;
    case "bridge":
      return `
        <path d="M${heroX - 20} 255 Q${heroX + 30} 225 ${heroX + 80} 255" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.3"/>
        <line x1="${heroX - 5}" y1="250" x2="${heroX - 5}" y2="270" stroke="rgba(255,255,255,0.12)" stroke-width="0.6"/>
        <line x1="${heroX + 35}" y1="238" x2="${heroX + 35}" y2="270" stroke="rgba(255,255,255,0.12)" stroke-width="0.6"/>
      `;
    case "path":
    default:
      return `
        <path d="M40 272 Q${heroX} 248 ${Math.min(heroX + 80, 360)} 268" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.2"/>
      `;
  }
}

function drawHero(heroX: number, heroName: string, answerValue?: number): string {
  const mood = answerValue ?? 3;
  const stride = mood >= 4 ? 4 : mood <= 2 ? -2 : 0;
  const headY = 188 + stride;
  return `
    <g opacity="0.9">
      <circle cx="${heroX}" cy="${headY}" r="10" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>
      <path d="M${heroX} ${headY + 10} L${heroX} ${headY + 42}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.4"/>
      <path d="M${heroX} ${headY + 22} L${heroX - 14} ${headY + 34} M${heroX} ${headY + 22} L${heroX + 14} ${headY + 34}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.1"/>
      <path d="M${heroX} ${headY + 42} L${heroX - 10 + stride} ${headY + 58} M${heroX} ${headY + 42} L${heroX + 10 - stride} ${headY + 58}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.1"/>
      <path d="M${heroX - 8} ${headY - 2} Q${heroX} ${headY - 14} ${heroX + 8} ${headY - 2}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.8"/>
    </g>
    <text x="${heroX}" y="${headY + 78}" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="9" font-family="Georgia, serif">${escapeXml(heroName.slice(0, 12))}</text>
  `;
}

function crosshatch(count: number, hash: number, opacity: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const y = 24 + i * 14 + (hash % 16);
    lines.push(
      `<line x1="16" y1="${y}" x2="384" y2="${y + (i % 3) * 2}" stroke="rgba(255,255,255,${opacity + (i % 4) * 0.012})" stroke-width="0.45"/>`
    );
  }
  return lines.join("");
}

/** Story-continuous pencil sketch — each frame advances the same journey */
export function generateStorySceneSvg(input: StorySceneInput): string {
  const hash = hashSeed(input.seed);
  const progress = input.totalBeats > 1 ? input.beatIndex / (input.totalBeats - 1) : 0;
  const heroX = 70 + progress * 240;
  const settingKind = detectSetting(input.setting);
  const elements = detectElements(input.narrative, input.scenePrompt, input.chapterTitle);

  const mood = input.answerValue ?? 3;
  const moodShift = (mood - 3) * 0.04;
  const hue = (220 + input.chapter * 8 + hash % 30) % 360;

  const backdrop = settingBackdrop(settingKind, progress);
  const storyProps = elements.map((el) => drawElement(el, heroX, hash + el.length * 17)).join("");
  const hero = drawHero(heroX, input.heroName, input.answerValue);

  const chapterLabel = `Ch. ${input.chapter} — ${input.chapterTitle}`;
  const caption = truncate(input.narrative, 110);
  const choiceNote = input.choiceLabel ? truncate(input.choiceLabel, 72) : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="400" height="320">
    <defs>
      <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="n"/><feDiffuseLighting in="n" lighting-color="#12121a" surfaceScale="1"><feDistantLight azimuth="50" elevation="58"/></feDiffuseLighting></filter>
      <radialGradient id="sky" cx="${30 + progress * 40}%" cy="30%"><stop offset="0%" stop-color="hsla(${hue},30%,${38 + moodShift * 100}%,0.5)"/><stop offset="100%" stop-color="hsla(${hue},20%,8%,0.96)"/></radialGradient>
    </defs>
    <rect width="400" height="320" fill="url(#sky)"/>
    ${crosshatch(12, hash, 0.05)}
    ${backdrop}
    ${storyProps}
    ${hero}
    ${crosshatch(6, hash + 99, 0.03)}
    <rect x="0" y="248" width="400" height="72" fill="rgba(8,8,12,0.72)"/>
    <line x1="20" y1="248" x2="380" y2="248" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
    <text x="20" y="266" fill="rgba(255,255,255,0.45)" font-size="8" font-family="Georgia, serif" letter-spacing="0.08em">${escapeXml(chapterLabel.toUpperCase())}</text>
    <text x="20" y="284" fill="rgba(255,255,255,0.78)" font-size="11" font-family="Georgia, serif">${escapeXml(caption)}</text>
    ${choiceNote ? `<text x="20" y="302" fill="rgba(167,139,250,0.85)" font-size="9" font-family="Georgia, serif" font-style="italic">${escapeXml(`You chose: ${choiceNote}`)}</text>` : `<text x="20" y="302" fill="rgba(255,255,255,0.3)" font-size="9" font-family="Georgia, serif">Moment ${input.beatIndex + 1} of ${input.totalBeats}</text>`}
    <rect width="400" height="320" fill="url(#paper)" opacity="0.14"/>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** @deprecated Use generateStorySceneSvg — kept for compatibility */
export function generateSketchSceneSvg(scenePrompt: string, seed: number): string {
  return generateStorySceneSvg({
    beatIndex: seed % 30,
    totalBeats: 30,
    chapter: 1,
    chapterTitle: "The Journey",
    narrative: scenePrompt,
    setting: scenePrompt,
    heroName: "Traveler",
    scenePrompt,
    seed,
  });
}

export function generateAvatarSilhouetteSvg(
  partialTraits: Record<string, number>,
  blurAmount: number
): string {
  const o = (partialTraits.openness ?? 50) / 100;
  const e = (partialTraits.extraversion ?? 50) / 100;
  const a = (partialTraits.agreeableness ?? 50) / 100;
  const c = (partialTraits.conscientiousness ?? 50) / 100;
  const n = (partialTraits.neuroticism ?? 50) / 100;

  const smileCurve = 180 + e * 20;
  const eyeSize = 4 + e * 3;
  const hairFlow = o * 30;
  const faceRound = a * 8;
  const clarity = Math.max(0, 1 - blurAmount / 100);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
    <defs>
      <filter id="blur"><feGaussianBlur stdDeviation="${blurAmount * 0.12}"/></filter>
      <linearGradient id="face" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsla(${260 + o * 40},60%,${55 + c * 10}%,${0.3 + clarity * 0.5})"/>
        <stop offset="100%" stop-color="hsla(${280 + e * 20},50%,${45 + a * 15}%,${0.2 + clarity * 0.4})"/>
      </linearGradient>
    </defs>
    <g filter="url(#blur)" opacity="${0.4 + clarity * 0.6}">
      <ellipse cx="100" cy="130" rx="${55 + faceRound}" ry="65" fill="url(#face)" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
      <path d="M${70 - hairFlow} 90 Q100 ${40 - o * 15} ${130 + hairFlow} 90" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      <path d="M${75 - hairFlow * 0.5} 85 Q100 ${55 - o * 10} ${125 + hairFlow * 0.5} 85" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
      <ellipse cx="82" cy="120" rx="${eyeSize}" ry="${eyeSize * 0.7}" fill="rgba(255,255,255,${0.3 + e * 0.4})"/>
      <ellipse cx="118" cy="120" rx="${eyeSize}" ry="${eyeSize * 0.7}" fill="rgba(255,255,255,${0.3 + e * 0.4})"/>
      <path d="M85 ${smileCurve} Q100 ${smileCurve + 8 + e * 6} 115 ${smileCurve}" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
      ${n > 0.5 ? `<path d="M95 135 Q100 138 105 135" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>` : ""}
      <path d="M88 155 Q100 162 112 155" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
    </g>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function scoresToPartialTraits(scores: TraitScores): Record<string, number> {
  return {
    openness: scores.openness,
    extraversion: scores.extraversion,
    agreeableness: scores.agreeableness,
    conscientiousness: scores.conscientiousness,
    neuroticism: scores.neuroticism,
  };
}
