import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, Container, useResponsive } from '../components/ui';
import MacroDonut from '../components/MacroDonut';
import CoachModal from '../components/CoachModal';
import AlertsModal from '../components/AlertsModal';
import HealthInsights from '../components/HealthInsights';
import DashboardSkeleton from '../components/DashboardSkeleton';
import { getHealthConnectWeeklySummary } from '../services/healthConnect';
import { colors, font, radius, spacing } from '../theme/colors';
import {
  getDailyActivity,
  getUser,
  listFoodEntries,
  listWeightEntries,
  listWorkoutSessions,
  saveDailyActivity,
  listAchievements,
  unlockAchievement,
} from '../services/api';
import {
  groupMealsByType,
  itemTotals,
  macroTargets,
  weightProgress,
} from '../utils/nutricion';
import { trainingStreak, weekStats } from '../utils/workout';
import {
  addDays,
  dayKey,
  endOfDayIso,
  formatDayLong,
  formatDayTitle,
  isToday,
  isSameDay,
  startOfDayIso,
} from '../utils/dates';
import { usePedometer } from '../hooks/usePedometer';

const IS_WEB = Platform.OS === 'web';

function todayNoon() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

export default function DashboardScreen() {
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();

  const [selectedDay, setSelectedDay] = useState(todayNoon);
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [weights, setWeights] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activity, setActivity] = useState({ day: dayKey(new Date()), steps: 0, water: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showCoach, setShowCoach] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [sensorOn, setSensorOn] = useState(false);
  const [healthDays, setHealthDays] = useState([]);
  const [achievements, setAchievements] = useState([]);

  const activityRef = useRef(activity);
  const saveTimer = useRef(null);
  const pendingSave = useRef(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const day = dayKey(selectedDay);
      const [loadedUser, foodRows, weightRows, workoutRows, daily, health, earned] = await Promise.all([
        getUser(),
        listFoodEntries({
          desde: startOfDayIso(selectedDay),
          hasta: endOfDayIso(selectedDay),
        }),
        listWeightEntries(),
        listWorkoutSessions(),
        getDailyActivity(day),
        getHealthConnectWeeklySummary(7).catch(() => ({ days: [] })),
        listAchievements().catch(() => []),
      ]);
      setUser(loadedUser);
      setEntries(foodRows);
      setWeights(weightRows);
      setSessions(workoutRows);
      setHealthDays(health?.days || []);
      setAchievements(earned || []);
      const nextActivity = {
        day,
        steps: Number(daily?.steps) || 0,
        water: Number(daily?.water) || 0,
      };
      activityRef.current = nextActivity;
      setActivity(nextActivity);
    } catch (e) {
      setError(e.message || 'Could not load your dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDay]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  const queueSave = useCallback((next, immediate = false) => {
    pendingSave.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const flush = () => {
      const payload = pendingSave.current;
      pendingSave.current = null;
      if (!payload) return;
      saveDailyActivity({
        day: payload.day,
        steps: payload.steps,
        water: payload.water,
      }).catch((e) => {
        setError(e.message || 'Could not save your activity.');
      });
    };
    if (immediate) flush();
    else saveTimer.current = setTimeout(flush, 500);
  }, []);

  const updateActivity = useCallback(
    (patch, immediate = false) => {
      const next = { ...activityRef.current, ...patch };
      activityRef.current = next;
      setActivity(next);
      queueSave(next, immediate);
    },
    [queueSave],
  );

  const addSensorSteps = useCallback(
    (delta) => {
      const current = activityRef.current;
      updateActivity({
        steps: Math.max(0, (Number(current.steps) || 0) + delta),
      });
    },
    [updateActivity],
  );

  const sensorStatus = usePedometer(sensorOn && isToday(selectedDay), addSensorSteps);

  // Flush a pending activity save when the screen goes away.
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const payload = pendingSave.current;
      if (payload) {
        saveDailyActivity({
          day: payload.day,
          steps: payload.steps,
          water: payload.water,
        }).catch(() => {});
      }
    },
    [],
  );

  const onRefresh = () => {
    setRefreshing(true);
    cargar();
  };

  // ---- Derived data ----
  const objetivo = Number(user?.objetivo_kcal) || 2000;
  const stepGoal = Number(user?.step_goal) || 8000;
  const waterGoal = Number(user?.water_goal) || 8;
  const consumed = entries.reduce((sum, e) => sum + (Number(e.total_kcal) || 0), 0);
  const macros = entries.reduce(
    (acc, entry) => {
      const t = itemTotals(entry.items);
      acc.protein += t.protein;
      acc.carbs += t.carbs;
      acc.fat += t.fat;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0 },
  );
  const targets = macroTargets(objetivo);
  const meals = groupMealsByType(entries);
  const latestWeight = weights.length > 0 ? weights[weights.length - 1] : null;
  const progress = weightProgress({
    start: weights.length > 0 ? weights[0].peso_kg : null,
    current: latestWeight?.peso_kg,
    goal: user?.meta_peso_kg,
    goalType: user?.goal_type,
  });
  const weekly = weekStats(sessions);
  const streak = trainingStreak(sessions);
  const hasWorkoutToday = sessions.some(
    (s) => dayKey(new Date(s.started_at)) === dayKey(selectedDay),
  );

  const remaining = Math.round(objetivo - consumed);
  const percentage = objetivo > 0 ? Math.min(consumed / objetivo, 1) : 0;
  const steps = Number(activity.steps) || 0;
  const water = Number(activity.water) || 0;
  const dailyStreak = (() => {
    let count = 0;
    for (const row of [...healthDays].reverse()) {
      if ((Number(row.steps) || 0) >= stepGoal) count += 1;
      else break;
    }
    return count;
  })();
  useEffect(() => {
    const milestones = [
      { key: 'steps_goal_1', days: 1 },
      { key: 'steps_streak_3', days: 3 },
      { key: 'steps_streak_7', days: 7 },
    ].filter((badge) => dailyStreak >= badge.days && !achievements.some((item) => item.achievement_key === badge.key));
    if (!milestones.length) return;
    Promise.all(milestones.map((badge) => unlockAchievement(badge.key, { streak: dailyStreak })))
      .then((rows) => setAchievements(rows[rows.length - 1] || achievements))
      .catch(() => {});
  }, [dailyStreak, achievements]);
  const when = isToday(selectedDay) ? 'today' : 'that day';

  // ---- Alerts ----
  const alerts = [];
  if (consumed === 0) {
    alerts.push({
      id: 'no-meals',
      tone: 'info',
      icon: 'restaurant-outline',
      title: 'No meals logged',
      message: `Nothing is logged ${when} yet. Add a meal and your macros update instantly.`,
    });
  } else if (consumed > objetivo) {
    alerts.push({
      id: 'kcal-over',
      tone: 'danger',
      icon: 'flame',
      title: 'Over your calorie goal',
      message: `You are ${formatNumber(consumed - objetivo)} kcal above your ${formatNumber(
        objetivo,
      )} kcal goal ${when}.`,
    });
  } else if (remaining <= 250) {
    alerts.push({
      id: 'kcal-near',
      tone: 'warning',
      icon: 'time-outline',
      title: 'Almost at your goal',
      message: `Only ${formatNumber(remaining)} kcal left ${when}. Choose something light if you are hungry.`,
    });
  }

  if (consumed > 0 && macros.protein < targets.protein * 0.6) {
    alerts.push({
      id: 'protein-low',
      tone: 'warning',
      icon: 'barbell-outline',
      title: 'Protein is low',
      message: `You are at ${Math.round(macros.protein)} g of about ${
        targets.protein
      } g ${when}. Eggs, yogurt, chicken or tofu would help.`,
    });
  }

  if (water < waterGoal) {
    alerts.push({
      id: 'water-low',
      tone: 'info',
      icon: 'water-outline',
      title: 'Time for water',
      message: `${water} of ${waterGoal} glasses ${when}. ${
        waterGoal - water
      } more to go.`,
    });
  }

  if (steps < stepGoal) {
    alerts.push({
      id: 'steps-low',
      tone: 'info',
      icon: 'footsteps-outline',
      title: 'Steps left',
      message: `${formatNumber(stepGoal - steps)} steps to reach your ${formatNumber(
        stepGoal,
      )} step goal.`,
    });
  }

  if (!hasWorkoutToday) {
    alerts.push({
      id: 'no-workout',
      tone: 'info',
      icon: 'barbell-outline',
      title: 'No workout yet',
      message: `A short session still counts. Your plan for ${when} is ready in Train.`,
    });
  }

  if (streak >= 2) {
    alerts.push({
      id: 'streak',
      tone: 'streak',
      icon: 'flame',
      title: `${streak}-day training streak`,
      message: 'Keep it alive with at least a short session today.',
    });
  }

  if (progress?.reached) {
    alerts.push({
      id: 'goal-reached',
      tone: 'success',
      icon: 'trophy-outline',
      title: 'Weight goal reached',
      message: `You are at ${progress.current} kg against a goal of ${progress.goal} kg. Well done!`,
    });
  }

  if (weights.length === 0) {
    alerts.push({
      id: 'no-weight',
      tone: 'info',
      icon: 'scale-outline',
      title: 'No weigh-ins yet',
      message: 'Log your first weight to unlock trend and goal progress.',
    });
  }

  const alertCount = alerts.filter((a) => a.tone !== 'success').length;

  const coachContext = {
    date: formatDayLong(selectedDay),
    calorieGoalKcal: objetivo,
    caloriesConsumed: Math.round(consumed),
    caloriesLeftKcal: Math.max(0, remaining),
    proteinGrams: Math.round(macros.protein),
    carbsGrams: Math.round(macros.carbs),
    fatGrams: Math.round(macros.fat),
    proteinTargetGrams: targets.protein,
    mealsLogged: entries.length,
    waterGlasses: water,
    waterGoalGlasses: waterGoal,
    steps,
    estimatedStepCaloriesBurned: Math.round(steps * 0.04),
    estimatedWorkoutCaloriesBurned: Math.round((sessions.filter((s) => isSameDay(s.started_at, selectedDay)).reduce((sum, s) => sum + (Number(s.duration_min) || 0), 0) * (Number(latestWeight?.peso_kg) || 70) * 5) / 60),
    stepGoal,
    goalType: user?.goal_type ?? 'maintain',
    currentWeightKg: latestWeight?.peso_kg ?? 'unknown',
    goalWeightKg: user?.meta_peso_kg ?? 'not set',
    workoutsThisWeek: weekly.count,
    trainingStreakDays: streak,
    healthConnectLast7Days: healthDays,
    request: 'Create a personalized 20-minute equipment-free home workout and a vegetarian meal plan for today. Use the 7-day Health Connect trends and profile goals; include practical exercises with timings and meals with estimated calories/protein. Label estimates and avoid medical claims.',
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const goNextDay = () => {
    if (isToday(selectedDay)) return;
    setSelectedDay((d) => addDays(d, 1));
  };

  const sensorHint =
    sensorOn && sensorStatus === 'denied'
      ? 'Motion access was denied. Enable it in your phone settings or use the quick buttons.'
      : sensorOn && sensorStatus === 'unsupported'
        ? 'This device does not expose a step sensor. Use the quick buttons instead.'
        : sensorOn && sensorStatus === 'error'
          ? 'Could not start the step sensor. Use the quick buttons instead.'
          : null;

  const canUseSensor = !IS_WEB && isToday(selectedDay);
  const stepCaloriesBurned = Math.round(steps * 0.04);
  const workoutMinutesToday = sessions.filter((s) => isSameDay(s.started_at, selectedDay)).reduce((sum, s) => sum + (Number(s.duration_min) || 0), 0);
  const workoutCaloriesBurned = Math.round(workoutMinutesToday * 5 * (Number(latestWeight?.peso_kg) || 70) / 60);

  const header = (
    <>
      <View style={styles.topRow}>
        <View style={styles.topInfo}>
          <Text style={styles.title}>{formatDayTitle(selectedDay)}</Text>
          <Text style={styles.date}>{formatDayLong(selectedDay)}</Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowCoach(true)}
            accessibilityLabel="Open AI coach"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowAlerts(true)}
            accessibilityLabel="Open alerts"
          >
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            {alertCount > 0 ? (
              <View style={styles.alertDot}>
                <Text style={styles.alertDotText}>{alertCount > 9 ? '9+' : alertCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dateNav}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => setSelectedDay((d) => addDays(d, -1))}
          hitSlop={6}
          accessibilityLabel="Previous day"
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navToday, isToday(selectedDay) && styles.navTodayDisabled]}
          onPress={() => setSelectedDay(todayNoon())}
          disabled={isToday(selectedDay)}
        >
          <Ionicons name="calendar-outline" size={14} color={colors.primaryDark} />
          <Text style={styles.navTodayText}>
            {isToday(selectedDay) ? 'Today' : 'Jump to today'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navBtn, isToday(selectedDay) && { opacity: 0.35 }]}
          onPress={goNextDay}
          disabled={isToday(selectedDay)}
          hitSlop={6}
          accessibilityLabel="Next day"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </>
  );

  const heroCard = (
    <LinearGradient
      colors={colors.primaryGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <Text style={styles.heroLabel}>
        {isToday(selectedDay) ? 'Calories today' : 'Calories'}
      </Text>
      <View style={styles.heroRow}>
        <Text style={styles.heroConsumidas}>{Math.round(consumed)}</Text>
        <Text style={styles.heroUnidad}>kcal</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${percentage * 100}%` }]} />
      </View>
      <View style={styles.barFooter}>
        <Text style={styles.meta}>Goal</Text>
        <Text style={styles.metaValor}>{formatNumber(objetivo)} kcal</Text>
      </View>
      <Text style={styles.faltan}>
        {remaining >= 0
          ? `${formatNumber(remaining)} kcal left`
          : `${formatNumber(Math.abs(remaining))} kcal over your goal`}
      </Text>
    </LinearGradient>
  );

  const macroCard = (
    <Card>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Macros</Text>
        <Badge tone="muted">{Math.round(consumed)} kcal</Badge>
      </View>
      <MacroDonut macros={macros} kcal={consumed} />
      <Text style={styles.targetText}>
        Target · Protein {targets.protein} g · Carbs {targets.carbs} g · Fat {targets.fat} g
      </Text>
    </Card>
  );

  const mealsCard = (
    <Card>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>
          {isToday(selectedDay) ? "Today's meals" : 'Meals'}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Food')} hitSlop={6}>
          <Text style={styles.link}>Add meal</Text>
        </TouchableOpacity>
      </View>
      {entries.length === 0 ? (
        <Text style={styles.mutedText}>
          No meals logged {when}. Describe what you ate and the AI will estimate the macros.
        </Text>
      ) : (
        meals.map((meal) => (
          <View key={meal.value} style={styles.mealRow}>
            <View style={styles.mealIcon}>
              <Ionicons name={meal.icon} size={18} color={colors.primary} />
            </View>
            <View style={styles.mealInfo}>
              <View style={styles.mealTopRow}>
                <Text style={styles.mealName}>{meal.label}</Text>
                <Text style={styles.mealKcal}>
                  {meal.entries.length > 0 ? `${formatNumber(meal.kcal)} kcal` : '—'}
                </Text>
              </View>
              <Text style={styles.mealItems} numberOfLines={2}>
                {meal.entries.length > 0
                  ? meal.entries.map((e) => e.texto_original).join(' · ')
                  : 'Nothing logged'}
              </Text>
            </View>
          </View>
        ))
      )}
    </Card>
  );

  const activityCard = (
    <Card>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Activity</Text>
        {canUseSensor ? (
          <TouchableOpacity
            onPress={() => setSensorOn((v) => !v)}
            style={[styles.sensorBtn, sensorOn && styles.sensorBtnOn]}
          >
            <Ionicons
              name={sensorOn ? 'pulse' : 'footsteps-outline'}
              size={13}
              color={sensorOn ? colors.white : colors.primary}
            />
            <Text style={[styles.sensorText, sensorOn && styles.sensorTextOn]}>
              {sensorOn ? 'Tracking' : 'Auto-track'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.activityRow}>
        <View style={[styles.activityIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="footsteps-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.activityInfo}>
          <View style={styles.mealTopRow}>
            <Text style={styles.activityLabel}>Steps</Text>
            <Text style={styles.activityValue}>
              {formatNumber(steps)}{' '}
              <Text style={styles.activityGoal}>/ {formatNumber(stepGoal)}</Text>
            </Text>
          </View>
          <View style={styles.miniBar}>
            <View
              style={[
                styles.miniFill,
                { width: `${Math.min(1, steps / stepGoal) * 100}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
        </View>
      </View>
      <View style={styles.quickRow}>
        {[500, 1000, 2500].map((amount) => (
          <TouchableOpacity
            key={amount}
            style={styles.quickChip}
            onPress={() => updateActivity({ steps: steps + amount })}
          >
            <Text style={styles.quickChipText}>+{formatNumber(amount)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {sensorHint ? <Text style={styles.sensorHint}>{sensorHint}</Text> : null}

      <View style={styles.burnedRow}>
        <Ionicons name="flame-outline" size={18} color={colors.warning} />
        <Text style={styles.burnedText}>Estimated burn</Text>
        <Text style={styles.burnedValue}>{formatNumber(stepCaloriesBurned + workoutCaloriesBurned)} kcal</Text>
      </View>
      <Text style={styles.burnedHint}>Steps: {formatNumber(stepCaloriesBurned)} kcal · Exercise: {formatNumber(workoutCaloriesBurned)} kcal (estimate)</Text>

      <View style={styles.divider} />

      <View style={styles.activityRow}>
        <View style={[styles.activityIcon, { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name="water-outline" size={20} color="#2563EB" />
        </View>
        <View style={styles.activityInfo}>
          <View style={styles.mealTopRow}>
            <Text style={styles.activityLabel}>Water</Text>
            <Text style={styles.activityValue}>
              {water} <Text style={styles.activityGoal}>/ {waterGoal} glasses</Text>
            </Text>
          </View>
          <View style={styles.glassesRow}>
            {Array.from({ length: Math.min(waterGoal, 12) }).map((_, index) => (
              <View
                key={index}
                style={[styles.glass, index < water && styles.glassFull]}
              />
            ))}
            {waterGoal > 12 ? (
              <Text style={styles.moreGlasses}>+{waterGoal - 12}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.waterBtns}>
          <TouchableOpacity
            style={styles.waterBtn}
            onPress={() => updateActivity({ water: Math.max(0, water - 1) }, true)}
            accessibilityLabel="Remove a glass of water"
          >
            <Ionicons name="remove" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.waterBtn, styles.waterBtnAdd]}
            onPress={() => updateActivity({ water: water + 1 }, true)}
            accessibilityLabel="Add a glass of water"
          >
            <Ionicons name="add" size={16} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  const weightCard = (
    <Card>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Weight</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Weight')} hitSlop={6}>
          <Text style={styles.link}>Details</Text>
        </TouchableOpacity>
      </View>
      {latestWeight ? (
        <>
          <View style={styles.weightRow}>
            <View style={styles.weightBlock}>
              <Text style={styles.weightValue}>
                {latestWeight.peso_kg}
                <Text style={styles.weightUnit}> kg</Text>
              </Text>
              <Text style={styles.weightLabel}>Current</Text>
            </View>
            <View style={styles.weightBlock}>
              <Text style={styles.weightValueMuted}>
                {progress ? progress.start : '—'}
                <Text style={styles.weightUnit}> kg</Text>
              </Text>
              <Text style={styles.weightLabel}>Start</Text>
            </View>
            <View style={styles.weightBlock}>
              <Text style={styles.weightValueMuted}>
                {progress ? progress.goal : '—'}
                <Text style={styles.weightUnit}> kg</Text>
              </Text>
              <Text style={styles.weightLabel}>Goal</Text>
            </View>
          </View>
          {progress ? (
            <>
              <View style={styles.miniBar}>
                <View
                  style={[
                    styles.miniFill,
                    { width: `${progress.pct * 100}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
              <Text style={styles.weightHint}>
                {progress.reached
                  ? 'Goal reached — keep it steady!'
                  : `${progress.toGo} kg to go · ${Math.round(progress.pct * 100)}% of the way`}
              </Text>
            </>
          ) : (
            <Text style={styles.mutedText}>
              Add a weight goal in Profile to see your transformation progress.
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.mutedText}>
          No weigh-ins yet. Log your first weight in the Weight tab.
        </Text>
      )}
    </Card>
  );

  const trainingCard = (
    <Card>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Training this week</Text>
        {streak > 0 ? (
          <Badge tone="warning">{streak}-day streak</Badge>
        ) : (
          <View style={styles.iconCircleSmall}>
            <Ionicons name="barbell-outline" size={16} color={colors.primary} />
          </View>
        )}
      </View>
      {weekly.count === 0 ? (
        <Text style={styles.mutedText}>
          No sessions yet. A short workout still counts — start one from here.
        </Text>
      ) : (
        <View style={styles.trainingRow}>
          <View style={styles.trainingBlock}>
            <Text style={styles.trainingValue}>{weekly.count}</Text>
            <Text style={styles.trainingLabel}>
              {weekly.count === 1 ? 'session' : 'sessions'}
            </Text>
          </View>
          <View style={styles.trainingBlock}>
            <Text style={styles.trainingValue}>
              {formatNumber(weekly.volume)}
            </Text>
            <Text style={styles.trainingLabel}>kg volume</Text>
          </View>
          <View style={styles.trainingBlock}>
            <Text style={styles.trainingValue}>{weekly.minutes}</Text>
            <Text style={styles.trainingLabel}>minutes</Text>
          </View>
        </View>
      )}
      <TouchableOpacity style={styles.trainingBtn} onPress={() => navigation.navigate('Train')}>
        <Ionicons name="add-circle-outline" size={18} color={colors.white} />
        <Text style={styles.trainingBtnText}>
          {weekly.count === 0 ? 'Start your first workout' : "Open this week's plan"}
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const errorCard = error ? (
    <Card style={styles.errorCard}>
      <Text style={styles.errorText}>{error}</Text>
    </Card>
  ) : null;

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Container>
          {header}
          {heroCard}

          {isDesktop ? (
            <>
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  {macroCard}
                  <View style={{ height: spacing.md }} />
                  {mealsCard}
                </View>
                <View style={styles.col}>
                  {activityCard}
                  <View style={{ height: spacing.md }} />
                  {weightCard}
                  <View style={{ height: spacing.md }} />
                  {trainingCard}
                  <HealthInsights days={healthDays} stepsGoal={stepGoal} caloriesGoal={300} water={water} waterGoal={waterGoal} streak={dailyStreak} achievements={achievements} />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={{ height: spacing.md }} />
              {macroCard}
              <View style={{ height: spacing.md }} />
              {mealsCard}
              <View style={{ height: spacing.md }} />
              {activityCard}
              <View style={{ height: spacing.md }} />
              {weightCard}
              <View style={{ height: spacing.md }} />
              {trainingCard}
              <HealthInsights days={healthDays} stepsGoal={stepGoal} caloriesGoal={300} water={water} waterGoal={waterGoal} streak={dailyStreak} achievements={achievements} />
            </>
          )}

          {errorCard}
          <View style={{ height: spacing.lg }} />
        </Container>
      </ScrollView>

      <CoachModal
        visible={showCoach}
        onClose={() => setShowCoach(false)}
        context={coachContext}
        onOpenProfile={() => navigation.navigate('Profile')}
      />
      <AlertsModal
        visible={showAlerts}
        onClose={() => setShowAlerts(false)}
        alerts={alerts}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  topInfo: { flex: 1 },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  date: {
    fontSize: font.base,
    color: colors.textMuted,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  topActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  alertDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  alertDotText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  navToday: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  navTodayDisabled: { opacity: 0.7 },
  navTodayText: {
    fontSize: font.sm,
    fontWeight: font.weight.semibold,
    color: colors.primaryDark,
  },

  // Hero
  hero: { borderRadius: radius.lg, padding: spacing.lg },
  heroLabel: {
    fontSize: font.base,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: font.weight.medium,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroConsumidas: { fontSize: 56, fontWeight: '800', color: colors.white, lineHeight: 60 },
  heroUnidad: {
    fontSize: font.lg,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: font.weight.medium,
  },
  bar: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barFill: { height: 12, borderRadius: radius.pill, backgroundColor: colors.white },
  meta: { fontSize: font.xs, color: 'rgba(255,255,255,0.75)' },
  metaValor: {
    fontSize: font.sm,
    fontWeight: font.weight.semibold,
    color: colors.white,
  },
  barFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  faltan: {
    fontSize: font.base,
    color: 'rgba(255,255,255,0.9)',
    marginTop: spacing.md,
    fontWeight: font.weight.semibold,
  },

  // Cards
  cardTitle: {
    fontSize: font.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  link: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.primary,
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  targetText: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  mutedText: { fontSize: font.base, color: colors.textMuted, lineHeight: 20 },

  // Meals
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mealIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealInfo: { flex: 1 },
  mealTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  mealName: { fontSize: font.base, fontWeight: '700', color: colors.text },
  mealKcal: { fontSize: font.sm, fontWeight: '700', color: colors.primaryDark },
  mealItems: { fontSize: font.sm, color: colors.textMuted, marginTop: 2, lineHeight: 17 },

  // Activity
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  burnedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  burnedText: { flex: 1, fontSize: font.sm, color: colors.textMuted },
  burnedValue: { fontSize: font.md, fontWeight: '800', color: colors.text },
  burnedHint: { fontSize: font.xs, color: colors.textMuted, marginTop: spacing.xs },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: font.base, fontWeight: '700', color: colors.text },
  activityValue: { fontSize: font.base, fontWeight: '800', color: colors.text },
  activityGoal: { fontSize: font.sm, color: colors.textMuted, fontWeight: font.weight.medium },
  miniBar: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  miniFill: { height: 8, borderRadius: radius.pill },
  quickRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  quickChipText: { fontSize: font.xs, fontWeight: '700', color: colors.text },
  sensorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  sensorBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  sensorText: { fontSize: font.xs, fontWeight: '700', color: colors.primary },
  sensorTextOn: { color: colors.white },
  sensorHint: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  glassesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs + 2,
    flexWrap: 'wrap',
  },
  glass: {
    width: 12,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: colors.surface,
  },
  glassFull: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  moreGlasses: { fontSize: font.xs, color: colors.textMuted, marginLeft: 2 },
  waterBtns: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  waterBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  waterBtnAdd: { backgroundColor: colors.primary },

  // Weight
  weightRow: { flexDirection: 'row', alignItems: 'center' },
  weightBlock: { flex: 1, alignItems: 'center' },
  weightValue: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  weightValueMuted: { fontSize: font.lg, fontWeight: '700', color: colors.textMuted },
  weightUnit: { fontSize: font.sm, color: colors.textMuted, fontWeight: font.weight.medium },
  weightLabel: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  weightHint: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Training
  iconCircleSmall: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainingRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  trainingBlock: { flex: 1 },
  trainingValue: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  trainingLabel: { fontSize: font.sm, color: colors.textMuted, marginTop: 1 },
  trainingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  trainingBtnText: { color: colors.white, fontSize: font.base, fontWeight: '700' },

  // Misc
  errorCard: {
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
    marginTop: spacing.md,
  },
  errorText: { color: colors.danger },
  twoCol: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  col: { flex: 1 },
});
