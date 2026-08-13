import { ChipGroup } from './ui';

export const OPCIONES_PERIODO = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: 'todo', label: 'Todo' },
];

export function periodoRango(value) {
  if (!value || value === 'todo') return { desde: null, hasta: null };
  const dias = Number(value.replace('d', '')) || 0;
  const ahora = new Date();
  const desde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - (dias - 1), 0, 0, 0);
  const hasta = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

export default function PeriodFilter({ value, onChange }) {
  return <ChipGroup options={OPCIONES_PERIODO} value={value} onChange={onChange} />;
}
