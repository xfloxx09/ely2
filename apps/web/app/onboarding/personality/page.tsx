"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/utils";
import { PencilScene } from "@/components/onboarding/PencilScene";
import { AvatarForge } from "@/components/onboarding/AvatarForge";
import { StoryReveal } from "@/components/onboarding/StoryReveal";
import { ChevronLeft, BookOpen, Feather } from "lucide-react";

type StoryChoice = { label: string; value: number };

type StoryBeat = {
  id: number;
  bfiId: number;
  trait: string;
  chapter: number;
  chapterTitle: string;
  narrative: string;
  question: string;
  choices: StoryChoice[];
  scenePrompt: string;
};

type StoryJourney = {
  title: string;
  prologue: string;
  heroName: string;
  setting: string;
  beats: StoryBeat[];
  _debug?: {
    storySource?: "gemini" | "openai" | "fallback";
    storyModel?: string;
    providerResolved?: "gemini" | "openai" | null;
    storyFailureReason?: string;
    sketchConfigured?: { sketchSource: string; sketchModel?: string };
  };
};

type Phase = "loading" | "prologue" | "story" | "submitting" | "reveal";

type SceneCacheEntry = {
  url: string;
  seed: number;
  _debug?: { sketchSource: string; sketchModel?: string; sketchFailureReason?: string };
};

function sceneSeedForBeat(bfiId: number, answerValue?: number) {
  return bfiId * 97 + (answerValue ?? 0) * 13;
}

function choiceLabelForBeat(beat: StoryBeat, answerValue?: number) {
  if (answerValue === undefined) return undefined;
  return beat.choices.find((c) => c.value === answerValue)?.label;
}

function isQuotaExceeded(reason?: string): boolean {
  if (!reason) return false;
  const lower = reason.toLowerCase();
  return lower.includes("429") || lower.includes("quota") || lower.includes("rate limit");
}

export default function PersonalityOnboarding() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [story, setStory] = useState<StoryJourney | null>(null);
  const [beatIndex, setBeatIndex] = useState(0);
  const [viewSceneIndex, setViewSceneIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [sceneCache, setSceneCache] = useState<Record<number, SceneCacheEntry>>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [blur, setBlur] = useState(40);
  const [progress, setProgress] = useState(0);
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [readyToAdvance, setReadyToAdvance] = useState(false);
  const [revealAvatar, setRevealAvatar] = useState<string | null>(null);
  const [sceneAnimating, setSceneAnimating] = useState(true);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [storyDebug, setStoryDebug] = useState<StoryJourney["_debug"]>(undefined);
  const [sketchDebug, setSketchDebug] = useState<SceneCacheEntry["_debug"]>(undefined);

  const beat = story?.beats[beatIndex];
  const totalBeats = story?.beats.length ?? 30;
  const maxSceneIndex = beatIndex;
  const viewedBeat = story?.beats[viewSceneIndex];
  const viewedScene = sceneCache[viewSceneIndex]?.url ?? null;

  const buildScenePayload = useCallback(
    (index: number, answerValue?: number, choiceLabel?: string) => {
      if (!story) return null;
      const b = story.beats[index];
      if (!b) return null;
      const val = answerValue ?? responses[b.bfiId];
      return {
        scenePrompt: b.scenePrompt,
        seed: sceneSeedForBeat(b.bfiId, val),
        answerValue: val,
        choiceLabel: choiceLabel ?? choiceLabelForBeat(b, val),
        beatIndex: index,
        totalBeats: story.beats.length,
        chapter: b.chapter,
        chapterTitle: b.chapterTitle,
        narrative: b.narrative,
        setting: story.setting,
        heroName: story.heroName,
      };
    },
    [story, responses]
  );

  const fetchSceneForBeat = useCallback(
    async (index: number, answerValue?: number, choiceLabel?: string, animate = true) => {
      const payload = buildScenePayload(index, answerValue, choiceLabel);
      if (!payload) return;

      setSceneAnimating(animate);
      setSceneLoading(true);
      try {
        const data = await apiFetch("/personality/story/scene", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSceneCache((prev) => ({
          ...prev,
          [index]: { url: data.imageUrl, seed: payload.seed, _debug: data._debug },
        }));
        if (data._debug) setSketchDebug(data._debug);
      } catch {
        /* keep previous */
      } finally {
        setSceneLoading(false);
      }
    },
    [buildScenePayload]
  );

  const fetchPreview = useCallback(
    async (nextResponses: Record<number, number>, index: number, beats: StoryBeat[]) => {
      try {
        const data = await apiFetch("/personality/story/preview", {
          method: "POST",
          body: JSON.stringify({ responses: nextResponses, beats, beatIndex: index }),
        });
        setAvatarPreview(data.avatarPreview);
        setBlur(data.blur);
        setProgress(data.progress);
      } catch {
        /* silent */
      }
    },
    []
  );

  useEffect(() => {
    apiFetch("/personality/story/generate", { method: "POST" })
      .then((data: StoryJourney) => {
        setStory(data);
        setStoryDebug(data._debug ?? undefined);
        setPhase("prologue");
      })
      .catch(() => setPhase("prologue"));
  }, []);

  useEffect(() => {
    if (!story || phase !== "story") return;
    fetchSceneForBeat(beatIndex, responses[story.beats[beatIndex]?.bfiId], undefined, beatIndex === viewSceneIndex);
    fetchPreview(responses, beatIndex, story.beats);
  }, [story, phase, beatIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!story) return;
    setSelectedValue(responses[story.beats[beatIndex]?.bfiId] ?? null);
    setReadyToAdvance(responses[story.beats[beatIndex]?.bfiId] !== undefined);
    setViewSceneIndex(beatIndex);
    const cached = sceneCache[beatIndex]?._debug;
    if (cached) setSketchDebug(cached);
  }, [beatIndex, story]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cached = sceneCache[viewSceneIndex]?._debug;
    if (cached) setSketchDebug(cached);
  }, [viewSceneIndex, sceneCache]);

  function selectChoice(value: number) {
    if (!beat || !story || readyToAdvance) return;
    setSelectedValue(value);
    const choiceLabel = beat.choices.find((c) => c.value === value)?.label;
    const nextResponses = { ...responses, [beat.bfiId]: value };
    setResponses(nextResponses);
    setReadyToAdvance(false);

    fetchSceneForBeat(beatIndex, value, choiceLabel, true);
    fetchPreview(nextResponses, beatIndex, story.beats);

    setTimeout(() => setReadyToAdvance(true), 1200);
  }

  function goBack() {
    if (beatIndex === 0 || !story) return;
    const prev = beatIndex - 1;
    setBeatIndex(prev);
    setViewSceneIndex(prev);
    setSceneAnimating(false);
    const b = story.beats[prev]!;
    const val = responses[b.bfiId];
    if (!sceneCache[prev]) {
      fetchSceneForBeat(prev, val, choiceLabelForBeat(b, val), false);
    }
    fetchPreview(responses, prev, story.beats);
  }

  function browseScenePrev() {
    if (viewSceneIndex <= 0) return;
    setSceneAnimating(false);
    setViewSceneIndex(viewSceneIndex - 1);
  }

  function browseSceneNext() {
    if (viewSceneIndex >= maxSceneIndex) return;
    const next = viewSceneIndex + 1;
    setSceneAnimating(false);
    setViewSceneIndex(next);
    if (story && !sceneCache[next]) {
      const b = story.beats[next]!;
      fetchSceneForBeat(next, responses[b.bfiId], choiceLabelForBeat(b, responses[b.bfiId]), false);
    }
  }

  async function advance() {
    if (!story || !beat) return;

    if (beatIndex < totalBeats - 1) {
      const next = beatIndex + 1;
      setBeatIndex(next);
      setViewSceneIndex(next);
      setSceneAnimating(true);
      const nextBeat = story.beats[next]!;
      const val = responses[nextBeat.bfiId];
      fetchSceneForBeat(next, val, choiceLabelForBeat(nextBeat, val), true);
      fetchPreview(responses, next, story.beats);
      return;
    }

    setPhase("submitting");
    try {
      const result = await apiFetch("/personality/submit", {
        method: "POST",
        body: JSON.stringify({ responses, formType: "short" }),
      });
      setRevealAvatar(result.avatar?.imageUrl ?? null);
      setPhase("reveal");
    } catch {
      setPhase("story");
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="h-10 w-10 rounded-full border-2 border-ely-primary/30 border-t-ely-primary"
        />
        <p className="text-sm text-ely-muted">Weaving your story...</p>
      </div>
    );
  }

  if (phase === "prologue" && story) {
    return (
      <div className="relative min-h-screen overflow-hidden px-4 py-10 safe-top safe-bottom">
        <div className="pointer-events-none absolute inset-0 gradient-orb opacity-60" />
        <div className="pointer-events-none absolute -right-24 top-20 h-64 w-64 rounded-full bg-ely-accent/10 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative mx-auto flex min-h-[80vh] max-w-lg flex-col justify-center"
        >
          <div className="mb-6 flex items-center gap-2 text-ely-accent">
            <BookOpen size={18} />
            <span className="text-[10px] uppercase tracking-[0.3em]">Your unique tale</span>
          </div>

          <h1 className="font-serif text-3xl leading-tight text-white sm:text-4xl">{story.title}</h1>
          <p className="mt-2 text-sm text-ely-muted">{story.setting}</p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 font-serif text-lg leading-relaxed text-white/85"
          >
            {story.prologue}
          </motion.p>

          {isQuotaExceeded(story._debug?.storyFailureReason) && (
            <p className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm leading-relaxed text-orange-100/90">
              Your Gemini API quota is used up (error 429). The built-in story still works — only AI personalization
              is off until quota resets or you enable billing at{" "}
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                className="underline text-orange-200"
              >
                Google AI Studio
              </a>
              .
            </p>
          )}

          {story._debug && (
            <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 font-mono text-[10px] leading-relaxed text-amber-100/85">
              <span className="font-semibold text-amber-200">Debug</span>
              {" · "}
              Story: {story._debug.storySource} ({story._debug.storyModel})
              {story._debug.providerResolved && story._debug.providerResolved !== story._debug.storySource
                ? ` · tried: ${story._debug.providerResolved}`
                : ""}
              {" · "}
              Sketch configured: {story._debug.sketchConfigured?.sketchSource} (
              {story._debug.sketchConfigured?.sketchModel})
              {story._debug.storyFailureReason ? (
                <>
                  <br />
                  <span className="text-amber-200/90">Why fallback: {story._debug.storyFailureReason}</span>
                </>
              ) : null}
            </p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-10 space-y-3"
          >
            <Button
              onClick={() => {
                setPhase("story");
                fetchSceneForBeat(0, undefined, undefined, true);
                fetchPreview({}, 0, story.beats);
              }}
              className="w-full sm:w-auto"
            >
              <Feather size={16} className="mr-2" />
              Begin the first chapter
            </Button>
            <button
              onClick={() => router.push("/chat")}
              className="block w-full text-center text-sm text-ely-muted hover:text-white"
            >
              Skip for now
            </button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (phase === "reveal" && story) {
    return (
      <StoryReveal
        title={story.title}
        heroName={story.heroName}
        avatarUrl={revealAvatar}
        onContinue={() => router.push("/chat")}
      />
    );
  }

  if (!story || !beat) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-ely-muted">Could not load your story. Please refresh.</p>
      </div>
    );
  }

  const storyProgress = ((beatIndex + 1) / totalBeats) * 100;
  const displayBeat = viewedBeat ?? beat;
  const isBrowsingPast = viewSceneIndex !== beatIndex;

  return (
    <div className="relative min-h-screen px-4 py-6 safe-top safe-bottom sm:py-8">
      <div className="pointer-events-none absolute inset-0 gradient-orb opacity-40" />

      <div className="relative mx-auto max-w-5xl">
        <header className="mb-6">
          {(storyDebug || sketchDebug) && (
            <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 font-mono text-[10px] leading-relaxed text-amber-100/90 sm:text-[11px]">
              <span className="font-semibold text-amber-200">Debug</span>
              {" · "}
              Story: {storyDebug?.storySource ?? "?"} ({storyDebug?.storyModel ?? "unknown"})
              {storyDebug?.providerResolved ? ` · provider: ${storyDebug.providerResolved}` : ""}
              {" · "}
              Sketch: {sketchDebug?.sketchSource ?? storyDebug?.sketchConfigured?.sketchSource ?? "?"}
              ({sketchDebug?.sketchModel ?? storyDebug?.sketchConfigured?.sketchModel ?? "pending"})
              {storyDebug?.storyFailureReason ? (
                <>
                  <br />
                  <span className="text-amber-200/90">Story fallback: {storyDebug.storyFailureReason}</span>
                </>
              ) : null}
              {sketchDebug?.sketchFailureReason ? (
                <>
                  <br />
                  <span className="text-amber-200/90">Sketch fallback: {sketchDebug.sketchFailureReason}</span>
                </>
              ) : null}
            </div>
          )}
          <div className="mb-2 flex items-center justify-between text-xs text-ely-muted">
            <span className="uppercase tracking-[0.2em]">
              Chapter {displayBeat.chapter} · {displayBeat.chapterTitle}
            </span>
            <span>
              Question {beatIndex + 1} / {totalBeats}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-ely-primary via-ely-secondary to-ely-accent"
              animate={{ width: `${storyProgress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_220px] lg:gap-8">
          <div className="space-y-6">
            <PencilScene
              imageUrl={viewedScene}
              loading={sceneLoading && viewSceneIndex === beatIndex}
              beatKey={`scene-${viewSceneIndex}-${sceneCache[viewSceneIndex]?.seed ?? "pending"}`}
              sceneIndex={viewSceneIndex}
              maxSceneIndex={maxSceneIndex}
              chapter={displayBeat.chapter}
              chapterTitle={displayBeat.chapterTitle}
              narrative={displayBeat.narrative}
              totalBeats={totalBeats}
              choiceLabel={choiceLabelForBeat(displayBeat, responses[displayBeat.bfiId])}
              onPrev={browseScenePrev}
              onNext={browseSceneNext}
              animate={sceneAnimating && viewSceneIndex === beatIndex}
            />

            {isBrowsingPast && (
              <p className="text-center text-xs text-ely-muted">
                Viewing moment {viewSceneIndex + 1} — use arrows to flip through your story so far
              </p>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={beat.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45 }}
                className="glass rounded-2xl p-5 sm:p-6"
              >
                <p className="font-serif text-base leading-relaxed text-white/75 break-words sm:text-lg">{beat.narrative}</p>
                <p className="mt-4 text-lg font-medium leading-snug text-white break-words sm:text-xl">{beat.question}</p>

                <div className="mt-5 space-y-2.5">
                  {beat.choices.map((choice) => (
                    <button
                      key={choice.value}
                      onClick={() => selectChoice(choice.value)}
                      disabled={phase === "submitting"}
                      className={`group w-full rounded-xl border px-4 py-3.5 text-left text-sm transition-all min-h-[44px] sm:text-[15px] ${
                        selectedValue === choice.value
                          ? "border-ely-primary bg-ely-primary/15 text-white shadow-lg shadow-ely-primary/10"
                          : "border-white/10 bg-white/[0.03] text-white/85 hover:border-ely-primary/40 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-ely-accent opacity-0 transition-opacity group-hover:opacity-60" />
                      {choice.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-col items-center lg:sticky lg:top-8 lg:self-start">
            <AvatarForge previewUrl={avatarPreview} progress={progress} blur={blur} />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="ghost" onClick={goBack} disabled={beatIndex === 0 || phase === "submitting"} className="flex-1 sm:flex-none">
            <ChevronLeft size={18} className="mr-1" /> Back
          </Button>
          <Button
            onClick={advance}
            disabled={selectedValue === null || !readyToAdvance || phase === "submitting"}
            className="flex-1 sm:flex-none sm:min-w-[180px]"
          >
            {phase === "submitting"
              ? "Creating your ELY..."
              : beatIndex === totalBeats - 1
                ? "Reveal my companion"
                : "Turn the page"}
          </Button>
        </div>
      </div>
    </div>
  );
}
