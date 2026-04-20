import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { formatCurrency } from "@/lib/investmentCalculations";

export default function StrategyETFForm({ config, globalParams, allStrategies, onChange, projection, strategyIRRAnnual }) {
  const effectiveCapital = globalParams?.capitalInitial ?? 0;
  const years = globalParams?.durationYears || 20;
  const lastPoint = projection && projection.length > 0 ? projection[projection.length - 1] : null;
  const majorExpensePoint = projection?.find((p) => (p.majorExpenseNetPaid || 0) > 0 || (p.majorExpenseUnfunded || 0) > 0) || null;
  const totalInvested = lastPoint?.totalInvested || 0;
  // Indice ETF théorique base 100€ pour donner une lecture "nombre de parts".
  const syntheticUnitPrice = 100;
  const estimatedUnits = lastPoint?.capitalBrut ? lastPoint.capitalBrut / syntheticUnitPrice : 0;

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
      {lastPoint && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Détails ETF ({years} ans)</p>
          <p>Total versé (coût d'acquisition) : <span className="font-mono text-foreground">{formatCurrency(totalInvested)}</span></p>
          <p>Valeur brute estimée : <span className="font-mono text-foreground">{formatCurrency(lastPoint.capitalBrut || 0)}</span></p>
          <p>Valeur nette estimée : <span className="font-mono text-foreground">{formatCurrency(lastPoint.netValue || 0)}</span></p>
          <p>TRI annualisé estimé : <span className="font-mono text-foreground">{strategyIRRAnnual != null ? `${(strategyIRRAnnual * 100).toFixed(2)} %` : "—"}</span></p>
          <p>Nombre de parts ETF (indice base 100€) : <span className="font-mono text-foreground">{estimatedUnits.toFixed(2)}</span></p>
          {majorExpensePoint && (
            <>
              <p className="pt-1 font-semibold text-foreground">Grosse dépense (année {majorExpensePoint.year})</p>
              <p>Financée par cash initial : <span className="font-mono text-foreground">{formatCurrency(majorExpensePoint.majorExpenseFromInitialCash || majorExpensePoint.majorExpenseFromCash || 0)}</span></p>
              <p>Financée par vente ETF nette : <span className="font-mono text-foreground">{formatCurrency((majorExpensePoint.majorExpenseNetPaid || 0) - (majorExpensePoint.majorExpenseFromCash || 0))}</span></p>
              <p>Impôt ETF payé à cette vente : <span className="font-mono text-foreground">{formatCurrency(majorExpensePoint.majorExpenseTaxPaid || 0)}</span></p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
