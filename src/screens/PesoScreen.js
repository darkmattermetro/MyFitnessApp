import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  View,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import PesoChart from '../components/PesoChart';
import { Button, Card, ChipGroup, Container, EmptyState, Grid, GridItem, useResponsive } from '../components/ui';
import PeriodFilter, { periodoRango } from '../components/PeriodFilter';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { colors, font, radius, spacing } from '../theme/colors';
import {
  createWeightEntry,
  listWeightEntries,
  deleteWeightEntry,
  getUser,
} from '../services/api';

function formatFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatHora(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatCorto(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const PAGE = 30;
const MAX_PUNTOS_CHART = 150;

function decimar(lista, max) {
  if (lista.length <= max) return lista;
  const step = (lista.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(lista[Math.round(i * step)]);
  return out;
}

export default function PesoScreen() {
  const { width } = useWindowDimensions();
  const { isDesktop } = useResponsive();
  const [peso, setPeso] = useState('');
  const [entries, setEntries] = useState([]);
  const [lista, setLista] = useState([]);
  const [periodo, setPeriodo] = useState('30d');
  const [hasMore, setHasMore] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [meta, setMeta] = useState(null);
  const [modo, setModo] = useState('dia');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const { showToast: toast } = useToast();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const { desde, hasta } = periodoRango(periodo);
      const [user, pesos, page] = await Promise.all([
        getUser(),
        listWeightEntries({ desde, hasta }),
        listWeightEntries({ desde, hasta, limit: PAGE, offset: 0, asc: false }),
      ]);
      setEntries(pesos);
      setLista(page.data);
      setHasMore(page.hasMore);
      setMeta(user.meta_peso_kg != null ? Number(user.meta_peso_kg) : null);
    } catch (e) {
      setError(e.message || 'No se pudo cargar el peso.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setCargando(false);
      setCargandoMas(false);
    }
  }, [periodo]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const cambiarPeriodo = (p) => {
    if (p === periodo) return;
    setPeriodo(p);
    setCargando(true);
  };

  const cargarMas = async () => {
    setCargandoMas(true);
    try {
      const { desde, hasta } = periodoRango(periodo);
      const page = await listWeightEntries({
        desde,
        hasta,
        limit: PAGE,
        offset: lista.length,
        asc: false,
      });
      setLista((prev) => [...prev, ...page.data]);
      setHasMore(page.hasMore);
    } catch (e) {
      toast(e.message || 'No se pudo cargar más registros.', 'error');
      setCargandoMas(false);
    }
  };

  const registrar = async () => {
    const valor = Number(peso);
    if (!peso || !Number.isFinite(valor) || valor <= 0) {
      toast('Ingresá un peso válido.', 'info');
      return;
    }
    setSaving(true);
    try {
      await createWeightEntry({ pesoKg: valor, measuredAt: new Date() });
      setPeso('');
      await cargar();
      toast('Peso registrado.', 'success');
    } catch (e) {
      toast(e.message || 'No se pudo guardar el peso.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = (id) => setEliminando(id);

  const ejecutarEliminar = async () => {
    const id = eliminando;
    if (!id) return;
    try {
      await deleteWeightEntry(id);
      setEliminando(null);
      await cargar();
    } catch (e) {
      toast(e.message || 'No se pudo eliminar.', 'error');
      setEliminando(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    cargar();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const chartData = (() => {
    if (modo === 'todos') {
      return decimar(
        entries.map((e) => ({
          value: Number(e.peso_kg),
          label: formatCorto(e.measured_at),
          ms: new Date(e.measured_at).getTime(),
          fechaTexto: `${formatFecha(e.measured_at)} · ${formatHora(e.measured_at)}`,
        })),
        MAX_PUNTOS_CHART,
      );
    }
    const grupos = new Map();
    for (const e of entries) {
      const key = new Date(e.measured_at).toDateString();
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(e);
    }
    return decimar(
      [...grupos.entries()]
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([key, listaDia]) => {
          const prom =
            listaDia.reduce((s, e) => s + Number(e.peso_kg), 0) / listaDia.length;
          return {
            value: Number(prom.toFixed(2)),
            label: formatCorto(key),
            fechaTexto: listaDia.length > 1
              ? `${formatFecha(key)} · promedio de ${listaDia.length} registros`
              : `${formatFecha(key)} · ${formatHora(listaDia[0].measured_at)}`,
          };
        }),
      MAX_PUNTOS_CHART,
    );
  })();

  const chartWidth = (() => {
    const inner = isDesktop ? Math.min(width, 1120) : width;
    return Math.max(inner - spacing.md * 4 - 2, 200);
  })();

  const chartCard = (
    <Card>
      <ChipGroup
        options={[
          { value: 'dia', label: 'Promedio por día' },
          { value: 'todos', label: 'Todos los registros' },
        ]}
        value={modo}
        onChange={setModo}
      />
      <View style={styles.chartWrap}>
        <PesoChart
          data={chartData}
          meta={meta}
          width={chartWidth}
          height={230}
          color={colors.primary}
        />
      </View>
      {meta != null ? (
        <Text style={styles.metaTexto}>Línea punteada: meta {meta} kg</Text>
      ) : null}
    </Card>
  );

  const inputCard = (
    <Card style={styles.inputCard}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="78.5"
          placeholderTextColor={colors.textMuted}
          value={peso}
          onChangeText={setPeso}
        />
        <Text style={styles.unidad}>kg</Text>
      </View>
      <Button
        variant="primary"
        icon="add"
        onPress={registrar}
        disabled={saving}
        loading={saving}
      >
        Registrar
      </Button>
    </Card>
  );

  const registrosCard = lista.length > 0 ? (
    <View style={styles.lista}>
      <Text style={styles.listaTitulo}>Registros</Text>
      {lista.map((e) => (
        <Card key={e.id} style={styles.itemCard}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemPeso}>{e.peso_kg} kg</Text>
            <Text style={styles.itemFecha}>
              {formatFecha(e.measured_at)} · {formatHora(e.measured_at)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => eliminar(e.id)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </Card>
      ))}
      {hasMore ? (
        <Button
          variant="secondary"
          icon="chevron-down"
          onPress={cargarMas}
          loading={cargandoMas}
          disabled={cargandoMas}
          style={styles.masBtn}
        >
          Cargar más
        </Button>
      ) : null}
    </View>
  ) : null;

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      <Container>
        <Text style={styles.title}>Registrar peso</Text>

        <PeriodFilter value={periodo} onChange={cambiarPeriodo} />

        {cargando ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : null}

        {periodo !== 'todo' && lista.length > 0 ? (
          <Text style={styles.contador}>
            Mostrando {lista.length} registro{lista.length === 1 ? '' : 's'} en el período seleccionado
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {entries.length === 0 ? (
          <>
            {inputCard}
            <EmptyState
              icon="scale-outline"
              title="Registrá tu primer peso"
              hint="Vas a ver tu curva acá en la pestaña Peso."
            />
          </>
        ) : isDesktop ? (
          <Grid cols={2}>
            <GridItem cols={1}>
              {chartCard}
            </GridItem>
            <GridItem cols={1}>
              {inputCard}
              {registrosCard}
            </GridItem>
          </Grid>
        ) : (
          <>
            {inputCard}
            {chartCard}
            {registrosCard}
          </>
        )}
      </Container>
      </ScrollView>

      <ConfirmDialog
        visible={eliminando != null}
        title="Eliminar registro"
        message="¿Eliminar este registro de peso? Esta acción no se puede deshacer."
        loading={saving}
        onConfirm={ejecutarEliminar}
        onCancel={() => setEliminando(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  contador: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },
  spinner: { marginVertical: spacing.md },
  inputCard: { marginBottom: spacing.md },
  masBtn: { marginTop: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  unidad: { fontSize: font.md, fontWeight: '700', color: colors.textMuted },
  error: { color: colors.danger, marginBottom: spacing.md },
  chartWrap: { alignItems: 'center', marginTop: spacing.md },
  metaTexto: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  lista: { marginTop: spacing.lg },
  listaTitulo: { fontSize: font.md, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  itemCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, marginBottom: spacing.sm },
  itemInfo: { flex: 1 },
  itemPeso: { fontSize: font.md, fontWeight: '700', color: colors.text },
  itemFecha: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.xs },
});