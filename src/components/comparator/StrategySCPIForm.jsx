import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { computeSCPILoanCapacity, computeEffectiveETFCapital, formatCurrency } from "@/lib/investmentCalculations";
import { Lock } from "lucide-react";

function ReadOnlyField({ label, value, hint = null }) {
  return (
    <div className="space-y-2">
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

export default function StrategySCPIForm({ config, globalParams, onChange }) {
  const update = (key, value) => onChange({ ...config, [key]: value });
  const creditDurationYears = globalParams.creditDurationYears || globalParams.durationYears;

  // effort = credit payment - net rents => solve for loan
  const occupancy = config.scpiOccupancyRate ?? 1;
  const effectiveYield = (config.scpiInitialYield || 0) * occupancy;
  const loanAmount = computeSCPILoanCapacity(
    globalParams.monthlySavings,
    globalParams.creditRate,
    creditDurationYears,
    effectiveYield,
    config.scpiTaxOnRent || 0,
    config.scpiDownPayment || 0
  );
  const scpiPrice = loanAmount + (config.scpiDownPayment || 0);
  const creditN = creditDurationYears * 12;
  const creditR = globalParams.creditRate / 12;
  const monthlyPayment = loanAmount > 0
    ? (creditR === 0 ? loanAmount / creditN : loanAmount * creditR * Math.pow(1 + creditR, creditN) / (Math.pow(1 + creditR, creditN) - 1))
    : 0;
  const annualRentEstimate = scpiPrice * (config.scpiInitialYield || 0) * occupancy;
  const monthlyRentNet = (annualRentEstimate * (1 - (config.scpiTaxOnRent || 0))) / 12;
  const effectiveMonthlyEffort = Math.max(0, monthlyPayment - monthlyRentNet);

  const etfStartCapital = computeEffectiveETFCapital(
    config.scpiDownPayment || 0,
    globalParams.capitalInitial,
    globalParams.capitalDisponible || 0,
    globalParams.currentETFGainRate || 0,
    globalParams.taxRate
  );
  const capitalDeducted = globalParams.capitalInitial - etfStartCapital;

  return (
    <div className="space-y-4">
      {/* Computed info box */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg border border-dashed border-border">
        <ReadOnlyField
          label="Prix du bien"
          value={formatCurrency(scpiPrice)}
          hint="= capacité emprunt + apport"
        />
        <ReadOnlyField
          label="Montant emprunté"
          value={formatCurrency(loanAmount)}
          hint="hors apport"
        />
        <ReadOnlyField
          label="Mensualité crédit"
          value={`${formatCurrency(monthlyPayment)}/mois`}
        />
        <ReadOnlyField
          label="Loyer net mensuel"
          value={`${formatCurrency(monthlyRentNet)}/mois`}
          hint="après fiscalité"
        />
        <ReadOnlyField
          label="Rendement effectif"
          value={`${((config.scpiInitialYield || 0) * occupancy * 100).toFixed(2)} %`}
          hint={`plaquette ${((config.scpiInitialYield || 0) * 100).toFixed(2)}% × occupation ${(occupancy * 100).toFixed(0)}%`}
        />
        <ReadOnlyField
          label="Effort net réel"
          value={`${formatCurrency(effectiveMonthlyEffort)}/mois`}
          hint="= crédit − loyers nets"
        />
        <ReadOnlyField
          label="Capital ETF de départ"
          value={formatCurrency(etfStartCapital)}
          hint={capitalDeducted > 0 ? `−${formatCurrency(capitalDeducted)} (apport prélevé)` : 'aucun prélèvement'}
        />
        {globalParams.annualIncome > 0 && (() => {
          const monthlyIncome = globalParams.annualIncome / 12;
          const newDebt = (globalParams.currentMonthlyDebt || 0) + monthlyPayment;
          const ratio = newDebt / monthlyIncome;
          const over = ratio > 0.35;
          return (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Lock className="h-3 w-3" /> Taux d'endettement avec SCPI
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Taux d'occupation réel</Label>
          <div className="relative">
            <Input type="number" step="0.1" min="0" max="100" value={((config.scpiOccupancyRate ?? 1) * 100).toFixed(1)} onChange={(e) => update("scpiOccupancyRate", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">100% = rendement plaquette. Baisser pour stress-tester.</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Apport SCPI</Label>
          <div className="relative">
            <Input type="number" value={config.scpiDownPayment} onChange={(e) => update("scpiDownPayment", Number(e.target.value))} className="pr-8 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rendement initial SCPI</Label>
          <div className="relative">
            <Input type="number" step="0.01" value={(config.scpiInitialYield * 100).toFixed(2)} onChange={(e) => update("scpiInitialYield", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fiscalité loyers SCPI</Label>
          <div className="relative">
            <Input type="number" step="0.01" value={(config.scpiTaxOnRent * 100).toFixed(2)} onChange={(e) => update("scpiTaxOnRent", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Flat tax plus-values SCPI</Label>
          <div className="relative">
            <Input type="number" step="0.01" value={((config.scpiCapitalGainsTax || 0) * 100).toFixed(2)} onChange={(e) => update("scpiCapitalGainsTax", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
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
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Frais d'entrée</Label>
                <div className="relative">
                  <Input type="number" step="0.01" value={(config.scpiEntryFees * 100).toFixed(2)} onChange={(e) => update("scpiEntryFees", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Frais de sortie</Label>
                <div className="relative">
                  <Input type="number" step="0.01" value={(config.scpiExitFees * 100).toFixed(2)} onChange={(e) => update("scpiExitFees", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Croissance loyers / an</Label>
                <div className="relative">
                  <Input type="number" step="0.01" value={(config.scpiRentGrowth * 100).toFixed(2)} onChange={(e) => update("scpiRentGrowth", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revalorisation foncière / an</Label>
                <div className="relative">
                  <Input type="number" step="0.01" value={(config.scpiPropertyGrowth * 100).toFixed(2)} onChange={(e) => update("scpiPropertyGrowth", Number(e.target.value) / 100)} className="pr-8 font-mono text-sm" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fréquence loyers / an</Label>
                <Input type="number" value={config.scpiPaymentFrequency} onChange={(e) => update("scpiPaymentFrequency", Number(e.target.value))} className="font-mono text-sm" />
              </div>
              <div className="space-y-2 opacity-60">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Flat tax ETF
                </Label>
                <div className="h-9 px-3 flex items-center rounded-md bg-muted/60 border border-border font-mono text-sm">
                  {((globalParams?.taxRate ?? 0.30) * 100).toFixed(2)} % (paramètres communs)
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
