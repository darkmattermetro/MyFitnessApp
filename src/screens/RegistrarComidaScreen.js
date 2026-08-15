import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Container, Input, SectionLabel, Grid, GridItem, useResponsive } from '../components/ui';
import PreferenciasSection from '../components/PreferenciasSection';
import { useToast } from '../components/Toast';
import { colors, font, radius, spacing } from '../theme/colors';
import { parseFood, createFoodEntry, describeFoodImage } from '../services/api';

export default function RegistrarComidaScreen() {
  const { isDesktop } = useResponsive();
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [imagen, setImagen] = useState(null);
  const [describiendo, setDescribiendo] = useState(false);
  const { showToast: toast } = useToast();

  const interpretar = async () => {
    if (!texto.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await parseFood(texto);
      if (!res || !res.items || res.items.length === 0) {
        throw new Error('La IA no encontró alimentos en tu texto.');
      }
      setItems(res.items);
    } catch (e) {
      setError(e.message || 'No se pudo interpretar la comida.');
    } finally {
      setLoading(false);
    }
  };

  const describirImagen = async (base64, mimeType) => {
    if (!base64 || !mimeType) return;
    setDescribiendo(true);
    setError(null);
    try {
      const descripcion = await describeFoodImage(base64, mimeType);
      if (!descripcion) throw new Error('No se pudo describir la imagen.');
      setTexto(descripcion);
      setItems(null);
    } catch (e) {
      setError(e.message || 'No se pudo describir la imagen.');
    } finally {
      setDescribiendo(false);
    }
  };

  const tomarFoto = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      toast('Necesitás permitir la cámara para sacar fotos.', 'error');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      aspect: [4, 3],
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      setImagen(asset);
      describirImagen(asset.base64, asset.mimeType || 'image/jpeg');
    }
  };

  const elegirGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      toast('Necesitás permitir el acceso a tus fotos.', 'error');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      aspect: [4, 3],
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      setImagen(asset);
      describirImagen(asset.base64, asset.mimeType || 'image/jpeg');
    }
  };

  const subirWeb = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled) {
      const asset = res.assets[0];
      setImagen(asset);
      describirImagen(asset.base64, asset.mimeType || 'image/jpeg');
    }
  };

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = (items || []).reduce((s, i) => s + (Number(i.kcal) || 0), 0);

  const guardar = async () => {
    if (!items || items.length === 0) return;
    setSaving(true);
    try {
      await createFoodEntry({
        texto,
        items,
        totalKcal: total,
        fecha: new Date(),
      });
      toast('Comida registrada.', 'success');
      setItems(null);
      setTexto('');
      setImagen(null);
    } catch (e) {
      toast(e.message || 'No se pudo guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCard = (
    <Card style={styles.inputCard}>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          multiline
          placeholder="Ej: comí una uva y crispetas sin aceite"
          value={texto}
          onChangeText={setTexto}
          placeholderTextColor={colors.textMuted}
          submitBehavior="submit"
          onSubmitEditing={interpretar}
        />
        {texto.trim() ? (
          <TouchableOpacity
            style={[styles.sendBtn, loading && { opacity: 0.45 }]}
            onPress={interpretar}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="arrow-up" size={20} color={colors.white} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {imagen ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: imagen.uri }} style={styles.preview} />
          <TouchableOpacity
            style={styles.previewX}
            onPress={() => setImagen(null)}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.previewHint}>
            {describiendo ? 'Describiendo la imagen…' : 'Podés corregir la descripción abajo.'}
          </Text>
        </View>
      ) : null}

      {describiendo ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : null}

      <View style={styles.fotoRow}>
        {Platform.OS === 'web' ? (
          <TouchableOpacity style={styles.fotoBtn} onPress={subirWeb} disabled={describiendo}>
            <Ionicons name="image-outline" size={18} color={colors.primary} />
            <Text style={styles.fotoBtnText}>Subir imagen</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.fotoBtn} onPress={tomarFoto} disabled={describiendo}>
              <Ionicons name="camera-outline" size={18} color={colors.primary} />
              <Text style={styles.fotoBtnText}>Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fotoBtn} onPress={elegirGaleria} disabled={describiendo}>
              <Ionicons name="images-outline" size={18} color={colors.primary} />
              <Text style={styles.fotoBtnText}>Galería</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Card>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Container>
          <Text style={styles.title}>¿Qué comiste?</Text>
          <Text style={styles.subtitle}>
            Describilo con tus palabras o subí una foto. Incluí cantidades y método de preparación.
          </Text>

          {isDesktop ? (
            <Grid cols={2}>
              <GridItem cols={1}>
                {inputCard}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {loading && !items ? (
                  <ActivityIndicator style={styles.loading} color={colors.primary} />
                ) : null}

                {!items ? (
                  <Button
                    variant="primary"
                    icon="sparkles-outline"
                    disabled={!texto.trim() || loading || describiendo}
                    onPress={interpretar}
                    style={styles.bigBtn}
                  >
                    Interpretar por IA
                  </Button>
                ) : (
                  <Confirmacion
                    items={items}
                    total={total}
                    updateItem={updateItem}
                    removeItem={removeItem}
                    onEditar={() => setItems(null)}
                    onGuardar={guardar}
                    saving={saving}
                  />
                )}
              </GridItem>
              <GridItem cols={1}>
                <View style={styles.prefWrap}>
                  <PreferenciasSection />
                </View>
              </GridItem>
            </Grid>
          ) : (
            <>
              {inputCard}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {loading && !items ? (
                <ActivityIndicator style={styles.loading} color={colors.primary} />
              ) : null}

              {!items ? (
                <Button
                  variant="primary"
                  icon="sparkles-outline"
                  disabled={!texto.trim() || loading || describiendo}
                  onPress={interpretar}
                  style={styles.bigBtn}
                >
                  Interpretar por IA
                </Button>
              ) : (
                <Confirmacion
                  items={items}
                  total={total}
                  updateItem={updateItem}
                  removeItem={removeItem}
                  onEditar={() => setItems(null)}
                  onGuardar={guardar}
                  saving={saving}
                />
              )}

              <View style={styles.prefWrap}>
                <PreferenciasSection />
              </View>
            </>
          )}
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Confirmacion({ items, total, updateItem, removeItem, onEditar, onGuardar, saving }) {
  return (
    <View>
      <SectionLabel style={{ marginTop: spacing.md }}>Revisá antes de guardar</SectionLabel>
      {items.map((item, index) => (
        <Card key={`${item.nombre}-${index}`} style={styles.itemCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.nombre}>{item.nombre}</Text>
            <TouchableOpacity onPress={() => removeItem(index)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.cantidadInput}
            value={item.cantidad}
            onChangeText={(v) => updateItem(index, 'cantidad', v)}
            placeholder="Cantidad"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.kcalRow}>
            <Text style={styles.kcalLabel}>Calorías (kcal)</Text>
            <TextInput
              style={styles.kcalInput}
              keyboardType="numeric"
              value={String(item.kcal)}
              onChangeText={(v) => updateItem(index, 'kcal', v)}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          {item.advertencia ? (
            <Text style={styles.advertencia}>• {item.advertencia}</Text>
          ) : null}
        </Card>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total estimado</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalValue}>{Math.round(total)}</Text>
          <Text style={styles.totalUnidad}> kcal</Text>
        </View>
      </View>

      <View style={styles.botones}>
        <Button variant="secondary" onPress={onEditar} disabled={saving} style={styles.flexBtn}>
          Editar texto
        </Button>
        <Button
          variant="primary"
          onPress={onGuardar}
          disabled={saving || items.length === 0}
          loading={saving}
          icon="checkmark"
          style={styles.flexBtn}
        >
          Guardar
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: font.base, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  inputCard: { marginBottom: spacing.md },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: 0 },
  input: {
    flex: 1,
    minHeight: 76,
    fontSize: font.md,
    color: colors.text,
    textAlignVertical: 'top',
    padding: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: colors.danger, marginTop: spacing.sm },
  loading: { marginVertical: spacing.lg },
  bigBtn: { marginTop: spacing.sm },
  itemCard: { marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombre: { fontSize: font.md, fontWeight: '600', color: colors.text, flex: 1 },
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
  advertencia: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.sm },
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
  botones: { flexDirection: 'row', gap: spacing.sm },
  flexBtn: { flex: 1 },
  prefWrap: { marginTop: spacing.lg },
  fotoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  fotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fotoBtnText: { fontSize: font.base, fontWeight: '600', color: colors.primary },
  previewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  preview: { width: 72, height: 72, borderRadius: radius.sm },
  previewX: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs + 56,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHint: { flex: 1, fontSize: font.sm, color: colors.textMuted },
});