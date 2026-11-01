import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, font, radius, spacing } from '../theme/colors';

const MACROS = [
  { key: 'protein', label: 'Protein', color: colors.primary, kcalPerGram: 4 },
  { key: 'carbs', label: 'Carbs', color: colors.warning, kcalPerGram: 4 },
  { key: 'fat', label: 'Fat', color: colors.danger, kcalPerGram: 9 },
];

// Ring chart of where today's calories come from. Slices are sized by the
// energy each macro contributes (protein/carbs 4 kcal/g, fat 9 kcal/g).
export default function MacroDonut({ macros, kcal = 0, size = 132, stroke = 14 }) {
  const radiusValue = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusValue;

  const values = MACROS.map((macro) => {
    const grams = Number(macros?.[macro.key]) || 0;
    return { ...macro, grams, energy: grams * macro.kcalPerGram };
  });
  const totalEnergy = values.reduce((sum, v) => sum + v.energy, 0);

  let offset = 0;
  const slices = values.map((value) => {
    if (totalEnergy <= 0 || value.energy <= 0) return null;
    const length = (value.energy / totalEnergy) * circumference;
    const slice = { ...value, length, offset };
    offset += length;
    return slice;
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.lg }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radiusValue}
              stroke={colors.surfaceMuted}
              strokeWidth={stroke}
              fill="none"
            />
            {slices.map((slice) =>
              slice ? (
                <Circle
                  key={slice.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radiusValue}
                  stroke={slice.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${Math.max(slice.length - 2, 0)} ${circumference}`}
                  strokeDashoffset={-slice.offset}
                />
              ) : null,
            )}
          </G>
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ fontSize: font.xl, fontWeight: '800', color: colors.text }}>
            {Math.round(Number(kcal) || 0)}
          </Text>
          <Text style={{ fontSize: font.xs, color: colors.textMuted, fontWeight: font.weight.medium }}>
            kcal
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 150, gap: spacing.xs + 2 }}>
        {values.map((value) => {
          const pct = totalEnergy > 0 ? Math.round((value.energy / totalEnergy) * 100) : 0;
          return (
            <View key={value.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: radius.pill,
                  backgroundColor: value.color,
                }}
              />
              <Text style={{ flex: 1, fontSize: font.base, color: colors.text }}>{value.label}</Text>
              <Text style={{ fontSize: font.base, fontWeight: '700', color: colors.text }}>
                {Math.round(value.grams)} g
              </Text>
              <Text style={{ width: 36, textAlign: 'right', fontSize: font.sm, color: colors.textMuted }}>
                {pct}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
