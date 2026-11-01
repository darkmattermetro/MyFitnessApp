// Static exercise catalog. Used by the workout builder for quick add and by
// the template shortcuts. No database table needed: it ships with the app.

export const MUSCLES = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
];

export const MUSCLE_LABEL = MUSCLES.reduce((acc, m) => {
  acc[m.value] = m.label;
  return acc;
}, {});

export const EXERCISES = [
  // Chest
  { name: 'Bench Press', muscle: 'chest', equipment: 'Barbell' },
  { name: 'Incline Bench Press', muscle: 'chest', equipment: 'Barbell' },
  { name: 'Dumbbell Bench Press', muscle: 'chest', equipment: 'Dumbbell' },
  { name: 'Incline Dumbbell Press', muscle: 'chest', equipment: 'Dumbbell' },
  { name: 'Chest Fly', muscle: 'chest', equipment: 'Cable' },
  { name: 'Cable Crossover', muscle: 'chest', equipment: 'Cable' },
  { name: 'Push-Up', muscle: 'chest', equipment: 'Bodyweight' },
  { name: 'Dip', muscle: 'chest', equipment: 'Bodyweight' },

  // Back
  { name: 'Deadlift', muscle: 'back', equipment: 'Barbell' },
  { name: 'Barbell Row', muscle: 'back', equipment: 'Barbell' },
  { name: 'Pendlay Row', muscle: 'back', equipment: 'Barbell' },
  { name: 'Lat Pulldown', muscle: 'back', equipment: 'Cable' },
  { name: 'Seated Cable Row', muscle: 'back', equipment: 'Cable' },
  { name: 'Pull-Up', muscle: 'back', equipment: 'Bodyweight' },
  { name: 'Chin-Up', muscle: 'back', equipment: 'Bodyweight' },
  { name: 'Single-Arm Dumbbell Row', muscle: 'back', equipment: 'Dumbbell' },
  { name: 'T-Bar Row', muscle: 'back', equipment: 'Machine' },
  { name: 'Face Pull', muscle: 'back', equipment: 'Cable' },
  { name: 'Straight-Arm Pulldown', muscle: 'back', equipment: 'Cable' },
  { name: 'Superman', muscle: 'back', equipment: 'Bodyweight' },
  { name: 'Towel Row', muscle: 'back', equipment: 'Bodyweight' },

  // Shoulders
  { name: 'Overhead Press', muscle: 'shoulders', equipment: 'Barbell' },
  { name: 'Seated Dumbbell Press', muscle: 'shoulders', equipment: 'Dumbbell' },
  { name: 'Arnold Press', muscle: 'shoulders', equipment: 'Dumbbell' },
  { name: 'Lateral Raise', muscle: 'shoulders', equipment: 'Dumbbell' },
  { name: 'Front Raise', muscle: 'shoulders', equipment: 'Dumbbell' },
  { name: 'Rear Delt Fly', muscle: 'shoulders', equipment: 'Dumbbell' },
  { name: 'Upright Row', muscle: 'shoulders', equipment: 'Barbell' },
  { name: 'Shrug', muscle: 'shoulders', equipment: 'Dumbbell' },
  { name: 'Pike Push-Up', muscle: 'shoulders', equipment: 'Bodyweight' },
  { name: 'Reverse Snow Angel', muscle: 'shoulders', equipment: 'Bodyweight' },

  // Arms
  { name: 'Barbell Curl', muscle: 'arms', equipment: 'Barbell' },
  { name: 'Dumbbell Curl', muscle: 'arms', equipment: 'Dumbbell' },
  { name: 'Hammer Curl', muscle: 'arms', equipment: 'Dumbbell' },
  { name: 'Preacher Curl', muscle: 'arms', equipment: 'Machine' },
  { name: 'Cable Curl', muscle: 'arms', equipment: 'Cable' },
  { name: 'Triceps Pushdown', muscle: 'arms', equipment: 'Cable' },
  { name: 'Overhead Triceps Extension', muscle: 'arms', equipment: 'Dumbbell' },
  { name: 'Skull Crusher', muscle: 'arms', equipment: 'Barbell' },
  { name: 'Close-Grip Bench Press', muscle: 'arms', equipment: 'Barbell' },
  { name: 'Wrist Curl', muscle: 'arms', equipment: 'Dumbbell' },
  { name: 'Chair Dip', muscle: 'arms', equipment: 'Bodyweight' },
  { name: 'Towel Curl', muscle: 'arms', equipment: 'Bodyweight' },

  // Legs
  { name: 'Back Squat', muscle: 'legs', equipment: 'Barbell' },
  { name: 'Front Squat', muscle: 'legs', equipment: 'Barbell' },
  { name: 'Goblet Squat', muscle: 'legs', equipment: 'Dumbbell' },
  { name: 'Romanian Deadlift', muscle: 'legs', equipment: 'Barbell' },
  { name: 'Leg Press', muscle: 'legs', equipment: 'Machine' },
  { name: 'Leg Extension', muscle: 'legs', equipment: 'Machine' },
  { name: 'Leg Curl', muscle: 'legs', equipment: 'Machine' },
  { name: 'Bulgarian Split Squat', muscle: 'legs', equipment: 'Dumbbell' },
  { name: 'Walking Lunge', muscle: 'legs', equipment: 'Dumbbell' },
  { name: 'Hip Thrust', muscle: 'legs', equipment: 'Barbell' },
  { name: 'Standing Calf Raise', muscle: 'legs', equipment: 'Machine' },
  { name: 'Seated Calf Raise', muscle: 'legs', equipment: 'Machine' },
  { name: 'Bodyweight Squat', muscle: 'legs', equipment: 'Bodyweight' },
  { name: 'Glute Bridge', muscle: 'legs', equipment: 'Bodyweight' },
  { name: 'Wall Sit', muscle: 'legs', equipment: 'Bodyweight' },

  // Core
  { name: 'Plank', muscle: 'core', equipment: 'Bodyweight' },
  { name: 'Side Plank', muscle: 'core', equipment: 'Bodyweight' },
  { name: 'Crunch', muscle: 'core', equipment: 'Bodyweight' },
  { name: 'Hanging Leg Raise', muscle: 'core', equipment: 'Bodyweight' },
  { name: 'Cable Crunch', muscle: 'core', equipment: 'Cable' },
  { name: 'Russian Twist', muscle: 'core', equipment: 'Bodyweight' },
  { name: 'Ab Wheel Rollout', muscle: 'core', equipment: 'Bodyweight' },
  { name: 'Back Extension', muscle: 'core', equipment: 'Bodyweight' },
  { name: 'Mountain Climber', muscle: 'core', equipment: 'Bodyweight' },
  { name: 'Bicycle Crunch', muscle: 'core', equipment: 'Bodyweight' },

  // Cardio
  { name: 'Treadmill Run', muscle: 'cardio', equipment: 'Machine' },
  { name: 'Outdoor Run', muscle: 'cardio', equipment: 'Bodyweight' },
  { name: 'Cycling', muscle: 'cardio', equipment: 'Machine' },
  { name: 'Rowing Machine', muscle: 'cardio', equipment: 'Machine' },
  { name: 'Jump Rope', muscle: 'cardio', equipment: 'Bodyweight' },
  { name: 'Stair Climber', muscle: 'cardio', equipment: 'Machine' },
  { name: 'Elliptical', muscle: 'cardio', equipment: 'Machine' },
  { name: 'Brisk Walk', muscle: 'cardio', equipment: 'Bodyweight' },
  { name: 'Jumping Jack', muscle: 'cardio', equipment: 'Bodyweight' },
  { name: 'High Knees', muscle: 'cardio', equipment: 'Bodyweight' },
];

export const TEMPLATES = [
  {
    id: 'push',
    name: 'Push Day',
    icon: 'arrow-up-circle-outline',
    exercises: [
      'Bench Press',
      'Incline Dumbbell Press',
      'Overhead Press',
      'Lateral Raise',
      'Triceps Pushdown',
    ],
  },
  {
    id: 'pull',
    name: 'Pull Day',
    icon: 'arrow-down-circle-outline',
    exercises: [
      'Deadlift',
      'Lat Pulldown',
      'Barbell Row',
      'Face Pull',
      'Barbell Curl',
    ],
  },
  {
    id: 'legs',
    name: 'Leg Day',
    icon: 'walk-outline',
    exercises: [
      'Back Squat',
      'Romanian Deadlift',
      'Leg Press',
      'Leg Curl',
      'Standing Calf Raise',
    ],
  },
  {
    id: 'upper',
    name: 'Upper Body',
    icon: 'body-outline',
    exercises: [
      'Bench Press',
      'Barbell Row',
      'Seated Dumbbell Press',
      'Lat Pulldown',
      'Dumbbell Curl',
    ],
  },
  {
    id: 'full',
    name: 'Full Body',
    icon: 'fitness-outline',
    exercises: [
      'Back Squat',
      'Bench Press',
      'Barbell Row',
      'Overhead Press',
      'Plank',
    ],
  },
  {
    id: 'home',
    name: 'Home / No Equipment',
    icon: 'home-outline',
    exercises: ['Push-Up', 'Bodyweight Squat', 'Walking Lunge', 'Plank', 'Jump Rope'],
  },
];

export function findExercise(name) {
  const target = String(name || '').trim().toLowerCase();
  if (!target) return null;
  return EXERCISES.find((e) => e.name.toLowerCase() === target) ?? null;
}

// ---- Weekday plan (Home / Gym) ----
// Short form cues shown under each planned exercise.
const TIPS = {
  'Bench Press': 'Feet planted, shoulder blades back. Lower the bar to mid-chest and press up.',
  'Incline Dumbbell Press': 'Bench at 30°, elbows slightly tucked. Press up and together.',
  'Overhead Press': 'Brace your core, keep the bar over mid-foot, do not arch your lower back.',
  'Lateral Raise': 'Small lean forward, lead with the elbows, stop at shoulder height.',
  'Triceps Pushdown': 'Elbows pinned to your sides. Move only the forearms.',
  'Push-Up': 'Body in one line. Hands under the chest, elbows about 45°.',
  'Chair Dip': 'Keep your hips close to the chair and shoulders down.',
  'Pike Push-Up': 'Hips high, head travels toward the floor between your hands.',
  Deadlift: 'Bar over mid-foot, flat back, push the floor away.',
  'Lat Pulldown': 'Chest up, pull to the collarbone, control the way up.',
  'Barbell Row': 'Hinge to about 45°, pull to the belly button, no bouncing.',
  'Face Pull': 'Pull toward your eyebrows and squeeze the rear shoulders.',
  'Barbell Curl': 'Elbows stay still. Lower slowly and fully.',
  'Towel Row': 'Anchor a towel, sit back with a flat back and pull your elbows past your ribs.',
  Superman: 'Lift chest and legs together, keep the neck neutral.',
  'Reverse Snow Angel': 'Lie face down, sweep straight arms from hips to overhead.',
  'Towel Curl': 'Stand on the towel, curl the ends up and resist the way down.',
  'Back Squat': 'Knees track over the toes, hips back, chest proud.',
  'Romanian Deadlift': 'Soft knees, push hips back, keep the bar close to your legs.',
  'Leg Press': 'Do not let your lower back round at the bottom.',
  'Leg Curl': 'Squeeze the hamstrings and lower under control.',
  'Standing Calf Raise': 'Full stretch at the bottom, pause at the top.',
  'Bodyweight Squat': 'Sit back and down, knees over toes, heels down.',
  'Walking Lunge': 'Step long enough that both knees bend to about 90°.',
  'Glute Bridge': 'Push through your heels and squeeze your glutes at the top.',
  'Wall Sit': 'Thighs parallel to the floor, back flat against the wall.',
  Plank: 'Squeeze glutes and abs. Hips level, do not hold your breath.',
  'Side Plank': 'Stack the shoulders and hips, lift the bottom hip.',
  'Bicycle Crunch': 'Slow and controlled. Rotate from the ribs, not the elbows.',
  'Mountain Climber': 'Keep the hips low and drive the knees quickly.',
  'Hanging Leg Raise': 'No swinging. Curl the pelvis as your legs come up.',
  'Cable Crunch': 'Crunch your ribs toward your hips, hips stay still.',
  'Russian Twist': 'Rotate your whole ribcage, keep the chest tall.',
  'Jump Rope': 'Small hops, stay on the balls of your feet, relaxed shoulders.',
  'Jumping Jack': 'Land softly and keep a steady rhythm.',
  'High Knees': 'Drive the knees to hip height, stay light on your feet.',
  'Treadmill Run': 'Easy conversational pace. Increase the incline if you want more work.',
  Elliptical: 'Keep your posture tall and push through the whole foot.',
  'Rowing Machine': 'Legs, then back, then arms. Reverse on the way forward.',
  'Brisk Walk': 'A pace where talking is possible but not effortless.',
};

function planItem(name, sets, reps) {
  return { name, sets, reps, tip: TIPS[name] ?? '' };
}

// Index 0 is Sunday, matching Date#getDay().
export const WEEK_PLAN = [
  {
    title: 'Recovery & mobility',
    focus: 'Move easy, stretch and reset',
    note: 'Keep today light. A walk and a little mobility work count as training.',
    home: [
      planItem('Brisk Walk', 1, '20-30 min'),
      planItem('Plank', 2, '30-45 s'),
      planItem('Side Plank', 2, '20-30 s per side'),
      planItem('Glute Bridge', 2, '15'),
    ],
    gym: [
      planItem('Elliptical', 1, '20 min'),
      planItem('Treadmill Run', 1, '15 min'),
      planItem('Cable Crunch', 2, '12-15'),
      planItem('Back Extension', 2, '12-15'),
    ],
  },
  {
    title: 'Push day',
    focus: 'Chest, shoulders and triceps',
    note: 'Leave 1-2 reps in reserve on the last set of each lift.',
    home: [
      planItem('Push-Up', 4, '8-15'),
      planItem('Chair Dip', 3, '8-12'),
      planItem('Pike Push-Up', 3, '8-12'),
      planItem('Plank', 3, '30-45 s'),
    ],
    gym: [
      planItem('Bench Press', 4, '6-10'),
      planItem('Incline Dumbbell Press', 3, '8-12'),
      planItem('Overhead Press', 3, '6-10'),
      planItem('Lateral Raise', 3, '12-15'),
      planItem('Triceps Pushdown', 3, '10-15'),
    ],
  },
  {
    title: 'Pull day',
    focus: 'Back and biceps',
    note: 'Start with the heaviest pull while you are fresh, then finish with control work.',
    home: [
      planItem('Towel Row', 4, '10-15'),
      planItem('Superman', 3, '12-15'),
      planItem('Reverse Snow Angel', 3, '12-15'),
      planItem('Towel Curl', 3, '10-15'),
    ],
    gym: [
      planItem('Deadlift', 3, '5-8'),
      planItem('Lat Pulldown', 4, '8-12'),
      planItem('Barbell Row', 4, '6-10'),
      planItem('Face Pull', 3, '12-15'),
      planItem('Barbell Curl', 3, '8-12'),
    ],
  },
  {
    title: 'Leg day',
    focus: 'Quads, glutes and hamstrings',
    note: 'Warm up with 5 minutes of easy movement and a couple of ramp-up sets.',
    home: [
      planItem('Bodyweight Squat', 4, '15-20'),
      planItem('Walking Lunge', 3, '12 per leg'),
      planItem('Glute Bridge', 3, '15-20'),
      planItem('Wall Sit', 3, '30-45 s'),
      planItem('Standing Calf Raise', 3, '15-20'),
    ],
    gym: [
      planItem('Back Squat', 4, '6-10'),
      planItem('Romanian Deadlift', 3, '8-12'),
      planItem('Leg Press', 3, '10-15'),
      planItem('Leg Curl', 3, '10-15'),
      planItem('Standing Calf Raise', 4, '12-15'),
    ],
  },
  {
    title: 'Core & cardio',
    focus: 'Conditioning and abs',
    note: 'Keep the rest short and the effort steady rather than all-out.',
    home: [
      planItem('Jumping Jack', 3, '45 s'),
      planItem('Mountain Climber', 3, '30 s'),
      planItem('Bicycle Crunch', 3, '20'),
      planItem('Plank', 3, '45 s'),
      planItem('High Knees', 3, '30 s'),
    ],
    gym: [
      planItem('Rowing Machine', 1, '20 min'),
      planItem('Treadmill Run', 1, '20 min'),
      planItem('Hanging Leg Raise', 3, '10-12'),
      planItem('Cable Crunch', 3, '12-15'),
      planItem('Russian Twist', 3, '20'),
    ],
  },
  {
    title: 'Upper body',
    focus: 'Balanced upper-body strength',
    note: 'Alternate pressing and pulling sets to save time and keep quality high.',
    home: [
      planItem('Push-Up', 4, '10-15'),
      planItem('Towel Row', 4, '10-15'),
      planItem('Pike Push-Up', 3, '8-12'),
      planItem('Chair Dip', 3, '10-12'),
    ],
    gym: [
      planItem('Bench Press', 4, '6-10'),
      planItem('Barbell Row', 4, '6-10'),
      planItem('Seated Dumbbell Press', 3, '8-12'),
      planItem('Lat Pulldown', 3, '10-12'),
      planItem('Dumbbell Curl', 3, '10-12'),
      planItem('Skull Crusher', 3, '10-12'),
    ],
  },
  {
    title: 'Full body',
    focus: 'One strong session for everything',
    note: 'Pick a weight you can control. Smooth reps beat grinding reps.',
    home: [
      planItem('Bodyweight Squat', 3, '15-20'),
      planItem('Push-Up', 3, '10-15'),
      planItem('Walking Lunge', 3, '12 per leg'),
      planItem('Plank', 3, '40 s'),
      planItem('Jump Rope', 3, '60 s'),
    ],
    gym: [
      planItem('Back Squat', 4, '6-10'),
      planItem('Bench Press', 4, '6-10'),
      planItem('Barbell Row', 3, '8-12'),
      planItem('Overhead Press', 3, '8-12'),
      planItem('Plank', 3, '45 s'),
    ],
  },
];

export function planForDate(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return WEEK_PLAN[new Date().getDay()];
  return WEEK_PLAN[d.getDay()];
}
