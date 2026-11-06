import { useState } from 'react';
import { Pressable, Text, View, StyleSheet, Platform } from 'react-native';
import Svg, {
  Line,
  Polyline,
  Polygon,
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { spacing } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';

const PAD_LEFT = 42;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 26;
const GRID_STEPS = 4;
const HIT = 40;
const TOOLTIP_W = 150;

function fmt(v, rng) {
  if (rng < 1) return Number(v.toFixed(1));
  if (rng < 5) return Number(v.toFixed(1));
  return Math.round(v);
}

export default function PesoChart({
  data,
  meta = null,
  height = 220,
  width,
  color: colorProp,
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const color = colorProp || colors.primary;
  const [selected, setSelected] = useState(null);

  const resolverPuntoWeb = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const localX = evt.nativeEvent.clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dist = Math.abs(x(i) - localX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    setSelected(best);
  };

  if (!data || data.length === 0) {
    return (
      <View style={[styles.vacio, { height, width }]}>
        <Text style={styles.vacioText}>No data yet</Text>
      </View>
    );
  }

  const values = data.map((d) => Number(d.value));
  const rangeValues = meta != null ? [...values, Number(meta)] : values;
  let rawMin = Math.min(...rangeValues);
  let rawMax = Math.max(...rangeValues);

  if (rawMax === rawMin) {
    const pad = Math.max(Math.abs(rawMax) * 0.05, 0.5);
    rawMin -= pad;
    rawMax += pad;
  } else {
    const rng = rawMax - rawMin;
    rawMin -= rng * 0.08;
    rawMax += rng * 0.08;
  }

  const totalW = width;
  const plotW = totalW - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  const hasMs = data.every((d) => typeof d.ms === 'number');
  const msValues = hasMs ? data.map((d) => d.ms) : [];
  const msMin = msValues.length ? Math.min(...msValues) : 0;
  const msMax = msValues.length ? Math.max(...msValues) : 0;
  const spanMs = msMax - msMin;

  const x = (i) => {
    if (!hasMs || spanMs === 0) {
      return data.length === 1
        ? PAD_LEFT + plotW / 2
        : PAD_LEFT + (plotW * i) / (data.length - 1);
    }
    return PAD_LEFT + ((msValues[i] - msMin) / spanMs) * plotW;
  };
  const y = (v) =>
    PAD_TOP + ((rawMax - v) / (rawMax - rawMin)) * plotH;

  const points = data.map((d, i) => `${x(i)},${y(Number(d.value))}`).join(' ');

  const ticks = [];
  for (let k = 0; k <= GRID_STEPS; k++) {
    const v = rawMin + ((rawMax - rawMin) * k) / GRID_STEPS;
    ticks.push({ y: y(v), v });
  }

  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  const metaY = meta != null ? y(Number(meta)) : null;

  const tooltip = selected != null ? data[selected] : null;

  const areaPoints =
    data.length > 1
      ? `${points} ${x(data.length - 1)},${PAD_TOP + plotH} ${x(0)},${PAD_TOP + plotH}`
      : null;

  return (
    <View
      style={{ height, width }}
      onMouseEnter={Platform.OS === 'web' ? resolverPuntoWeb : undefined}
      onMouseMove={Platform.OS === 'web' ? resolverPuntoWeb : undefined}
      onMouseLeave={Platform.OS === 'web' ? () => setSelected(null) : undefined}
    >
      <Svg width={totalW} height={height}>
        <Defs>
          <SvgGradient id="pesoArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.18" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        {ticks.map((t, i) => (
          <Line
            key={i}
            x1={PAD_LEFT}
            y1={t.y}
            x2={totalW - PAD_RIGHT}
            y2={t.y}
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}
        {ticks.map((t, i) => (
          <SvgText
            key={i}
            x={PAD_LEFT - 8}
            y={t.y + 4}
            fontSize={10}
            fill={colors.textMuted}
            textAnchor="end"
          >
            {fmt(t.v, rawMax - rawMin)}
          </SvgText>
        ))}
        {metaY != null ? (
          <Line
            x1={PAD_LEFT}
            y1={metaY}
            x2={totalW - PAD_RIGHT}
            y2={metaY}
            stroke={colors.textMuted}
            strokeWidth={1}
            strokeDasharray="6 4"
          />
        ) : null}
        {areaPoints ? (
          <Polygon
            points={areaPoints}
            fill="url(#pesoArea)"
            stroke="none"
          />
        ) : null}
        {data.length > 1 ? (
          <Polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {data.map((d, i) => (
          <Circle
            key={i}
            cx={x(i)}
            cy={y(Number(d.value))}
            r={selected === i ? 7 : 5}
            fill={selected === i ? color : colors.background}
            stroke={color}
            strokeWidth={selected === i ? 3 : 2}
          />
        ))}
        {data.map((d, i) => (
          <SvgText
            key={i}
            x={x(i)}
            y={PAD_TOP + plotH + 16}
            fontSize={10}
            fill={colors.textMuted}
            textAnchor="middle"
          >
            {i % labelStep === 0 ? d.label : ''}
          </SvgText>
        ))}
      </Svg>

      {data.map((d, i) => (
        <Pressable
          key={i}
          style={{
            position: 'absolute',
            left: x(i) - HIT / 2,
            top: y(Number(d.value)) - HIT / 2,
            width: HIT,
            height: HIT,
          }}
          onPress={() => setSelected(selected === i ? null : i)}
        />
      ))}

      {tooltip ? (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              width: TOOLTIP_W,
              bottom: height - y(Number(tooltip.value)) + 14,
              left: Math.max(4, Math.min(x(selected) - TOOLTIP_W / 2, totalW - TOOLTIP_W - 4)),
            },
          ]}
        >
          <View style={[styles.tooltipDot, { backgroundColor: color }]} />
          <Text style={styles.tooltipValue}>{tooltip.value} kg</Text>
          <Text style={styles.tooltipFecha}>{tooltip.fechaTexto}</Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  vacio: { alignItems: 'center', justifyContent: 'center' },
  vacioText: { color: colors.textMuted, fontSize: 13 },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
  },
  tooltipDot: {
    position: 'absolute',
    top: 6,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  tooltipFecha: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
});