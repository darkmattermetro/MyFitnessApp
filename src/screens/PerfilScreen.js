import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  ScrollView,
  View,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  Button,
  Card,
  ChipGroup,
  Container,
  Field,
  Input,
  PasswordInput,
  SectionLabel,
  Grid,
  GridItem,
  useResponsive,
} from '../components/ui';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import GoogleFitCard from '../components/GoogleFitCard';
import HealthConnectCard from '../components/HealthConnectCard';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import CalorieAdjustmentCard from '../components/CalorieAdjustmentCard';
import { font, spacing, radius } from '../theme/colors';
import { useTheme, useThemedStyles, THEME_MODES } from '../theme/ThemeContext';
import {
  getUser,
  updateUser,
  getGeminiApiKey,
  setGeminiApiKey,
  listWeightEntries,
  listFoodEntries,
  listWorkoutSessions,
  listUserPreferences,
  listDailyActivity,
  listAchievements,
  listCalorieSuggestions,
} from '../services/api';
import { getCurrentUser, signOut, deleteAccount, isDemoMode } from '../services/auth';
import { clearStoredGeminiKey } from '../services/aiKeyStore';
import { clearAIDataConsent } from '../services/aiConsent';
import { buildExportPayload } from '../utils/dataExport.mjs';
import { resetDemo } from '../services/demoStorage';
import {
  calcularIMC,
  clasificarIMC,
  calcularBMR,
  calcularCaloriasRecomendadas,
  bmiInterpretation,
  healthyWeightRange,
  waistToHeightRatio,
  NIVELES_ACTIVIDAD,
} from '../utils/nutricion';
import { friendlyError } from '../utils/networkErrors.mjs';

function normalizeSex(value) {
  return value === 'female' || value === 'mujer' ? 'female' : 'male';
}

export default function PerfilScreen() {
  const { isDesktop } = useResponsive();
  const { colors, mode, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [objetivoKcal, setObjetivoKcal] = useState('');
  const [metaPeso, setMetaPeso] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  const [email, setEmail] = useState(null);
  const [pesoActual, setPesoActual] = useState('');
  const [cinturaCm, setCinturaCm] = useState('');
  const [asianBackground, setAsianBackground] = useState(false);
  const [alturaCm, setAlturaCm] = useState('');
  const [edad, setEdad] = useState('');
  const [sexo, setSexo] = useState('male');
  const [nivelActividad, setNivelActividad] = useState(1.2);
  const [stepGoal, setStepGoal] = useState('');
  const [waterGoal, setWaterGoal] = useState('');
  const [goalType, setGoalType] = useState('maintain');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [estado, setEstado] = useState('idle');
  const [vista, setVista] = useState('perfil');
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [confirmarBorradoCuenta, setConfirmarBorradoCuenta] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const reloadingRef = useRef(false);
  const timerRef = useRef(null);
  const { showToast: toast } = useToast();

  const cargar = useCallback(async () => {
    reloadingRef.current = true;
    try {
      const [user, currentUser, pesos, savedApiKey] = await Promise.all([
        getUser(),
        getCurrentUser(),
        listWeightEntries(),
        getGeminiApiKey(),
      ]);
      setEmail(currentUser?.email ?? null);
      setObjetivoKcal(String(user.objetivo_kcal ?? 2000));
      setMetaPeso(user.meta_peso_kg != null ? String(user.meta_peso_kg) : '');
      setApiKey(savedApiKey ?? '');
      setAlturaCm(user.altura_cm != null ? String(user.altura_cm) : '');
      setEdad(user.edad != null ? String(user.edad) : '');
      setSexo(normalizeSex(user.sexo));
      setNivelActividad(
        user.nivel_actividad != null ? Number(user.nivel_actividad) : 1.2,
      );
      setStepGoal(String(user.step_goal ?? 8000));
      setWaterGoal(String(user.water_goal ?? 8));
      setGoalType(user.goal_type ?? 'maintain');
      setPesoActual(
        pesos.length > 0 ? String(pesos[pesos.length - 1].peso_kg) : '',
      );
    } catch (e) {
      toast(friendlyError(e, 'Could not load your profile.'), 'error');
    } finally {
      setLoading(false);
      reloadingRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const cerrarSesion = async () => {
    setConfirmarSalida(false);
    try {
      if (isDemoMode()) {
        await resetDemo();
        toast('Demo data reset.', 'success');
        return;
      }
      await signOut();
    } catch (e) {
      toast(friendlyError(e, 'Could not sign out.'), 'error');
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const [user, meals, weights, workouts, preferences, activity, achievements, calorieSuggestions] = await Promise.all([
        getUser(),
        listFoodEntries(),
        listWeightEntries(),
        listWorkoutSessions(),
        listUserPreferences(),
        listDailyActivity(),
        listAchievements(),
        listCalorieSuggestions(),
      ]);
      const exportedAt = new Date().toISOString();
      const payload = JSON.stringify(buildExportPayload({
        profile: user,
        meals,
        weightEntries: weights,
        workouts,
        dailyActivity: activity,
        foodPreferences: preferences,
        achievements,
        calorieSuggestions,
      }, exportedAt, Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'), null, 2);

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const file = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = `openfit-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Your data export was downloaded.', 'success');
      } else {
        const fileName = 'openfit-export-' + exportedAt.slice(0, 10) + '.json';
        const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
        if (!directory) throw new Error('No local folder is available for the export file.');
        const uri = directory + fileName;
        await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.UTF8 });
        if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export OpenFit data', UTI: 'public.json' });
      }
    } catch (e) {
      toast(friendlyError(e, 'Could not export your data.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const guardar = async (overrides = {}) => {
    try {
      await updateUser({
        objetivoKcal: overrides.objetivoKcal ?? (Number(objetivoKcal) || 2000),
        metaPesoKg: metaPeso ? Number(metaPeso) : null,
        alturaCm: alturaCm ? Number(alturaCm) : null,
        sexo,
        edad: edad ? Number(edad) : null,
        nivelActividad,
        stepGoal: Number(stepGoal) || 8000,
        waterGoal: Number(waterGoal) || 8,
        goalType,
      });
      setEstado('guardado');
    } catch (e) {
      setEstado('error');
      toast(friendlyError(e, 'Could not save.'), 'error');
      if (overrides.throwOnError) throw e;
    }
  };

  // Keep the key separate from the profile auto-save. SecureStore writes can
  // take longer than a normal text edit on Android, which made the old
  // debounced auto-save interrupt or overwrite typing in this field.
  const saveApiKey = async () => {
    setSavingApiKey(true);
    setApiKeyStatus('');
    try {
      await setGeminiApiKey(apiKey.trim());
      setApiKeyStatus(apiKey.trim() ? 'API key saved securely on this device.' : 'API key removed from this device.');
      toast(apiKey.trim() ? 'Gemini API key saved.' : 'Gemini API key removed.', 'success');
    } catch (e) {
      const message = friendlyError(e, 'Could not save the API key.');
      setApiKeyStatus(message);
      toast(message, 'error');
    } finally {
      setSavingApiKey(false);
    }
  };

  const borrarCuenta = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      await Promise.all([clearStoredGeminiKey(), clearAIDataConsent()]);
      setConfirmarBorradoCuenta(false);
      toast('Your account and cloud data were deleted.', 'success');
    } catch (e) {
      toast(friendlyError(e, 'Could not delete your account.'), 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  useEffect(() => {
    if (reloadingRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setEstado('guardando');
    timerRef.current = setTimeout(() => {
      guardar();
    }, 800);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objetivoKcal, metaPeso, alturaCm, edad, sexo, nivelActividad, stepGoal, waterGoal, goalType]);

  const imc = calcularIMC(pesoActual, alturaCm);
  const clas = clasificarIMC(imc);
  const bmiInfo = bmiInterpretation(imc, asianBackground);
  const weightRange = healthyWeightRange(alturaCm);
  const waistRatio = waistToHeightRatio(cinturaCm, alturaCm);
  const bmr = calcularBMR(pesoActual, alturaCm, edad, sexo);
  const kcalRec = calcularCaloriasRecomendadas(
    pesoActual,
    alturaCm,
    edad,
    sexo,
    nivelActividad,
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (vista === 'calculadora') {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Container>
          <TouchableOpacity style={styles.backBtn} onPress={() => setVista('perfil')}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Calculator</Text>

          <Card style={styles.formCard}>
            <SectionLabel>How to read BMI</SectionLabel>
            <Text style={styles.infoCopy}>
              BMI is a screening measure based on height and weight. It does not diagnose a condition or distinguish muscle from fat. This adult calculator is not intended for people under 18 or during pregnancy.
            </Text>
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: asianBackground }}
              onPress={() => setAsianBackground((value) => !value)}
              style={[styles.activityRow, asianBackground && styles.activityActive]}
            >
              <Ionicons
                name={asianBackground ? 'checkbox' : 'square-outline'}
                size={21}
                color={asianBackground ? colors.primary : colors.textMuted}
              />
              <View style={styles.activityInfo}>
                <Text style={styles.activityLabel}>Use Asian adult screening thresholds</Text>
                <Text style={styles.activityHint}>These thresholds can flag risk at a lower BMI.</Text>
              </View>
            </TouchableOpacity>
          </Card>

          <Card style={styles.formCard}>
            <SectionLabel>Your details</SectionLabel>
            <Field
              label="Current weight (kg)"
              hint="Uses your latest entry from the Weight tab. You can adjust it here."
            >
              <Input
                value={pesoActual}
                onChangeText={setPesoActual}
                keyboardType="decimal-pad"
                placeholder="e.g. 78.5"
              />
            </Field>

            <Field label="Height (cm)">
              <Input
                value={alturaCm}
                onChangeText={setAlturaCm}
                keyboardType="decimal-pad"
                placeholder="e.g. 175"
              />
            </Field>

            <Field
              label="Waist circumference (cm) · optional"
              hint="Measure around your waist, roughly midway between the bottom of your ribs and the top of your hips."
            >
              <Input
                value={cinturaCm}
                onChangeText={setCinturaCm}
                keyboardType="decimal-pad"
                placeholder="e.g. 82"
              />
            </Field>

            <Field label="Age (years)">
              <Input
                value={edad}
                onChangeText={setEdad}
                keyboardType="number-pad"
                placeholder="e.g. 30"
              />
            </Field>

            <Field label="Sex">
              <ChipGroup
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                ]}
                value={sexo}
                onChange={setSexo}
              />
            </Field>

            <Field label="Activity level">
              {NIVELES_ACTIVIDAD.map((n) => {
                const active = nivelActividad === n.value;
                return (
                  <TouchableOpacity
                    key={n.value}
                    onPress={() => setNivelActividad(n.value)}
                    style={[styles.activityRow, active && styles.activityActive]}
                  >
                    <View
                      style={[
                        styles.radio,
                        active && { borderColor: colors.primary },
                      ]}
                    >
                      {active ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityLabel}>{n.label}</Text>
                      <Text style={styles.activityHint}>{n.hint}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Field>
          </Card>

          <Card style={styles.formCard}>
            <SectionLabel>Results</SectionLabel>
            <View style={styles.resultRow}>
              <View style={styles.resultBlock}>
                <Text style={styles.resultValor}>
                  {imc != null ? imc.toFixed(1) : '—'}
                </Text>
                <Text
                  style={[
                    styles.resultCategoria,
                    { color: clas ? clas.color : colors.textMuted },
                  ]}
                >
                  {clas ? clas.categoria : 'BMI'}
                </Text>
                <Text style={styles.resultSub}>
                  {imc != null
                    ? `Height: ${alturaCm} cm`
                    : 'Add weight and height'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.resultBlock}>
                <Text style={styles.resultValor}>
                  {kcalRec != null ? Math.round(kcalRec) : '—'}
                </Text>
                <Text style={[styles.resultCategoria, { color: colors.primary }]}>
                  kcal / day
                </Text>
                <Text style={styles.resultSub}>
                  {bmr != null
                    ? `Resting energy estimate: ${Math.round(bmr)} kcal/day`
                    : 'Incomplete data'}
                </Text>
              </View>
            </View>

            {bmiInfo ? (
              <View style={[styles.bmiGuide, bmiInfo.tone === 'warning' ? styles.bmiGuideWarning : styles.bmiGuideSuccess]}>
                <Text style={styles.bmiGuideTitle}>{bmiInfo.category}</Text>
                <Text style={styles.infoCopy}>{bmiInfo.detail}</Text>
                <Text style={styles.bmiAction}>{bmiInfo.action}</Text>
              </View>
            ) : null}

            {weightRange ? (
              <View style={styles.measureRow}>
                <Ionicons name="scale-outline" size={20} color={colors.primary} />
                <Text style={styles.infoCopy}>
                  Standard adult BMI range at {alturaCm} cm corresponds to about {weightRange.minKg}–{weightRange.maxKg} kg. This is a reference range, not a personal target.
                </Text>
              </View>
            ) : null}

            {waistRatio ? (
              <View style={styles.measureRow}>
                <Ionicons name="body-outline" size={20} color={waistRatio.value < 0.5 ? colors.primary : colors.warning} />
                <Text style={styles.infoCopy}>
                  Waist-to-height ratio: {waistRatio.value.toFixed(2)} ({waistRatio.category}). A ratio under 0.5 is a commonly used adult screening guide; it is not a diagnosis.
                </Text>
              </View>
            ) : cinturaCm ? (
              <Text style={styles.activityHint}>Enter a valid waist measurement and height to see the waist-to-height ratio.</Text>
            ) : null}

            <Text style={styles.disclaimer}>
              For adults only. BMI interpretation can vary with age, ethnicity, pregnancy, muscle mass, and medical history. Speak with a healthcare professional about concerns or unexpected weight changes.
            </Text>

            {kcalRec != null ? (
              <Button
                variant="primary"
                icon="flame-outline"
                onPress={() => setObjetivoKcal(String(Math.round(kcalRec)))}
                style={styles.applyBtn}
              >
                Use estimated maintenance calories ({Math.round(kcalRec)} kcal/day)
              </Button>
            ) : null}
          </Card>
        </Container>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Container>
          <Text style={styles.title}>Profile</Text>
        {estado === 'guardando' ? (
          <Text style={styles.estadoGuardando}>Saving…</Text>
        ) : estado === 'guardado' ? (
          <Text style={styles.estadoGuardado}>All changes saved ✓</Text>
        ) : estado === 'error' ? (
          <Text style={styles.estadoError}>
            {isDemoMode()
              ? 'Could not save local changes. Try restarting the app.'
              : 'Could not save. Check your connection.'}
          </Text>
        ) : null}

        {email ? (
          <Card style={styles.accountCard}>
            <View style={styles.accountIcon}>
              <Ionicons name="person-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountLabel}>Account</Text>
              <Text style={styles.accountEmail}>{email}</Text>
            </View>
          </Card>
        ) : null}

        <Card style={styles.formCard}>
          <SectionLabel>Appearance</SectionLabel>
          <Text style={styles.appearanceHint}>
            Choose how OpenFit looks. System follows your device setting.
          </Text>
          <ChipGroup options={THEME_MODES} value={mode} onChange={setMode} />
        </Card>

        <Grid cols={2}>
          <GridItem cols={1}>
            <Card style={styles.formCard}>
              <SectionLabel>AI</SectionLabel>
              <Field
                label="Gemini API key"
                hint={Platform.OS === 'web'
                  ? 'Optional key from Google AI Studio. Stored in this browser. Google quotas/pricing may apply. Clear this field and save to remove it; rotate it in Google AI Studio. Before AI runs, OpenFit explains which meal, preference, chat, and health/profile details are sent to Gemini.'
                  : 'Optional key from Google AI Studio. Stored in device secure storage. Google quotas/pricing may apply. Clear this field and save to remove it; rotate it in Google AI Studio. Before AI runs, OpenFit explains which meal, preference, chat, and health/profile details are sent to Gemini.'}
              >
                <PasswordInput
                  value={apiKey}
                  onChangeText={(value) => {
                    setApiKey(value);
                    setApiKeyStatus('');
                  }}
                  placeholder="Paste your API key"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  textContentType="none"
                  importantForAutofill="no"
                />
                <Button
                  variant="secondary"
                  icon="key-outline"
                  onPress={saveApiKey}
                  loading={savingApiKey}
                  style={{ marginTop: spacing.sm }}
                >
                  Save API key
                </Button>
                {apiKeyStatus ? (
                  <Text style={apiKeyStatus.includes('Could not') ? styles.estadoError : styles.estadoGuardado}>
                    {apiKeyStatus}
                  </Text>
                ) : null}
              </Field>
            </Card>
          </GridItem>

          <GridItem cols={1}>
            <Card style={styles.formCard}>
              <SectionLabel>Health</SectionLabel>
              <TouchableOpacity
                style={styles.saludRow}
                onPress={() => setVista('calculadora')}
              >
                <View style={styles.saludIcon}>
                  <Ionicons name="fitness" size={20} color={colors.primary} />
                </View>
                <View style={styles.saludInfo}>
                  <Text style={styles.saludLabel}>Calculate BMI and calories</Text>
                  <Text style={styles.saludHint}>
                    Estimate your BMI and how many kcal you should eat per day.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </Card>
          </GridItem>

          <GridItem cols={1}>
            <Card style={styles.formCard}>
              <SectionLabel>Goals</SectionLabel>
              <Field label="Daily calorie goal (kcal)">
                <Input
                  value={objetivoKcal}
                  onChangeText={setObjetivoKcal}
                  keyboardType="numeric"
                  placeholder="2000"
                />
              </Field>

              <Field label="Weight goal (kg)">
                <Input
                  value={metaPeso}
                  onChangeText={setMetaPeso}
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                />
              </Field>

              <Field label="Goal type">
                <ChipGroup
                  options={[
                    { value: 'lose', label: 'Lose' },
                    { value: 'maintain', label: 'Maintain' },
                    { value: 'gain', label: 'Gain' },
                  ]}
                  value={goalType}
                  onChange={setGoalType}
                />
              </Field>

              <Field label="Daily step goal">
                <Input
                  value={stepGoal}
                  onChangeText={setStepGoal}
                  keyboardType="number-pad"
                  placeholder="8000"
                />
              </Field>

              <Field label="Daily water goal (glasses)">
                <Input
                  value={waterGoal}
                  onChangeText={setWaterGoal}
                  keyboardType="number-pad"
                  placeholder="8"
                />
              </Field>
            </Card>
          </GridItem>
        </Grid>

        {Platform.OS === 'android' ? (
          <HealthConnectCard onOpenPrivacy={() => setPrivacyVisible(true)} />
        ) : (
          <>
            <GoogleFitCard />
            <HealthConnectCard onOpenPrivacy={() => setPrivacyVisible(true)} />
          </>
        )}
        {goalType === 'lose' ? (
          <CalorieAdjustmentCard
            onApply={async (calorieGoal) => {
              await guardar({ objetivoKcal: calorieGoal, throwOnError: true });
              setObjetivoKcal(String(calorieGoal));
            }}
          />
        ) : null}
        <Button
          variant="secondary"
          icon="shield-checkmark-outline"
          onPress={() => setPrivacyVisible(true)}
        >
          Privacy policy and data controls
        </Button>

        <Button
          variant="secondary"
          icon="download-outline"
          onPress={exportData}
          loading={exporting}
          disabled={exporting}
        >
          Export my data (JSON)
        </Button>
        <Text style={styles.exportHint}>Includes meals, workouts, weight, goals, daily activity, food preferences, and achievements. Your Gemini API key is excluded.</Text>

        <Button
          variant="secondary"
          icon="shield-checkmark-outline"
          onPress={async () => {
            await clearAIDataConsent();
            toast('AI data sharing choice cleared. OpenFit will ask again before your next AI request.', 'success');
          }}
        >
          Review AI data sharing choice
        </Button>

        <Button
          variant="danger"
          icon={isDemoMode() ? 'refresh-outline' : 'log-out-outline'}
          onPress={() => setConfirmarSalida(true)}
        >
          {isDemoMode() ? 'Reset demo data' : 'Sign out'}
        </Button>
        {!isDemoMode() ? (
          <Button
            variant="danger"
            icon="trash-outline"
            onPress={() => setConfirmarBorradoCuenta(true)}
          >
            Delete my account and data
          </Button>
        ) : null}
      </Container>
    </ScrollView>

    <ConfirmDialog
      visible={confirmarSalida}
      title={isDemoMode() ? 'Reset demo data' : 'Sign out'}
      message={
        isDemoMode()
          ? 'Delete all demo data and start over?'
          : 'Sign out of this device?'
      }
      confirmText={isDemoMode() ? 'Reset' : 'Sign out'}
      icon={isDemoMode() ? 'refresh-outline' : 'log-out-outline'}
      onConfirm={cerrarSesion}
      onCancel={() => setConfirmarSalida(false)}
    />
    <ConfirmDialog
      visible={confirmarBorradoCuenta}
      title="Delete account and all data?"
      message="This permanently deletes your OpenFit profile, meals, workouts, weight, activity, preferences, and achievements from the cloud, then removes your sign-in account. Export your data first if you want a copy."
      confirmText="Delete account"
      icon="trash-outline"
      loading={deletingAccount}
      onConfirm={borrarCuenta}
      onCancel={() => setConfirmarBorradoCuenta(false)}
    />
    <PrivacyPolicyModal visible={privacyVisible} onClose={() => setPrivacyVisible(false)} />
    </>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  estadoGuardando: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },
  estadoGuardado: { fontSize: font.sm, color: colors.primaryDark, marginBottom: spacing.md },
  exportHint: { fontSize: font.xs, lineHeight: 17, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  estadoError: { fontSize: font.sm, color: colors.danger, marginBottom: spacing.md },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: { marginLeft: spacing.md },
  accountLabel: { fontSize: font.sm, color: colors.textMuted },
  accountEmail: { fontSize: font.md, fontWeight: '600', color: colors.text },
  formCard: { marginBottom: spacing.md },
  appearanceHint: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },
  infoCopy: { flex: 1, fontSize: font.sm, lineHeight: 20, color: colors.textMuted },
  bmiGuide: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  bmiGuideWarning: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
  bmiGuideSuccess: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  bmiGuideTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  bmiAction: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginTop: spacing.sm, lineHeight: 19 },
  measureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  disclaimer: { fontSize: font.xs, color: colors.textMuted, lineHeight: 17, marginTop: spacing.sm, marginBottom: spacing.md },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.xs,
  },
  activityActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  activityInfo: { marginLeft: spacing.sm, flex: 1 },
  activityLabel: { fontSize: font.base, fontWeight: '600', color: colors.text },
  activityHint: { fontSize: font.sm, color: colors.textMuted },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  resultBlock: { flex: 1, alignItems: 'center' },
  resultValor: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  resultCategoria: { fontSize: font.md, fontWeight: '600', marginTop: spacing.xs },
  resultSub: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: spacing.md },
  applyBtn: { marginTop: spacing.xs },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  backText: { fontSize: font.md, fontWeight: '600', color: colors.primary },
  saludRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  saludIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saludInfo: { flex: 1 },
  saludLabel: { fontSize: font.md, fontWeight: '600', color: colors.text },
  saludHint: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.xs },
});
