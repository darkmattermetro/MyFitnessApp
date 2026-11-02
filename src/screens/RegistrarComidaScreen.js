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
import { Button, Card, ChipGroup, Container, SectionLabel, Grid, GridItem, useResponsive } from '../components/ui';
import PreferenciasSection from '../components/PreferenciasSection';
import { useToast } from '../components/Toast';
import { colors, font, radius, spacing } from '../theme/colors';
import { parseFood, createFoodEntry, describeFoodImage } from '../services/api';
import { MEAL_TYPES, guessMealType } from '../utils/nutricion';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function numericValue(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function RegistrarComidaScreen() {
  const { isDesktop } = useResponsive();
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [imagen, setImagen] = useState(null);
  const [describiendo, setDescribiendo] = useState(false);
  const [mealType, setMealType] = useState(() => guessMealType(new Date()));
  const { showToast: toast } = useToast();

  const interpretar = async () => {
    if (!texto.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await parseFood(texto);
      if (!res || !res.items || res.items.length === 0) {
        throw new Error('The AI could not find any food in your text.');
      }
      setItems(res.items);
    } catch (e) {
      setError(e.message || 'Could not interpret the meal.');
    } finally {
      setLoading(false);
    }
  };

  const describirImagen = async (base64, mimeType) => {
    if (!base64) {
      setError('No image data received. Try selecting the image again.');
      return;
    }
    if (!mimeType) mimeType = 'image/jpeg';
    setDescribiendo(true);
    setError(null);
    try {
      const descripcion = await describeFoodImage(base64, mimeType);
      if (!descripcion) throw new Error('Could not describe the image.');
      setTexto(descripcion);
      setItems(null);
    } catch (e) {
      setError(e.message || 'Could not describe the image.');
    } finally {
      setDescribiendo(false);
    }
  };

  const tomarFoto = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      toast('You need to allow camera access to take photos.', 'error');
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
      if (!asset.base64) {
        setError('Could not read the photo. Try again.');
        return;
      }
      describirImagen(asset.base64, asset.mimeType || 'image/jpeg');
    }
  };

  const elegirGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      toast('You need to allow access to your photos.', 'error');
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
      if (!asset.base64) {
        setError('Could not read the image. Try again.');
        return;
      }
      describirImagen(asset.base64, asset.mimeType || 'image/jpeg');
    }
  };

  const subirWeb = async () => {
    setError(null);
    let res;
    try {
      res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
    } catch (e) {
      setError(e.message || 'Could not open the file picker.');
      return;
    }
    if (res.canceled || !res.assets || res.assets.length === 0) return;
    const asset = res.assets[0];
    setImagen(asset);

    if (asset.file?.size > MAX_IMAGE_BYTES) {
      setError('Choose an image smaller than 15 MB so it can be sent to Gemini.');
      setImagen(null);
      return;
    }

    // On web, base64 may be missing in some browsers. Read the selected File,
    // or fetch Expo's temporary object URL and read that Blob as a fallback.
    let base64 = asset.base64;
    if (!base64) {
      try {
        let file = asset.file;
        if (!file && asset.uri) {
          const response = await fetch(asset.uri);
          if (!response.ok) throw new Error('Could not read the selected image.');
          file = await response.blob();
        }
        if (file?.size > MAX_IMAGE_BYTES) {
          setError('Choose an image smaller than 15 MB so it can be sent to Gemini.');
          setImagen(null);
          return;
        }
        if (!file) throw new Error('The browser did not provide image data. Choose the image again.');
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const result = ev.target?.result;
            if (typeof result === 'string') {
              resolve(result.split(',')[1]);
            } else {
              reject(new Error('Could not read file'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
      } catch (e) {
        setError(e.message || 'Could not read the image.');
        return;
      }
    }

    if (!base64) {
      setError('Could not read the image as base64. Try a smaller image.');
      return;
    }
    if (base64.length * 0.75 > MAX_IMAGE_BYTES) {
      setError('Choose an image smaller than 15 MB so it can be sent to Gemini.');
      setImagen(null);
      return;
    }
    describirImagen(base64, asset.mimeType || 'image/jpeg');
  };

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = (items || []).reduce((s, i) => s + numericValue(i.kcal), 0);

  const guardar = async () => {
    if (!items || items.length === 0) return;
    setSaving(true);
    try {
      await createFoodEntry({
        texto,
        items: items.map((it) => ({
          name: String(it.name ?? '').trim(),
          amount: String(it.amount ?? ''),
          kcal: numericValue(it.kcal),
          protein: numericValue(it.protein),
          fat: numericValue(it.fat),
          carbs: numericValue(it.carbs),
          note: String(it.note ?? ''),
        })),
        totalKcal: total,
        fecha: new Date(),
        mealType,
      });
      toast('Meal logged.', 'success');
      setItems(null);
      setTexto('');
      setImagen(null);
      setMealType(guessMealType(new Date()));
    } catch (e) {
      toast(e.message || 'Could not save.', 'error');
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
          placeholder="e.g. I had a grape and popcorn without oil"
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
            {describiendo ? 'Describing the image…' : 'You can edit the description below.'}
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
            <Text style={styles.fotoBtnText}>Upload image</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.fotoBtn} onPress={tomarFoto} disabled={describiendo}>
              <Ionicons name="camera-outline" size={18} color={colors.primary} />
              <Text style={styles.fotoBtnText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fotoBtn} onPress={elegirGaleria} disabled={describiendo}>
              <Ionicons name="images-outline" size={18} color={colors.primary} />
              <Text style={styles.fotoBtnText}>Gallery</Text>
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
          <Text style={styles.title}>What did you eat?</Text>
          <Text style={styles.subtitle}>
            Describe it in your own words or upload a photo. Include amounts and how it was
            cooked.
          </Text>
          <Text style={styles.aiNotice}>
            AI estimates can be inaccurate. When you use AI, your meal text or selected photo and saved food preferences are sent to Google Gemini. Review the result before saving.
          </Text>

          <Card style={styles.mealCard}>
            <Text style={styles.mealLabel}>Which meal is this?</Text>
            <ChipGroup
              options={MEAL_TYPES.map((meal) => ({ value: meal.value, label: meal.label }))}
              value={mealType}
              onChange={setMealType}
            />
          </Card>

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
                    Interpret with AI
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
                  Interpret with AI
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
  const macroTotals = items.reduce((totals, item) => ({
    protein: totals.protein + numericValue(item.protein),
    carbs: totals.carbs + numericValue(item.carbs),
    fat: totals.fat + numericValue(item.fat),
  }), { protein: 0, carbs: 0, fat: 0 });

  return (
    <View>
      <SectionLabel style={{ marginTop: spacing.md }}>Review before saving</SectionLabel>
      {items.map((item, index) => (
        <Card key={`${item.name}-${index}`} style={styles.itemCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.nombre}>{item.name}</Text>
            <TouchableOpacity onPress={() => removeItem(index)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.cantidadInput}
            value={String(item.amount ?? '')}
            onChangeText={(v) => updateItem(index, 'amount', v)}
            placeholder="Amount"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.kcalRow}>
            <Text style={styles.kcalLabel}>Calories (kcal)</Text>
            <TextInput
              style={styles.kcalInput}
              keyboardType="numeric"
              value={String(item.kcal)}
              onChangeText={(v) => updateItem(index, 'kcal', v)}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.macroInputs}>
            {[
              ['protein', 'Protein (g)'],
              ['carbs', 'Carbs (g)'],
              ['fat', 'Fat (g)'],
            ].map(([field, label]) => (
              <View key={field} style={styles.macroInputWrap}>
                <Text style={styles.macroLabel}>{label}</Text>
                <TextInput
                  style={styles.macroInput}
                  keyboardType="decimal-pad"
                  value={String(item[field] ?? 0)}
                  onChangeText={(value) => updateItem(index, field, value)}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            ))}
          </View>
          {item.note ? <Text style={styles.advertencia}>• {item.note}</Text> : null}
        </Card>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Estimated total</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalValue}>{Math.round(total)}</Text>
          <Text style={styles.totalUnidad}> kcal</Text>
        </View>
      </View>
      <Text style={styles.macroSummary}>
        Estimated macros: {Math.round(macroTotals.protein)} g protein · {Math.round(macroTotals.carbs)} g carbs · {Math.round(macroTotals.fat)} g fat
      </Text>

      <View style={styles.botones}>
        <Button variant="secondary" onPress={onEditar} disabled={saving} style={styles.flexBtn}>
          Edit text
        </Button>
        <Button
          variant="primary"
          onPress={onGuardar}
          disabled={saving || items.length === 0}
          loading={saving}
          icon="checkmark"
          style={styles.flexBtn}
        >
          Save
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
  aiNotice: { fontSize: font.sm, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  mealCard: { marginBottom: spacing.md },
  mealLabel: {
    fontSize: font.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
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
  macroInputs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  macroInputWrap: { flex: 1, minWidth: 0 },
  macroLabel: { fontSize: font.xs, color: colors.textMuted, marginBottom: spacing.xs },
  macroInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: font.base,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  macroSummary: { color: colors.textMuted, fontSize: font.sm, marginTop: -spacing.sm, marginBottom: spacing.md },
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
