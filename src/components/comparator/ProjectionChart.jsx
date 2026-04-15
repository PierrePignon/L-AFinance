import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/investmentCalculations";

const COLORS = [
  "#2563eb", // blue
  "#059669", // emerald
  "#d97706", // amber
  "#7c3aed", // violet
  "#dc2626", // red
  "#0891b2", // cyan
];

const SAVINGS_KEY = "Épargne non investie";

export default function ProjectionChart({ projections, savingsBaseline }) {
  const keyMoments = useMemo(() => {
    if (!projections || projections.length < 2) return { transitions: [], winnerText: null };
    const maxMonths = Math.max(...projections.map((p) => p.data.length));
    if (!maxMonths) return { transitions: [], winnerText: null };

    const leaderByMonth = [];
    for (let m = 1; m <= maxMonths; m++) {
      let best = null;
      projections.forEach((p) => {
        const value = p.data[m - 1]?.netValue;
        if (value == null) return;
        if (!best || value > best.value) best = { name: p.name, value };
      });
      if (best) leaderByMonth.push({ month: m, ...best });
    }

    const transitions = [];
    for (let i = 1; i < leaderByMonth.length; i++) {
      const prev = leaderByMonth[i - 1];
      const curr = leaderByMonth[i];
      if (curr.name !== prev.name) {
        transitions.push(`Annnée(s) ${Math.ceil(curr.month / 12)}: ${curr.name} passe devant`);
      }
    }

    const lastMonthLeaders = leaderByMonth[leaderByMonth.length - 1];
    const finalRanking = projections
      .map((p) => ({ name: p.name, value: p.data[p.data.length - 1]?.netValue ?? -Infinity }))
      .sort((a, b) => b.value - a.value);
    const first = finalRanking[0];
    const second = finalRanking[1];
    const winnerText = first && second
      ? `Final: ${first.name} devant de ${formatCurrency(first.value - second.value)}`
      : lastMonthLeaders
        ? `Final: ${lastMonthLeaders.name} en tête`
        : null;

    return { transitions: transitions.slice(0, 4), winnerText };
  }, [projections]);

  const chartData = useMemo(() => {
    const allData = [...(projections || []), ...(savingsBaseline ? [{ name: SAVINGS_KEY, data: savingsBaseline }] : [])];
    if (allData.length === 0) return [];

    const maxMonths = Math.max(...allData.map((p) => p.data.length));
    const data = [];

    for (let m = 0; m < maxMonths; m++) {
      const point = { month: m + 1, year: Math.ceil((m + 1) / 12) };
      allData.forEach((p) => {
        if (p.data[m]) {
          point[p.name] = Math.round(p.data[m].netValue);
        }
      });
      if ((m + 1) % 3 === 0 || m === 0 || m === maxMonths - 1) {
        data.push(point);
      }
    }
    return data;
  }, [projections, savingsBaseline]);

  if (chartData.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Ajoutez des stratégies pour voir la projection</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="text-base font-semibold text-foreground mb-1">Projection du patrimoine net</h3>
      <p className="text-xs text-muted-foreground mb-6">Évolution sur la durée de projection, après impôts et frais</p>

      <div className="h-80 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `${Math.ceil(v / 12)}a`}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => {
                if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                return v;
              }}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              formatter={(value, name) => [formatCurrency(value), name]}
              labelFormatter={(label) => `Mois ${label} (Année ${Math.ceil(label / 12)})`}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
            />
            {projections.map((p, i) => (
              <Line
                key={p.name}
                type="monotone"
                dataKey={p.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
            {savingsBaseline && (
              <Line
                key={SAVINGS_KEY}
                type="monotone"
                dataKey={SAVINGS_KEY}
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 3 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {keyMoments.winnerText && (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-foreground mb-2">Moments clés</p>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{keyMoments.winnerText}</span>
            {keyMoments.transitions.length === 0 ? (
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Aucune bascule: le leader reste le même</span>
            ) : (
              keyMoments.transitions.map((t) => (
                <span key={t} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{t}</span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
