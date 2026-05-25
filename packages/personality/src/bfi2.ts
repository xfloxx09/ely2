export type TraitScores = {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
};

export type BFIQuestion = {
  id: number;
  text: string;
  trait: keyof TraitScores;
  reverseScored: boolean;
};

export const BFI2_SHORT: BFIQuestion[] = [
  { id: 1, text: "I see myself as someone who is outgoing, sociable", trait: "extraversion", reverseScored: false },
  { id: 2, text: "I see myself as someone who is compassionate, has a soft heart", trait: "agreeableness", reverseScored: false },
  { id: 3, text: "I see myself as someone who tends to be disorganized", trait: "conscientiousness", reverseScored: true },
  { id: 4, text: "I see myself as someone who is relaxed, handles stress well", trait: "neuroticism", reverseScored: true },
  { id: 5, text: "I see myself as someone who has few artistic interests", trait: "openness", reverseScored: true },
  { id: 6, text: "I see myself as someone who has an assertive personality", trait: "extraversion", reverseScored: false },
  { id: 7, text: "I see myself as someone who is respectful, treats others with respect", trait: "agreeableness", reverseScored: false },
  { id: 8, text: "I see myself as someone who tends to be lazy", trait: "conscientiousness", reverseScored: true },
  { id: 9, text: "I see myself as someone who stays optimistic after setbacks", trait: "neuroticism", reverseScored: true },
  { id: 10, text: "I see myself as someone who is complex, a deep thinker", trait: "openness", reverseScored: false },
  { id: 11, text: "I see myself as someone who is less active than other people", trait: "extraversion", reverseScored: true },
  { id: 12, text: "I see myself as someone who tends to find fault with others", trait: "agreeableness", reverseScored: true },
  { id: 13, text: "I see myself as someone who is dependable, steady", trait: "conscientiousness", reverseScored: false },
  { id: 14, text: "I see myself as someone who is moody, has up and down moods", trait: "neuroticism", reverseScored: false },
  { id: 15, text: "I see myself as someone who is inventive, finds clever ways to do things", trait: "openness", reverseScored: false },
  { id: 16, text: "I see myself as someone who tends to be quiet", trait: "extraversion", reverseScored: true },
  { id: 17, text: "I see myself as someone who feels little sympathy for others", trait: "agreeableness", reverseScored: true },
  { id: 18, text: "I see myself as someone who is systematic, likes to keep things in order", trait: "conscientiousness", reverseScored: false },
  { id: 19, text: "I see myself as someone who can be tense", trait: "neuroticism", reverseScored: false },
  { id: 20, text: "I see myself as someone who is curious about many different things", trait: "openness", reverseScored: false },
  { id: 21, text: "I see myself as someone who is full of energy", trait: "extraversion", reverseScored: false },
  { id: 22, text: "I see myself as someone who starts arguments with others", trait: "agreeableness", reverseScored: true },
  { id: 23, text: "I see myself as someone who is a reliable worker", trait: "conscientiousness", reverseScored: false },
  { id: 24, text: "I see myself as someone who can be moody", trait: "neuroticism", reverseScored: false },
  { id: 25, text: "I see myself as someone who is ingenious, a deep thinker", trait: "openness", reverseScored: false },
  { id: 26, text: "I see myself as someone who generates a lot of enthusiasm", trait: "extraversion", reverseScored: false },
  { id: 27, text: "I see myself as someone who has a forgiving nature", trait: "agreeableness", reverseScored: false },
  { id: 28, text: "I see myself as someone who tends to be disorganized", trait: "conscientiousness", reverseScored: true },
  { id: 29, text: "I see myself as someone who worries a lot", trait: "neuroticism", reverseScored: false },
  { id: 30, text: "I see myself as someone who is original, comes up with new ideas", trait: "openness", reverseScored: false },
];

export const BFI2_LONG: BFIQuestion[] = [
  ...BFI2_SHORT,
  { id: 31, text: "I see myself as someone who is talkative", trait: "extraversion", reverseScored: false },
  { id: 32, text: "I see myself as someone who is sometimes rude to others", trait: "agreeableness", reverseScored: true },
  { id: 33, text: "I see myself as someone who does a thorough job", trait: "conscientiousness", reverseScored: false },
  { id: 34, text: "I see myself as someone who gets nervous easily", trait: "neuroticism", reverseScored: false },
  { id: 35, text: "I see myself as someone who is sophisticated in art, music, or literature", trait: "openness", reverseScored: false },
  { id: 36, text: "I see myself as someone who is reserved", trait: "extraversion", reverseScored: true },
  { id: 37, text: "I see myself as someone who is helpful and unselfish with others", trait: "agreeableness", reverseScored: false },
  { id: 38, text: "I see myself as someone who can be somewhat careless", trait: "conscientiousness", reverseScored: true },
  { id: 39, text: "I see myself as someone who is emotionally stable, not easily upset", trait: "neuroticism", reverseScored: true },
  { id: 40, text: "I see myself as someone who is curious about many different things", trait: "openness", reverseScored: false },
  { id: 41, text: "I see myself as someone who is sometimes shy, inhibited", trait: "extraversion", reverseScored: true },
  { id: 42, text: "I see myself as someone who is considerate and kind to almost everyone", trait: "agreeableness", reverseScored: false },
  { id: 43, text: "I see myself as someone who does things efficiently", trait: "conscientiousness", reverseScored: false },
  { id: 44, text: "I see myself as someone who remains calm in tense situations", trait: "neuroticism", reverseScored: true },
  { id: 45, text: "I see myself as someone who prefers work that is routine", trait: "openness", reverseScored: true },
  { id: 46, text: "I see myself as someone who is outgoing, sociable", trait: "extraversion", reverseScored: false },
  { id: 47, text: "I see myself as someone who is sometimes cold and distant", trait: "agreeableness", reverseScored: true },
  { id: 48, text: "I see myself as someone who makes plans and follows through", trait: "conscientiousness", reverseScored: false },
  { id: 49, text: "I see myself as someone who gets stressed out easily", trait: "neuroticism", reverseScored: false },
  { id: 50, text: "I see myself as someone who is original, comes up with new ideas", trait: "openness", reverseScored: false },
  { id: 51, text: "I see myself as someone who is dominant, acts as a leader", trait: "extraversion", reverseScored: false },
  { id: 52, text: "I see myself as someone who is sometimes conflictual with others", trait: "agreeableness", reverseScored: true },
  { id: 53, text: "I see myself as someone who is a reliable worker", trait: "conscientiousness", reverseScored: false },
  { id: 54, text: "I see myself as someone who can be moody", trait: "neuroticism", reverseScored: false },
  { id: 55, text: "I see myself as someone who is inventive, finds clever ways to do things", trait: "openness", reverseScored: false },
  { id: 56, text: "I see myself as someone who is full of energy", trait: "extraversion", reverseScored: false },
  { id: 57, text: "I see myself as someone who has a forgiving nature", trait: "agreeableness", reverseScored: false },
  { id: 58, text: "I see myself as someone who tends to be lazy", trait: "conscientiousness", reverseScored: true },
  { id: 59, text: "I see myself as someone who worries a lot", trait: "neuroticism", reverseScored: false },
  { id: 60, text: "I see myself as someone who is complex, a deep thinker", trait: "openness", reverseScored: false },
];

export function scoreBFI2(
  responses: Record<number, number>,
  questions: BFIQuestion[]
): TraitScores {
  const traitSums: Record<keyof TraitScores, { sum: number; count: number }> = {
    openness: { sum: 0, count: 0 },
    conscientiousness: { sum: 0, count: 0 },
    extraversion: { sum: 0, count: 0 },
    agreeableness: { sum: 0, count: 0 },
    neuroticism: { sum: 0, count: 0 },
  };

  for (const q of questions) {
    const raw = responses[q.id];
    if (raw === undefined) continue;
    const score = q.reverseScored ? 6 - raw : raw;
    traitSums[q.trait].sum += score;
    traitSums[q.trait].count += 1;
  }

  const normalize = (sum: number, count: number) =>
    count === 0 ? 50 : Math.round(((sum / count - 1) / 4) * 100);

  return {
    openness: normalize(traitSums.openness.sum, traitSums.openness.count),
    conscientiousness: normalize(traitSums.conscientiousness.sum, traitSums.conscientiousness.count),
    extraversion: normalize(traitSums.extraversion.sum, traitSums.extraversion.count),
    agreeableness: normalize(traitSums.agreeableness.sum, traitSums.agreeableness.count),
    neuroticism: normalize(traitSums.neuroticism.sum, traitSums.neuroticism.count),
  };
}
