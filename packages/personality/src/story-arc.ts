/** One continuous 30-beat narrative — each moment flows into the next. */
export type ArcMoment = {
  narrative: string;
  question: string;
  sceneDetail: string;
};

export function buildContinuousArc(hero: string, setting: string): ArcMoment[] {
  const h = hero;
  const s = setting;

  return [
    {
      narrative: `${h} arrives at the edge of ${s}, clutching a blank map that pulses faintly. Distant music drifts through the mist — a festival has begun without them.`,
      question: `The path splits toward the music. Does ${h} walk toward the crowd, heart already lifting?`,
      sceneDetail: "hero at crossroads, distant festival lights, misty path, lantern",
    },
    {
      narrative: `Following the sound, ${h} finds a traveler collapsed by the road, ink bleeding from a torn journal. The map in ${h}'s hand warms, as if waiting.`,
      question: `The stranger reaches out. How quickly does ${h}'s compassion move before caution?`,
      sceneDetail: "injured traveler on path, glowing map in hand, compassionate moment",
    },
    {
      narrative: `${h} helps the traveler sit, but their shared camp is chaos — bedroll half-spread, crumbs, unfinished notes. The map gains its first smudged line.`,
      question: `The mess surrounds ${h}. Is disorder simply part of how they live?`,
      sceneDetail: "messy camp beside road, scattered papers, bedroll",
    },
    {
      narrative: `Thunder rolls over ${s}, yet the lantern on ${h}'s map glows steady. The traveler sleeps. ${h} watches the storm pass.`,
      question: `When the sky breaks open, does ${h} stay unshaken inside?`,
      sceneDetail: "storm clouds, sheltered camp, steady lantern light",
    },
    {
      narrative: `Dawn clears the air. ${h} passes a wall of empty picture frames — the traveler said artists once filled them. Only dust remains.`,
      question: `Do abstract beauty and art call to ${h}, or does the practical road matter more?`,
      sceneDetail: "empty ornate frames on stone wall, dusty gallery, morning light",
    },
    {
      narrative: `By midday ${h} reaches a hall where voices debate the way forward. All eyes turn — they expect someone to speak.`,
      question: `In a room that demands a voice, does ${h} step forward without hesitation?`,
      sceneDetail: "gathering hall, crowd turning toward hero, raised platform",
    },
    {
      narrative: `${h} speaks, then listens as an elder recounts old laws of the road. Respect hangs in the air like incense.`,
      question: `When others share their truth, does ${h} honor them even when it's hard?`,
      sceneDetail: "elder speaking, respectful audience, incense smoke",
    },
    {
      narrative: `The council assigns ${h} chores before the next leg — fetch water, mend the signpost. The open trail glitters beyond the gate.`,
      question: `Would ${h} rather wander freely, leaving tasks half-done?`,
      sceneDetail: "open gate to glittering trail, chore list on post",
    },
    {
      narrative: `The bridge ahead has collapsed. ${h} stands at the gap while others curse. The map shows a detour that might work.`,
      question: `After this setback, does ${h} believe the journey can still go on?`,
      sceneDetail: "collapsed bridge, gap over water, hopeful detour on map",
    },
    {
      narrative: `In a quiet alcove, ${h} finds a book written in layers — each page a thought inside a thought. The map copies its spiral pattern.`,
      question: `Does ${h} delight in complexity, in ideas that fold inward forever?`,
      sceneDetail: "ancient layered book, spiral patterns, quiet alcove",
    },
    {
      narrative: `The detour climbs slowly. Other pilgrims race ahead while ${h} matches their own pace. The traveler catches up, breathing hard.`,
      question: `On long roads, is ${h} usually less restless and active than those around them?`,
      sceneDetail: "slow climbing path, pilgrims passing, steady walking pace",
    },
    {
      narrative: `At a river crossing, a merchant accuses the ferryman of cheating. Tension crackles. ${h} knows both sides.`,
      question: `When fault is easy to find in others, does ${h} point it out?`,
      sceneDetail: "ferry dispute, angry merchant, tense river crossing",
    },
    {
      narrative: `The ferryman proves honest. ${h} helps tie the boat, knot after careful knot. The map's lines grow straighter.`,
      question: `Can others count on ${h} to be steady and dependable?`,
      sceneDetail: "tying boat knots, calm river, reliable hands",
    },
    {
      narrative: `Night falls mid-crossing. ${h}'s mood shifts with the waves — bright, then heavy, then bright again.`,
      question: `Do ${h}'s feelings rise and fall like tides they can't always control?`,
      sceneDetail: "night ferry, moon on waves, shifting reflections",
    },
    {
      narrative: `On the far bank sits a workshop of odd inventions — gears that dream, clocks that hum poems. ${h} lingers at the door.`,
      question: `Does ${h} invent new ways forward when the old path fails?`,
      sceneDetail: "whimsical workshop, gears and clocks, creative inventions",
    },
    {
      narrative: `The workshop keeper invites ${h} to stay for tea. Conversation would mean sharing the night. Silence would mean moving on alone.`,
      question: `Is ${h} usually the quiet one, keeping words folded inside?`,
      sceneDetail: "tea invitation, quiet doorway, solitary road beyond",
    },
    {
      narrative: `A beggar on the next ridge asks for nothing but an ear. ${h} has little left to give. The map dims slightly.`,
      question: `Does ${h} often feel distant from others' suffering?`,
      sceneDetail: "beggar on ridge, dimming map, distant cold landscape",
    },
    {
      narrative: `${h} organizes the camp anyway — firewood stacked, herbs sorted, tomorrow's route marked. Order feels like kindness.`,
      question: `Does ${h} need things in their place before the heart can rest?`,
      sceneDetail: "organized camp, stacked firewood, marked route map",
    },
    {
      narrative: `Wolves howl. ${h}'s shoulders tighten before the mind catches up. The traveler squeezes their arm.`,
      question: `Does tension live close to the surface inside ${h}?`,
      sceneDetail: "wolves howling, tense shoulders, dark forest edge",
    },
    {
      narrative: `Morning reveals a library of questions — shelves of doors, each labeled with a mystery. ${h} pulls one open.`,
      question: `Is ${h} hungry to learn what lies behind every unknown door?`,
      sceneDetail: "shelves of labeled doors, curiosity, library of mysteries",
    },
    {
      narrative: `Behind the door: a field of fireflies and laughing children. ${h}'s energy surges — or doesn't.`,
      question: `Does ${h} carry a full bright energy that fills open spaces?`,
      sceneDetail: "firefly field, laughing children, vibrant open meadow",
    },
    {
      narrative: `Two companions argue about the map's true north. Words sharpen. ${h} stands between them.`,
      question: `When voices clash, does ${h} add heat to the argument?`,
      sceneDetail: "two figures arguing, hero between them, compass map",
    },
    {
      narrative: `${h} mediates until both agree on a shared bearing. Work resumes — packing, planning, moving as one.`,
      question: `When duty calls, does ${h} show up as a reliable worker?`,
      sceneDetail: "group packing together, shared compass, unified departure",
    },
    {
      narrative: `Clouds return. ${h} feels the old mood swing — sun and shadow in the same hour.`,
      question: `Can ${h}'s moods shift quickly, even on good days?`,
      sceneDetail: "sun and shadow through clouds, emotional sky, walking figure",
    },
    {
      narrative: `At the summit, ${h} designs a new symbol for the map — something no one has drawn before.`,
      question: `Does ingenuity live naturally in ${h}'s hands and mind?`,
      sceneDetail: "summit vista, drawing new symbol, creative breakthrough",
    },
    {
      narrative: `The symbol glows. Other travelers cheer. ${h} feels warmth spread outward.`,
      question: `Does ${h} spark enthusiasm in people simply by being near?`,
      sceneDetail: "glowing symbol, cheering travelers, warm summit light",
    },
    {
      narrative: `An old rival appears — someone ${h} wronged seasons ago. They bow first. Forgiveness hangs unspoken.`,
      question: `Does ${h} forgive easily when the past returns?`,
      sceneDetail: "old rival meeting, bowing figure, path of forgiveness",
    },
    {
      narrative: `Together they descend, but ${h}'s pack spills — papers flutter into the wind. Order dissolves again.`,
      question: `Does disorganization follow ${h} even when they try?`,
      sceneDetail: "spilled pack, papers in wind, descending path",
    },
    {
      narrative: `Near the end, ${h} counts everything that could go wrong. The map almost slips from trembling fingers.`,
      question: `Does worry run often and deep inside ${h}?`,
      sceneDetail: "worried hands, almost slipping map, anxious cliff path",
    },
    {
      narrative: `At last ${h} reaches the heart of ${s} — a mirror pool that shows not a face, but a companion waiting to be born. One final choice completes the map.`,
      question: `Does ${h} trust the original ideas that arrive unbidden — the ones that could change everything?`,
      sceneDetail: "mirror pool finale, companion silhouette forming, completed map glow",
    },
  ];
}
