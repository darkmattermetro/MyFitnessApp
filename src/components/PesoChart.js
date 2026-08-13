import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Svg, {
  Line,
  Polyline,
  Circle,
  Text as SvgText,
} from 'react-native-svg';
import { colors, spacing } from '../theme/colors';

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
  color = colors.primary,
}) {
  const [selected, setSelected] = useState(null);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.vacio, { height, width }]}>
        <Text style={styles.vacioText}>Sin datos</Text>
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

  return (
    <View style={{ height, width }}>
      <Svg width={totalW} height={height}>
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
        {data.length > 1 ? (
          <Polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {data.map((d, i) => (
          <Circle
            key={i}
            cx={x(i)}
            cy={y(Number(d.value))}
            r={selected === i ? 6 : 4}
            fill={color}
            stroke={colors.background}
            strokeWidth={2}
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
          style={[
            styles.tooltip,
            {
              width: TOOLTIP_W,
              bottom: height - y(Number(tooltip.value)) + 8,
              left: Math.max(4, Math.min(x(selected) - TOOLTIP_W / 2, totalW - TOOLTIP_W - 4)),
            },
          ]}
        >
          <Text style={styles.tooltipValue}>{tooltip.value} kg</Text>
          <Text style={styles.tooltipFecha}>{tooltip.fechaTexto}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  vacio: { alignItems: 'center', justifyContent: 'center' },
  vacioText: { color: colors.textMuted, fontSize: 13 },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  tooltipValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  tooltipFecha: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
});