import { formatCurrency } from "@/lib/investmentCalculations";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

function Metric({ label, value, sub, highlight }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold font-mono ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground font-mono">{sub}</p>}
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function SummaryTable({ projections, globalParams }) {
  if (!projections || projections.length === 0) return null;

  const years = globalParams?.durationYears || 20;
  const totalDeployed = (globalParams?.capitalInitial || 0) + (globalParams?.monthlySavings || 0) * years * 12;

  const sorted = [...projections].sort((a, b) => {
    const aFinal = a.data[a.data.length - 1]?.netValue || 0;
    const bFinal = b.data[b.data.length - 1]?.netValue || 0;
    return bFinal - aFinal;
  });

  const bestValue = sorted[0]?.data[sorted[0].data.length - 1]?.netValue || 0;

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">Résumé comparatif</h3>
        <p className="text-xs text-muted-foreground">Capital total engagé : <span className="font-mono font-medium text-foreground">{formatCurrency(totalDeployed)}</span></p>
      </div>

      <div className="space-y-3">
        {sorted.map((p, i) => {
          const finalData = p.data[p.data.length - 1];
          if (!finalData) return null;
          const isWinner = i === 0;
          const diff = finalData.netValue - bestValue;
          const multiple = totalDeployed > 0 ? finalData.netValue / totalDeployed : 0;
          const cagr = totalDeployed > 0 && years > 0
            ? Math.pow(finalData.netValue / totalDeployed, 1 / years) - 1
            : 0;
          const gain = finalData.netValue - totalDeployed;

          return (
            <div
              key={p.name}
              className={`p-4 rounded-lg border transition-all space-y-3 ${
                isWinner ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isWinner ? (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="h-4 w-4 text-primary" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold font-mono text-foreground">{formatCurrency(finalData.netValue)}</p>
                  {!isWinner ? (
                    <p className="text-xs text-destructive font-mono flex items-center justify-end gap-1">
                      <TrendingDown className="h-3 w-3" />{formatCurrency(diff)}
                    </p>
                  ) : projections.length > 1 && (
                    <p className="text-xs text-primary font-mono flex items-center justify-end gap-1">
                      <TrendingUp className="h-3 w-3" />Meilleure stratégie
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                <Metric
                  label="CAGR net"
                  value={`${(cagr * 100).toFixed(1)}%`}
                  highlight={isWinner}
                />
                <Metric
                  label="Multiple"
                  value={`×${multiple.toFixed(2)}`}
                  highlight={isWinner}
                />
                <Metric
                  label="Gain net"
                  value={formatCurrency(gain)}
                  highlight={isWinner}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
