"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Question = {
  id: number;
  text: string;
  trait: string;
  reverseScored: boolean;
};

const SCALE = [
  { value: 1, label: "Disagree strongly" },
  { value: 2, label: "Disagree a little" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree a little" },
  { value: 5, label: "Agree strongly" },
];

export default function PersonalityOnboarding() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch("/personality/questions?type=short")
      .then((data) => setQuestions(data.questions))
      .catch(() => {});
  }, []);

  const q = questions[current];
  const progress = questions.length ? ((current + 1) / questions.length) * 100 : 0;

  function selectValue(value: number) {
    if (!q) return;
    setResponses((prev) => ({ ...prev, [q.id]: value }));
  }

  async function finish() {
    setLoading(true);
    try {
      await apiFetch("/personality/submit", {
        method: "POST",
        body: JSON.stringify({ responses, formType: "short" }),
      });
      router.push("/chat");
    } catch {
      setLoading(false);
    }
  }

  function next() {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      finish();
    }
  }

  if (!q) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-ely-muted">Loading assessment...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-8 safe-top safe-bottom">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
        <div className="mb-8">
          <div className="flex justify-between text-sm text-ely-muted mb-2">
            <span>Personality Assessment</span>
            <span>{current + 1} / {questions.length}</span>
          </div>
          <div className="h-2 bg-ely-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ely-primary to-ely-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Card className="flex-1 flex flex-col justify-center mb-8">
          <p className="text-lg sm:text-xl font-medium leading-relaxed mb-8">
            {q.text}
          </p>

          <div className="space-y-3">
            {SCALE.map((s) => (
              <button
                key={s.value}
                onClick={() => selectValue(s.value)}
                className={`w-full px-4 py-4 rounded-xl text-left transition-all min-h-[44px] ${
                  responses[q.id] === s.value
                    ? "bg-ely-primary/20 border-2 border-ely-primary"
                    : "bg-ely-bg border border-ely-border hover:border-ely-primary/50"
                }`}
              >
                <span className="font-medium mr-2">{s.value}.</span>
                {s.label}
              </button>
            ))}
          </div>
        </Card>

        <div className="flex gap-4">
          <Button
            variant="ghost"
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0}
            className="flex-1"
          >
            <ChevronLeft size={18} className="mr-1" /> Back
          </Button>
          <Button
            onClick={next}
            disabled={!responses[q.id] || loading}
            className="flex-1"
          >
            {current === questions.length - 1 ? (loading ? "Creating ELY..." : "Complete") : "Next"}
            {current < questions.length - 1 && <ChevronRight size={18} className="ml-1" />}
          </Button>
        </div>

        <button
          onClick={() => router.push("/chat")}
          className="text-sm text-ely-muted text-center mt-4 hover:text-white"
        >
          Skip for now (neutral persona)
        </button>
      </div>
    </div>
  );
}
