import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";

export default function StrategyETFForm({ config, globalParams, allStrategies, onChange }) {
  const effectiveCapital = globalParams?.capitalInitial ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 opacity-60">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Lock className="h-3 w-3" /> Capital de départ ETF
          </Label>
          <div className="h-9 px-3 flex items-center rounded-md bg-muted/60 border border-border font-mono text-sm">
            {effectiveCapital.toLocaleString('fr-FR')} €
          </div>
          <p className="text-xs text-muted-foreground">Capital investi ETF (pas de déduction d'apport)</p>
        </div>
        <div className="space-y-2 opacity-60">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Lock className="h-3 w-3" /> Versement mensuel
          </Label>
          <div className="h-9 px-3 flex items-center rounded-md bg-muted/60 border border-border font-mono text-sm">
            {(globalParams?.monthlySavings ?? 0).toLocaleString('fr-FR')} €/mois
          </div>
          <p className="text-xs text-muted-foreground">= effort d'épargne global</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-60">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Lock className="h-3 w-3" /> Rendement ETF / an
          </Label>
          <div className="h-9 px-3 flex items-center rounded-md bg-muted/60 border border-border font-mono text-sm">
            {((globalParams?.etfAnnualReturn ?? 0.08) * 100).toFixed(2)} %
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Lock className="h-3 w-3" /> Flat tax (PFU)
          </Label>
          <div className="h-9 px-3 flex items-center rounded-md bg-muted/60 border border-border font-mono text-sm">
            {((globalParams?.taxRate ?? 0.30) * 100).toFixed(2)} %
          </div>
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">Modifiables dans les paramètres communs</p>
      </div>
    </div>
  );
}
