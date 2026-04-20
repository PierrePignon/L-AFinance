import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings2 } from "lucide-react";

const SCENARIOS = [
  { value: 'linear', label: 'Linéaire (stable)' },
  { value: 'crash_start', label: 'Crash début (−30% an 1-2)' },
  { value: 'crash_end', label: 'Crash fin (−30% dernières années)' },
  { value: 'volatile', label: 'Volatile (±15% alternant)' },
  { value: 'sideways', label: 'Cycle plat (hauts/bas, progression lente)' },
  { value: 'dotcom_2008', label: 'Double crise (style 2000 + 2008)' },
  { value: 'stochastic_mild', label: 'Aléatoire modéré (reproductible)' },
  { value: 'stochastic_crisis', label: 'Aléatoire avec crises (reproductible)' },
];

// Calcule l'effort mensuel net qui amène le paiement crédit SCPI exactement à 35% DTI
// effort = maxCreditPayment * (pmtFactor - scpiYieldNetMonthly) / pmtFactor
function computeEffortAt35(annualIncome, currentMonthlyDebt, creditRate, creditDurationYears) {
  if (!annualIncome) return null;
  const maxCreditPayment = Math.max(0, annualIncome / 12 * 0.35 - (currentMonthlyDebt || 0));
  const r = creditRate / 12;
  const n = creditDurationYears * 12;
  const pmtFactor = r === 0 ? 1 / n : (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  // Paramètres SCPI par défaut : rendement 4.71%, fiscalité 25%, occupation 100%
  const scpiYieldNetMonthly = 0.0471 * (1 - 0.25) / 12;
  const denominator = pmtFactor - scpiYieldNetMonthly;
  if (denominator <= 0) return maxCreditPayment;
  return Math.round(maxCreditPayment * denominator / pmtFactor);
}

export default function GlobalParameters({ params, onChange }) {
  const creditDurationYears = params.creditDurationYears || params.durationYears || 20;

  const update = (key, value) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Paramètres globaux</h2>
          <p className="text-xs text-muted-foreground">Hypothèses communes à toutes les stratégies</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Capital investi ETF (actuel)</Label>
          <div className="relative">
            <Input type="number" value={params.capitalInitial} onChange={(e) => update("capitalInitial", Number(e.target.value))} className="pr-8 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
          </div>
          <p className="text-xs text-muted-foreground">Valeur actuelle du portefeuille ETF</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Capital disponible (cash)</Label>
          <div className="relative">
            <Input type="number" value={params.capitalDisponible || 0} onChange={(e) => update("capitalDisponible", Number(e.target.value))} className="pr-8 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
          </div>
          <p className="text-xs text-muted-foreground">Utilisé en priorité pour les apports</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plus-value latente ETF</Label>
          <div className="relative">
            <Input type="number" step="1" value={Math.round((params.currentETFGainRate || 0) * 100)} onChange={(e) => update("currentETFGainRate", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">% de la valeur qui est une plus-value (pour calculer le coût fiscal de liquidation)</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Effort d'épargne mensuel</Label>
          <div className="relative">
            <Input type="number" value={params.monthlySavings} onChange={(e) => update("monthlySavings", Number(e.target.value))} className="pr-16 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€/mois</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Épargne bonus ETF</Label>
          <div className="relative">
            <Input type="number" value={params.etfBonusMonthlySavings || 0} onChange={(e) => update("etfBonusMonthlySavings", Number(e.target.value))} className="pr-16 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€/mois</span>
          </div>
          <p className="text-xs text-muted-foreground">Ajoutée uniquement aux versements ETF (ETF pur, SCPI, immobilier).</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Taux crédit (toutes stratégies)</Label>
          <div className="relative">
            <Input type="number" step="0.01" value={(params.creditRate * 100).toFixed(2)} onChange={(e) => update("creditRate", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>




        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rendement ETF / an</Label>
          <div className="relative">
            <Input type="number" step="0.01" value={(params.etfAnnualReturn * 100).toFixed(2)} onChange={(e) => update("etfAnnualReturn", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Flat tax ETF (PFU)</Label>
          <div className="relative">
            <Input type="number" step="0.01" value={(params.taxRate * 100).toFixed(2)} onChange={(e) => update("taxRate", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scénario boursier</Label>
          <select
            value={params.etfScenario}
            onChange={(e) => update("etfScenario", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {SCENARIOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Convention de taux ETF</Label>
          <select
            value={params.etfRateConvention || 'effective'}
            onChange={(e) => update("etfRateConvention", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="effective">Annuel effectif</option>
            <option value="nominal">Nominal</option>
          </select>
          <p className="text-xs text-muted-foreground">Permet d'aligner la simulation avec les calculateurs externes.</p>
        </div>
        <div className="space-y-2 col-span-full border-t border-border pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Profil emprunteur</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenu annuel net imposable</Label>
              <div className="relative">
                <Input type="number" value={params.annualIncome} onChange={(e) => update("annualIncome", Number(e.target.value))} className="pr-8 font-mono text-sm" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Charges crédit actuelles</Label>
              <div className="relative">
                <Input type="number" value={params.currentMonthlyDebt} onChange={(e) => update("currentMonthlyDebt", Number(e.target.value))} className="pr-16 font-mono text-sm" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€/mois</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Âge actuel</Label>
              <div className="relative">
                <Input type="number" value={params.currentAge || 35} onChange={(e) => update("currentAge", Number(e.target.value))} className="pr-12 font-mono text-sm" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ans</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                Taux d'endettement actuel
              </Label>
              <div className="h-9 px-3 flex items-center rounded-md bg-muted/60 border border-border font-mono text-sm font-semibold"
                style={{ color: params.annualIncome > 0 && (params.currentMonthlyDebt / (params.annualIncome / 12)) > 0.35 ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))' }}>
                {params.annualIncome > 0
                  ? `${((params.currentMonthlyDebt / (params.annualIncome / 12)) * 100).toFixed(1)} %`
                  : '—'}
              </div>
              <p className="text-xs text-muted-foreground">Seuil bancaire : 35 %</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Durée crédit — {creditDurationYears} ans
          </Label>
          <Slider
            value={[creditDurationYears]}
            onValueChange={([v]) => {
              const newEffort = computeEffortAt35(params.annualIncome, params.currentMonthlyDebt, params.creditRate, v);
              onChange({ ...params, creditDurationYears: v, ...(newEffort != null ? { monthlySavings: newEffort } : {}) });
            }}
            min={5} max={50} step={1} className="mt-3"
          />
          {params.annualIncome > 0 && (
            <p className="text-xs text-muted-foreground">↑ Effort auto-calculé pour que le crédit SCPI soit exactement à 35% DTI (varie avec la durée)</p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Durée de projection (liquidation finale) — {params.durationYears} ans
          </Label>
          <Slider
            value={[params.durationYears]}
            onValueChange={([v]) => {
              onChange({ ...params, durationYears: v });
            }}
            min={5} max={50} step={1} className="mt-3"
          />
        </div>
        <div className="space-y-3 sm:col-span-2 lg:col-span-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="enable-major-expense"
              checked={Boolean(params.enableMajorExpense)}
              onCheckedChange={(checked) => update("enableMajorExpense", Boolean(checked))}
            />
            <Label htmlFor="enable-major-expense" className="text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer">
              Activer une grosse dépense (achat immo, etc.)
            </Label>
          </div>
          {Boolean(params.enableMajorExpense) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Année de la dépense — {params.majorExpenseYears ?? 10} ans
                </Label>
                <Slider
                  value={[Math.min(params.majorExpenseYears ?? 10, params.durationYears)]}
                  onValueChange={([v]) => update("majorExpenseYears", v)}
                  min={1}
                  max={params.durationYears}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Montant de la dépense</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={params.majorExpenseAmount || 0}
                    onChange={(e) => update("majorExpenseAmount", Number(e.target.value))}
                    className="pr-8 font-mono text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                </div>
              </div>
              <div className="sm:col-span-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Règles de financement appliquées</p>
                <p>Priorité cash ({`capital disponible`}) puis vente ETF si nécessaire.</p>
                <p>La plus-value latente ETF impacte aussi l'impôt estimé lors des ventes ETF (apport et grosse dépense).</p>
                <p>ETF pur: vente ETF ponctuelle au mois choisi (impôt sur la part de plus-value vendue).</p>
                <p>SCPI: la dépense déclenche une vente SCPI, remboursement anticipé du crédit (CRD + IRA standard), puis complément éventuel par vente ETF.</p>
                <p>Après vente SCPI, les loyers cessent ; l'effort mensuel continue vers ETF.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
