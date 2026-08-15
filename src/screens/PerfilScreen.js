import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  ScrollView,
  View,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  Button,
  Card,
  ChipGroup,
  Container,
  Field,
  Input,
  SectionLabel,
  Grid,
  GridItem,
  useResponsive,
} from '../components/ui';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { colors, font, spacing, radius } from '../theme/colors';
import {
  getUser,
  updateUser,
  listWeightEntries,
} from '../services/api';
import { getCurrentUser, signOut, isDemoMode } from '../services/auth';
import { resetDemo } from '../services/demoStorage';
import {
  calcularIMC,
  clasificarIMC,
  calcularBMR,
  calcularCaloriasRecomendadas,
  NIVELES_ACTIVIDAD,
} from '../utils/nutricion';

export default function PerfilScreen() {
  const { isDesktop } = useResponsive();
  const [objetivoKcal, setObjetivoKcal] = useState('');
  const [metaPeso, setMetaPeso] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState(null);
  const [pesoActual, setPesoActual] = useState('');
  const [alturaCm, setAlturaCm] = useState('');
  const [edad, setEdad] = useState('');
  const [sexo, setSexo] = useState('hombre');
  const [nivelActividad, setNivelActividad] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState('idle');
  const [vista, setVista] = useState('perfil');
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const reloadingRef = useRef(false);
  const timerRef = useRef(null);
  const { showToast: toast } = useToast();

  const cargar = useCallback(async () => {
    reloadingRef.current = true;
    try {
      const [user, currentUser, pesos] = await Promise.all([
        getUser(),
        getCurrentUser(),
        listWeightEntries(),
      ]);
      setEmail(currentUser?.email ?? null);
      setObjetivoKcal(String(user.objetivo_kcal ?? 2000));
      setMetaPeso(user.meta_peso_kg != null ? String(user.meta_peso_kg) : '');
      setApiKey(user.gemini_api_key ?? '');
      setAlturaCm(user.altura_cm != null ? String(user.altura_cm) : '');
      setEdad(user.edad != null ? String(user.edad) : '');
      setSexo(user.sexo || 'hombre');
      setNivelActividad(
        user.nivel_actividad != null ? Number(user.nivel_actividad) : 1.2,
      );
      setPesoActual(
        pesos.length > 0 ? String(pesos[pesos.length - 1].peso_kg) : '',
      );
    } catch (e) {
      toast(e.message || 'No se pudo cargar el perfil.', 'error');
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
        toast('Datos demo reiniciados.', 'success');
        return;
      }
      await signOut();
    } catch (e) {
      toast(e.message || 'No se pudo cerrar la sesión.', 'error');
    }
  };

  const guardar = async () => {
    try {
      await updateUser({
        objetivoKcal: Number(objetivoKcal) || 2000,
        metaPesoKg: metaPeso ? Number(metaPeso) : null,
        geminiApiKey: apiKey.trim(),
        alturaCm: alturaCm ? Number(alturaCm) : null,
        sexo,
        edad: edad ? Number(edad) : null,
        nivelActividad,
      });
      setEstado('guardado');
    } catch (e) {
      setEstado('error');
      toast(e.message || 'No se pudo guardar.', 'error');
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
  }, [objetivoKcal, metaPeso, apiKey, alturaCm, edad, sexo, nivelActividad]);

  const imc = calcularIMC(pesoActual, alturaCm);
  const clas = clasificarIMC(imc);
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
            <Text style={styles.backText}>Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Calculadora</Text>

          <Card style={styles.formCard}>
            <SectionLabel>Tus datos</SectionLabel>
            <Field
              label="Peso actual (kg)"
              hint="Se usa el último registro de la pestaña Peso. Podés ajustarlo."
            >
              <Input
                value={pesoActual}
                onChangeText={setPesoActual}
                keyboardType="decimal-pad"
                placeholder="Ej: 78.5"
              />
            </Field>

            <Field label="Altura (cm)">
              <Input
                value={alturaCm}
                onChangeText={setAlturaCm}
                keyboardType="decimal-pad"
                placeholder="Ej: 175"
              />
            </Field>

            <Field label="Edad (años)">
              <Input
                value={edad}
                onChangeText={setEdad}
                keyboardType="number-pad"
                placeholder="Ej: 30"
              />
            </Field>

            <Field label="Sexo">
              <ChipGroup
                options={[
                  { value: 'hombre', label: 'Hombre' },
                  { value: 'mujer', label: 'Mujer' },
                ]}
                value={sexo}
                onChange={setSexo}
              />
            </Field>

            <Field label="Nivel de actividad">
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
            <SectionLabel>Resultados</SectionLabel>
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
                  {clas ? clas.categoria : 'IMC'}
                </Text>
                <Text style={styles.resultSub}>
                  {imc != null
                    ? `Altura: ${alturaCm} cm`
                    : 'Cargá peso y altura'}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.resultBlock}>
                <Text style={styles.resultValor}>
                  {kcalRec != null ? Math.round(kcalRec) : '—'}
                </Text>
                <Text style={[styles.resultCategoria, { color: colors.primary }]}>
                  kcal / día
                </Text>
                <Text style={styles.resultSub}>
                  {bmr != null
                    ? `Metabolismo: ${Math.round(bmr)} kcal`
                    : 'Datos incompletos'}
                </Text>
              </View>
            </View>

            {kcalRec != null ? (
              <Button
                variant="primary"
                icon="flame-outline"
                onPress={() => setObjetivoKcal(String(Math.round(kcalRec)))}
                style={styles.applyBtn}
              >
                Usar {Math.round(kcalRec)} kcal como objetivo
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
          <Text style={styles.title}>Perfil</Text>
        {estado === 'guardando' ? (
          <Text style={styles.estadoGuardando}>Guardando…</Text>
        ) : estado === 'guardado' ? (
          <Text style={styles.estadoGuardado}>Todo guardado ✓</Text>
        ) : estado === 'error' ? (
          <Text style={styles.estadoError}>No se pudo guardar. Revisá tu conexión.</Text>
        ) : null}

        {email ? (
          <Card style={styles.accountCard}>
            <View style={styles.accountIcon}>
              <Ionicons name="person-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountLabel}>Cuenta</Text>
              <Text style={styles.accountEmail}>{email}</Text>
            </View>
          </Card>
        ) : null}

        <Grid cols={2}>
          <GridItem cols={1}>
            <Card style={styles.formCard}>
              <SectionLabel>IA</SectionLabel>
              <Field
                label="API key de Gemini"
                hint="Tu propia clave de https://aistudio.google.com/apikey. Se usa para interpretar tus comidas."
              >
                <Input
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="Tu API key"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </Field>
            </Card>
          </GridItem>

          <GridItem cols={1}>
            <Card style={styles.formCard}>
              <SectionLabel>Salud</SectionLabel>
              <TouchableOpacity
                style={styles.saludRow}
                onPress={() => setVista('calculadora')}
              >
                <View style={styles.saludIcon}>
                  <Ionicons name="fitness" size={20} color={colors.primary} />
                </View>
                <View style={styles.saludInfo}>
                  <Text style={styles.saludLabel}>Calcular IMC y calorías</Text>
                  <Text style={styles.saludHint}>
                    Calculá tu IMC y cuántas kcal deberías consumir por día.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </Card>
          </GridItem>

          <GridItem cols={1}>
            <Card style={styles.formCard}>
              <SectionLabel>Objetivos</SectionLabel>
              <Field label="Objetivo calórico diario (kcal)">
                <Input
                  value={objetivoKcal}
                  onChangeText={setObjetivoKcal}
                  keyboardType="numeric"
                  placeholder="2000"
                />
              </Field>

              <Field label="Meta de peso (kg)">
                <Input
                  value={metaPeso}
                  onChangeText={setMetaPeso}
                  keyboardType="decimal-pad"
                  placeholder="Opcional"
                />
              </Field>
            </Card>
          </GridItem>
        </Grid>

        <Button
          variant="danger"
          icon={isDemoMode() ? 'refresh-outline' : 'log-out-outline'}
          onPress={() => setConfirmarSalida(true)}
        >
          {isDemoMode() ? 'Reiniciar datos demo' : 'Cerrar sesión'}
        </Button>
      </Container>
    </ScrollView>

    <ConfirmDialog
      visible={confirmarSalida}
      title={isDemoMode() ? 'Reiniciar datos demo' : 'Cerrar sesión'}
      message={
        isDemoMode()
          ? '¿Querés borrar todos los datos demo y empezar de nuevo?'
          : '¿Querés cerrar tu sesión en este dispositivo?'
      }
      confirmText={isDemoMode() ? 'Reiniciar' : 'Cerrar sesión'}
      icon={isDemoMode() ? 'refresh-outline' : 'log-out-outline'}
      onConfirm={cerrarSesion}
      onCancel={() => setConfirmarSalida(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  estadoGuardando: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },
  estadoGuardado: { fontSize: font.sm, color: colors.primaryDark, marginBottom: spacing.md },
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