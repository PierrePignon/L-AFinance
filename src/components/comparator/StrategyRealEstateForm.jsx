import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { computeLoanPayment, computeRealEstateCapacity, formatCurrency } from "@/lib/investmentCalculations";
import { computeEffectiveETFCapital } from "@/lib/investmentCalculations";
import { Lock, AlertTriangle } from "lucide-react";

function ReadOnlyField({ label, value, hint }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <Lock className="h-3 w-3" /> {label}
      </Label>
      <div className="h-9 px-3 flex items-center rounded-md bg-muted/60 border border-border font-mono text-sm text-foreground/70">
        {value}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function StrategyRealEstateForm({ config, globalParams, onChange, projection }) {
  const update = (key, value) => onChange({ ...config, [key]: value });
  const creditDurationYears = globalParams.creditDurationYears || globalParams.durationYears;

  // Prix du bien calculé de façon à ce que l'effort net = monthlySavings
  const propertyPrice = computeRealEstateCapacity({
    monthlySavings: globalParams.monthlySavings,
    creditRate: globalParams.creditRate,
    creditDurationYears,
    downPayment: config.downPayment || 0,
    notaryFees: config.notaryFees || 0.08,
  });

  const loanAmount = Math.max(propertyPrice * (1 + (config.notaryFees || 0.08)) - (config.downPayment || 0), 0);
  const monthlyPayment = computeLoanPayment(loanAmount, globalParams.creditRate, creditDurationYears);
  const monthlyRentBrut = propertyPrice * (config.rentalYield || 0) / 12;
  const grossRentAfterVacancy = monthlyRentBrut * (1 - (config.vacancyRate || 0));
  const netRentBeforeTax = grossRentAfterVacancy - (config.maintenanceMonthly || 0) - (config.taxeFonciere || 0) / 12;
  const netRent = netRentBeforeTax - Math.max(netRentBeforeTax, 0) * (config.taxOnRent || 0);
  // Versement mensuel vers ETF = effort - mensualité crédit + loyer net
  // (peut être négatif si charges élevées : on pioche dans l'ETF)
  const monthlyToETF = globalParams.monthlySavings - monthlyPayment + netRent;
  const etfDeficit = monthlyToETF < 0;

  // Vrai coût de l'apport : cash d'abord, puis liquidation ETF (avec impôt sur PV)
  const dp = config.downPayment || 0;
  const fromCash = Math.min(dp, globalParams.capitalDisponible || 0);
  const fromETF = dp - fromCash;
  const gainRate = globalParams.currentETFGainRate || 0;
  const grossToSell = (fromETF > 0 && gainRate > 0)
    ? fromETF / (1 - gainRate * (globalParams.taxRate || 0.30))
    : fromETF;
  const taxPaidOnLiquidation = grossToSell - fromETF;
  const trueCostApport = fromCash + grossToSell;
  const etfStartCapital = computeEffectiveETFCapital(
    dp,
    globalParams.capitalInitial,
    globalParams.capitalDisponible || 0,
    gainRate,
    globalParams.taxRate || 0.30
  );

  const lastPoint = projection && projection.length > 0 ? projection[projection.length - 1] : null;
  const finalETFNet = lastPoint ? lastPoint.etfNet : null;
  const etfGoesNegative = projection && projection.some(p => p.etfNet < 0);
  const firstNegativeMonth = etfGoesNegative ? projection.find(p => p.etfNet < 0) : null;

  return (
    <div className="space-y-4">
      {/* Alerte ETF négatif */}
      {etfGoesNegative && firstNegativeMonth && (
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-300 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">⚠ Faillite ETF au mois {firstNegativeMonth.month} (an {firstNegativeMonth.year})</p>
            <p className="text-xs text-red-600">Le portefeuille ETF tombe en négatif — les charges dépassent les revenus et le capital disponible.</p>
          </div>
        </div>
      )}

      {/* Récap calculé */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border border-dashed border-border">
        <ReadOnlyField label="Prix du bien (calculé)" value={formatCurrency(propertyPrice)} hint="= (emprunt max + apport) / (1 + notaire)" />
        <ReadOnlyField label="Mensualité crédit" value={`${formatCurrency(monthlyPayment)}/mois`} />
        <ReadOnlyField label="Effort d'épargne mensuel" value={`${formatCurrency(globalParams.monthlySavings)}/mois`} hint="paramètre commun (fixe)" />
        <ReadOnlyField label="Capital ETF de départ" value={formatCurrency(etfStartCapital)} hint={dp > 0 ? `après prélèvement de l'apport sur le portefeuille ETF` : 'aucun apport prélevé'} />
        {finalETFNet != null && (
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Lock className="h-3 w-3" /> ETF final (projection)
            </Label>
            <div className={`h-9 px-3 flex items-center rounded-md border font-mono text-sm font-semibold ${
              finalETFNet < 0 ? 'bg-red-50 border-red-300 text-red-700' : 'bg-green-50 border-green-300 text-green-700'
            }`}>
              {formatCurrency(finalETFNet)}
            </div>
            <p className="text-xs text-muted-foreground">valeur nette ETF à la fin de la période</p>
          </div>
        )}
        <ReadOnlyField label="Loyer brut" value={`${formatCurrency(monthlyRentBrut)}/mois`} />
        <ReadOnlyField label="Loyer net (après charges & impôts)" value={`${formatCurrency(netRent)}/mois`} />
        {dp > 0 && (
          <ReadOnlyField
            label="Vrai coût de l'apport"
            value={formatCurrency(trueCostApport)}
            hint={taxPaidOnLiquidation > 0
              ? `dont ${formatCurrency(taxPaidOnLiquidation)} d'impôts sur PV ETF liquidés`
              : fromCash >= dp ? 'entièrement financé par le cash disponible' : 'sans impôt (pas de PV latente)'}
          />
        )}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Lock className="h-3 w-3" /> {etfDeficit ? '⚠ Déficit mensuel (pioche ETF)' : 'Versement mensuel → ETF'}
          </Label>
          <div className={`h-9 px-3 flex items-center rounded-md border font-mono text-sm font-semibold ${
            etfDeficit ? 'bg-red-50 border-red-300 text-red-600' : 'bg-muted/60 border-border text-foreground/70'
          }`}>
            {formatCurrency(monthlyToETF)}/mois
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(globalParams.monthlySavings)} effort − {formatCurrency(monthlyPayment)} crédit + {formatCurrency(netRent)} loyer net
          </p>
        </div>
        {globalParams.annualIncome > 0 && (() => {
          const monthlyIncome = globalParams.annualIncome / 12;
          const newDebt = (globalParams.currentMonthlyDebt || 0) + monthlyPayment;
          const ratio = newDebt / monthlyIncome;
          const over = ratio > 0.35;
          return (
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Lock className="h-3 w-3" /> Taux d'endettement avec crédit immo
              </Label>
              <div className={`h-9 px-3 flex items-center rounded-md border font-mono text-sm font-semibold ${
                over ? 'bg-red-50 border-red-300 text-red-600' : 'bg-muted/60 border-border text-foreground/70'
              }`}>
                {(ratio * 100).toFixed(1)} % {over ? '⚠ > 35 %' : '✓'}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Choix allocation surplus */}
      <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Surplus mensuel →</span>
        <div className="flex gap-2">
          <button
            onClick={() => update('surplusAllocation', 'etf')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              (config.surplusAllocation || 'etf') === 'etf'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            📈 Investir dans ETF
          </button>
          <button
            onClick={() => update('surplusAllocation', 'credit')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              config.surplusAllocation === 'credit'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            🏦 Rembourser crédit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Rentabilité brute — paramètre clé */}
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rentabilité brute</Label>
          <div className="relative">
            <Input
              type="number" step="0.1"
              value={((config.rentalYield || 0) * 100).toFixed(1)}
              onChange={(e) => update("rentalYield", Number(e.target.value) / 100)}
              className="pr-8 font-mono text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">Loyer annuel / prix du bien</p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Apport</Label>
          <div className="relative">
            <Input
              type="number"
              value={config.downPayment || 0}
              onChange={(e) => update("downPayment", Number(e.target.value))}
              className="pr-8 font-mono text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Charges mensuelles</Label>
          <div className="relative">
            <Input
              type="number"
              value={config.maintenanceMonthly || 0}
              onChange={(e) => update("maintenanceMonthly", Number(e.target.value))}
              className="pr-16 font-mono text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€/mois</span>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Taxe foncière</Label>
          <div className="relative">
            <Input
              type="number"
              value={config.taxeFonciere || 0}
              onChange={(e) => update("taxeFonciere", Number(e.target.value))}
              className="pr-10 font-mono text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€/an</span>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fiscalité revenus locatifs</Label>
          <div className="relative">
            <Input
              type="number" step="1"
              value={Math.round((config.taxOnRent || 0) * 100)}
              onChange={(e) => update("taxOnRent", Number(e.target.value) / 100)}
              className="pr-8 font-mono text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Flat tax plus-values immo</Label>
          <div className="relative">
            <Input
              type="number" step="1"
              value={Math.round((config.propertyCapitalGainsTax || 0) * 100)}
              onChange={(e) => update("propertyCapitalGainsTax", Number(e.target.value) / 100)}
              className="pr-8 font-mono text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced" className="border-none">
          <AccordionTrigger className="text-xs text-muted-foreground hover:no-underline py-2">
            Paramètres avancés
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Frais de notaire</Label>
                <div className="relative">
                  <Input type="number" step="0.5" value={((config.notaryFees || 0.08) * 100).toFixed(1)} onChange={(e) => update("notaryFees", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vacance locative</Label>
                <div className="relative">
                  <Input type="number" step="1" value={Math.round((config.vacancyRate || 0) * 100)} onChange={(e) => update("vacancyRate", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revalorisation foncière / an</Label>
                <div className="relative">
                  <Input type="number" step="0.5" value={((config.propertyGrowth || 0.02) * 100).toFixed(1)} onChange={(e) => update("propertyGrowth", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hausse loyers</Label>
                <div className="relative">
                  <Input type="number" step="0.5" value={((config.rentIncreaseRate || 0.05) * 100).toFixed(1)} onChange={(e) => update("rentIncreaseRate", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fréquence hausse loyers</Label>
                <div className="relative">
                  <Input type="number" min="1" value={config.rentIncreaseFrequencyYears || 5} onChange={(e) => update("rentIncreaseFrequencyYears", Number(e.target.value))} className="pr-10 font-mono text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ans</span>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
