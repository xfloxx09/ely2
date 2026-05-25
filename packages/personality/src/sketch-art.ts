import type { TraitScores } from "./bfi2.js";

function hashSeed(seed: number): number {
  return (seed * 2654435761) >>> 0;
}

/** SVG pencil-sketch style scene — no external API required */
export function generateSketchSceneSvg(scenePrompt: string, seed: number): string {
  const hash = hashSeed(seed);
  const hue = hash % 360;
  const lines = 14 + (hash % 10);
  const moodBoost = scenePrompt.includes("bold") ? 0.15 : scenePrompt.includes("shadow") ? -0.1 : 0;

  const elements: string[] = [];
  for (let i = 0; i < lines; i++) {
    const y = 30 + i * 16 + (hash % 24);
    const x1 = 20 + (i * 19) % 50;
    const x2 = 380 - (i * 11) % 60;
    elements.push(
      `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y + (i % 4) * 3}" stroke="rgba(255,255,255,${0.06 + (i % 6) * 0.035 + moodBoost})" stroke-width="${0.4 + (i % 3) * 0.25}"/>`
    );
  }

  for (let i = 0; i < 8; i++) {
    const x = 40 + i * 42 + (hash % 20);
    elements.push(
      `<line x1="${x}" y1="20" x2="${x - 20}" y2="300" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>`
    );
  }

  const keywords = scenePrompt.toLowerCase();
  let motif = "path";
  if (keywords.includes("library") || keywords.includes("book") || keywords.includes("arch")) motif = "arch";
  else if (keywords.includes("garden") || keywords.includes("tree")) motif = "tree";
  else if (keywords.includes("lake") || keywords.includes("water") || keywords.includes("waves")) motif = "waves";
  else if (keywords.includes("market") || keywords.includes("crowd") || keywords.includes("figures")) motif = "figures";
  else if (keywords.includes("train") || keywords.includes("road")) motif = "train";
  else if (keywords.includes("mist") || keywords.includes("fog")) motif = "mist";

  let motifSvg = "";
  if (motif === "arch") {
    motifSvg = `
      <path d="M90 270 Q200 90 310 270" fill="none" stroke="rgba(255,255,255,0.38)" stroke-width="2"/>
      <path d="M120 270 L120 180 M280 270 L280 180" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
      <line x1="140" y1="200" x2="260" y2="200" stroke="rgba(255,255,255,0.15)" stroke-width="0.8"/>
    `;
  } else if (motif === "tree") {
    motifSvg = `
      <path d="M200 280 L200 130" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
      <path d="M200 150 Q150 190 130 170 M200 150 Q250 190 270 170 M200 130 Q170 110 160 95 M200 130 Q230 110 240 95" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.2"/>
      <ellipse cx="200" cy="280" rx="40" ry="8" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
    `;
  } else if (motif === "waves") {
    motifSvg = `
      <path d="M60 230 Q100 210 140 230 T220 230 T300 230" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="1.3"/>
      <path d="M80 250 Q120 235 160 250 T240 250" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <circle cx="320" cy="80" r="22" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>
    `;
  } else if (motif === "figures") {
    motifSvg = `
      <circle cx="150" cy="190" r="14" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>
      <path d="M150 204 L150 250 M150 220 L130 240 M150 220 L170 240" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1"/>
      <circle cx="250" cy="200" r="12" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
      <path d="M250 212 L250 255 M250 225 L235 245 M250 225 L265 242" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
    `;
  } else if (motif === "train") {
    motifSvg = `
      <rect x="80" y="210" width="240" height="50" rx="6" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      <line x1="130" y1="210" x2="130" y2="260" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <line x1="200" y1="210" x2="200" y2="260" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <line x1="270" y1="210" x2="270" y2="260" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <path d="M60 240 L80 240 M320 240 L340 240" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    `;
  } else if (motif === "mist") {
    motifSvg = `
      <path d="M40 180 Q120 160 200 180 T360 180" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
      <path d="M60 210 Q140 195 220 210 T380 205" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    `;
  } else {
    motifSvg = `
      <path d="M90 280 L200 120 L310 280" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.8"/>
      <path d="M130 280 L200 160 L270 280" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="400" height="320">
    <defs>
      <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="5" result="n"/><feDiffuseLighting in="n" lighting-color="#14141f" surfaceScale="1.2"><feDistantLight azimuth="45" elevation="55"/></feDiffuseLighting></filter>
      <radialGradient id="g" cx="50%" cy="38%"><stop offset="0%" stop-color="hsla(${hue},35%,${32 + moodBoost * 100}%,0.55)"/><stop offset="100%" stop-color="hsla(${hue},25%,8%,0.95)"/></radialGradient>
    </defs>
    <rect width="400" height="320" fill="url(#g)"/>
    ${elements.join("")}
    ${motifSvg}
    <rect width="400" height="320" fill="url(#paper)" opacity="0.18"/>
    <rect width="400" height="320" fill="rgba(10,10,15,0.08)"/>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
