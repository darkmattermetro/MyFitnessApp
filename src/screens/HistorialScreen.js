import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  ScrollView,
  View,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Button, Card, ChipGroup, Container, EmptyState, Field, Input, SectionLabel, Grid, GridItem, useResponsive } from '../components/ui';
import PeriodFilter, { periodRange } from '../components/PeriodFilter';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { colors, font, radius, spacing } from '../theme/colors';
import {
  listFoodEntries,
  updateFoodEntry,
  deleteFoodEntry,
} from '../services/api';
import { MEAL_LABEL, MEAL_TYPES, mealTypeOf } from '../utils/nutricion';

function parseFecha(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatFecha(iso) {
  const d = parseFecha(iso);
  if (!d) return 'No date';
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
  });
}

function formatHora(iso) {
  const d = parseFecha(iso);
  if (!d) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function agruparPorDia(entries) {
  const grupos = new Map();
  for (const e of entries) {
    const d = parseFecha(e.fecha);
    const key = d ? d.toDateString() : 'No date';
    if (!grupos.has(key)) grupos.set(key, { fecha: d, entries: [] });
    grupos.get(key).entries.push(e);
  }
  const porDia = [...grupos.entries()].sort((a, b) => {
    if (a[1].fecha == null) return 1;
    if (b[1].fecha == null) return -1;
    return b[1].fecha - a[1].fecha;
  });
  return porDia.map(([dia, g]) => [
    dia,
    [...g.entries].sort((x, y) => {
      const tx = parseFecha(x.fecha)?.getTime() ?? 0;
      const ty = parseFecha(y.fecha)?.getTime() ?? 0;
      if (ty !== tx) return ty - tx;
      return String(y.created_at ?? '').localeCompare(String(x.created_at ?? ''));
    }),
  ]);
}

function itemsArray(items) {
  return Array.isArray(items) ? items : [];
}

// Current items use English keys; early demo rows may still use Spanish ones.
function normalizeItem(item) {
  const raw = item || {};
  return {
    name: raw.name ?? raw.nombre ?? '',
    amount: raw.amount ?? raw.cantidad ?? '',
    kcal: raw.kcal ?? '',
    note: raw.note ?? raw.advertencia ?? '',
  };
}

const PAGE = 30;

export default function HistorialScreen() {
  const { isDesktop } = useResponsive();
  const [entries, setEntries] = useState([]);
  const [periodo, setPeriodo] = useState('7d');
  const [hasMore, setHasMore] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(null);
  const { showToast: toast } = useToast();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const { desde, hasta } = periodRange(periodo);
      const res = await listFoodEntries({ desde, hasta, limit: PAGE, offset: 0 });
      setEntries(res.data);
      setHasMore(res.hasMore);
    } catch (e) {
      setError(e.message || 'Could not load your history.');
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
      const { desde, hasta } = periodRange(periodo);
      const res = await listFoodEntries({
        desde,
        hasta,
        limit: PAGE,
        offset: entries.length,
      });
      setEntries((prev) => [...prev, ...res.data]);
      setHasMore(res.hasMore);
    } catch (e) {
      toast(e.message || 'Could not load more entries.', 'error');
      setCargandoMas(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    cargar();
  };

  const abrirEdicion = (e) => {
    setEditando({
      id: e.id,
      fecha: e.fecha,
      meal_type: mealTypeOf(e),
      texto_original: e.texto_original || '',
      items: itemsArray(e.items).map((it) => normalizeItem(it)),
    });
  };

  const cerrarEdicion = () => {
    if (guardando) return;
    setEditando(null);
  };

  const updateItem = (index, campo, valor) => {
    setEditando((prev) => {
      const items = prev.items.map((it, i) =>
        i === index ? { ...it, [campo]: valor } : it,
      );
      return { ...prev, items };
    });
  };

  const quitarItem = (index) => {
    setEditando((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const agregarItem = () => {
    setEditando((prev) => ({
      ...prev,
      items: [...prev.items, { name: '', amount: '', kcal: '', note: '' }],
    }));
  };

  const totalEdit = (editando?.items || []).reduce(
    (s, it) => s + (Number(it.kcal) || 0),
    0,
  );

  const guardar = async () => {
    if (!editando) return;
    if (!editando.texto_original.trim()) {
      toast('Add a description for this meal.', 'info');
      return;
    }
    if (editando.items.length === 0) {
      toast('Add at least one item.', 'info');
      return;
    }
    setGuardando(true);
    try {
      await updateFoodEntry(editando.id, {
        texto: editando.texto_original.trim(),
        items: editando.items.map((it) => ({
          name: (it.name || '').trim(),
          amount: String(it.amount ?? ''),
          kcal: Number(it.kcal) || 0,
          protein: Number(it.protein) || 0,
          fat: Number(it.fat) || 0,
          carbs: Number(it.carbs) || 0,
          note: String(it.note ?? ''),
        })),
        totalKcal: totalEdit,
        fecha: new Date(editando.fecha),
        mealType: editando.meal_type,
      });
      setEditando(null);
      await cargar();
      toast('Changes saved.', 'success');
    } catch (e) {
      toast(e.message || 'Could not save the changes.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = (id) => setEliminando(id);

  const ejecutarEliminar = async () => {
    const id = eliminando;
    if (!id) return;
    setGuardando(true);
    try {
      await deleteFoodEntry(id);
      setEliminando(null);
      setEditando(null);
      await cargar();
      toast('Meal deleted.', 'success');
    } catch (e) {
      toast(e.message || 'Could not delete the meal.', 'error');
      setEliminando(null);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const groups = agruparPorDia(entries);

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Container>
          <Text style={styles.title}>History</Text>
          <PeriodFilter value={periodo} onChange={cambiarPeriodo} />

          {cargando ? (
            <ActivityIndicator style={styles.spinner} color={colors.primary} />
          ) : null}

          {entries.length > 0 ? (
            <Text style={styles.contador}>
              Showing {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              {periodo !== 'todo' ? ' in the selected period' : ''}
            </Text>
          ) : null}

          {entries.length === 0 ? (
            <EmptyState
              icon="restaurant-outline"
              title="No meals in this period"
              hint="Log something in the Food tab or change the date filter."
            />
          ) : isDesktop ? (
            <Grid cols={2}>
              {groups.map(([dia, delDia]) => {
                const totalDia = delDia.reduce(
                  (s, e) => s + (Number(e.total_kcal) || 0),
                  0,
                );
                return (
                  <GridItem key={dia} cols={1}>
                    <View style={styles.diaHeader}>
                      <Text style={styles.diaTitulo}>{formatFecha(dia)}</Text>
                      <Badge>{Math.round(totalDia)} kcal</Badge>
                    </View>
                    {delDia.map((e) => (
                      <Card key={e.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardTitulo}>{e.texto_original}</Text>
                          <View style={styles.cardRight}>
                            <Badge tone="muted">{MEAL_LABEL[mealTypeOf(e)]}</Badge>
                            <Text style={styles.cardHora}>{formatHora(e.fecha)}</Text>
                          </View>
                        </View>
                        {itemsArray(e.items).length > 0 ? (
                          <View style={styles.items}>
                            {itemsArray(e.items).map((it, i) => {
                              const item = normalizeItem(it);
                              return (
                                <Text key={i} style={styles.itemTexto}>
                                  • {item.name} ({item.amount}) — {Math.round(Number(item.kcal) || 0)} kcal
                                </Text>
                              );
                            })}
                          </View>
                        ) : null}
                        <View style={styles.cardActions}>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => abrirEdicion(e)}
                            hitSlop={6}
                          >
                            <Ionicons name="create-outline" size={16} color={colors.primary} />
                            <Text style={styles.actionEditar}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => confirmarEliminar(e.id)}
                            hitSlop={6}
                          >
                            <Ionicons name="trash-outline" size={16} color={colors.danger} />
                            <Text style={styles.actionBorrar}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </Card>
                    ))}
                  </GridItem>
                );
              })}
            </Grid>
          ) : (
            groups.map(([dia, delDia]) => {
              const totalDia = delDia.reduce(
                (s, e) => s + (Number(e.total_kcal) || 0),
                0,
              );
              return (
                <View key={dia} style={styles.dia}>
                  <View style={styles.diaHeader}>
                    <Text style={styles.diaTitulo}>{formatFecha(dia)}</Text>
                    <Badge>{Math.round(totalDia)} kcal</Badge>
                  </View>
                  {delDia.map((e) => (
                    <Card key={e.id} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitulo}>{e.texto_original}</Text>
                        <View style={styles.cardRight}>
                          <Badge tone="muted">{MEAL_LABEL[mealTypeOf(e)]}</Badge>
                          <Text style={styles.cardHora}>{formatHora(e.fecha)}</Text>
                        </View>
                      </View>
                      {itemsArray(e.items).length > 0 ? (
                        <View style={styles.items}>
                          {itemsArray(e.items).map((it, i) => {
                            const item = normalizeItem(it);
                            return (
                              <Text key={i} style={styles.itemTexto}>
                                • {item.name} ({item.amount}) — {Math.round(Number(item.kcal) || 0)} kcal
                              </Text>
                            );
                          })}
                        </View>
                      ) : null}
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => abrirEdicion(e)}
                          hitSlop={6}
                        >
                          <Ionicons name="create-outline" size={16} color={colors.primary} />
                          <Text style={styles.actionEditar}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => confirmarEliminar(e.id)}
                          hitSlop={6}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.danger} />
                          <Text style={styles.actionBorrar}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  ))}
                </View>
              );
            })
          )}

          {hasMore ? (
            <Button
              variant="secondary"
              icon="chevron-down"
              onPress={cargarMas}
              loading={cargandoMas}
              disabled={cargandoMas}
              style={styles.masBtn}
            >
              Load more
            </Button>
          ) : null}
        </Container>
      </ScrollView>

      <Modal
        visible={editando != null}
        animationType="slide"
        onRequestClose={cerrarEdicion}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Container>
              <Text style={styles.modalTitle}>Edit meal</Text>

              <Field label="Description">
                <Input
                  multiline
                  value={editando?.texto_original}
                  onChangeText={(v) =>
                    setEditando((prev) => ({ ...prev, texto_original: v }))
                  }
                  style={{ minHeight: 64, textAlignVertical: 'top' }}
                />
              </Field>

              <Field label="Meal">
                <ChipGroup
                  options={MEAL_TYPES.map((meal) => ({ value: meal.value, label: meal.label }))}
                  value={editando?.meal_type ?? 'snack'}
                  onChange={(v) => setEditando((prev) => ({ ...prev, meal_type: v }))}
                />
              </Field>

              <SectionLabel>Items</SectionLabel>
              {editando && (editando.items ?? []).map((item, index) => (
                <Card key={index} style={styles.editItemCard}>
                  <View style={styles.cardHeader}>
                    <TextInput
                      style={styles.nombreInput}
                      value={item.name}
                      onChangeText={(v) => updateItem(index, 'name', v)}
                      placeholder="Name"
                      placeholderTextColor={colors.textMuted}
                    />
                    <TouchableOpacity onPress={() => quitarItem(index)} hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.cantidadInput}
                    value={String(item.amount ?? '')}
                    onChangeText={(v) => updateItem(index, 'amount', v)}
                    placeholder="Amount (e.g. 2 slices)"
                    placeholderTextColor={colors.textMuted}
                  />
                  <View style={styles.kcalRow}>
                    <Text style={styles.kcalLabel}>Calories (kcal)</Text>
                    <TextInput
                      style={styles.kcalInput}
                      keyboardType="numeric"
                      value={String(item.kcal ?? '')}
                      onChangeText={(v) => updateItem(index, 'kcal', v)}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  {item.note ? (
                    <Text style={styles.advertencia}>{item.note}</Text>
                  ) : null}
                </Card>
              ))}

              <Button
                variant="ghost"
                icon="add"
                onPress={agregarItem}
                style={styles.addBtn}
              >
                Add item
              </Button>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <View style={styles.totalBadge}>
                  <Text style={styles.totalValue}>{Math.round(totalEdit)}</Text>
                  <Text style={styles.totalUnidad}> kcal</Text>
                </View>
              </View>

              {guardando ? (
                <ActivityIndicator style={styles.loading} color={colors.primary} />
              ) : (
                <View style={styles.modalAcciones}>
                  <Button
                    variant="danger"
                    icon="trash-outline"
                    onPress={() => confirmarEliminar(editando.id)}
                    style={styles.modalBtn}
                  >
                    Delete meal
                  </Button>
                  <View style={styles.btnRow}>
                    <Button variant="secondary" onPress={cerrarEdicion} style={styles.flexBtn}>
                      Cancel
                    </Button>
                    <Button variant="primary" onPress={guardar} icon="checkmark" style={styles.flexBtn}>
                      Save changes
                    </Button>
                  </View>
                </View>
              )}
            </Container>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={eliminando != null}
        title="Delete meal"
        message="Remove this meal from your history? This cannot be undone."
        loading={guardando}
        onConfirm={ejecutarEliminar}
        onCancel={() => setEliminando(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  error: { color: colors.danger, textAlign: 'center' },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  dia: { marginBottom: spacing.lg },
  contador: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.md },
  spinner: { marginVertical: spacing.md },
  masBtn: { marginTop: spacing.md },
  diaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  diaTitulo: { fontSize: font.md, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  card: { marginBottom: spacing.sm, padding: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitulo: { fontSize: font.base, fontWeight: '600', color: colors.text, flex: 1 },
  cardHora: { fontSize: font.sm, color: colors.textMuted, marginLeft: spacing.sm },
  items: { marginTop: spacing.sm },
  itemTexto: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.xs },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  actionEditar: { color: colors.primary, fontSize: font.base, fontWeight: '600' },
  actionBorrar: { color: colors.danger, fontSize: font.base, fontWeight: '600' },
  modalTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.lg },
  editItemCard: { marginBottom: spacing.sm, padding: spacing.md },
  nombreInput: { flex: 1, fontSize: font.md, fontWeight: '600', color: colors.text, padding: 0 },
  cantidadInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: font.base,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.sm,
  },
  kcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  kcalLabel: { fontSize: font.base, color: colors.textMuted },
  kcalInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: font.base,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    minWidth: 90,
    textAlign: 'right',
  },
  advertencia: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  addBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  totalLabel: { fontSize: font.md, color: colors.text, fontWeight: '600' },
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  totalValue: { fontSize: font.lg, fontWeight: '800', color: colors.primaryDark },
  totalUnidad: { fontSize: font.sm, color: colors.primaryDark, fontWeight: '600' },
  loading: { marginVertical: spacing.md },
  modalAcciones: { marginTop: spacing.sm },
  modalBtn: { marginBottom: spacing.sm },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  flexBtn: { flex: 1 },
});
