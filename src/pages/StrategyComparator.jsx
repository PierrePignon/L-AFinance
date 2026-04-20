import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GlobalParameters from "../components/comparator/GlobalParameters";
import StrategyCard from "../components/comparator/StrategyCard";
import ProjectionChart from "../components/comparator/ProjectionChart";
import SummaryTable from "../components/comparator/SummaryTable";
import AddStrategyDialog from "../components/comparator/AddStrategyDialog";
import {
  getDefaultGlobalParams,
  createStrategy,
} from "../lib/defaultStrategies";
import {
  calculateETF,
  calculateSCPILeverage,
  calculateRealEstate,
  calculateSavings,
  computeRealEstateCapacity,
  computeLoanCapacity,
  computeEffectiveETFCapital,
  computeRemainingCashAfterDownPayment,
  formatCurrency,
} from "../lib/investmentCalculations";

function computeProjection(strategy, globalParams, allStrategies) {
  const g = globalParams;
  const c = strategy.config;
  const creditDurationYears = g.creditDurationYears || g.durationYears;

  // Sum of all SCPI downpayments across sibling strategies
  const totalScpiDownPayment = allStrategies
    .filter(s => s.type === 'scpi')
    .reduce((sum, s) => sum + (s.config.scpiDownPayment || 0), 0);

  switch (strategy.type) {
    case "etf":
      return calculateETF({
        capitalInitial: g.capitalInitial,
        initialCapital: c.initialCapital,
        monthlyContribution: g.monthlySavings,
        etfBonusMonthlySavings: g.etfBonusMonthlySavings || 0,
        annualReturn: g.etfAnnualReturn,
        taxRate: g.taxRate,
        durationYears: g.durationYears,
        availableCash: g.capitalDisponible || 0,
        initialETFGainRate: g.currentETFGainRate || 0,
        enableMajorExpense: g.enableMajorExpense ?? false,
        majorExpenseYears: g.majorExpenseYears ?? g.durationYears,
        majorExpenseAmount: g.majorExpenseAmount ?? 0,
        etfScenario: g.etfScenario,
        etfRateConvention: g.etfRateConvention,
      });
    case "scpi": {
      const etfStartCapitalSCPI = computeEffectiveETFCapital(
        c.scpiDownPayment || 0,
        g.capitalInitial,
        g.capitalDisponible || 0,
        g.currentETFGainRate || 0,
        g.taxRate
      );
      return calculateSCPILeverage({
        capitalInitial: g.capitalInitial,
        etfStartCapital: etfStartCapitalSCPI,
        etfAnnualReturn: g.etfAnnualReturn,
        taxRateETF: g.taxRate,
        durationYears: g.durationYears,
        monthlySavings: g.monthlySavings,
        etfBonusMonthlySavings: g.etfBonusMonthlySavings || 0,
        creditRate: g.creditRate,
        creditDurationYears,
        scpiEntryFees: c.scpiEntryFees,
        scpiExitFees: c.scpiExitFees,
        scpiCapitalGainsTax: c.scpiCapitalGainsTax,
        scpiInitialYield: c.scpiInitialYield,
        scpiRentGrowth: c.scpiRentGrowth,
        scpiPropertyGrowth: c.scpiPropertyGrowth,
        scpiTaxOnRent: c.scpiTaxOnRent,
        scpiPaymentFrequency: c.scpiPaymentFrequency,
        scpiDownPayment: c.scpiDownPayment,
        availableCash: computeRemainingCashAfterDownPayment(c.scpiDownPayment || 0, g.capitalDisponible || 0),
        initialETFGainRate: g.currentETFGainRate || 0,
        scpiOccupancyRate: c.scpiOccupancyRate ?? 1,
        enableMajorExpense: g.enableMajorExpense ?? false,
        majorExpenseYears: g.majorExpenseYears ?? g.durationYears,
        majorExpenseAmount: g.majorExpenseAmount ?? 0,
        etfScenario: g.etfScenario,
        etfRateConvention: g.etfRateConvention,
      });
    }
    case "realEstate": {
      const propertyPrice = computeRealEstateCapacity({
        monthlySavings: g.monthlySavings,
        creditRate: g.creditRate,
        creditDurationYears,
        downPayment: c.downPayment || 0,
        notaryFees: c.notaryFees || 0.08,
      });
      const etfStartCapitalRE = computeEffectiveETFCapital(
        c.downPayment || 0,
        g.capitalInitial,
        g.capitalDisponible || 0,
        g.currentETFGainRate || 0,
        g.taxRate
      );
      return calculateRealEstate({
        capitalInitial: g.capitalInitial,
        etfStartCapital: etfStartCapitalRE,
        etfAnnualReturn: g.etfAnnualReturn,
        taxRateETF: g.taxRate,
        durationYears: g.durationYears,
        monthlySavings: g.monthlySavings,
        etfBonusMonthlySavings: g.etfBonusMonthlySavings || 0,
        creditRate: g.creditRate,
        creditDurationYears,
        propertyPrice,
        notaryFees: c.notaryFees || 0.08,
        downPayment: c.downPayment,
        rentalYield: c.rentalYield,
        maintenanceMonthly: c.maintenanceMonthly,
        taxeFonciere: c.taxeFonciere,
        rentIncreaseRate: c.rentIncreaseRate,
        rentIncreaseFrequencyYears: c.rentIncreaseFrequencyYears,
        propertyGrowth: c.propertyGrowth,
        vacancyRate: c.vacancyRate,
        taxOnRent: c.taxOnRent,
        propertyCapitalGainsTax: c.propertyCapitalGainsTax,
        surplusAllocation: c.surplusAllocation || 'etf',
        availableCash: computeRemainingCashAfterDownPayment(c.downPayment || 0, g.capitalDisponible || 0),
        initialETFGainRate: g.currentETFGainRate || 0,
        enableMajorExpense: g.enableMajorExpense ?? false,
        majorExpenseYears: g.majorExpenseYears ?? g.durationYears,
        majorExpenseAmount: g.majorExpenseAmount ?? 0,
        etfScenario: g.etfScenario,
        etfRateConvention: g.etfRateConvention,
      });
    }
    case "savings":
      return calculateSavings({
        capitalInitial: g.capitalInitial,
        monthlySavings: g.monthlySavings,
        durationYears: g.durationYears,
        enableMajorExpense: g.enableMajorExpense ?? false,
        majorExpenseYears: g.majorExpenseYears ?? g.durationYears,
        majorExpenseAmount: g.majorExpenseAmount ?? 0,
      });
    default:
      return [];
  }
}

const TYPE_LABELS = {
  etf: "ETF DCA",
  scpi: "SCPI + Levier",
  realEstate: "Immobilier locatif",
  savings: "Épargne non investie",
};

const ANALYSIS_SCENARIOS = [
  { value: "linear", label: "Linéaire" },
  { value: "crash_start", label: "Crash début" },
  { value: "crash_end", label: "Crash fin" },
  { value: "volatile", label: "Volatile" },
  { value: "sideways", label: "Cycle plat" },
  { value: "dotcom_2008", label: "Double crise" },
  { value: "stochastic_mild", label: "Aléatoire modéré" },
  { value: "stochastic_crisis", label: "Aléatoire crises" },
];
const SCENARIO_PROBABILITIES = {
  linear: 0.18,
  crash_start: 0.1,
  crash_end: 0.1,
  volatile: 0.14,
  sideways: 0.14,
  dotcom_2008: 0.1,
  stochastic_mild: 0.14,
  stochastic_crisis: 0.1,
};

export default function StrategyComparator() {
  const [globalParams, setGlobalParams] = useState(getDefaultGlobalParams);
  const [strategies, setStrategies] = useState(() => [
    createStrategy("etf"),
    createStrategy("scpi"),
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const savingsBaseline = useMemo(() => calculateSavings({
    capitalInitial: globalParams.capitalInitial,
    monthlySavings: globalParams.monthlySavings,
    durationYears: globalParams.durationYears,
    enableMajorExpense: globalParams.enableMajorExpense ?? false,
    majorExpenseYears: globalParams.majorExpenseYears ?? globalParams.durationYears,
    majorExpenseAmount: globalParams.majorExpenseAmount ?? 0,
  }), [globalParams]);

  const projections = useMemo(() => {
    return strategies
      .filter(s => s.type !== 'savings')
      .map((s) => ({
        name: s.name,
        type: TYPE_LABELS[s.type],
        data: computeProjection(s, globalParams, strategies),
      }));
  }, [strategies, globalParams]);

  const scenarioAnalysis = useMemo(() => {
    const activeStrategies = strategies.filter((s) => s.type !== "savings");
    const projectMonth = Math.min(
      Math.max(1, Math.round((globalParams.majorExpenseYears ?? globalParams.durationYears) * 12)),
      (globalParams.durationYears || 1) * 12
    );
    const projectIndex = Math.max(projectMonth - 1, 0);
    const beforeProjectIndex = Math.max(projectMonth - 2, 0);
    
    return activeStrategies.map((strategy) => {
      const byScenario = ANALYSIS_SCENARIOS.map((scenario) => {
        const data = computeProjection(strategy, { ...globalParams, etfScenario: scenario.value }, strategies);
        const dataAny = /** @type {any[]} */ (data);
        const finalPoint = dataAny[dataAny.length - 1] || null;
        const pointBeforeProject = dataAny[beforeProjectIndex] || finalPoint;
        const majorExpensePoint = dataAny.find((p) => (p.majorExpenseNetPaid || 0) > 0 || (p.majorExpenseUnfunded || 0) > 0) || finalPoint;
        
        const unfunded = majorExpensePoint?.majorExpenseUnfunded || 0;
        const paidByETF = Math.max((majorExpensePoint?.majorExpenseNetPaid || 0) - (majorExpensePoint?.majorExpenseFromCash || 0), 0);
        const stressRatio = globalParams.majorExpenseAmount > 0 ? paidByETF / globalParams.majorExpenseAmount : 0;
        const finalNet = finalPoint?.netValue || 0;
        
        // CORRECTION 1: Gestion de la vente SCPI
        // Si SCPI vendue au moment du projet, sa mensualité ne compte plus dans l'endettement
        const isSCPI = strategy.type === 'scpi';
        const scpiExited = isSCPI && majorExpensePoint?.scpiExitMonth != null && majorExpensePoint.scpiExitMonth <= projectMonth;
        
        // Si SCPI vendue, monthlyPayment de la stratégie = 0, sinon on prend celle du moment (avant vente)
        const strategyMonthlyPayment = scpiExited ? 0 : (pointBeforeProject?.monthlyPayment || 0);
        const monthlyDebtDuringProject = (globalParams.currentMonthlyDebt || 0) + strategyMonthlyPayment;
        
        // Revenu mensuel et DTI
        const monthlyIncome = (globalParams.annualIncome || 0) / 12;
        const maxDTI = 0.35;
        const maxBankMonthlyPayment = Math.max(0, monthlyIncome * maxDTI - monthlyDebtDuringProject);
        
        // CORRECTION 2: Limite d'âge réaliste (70 ans max à la fin du prêt)
        const currentAge = globalParams.currentAge || 35;
        const yearsElapsed = (globalParams.majorExpenseYears ?? globalParams.durationYears ?? 0);
        const ageAtProject = currentAge + yearsElapsed;
        const maxAgeEndLoan = 70; // Limite bancaire réaliste (65-70 ans)
        const maxLoanDurationYears = Math.max(0, Math.min(25, maxAgeEndLoan - ageAtProject));
        
        // Calcul du capital empruntable sur la durée restante
        const creditRate = globalParams.creditRate || 0;
        const isETF = strategy.type === "etf";

        const debtCapacity = !isETF && maxLoanDurationYears > 0 && maxBankMonthlyPayment > 0
          ? computeLoanCapacity(maxBankMonthlyPayment, creditRate, maxLoanDurationYears)
          : 0;
        
        return {
          scenario: scenario.value,
          scenarioLabel: scenario.label,
          finalNet,
          unfunded,
          stressRatio,
          debtCapacity,
          maxBankMonthlyPayment,
          maxLoanDurationYears,
          ageAtProject,
          scpiExitYear: majorExpensePoint?.scpiExitMonth ? Math.ceil(majorExpensePoint.scpiExitMonth / 12) : null,
          monthlyDebtDuringProject, // Pour debug
        };
      });
      
      const avgNet = byScenario.reduce((sum, s) => sum + s.finalNet, 0) / Math.max(byScenario.length, 1);
      const worst = byScenario.reduce((a, b) => (b.finalNet < a.finalNet ? b : a), byScenario[0]);
      const best = byScenario.reduce((a, b) => (b.finalNet > a.finalNet ? b : a), byScenario[0]);
      const anyUnfunded = byScenario.some((s) => s.unfunded > 0);
      const fundingRiskProb = byScenario.reduce((acc, s) => acc + (s.unfunded > 0 ? (SCENARIO_PROBABILITIES[s.scenario] || 0) : 0), 0);
      const avgStress = byScenario.reduce((sum, s) => sum + s.stressRatio, 0) / Math.max(byScenario.length, 1);
      const currentScenario = globalParams.etfScenario || "linear";
      const currentCase = byScenario.find((s) => s.scenario === currentScenario) || byScenario[0];
      
      return {
        id: strategy.id,
        name: strategy.name,
        type: strategy.type,
        byScenario,
        avgNet,
        worst,
        best,
        currentCase,
        anyUnfunded,
        fundingRiskProb,
        avgStress,
      };
    });
  }, [strategies, globalParams]);

  const etfScpiCrossovers = useMemo(() => {
    const etfStrategy = strategies.find((s) => s.type === "etf");
    const scpiStrategy = strategies.find((s) => s.type === "scpi");
    if (!etfStrategy || !scpiStrategy) return [];
    return ANALYSIS_SCENARIOS.map((scenario) => {
      const g = { ...globalParams, etfScenario: scenario.value };
      const etfData = computeProjection(etfStrategy, g, strategies);
      const scpiData = computeProjection(scpiStrategy, g, strategies);
      const length = Math.min(etfData.length, scpiData.length);
      let crossingYear = null;
      for (let i = 1; i < length; i++) {
        const prevDiff = (etfData[i - 1]?.netValue || 0) - (scpiData[i - 1]?.netValue || 0);
        const currDiff = (etfData[i]?.netValue || 0) - (scpiData[i]?.netValue || 0);
        if (prevDiff <= 0 && currDiff > 0) {
          crossingYear = Math.ceil((i + 1) / 12);
          break;
        }
      }
      const finalDiff = (etfData[length - 1]?.netValue || 0) - (scpiData[length - 1]?.netValue || 0);
      return {
        scenarioLabel: scenario.label,
        crossingYear,
        finalDiff,
        finalLeader: finalDiff >= 0 ? "ETF" : "SCPI",
      };
    });
  }, [strategies, globalParams]);

  const recommendation = useMemo(() => {
    if (!scenarioAnalysis.length) return null;
    const scored = scenarioAnalysis.map((s) => {
      const fundingPenalty = s.anyUnfunded ? 200000 : 0;
      const stressPenalty = s.avgStress * 30000;
      const score = s.avgNet + s.worst.finalNet * 0.4 - fundingPenalty - stressPenalty;
      return { ...s, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0];
  }, [scenarioAnalysis]);

  const decisionKpis = useMemo(() => {
    if (!scenarioAnalysis.length) return null;
    const currentScenario = globalParams.etfScenario || "linear";
    const bestAvg = scenarioAnalysis.reduce((a, b) => (b.avgNet > a.avgNet ? b : a), scenarioAnalysis[0]);
    const bestWorst = scenarioAnalysis.reduce((a, b) => (b.worst.finalNet > a.worst.finalNet ? b : a), scenarioAnalysis[0]);
    const bestCurrent = scenarioAnalysis.reduce((a, b) => {
      const aVal = a.byScenario.find((s) => s.scenario === currentScenario)?.finalNet || -Infinity;
      const bVal = b.byScenario.find((s) => s.scenario === currentScenario)?.finalNet || -Infinity;
      return bVal > aVal ? b : a;
    }, scenarioAnalysis[0]);
    return { bestAvg, bestWorst, bestCurrent, currentScenario };
  }, [scenarioAnalysis, globalParams.etfScenario]);

  const financingBadge = useMemo(() => {
    if (!globalParams.enableMajorExpense) {
      return { color: "bg-blue-50 text-blue-700 border-blue-200", text: "Info: active la grosse dépense pour noter la qualité de financement." };
    }
    const worstUnfunded = Math.max(...scenarioAnalysis.map((s) => s.worst.unfunded || 0), 0);
    if (worstUnfunded > 0) {
      return { color: "bg-red-50 text-red-700 border-red-200", text: "Projet à risque: financement incomplet en pire scénario." };
    }
    const worstStress = Math.max(...scenarioAnalysis.map((s) => s.avgStress || 0), 0);
    if (worstStress > 0.6) {
      return { color: "bg-amber-50 text-amber-800 border-amber-200", text: "Projet possible mais dépend fortement du marché." };
    }
    return { color: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "Projet financé sans stress dans les scénarios simulés." };
  }, [scenarioAnalysis, globalParams.enableMajorExpense]);

  const handleAddStrategy = (type) => {
    setStrategies((prev) => [...prev, createStrategy(type)]);
    setDialogOpen(false);
  };

  const handleUpdateStrategy = (index, updated) => {
    setStrategies((prev) => prev.map((s, i) => (i === index ? updated : s)));
  };

  const handleRemoveStrategy = (index) => {
    setStrategies((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">Comparateur de stratégies</h1>
              <p className="text-xs text-muted-foreground">ETF · SCPI · Immobilier</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ajouter une stratégie</span>
            <span className="sm:hidden">Ajouter</span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Tabs defaultValue="settings" className="space-y-4">
            <TabsList>
            <TabsTrigger value="settings">Onglet 1 - Paramètres</TabsTrigger>
            <TabsTrigger value="decision">Onglet 2 - Aide à la décision</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <GlobalParameters params={globalParams} onChange={setGlobalParams} />

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Stratégies ({strategies.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {strategies.map((s, i) => {
                  const proj = projections.find(p => p.name === s.name);
                  return (
                    <StrategyCard
                      key={s.id}
                      strategy={s}
                      globalParams={globalParams}
                      allStrategies={strategies}
                      onUpdate={(updated) => handleUpdateStrategy(i, updated)}
                      onRemove={() => handleRemoveStrategy(i)}
                      projection={proj ? proj.data : null}
                    />
                  );
                })}
                {strategies.length === 0 && (
                  <div className="col-span-full bg-card rounded-xl border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground mb-3">Aucune stratégie configurée</p>
                    <Button variant="outline" onClick={() => setDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Ajouter une stratégie
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <ProjectionChart projections={projections} savingsBaseline={savingsBaseline} />
              </div>
              <div>
                <SummaryTable projections={projections} globalParams={globalParams} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="decision" className="space-y-6">
            <div className="rounded-xl border p-4 bg-card space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Recommandation: {recommendation ? recommendation.name : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {recommendation
                  ? `Dans votre cas (horizon ${globalParams.durationYears} ans), cette stratégie offre le meilleur compromis performance moyenne / robustesse en pire scénario.`
                  : "Ajoutez des stratégies pour afficher une recommandation."}
              </p>
              {decisionKpis && (
                <p className="text-xs text-muted-foreground">
                  Scénario actuel ({ANALYSIS_SCENARIOS.find((s) => s.value === decisionKpis.currentScenario)?.label}): leader = <span className="font-medium text-foreground">{decisionKpis.bestCurrent.name}</span>. Ce n'est pas forcément le même que le leader en moyenne.
                </p>
              )}
              <div className={`inline-block rounded-md border px-2 py-1 text-xs font-medium ${financingBadge.color}`}>
                {financingBadge.text}
              </div>
            </div>

            {decisionKpis && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Leader scénario actuel</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{decisionKpis.bestCurrent.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Valeur nette: {formatCurrency(decisionKpis.bestCurrent.byScenario.find((s) => s.scenario === decisionKpis.currentScenario)?.finalNet || 0)}
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Leader moyen (tous scénarios)</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{decisionKpis.bestAvg.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Moyenne: {formatCurrency(decisionKpis.bestAvg.avgNet)}
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Leader en pire cas (robustesse)</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{decisionKpis.bestWorst.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pire cas: {formatCurrency(decisionKpis.bestWorst.worst.finalNet)}
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3">Écarts de performance par scénario</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-3">Stratégie</th>
                      {ANALYSIS_SCENARIOS.map((s) => <th key={s.value} className="py-2 pr-3">{s.label}</th>)}
                      <th className="py-2 pr-3">Moyenne</th>
                      <th className="py-2 pr-3">Pire cas</th>
                      <th className="py-2 pr-3">Risque financement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioAnalysis.map((row) => (
                      <tr key={row.id} className="border-b border-border/60">
                        <td className="py-2 pr-3 font-medium">{row.name}</td>
                        {row.byScenario.map((c) => (
                          <td key={c.scenario} className="py-2 pr-3 font-mono">{formatCurrency(c.finalNet)}</td>
                        ))}
                        <td className="py-2 pr-3 font-mono font-semibold">{formatCurrency(row.avgNet)}</td>
                        <td className="py-2 pr-3 font-mono text-destructive">{formatCurrency(row.worst.finalNet)}</td>
                        <td className="py-2 pr-3">
                          {globalParams.enableMajorExpense
                            ? `${Math.round(row.fundingRiskProb * 100)} %`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                La colonne "Risque financement" = probabilité estimée d'un financement incomplet, selon la pondération des scénarios.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scenarioAnalysis.map((row) => (
                <div key={`${row.id}-risk`} className="rounded-xl border bg-card p-4 space-y-2">
                  <p className="text-sm font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">Lecture globale (moyenne): <span className="font-medium text-foreground">{formatCurrency(row.avgNet)}</span></p>
                  <p className="text-xs text-muted-foreground">Scénario actuel: <span className="font-medium text-foreground">{formatCurrency(row.currentCase?.finalNet || 0)}</span></p>
                  <p className="text-xs text-muted-foreground">
                    Stress test (pire cas): <span className="font-medium text-foreground">{row.worst.scenarioLabel}</span> ({formatCurrency(row.worst.finalNet)})
                  </p>
                  {globalParams.enableMajorExpense ? (
                    <>
                      {row.worst.unfunded > 0 ? (
                        <p className="text-xs text-red-700">🔴 En pire scénario uniquement, il manque {formatCurrency(row.worst.unfunded)} pour financer la dépense.</p>
                      ) : row.avgStress > 0.6 ? (
                        <p className="text-xs text-amber-700">🟠 En stress test, le projet passe mais dépend du marché (vente ETF importante).</p>
                      ) : (
                        <p className="text-xs text-emerald-700">🟢 Même en stress test, projet financé sans tension majeure.</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Probabilité estimée d'un financement incomplet:{" "}
                        <span className="font-medium text-foreground">
                          {Math.round(row.fundingRiskProb * 100)} %
                        </span>
                      </p>
                      
                      {/* ICI : Affichage de la capacité d'emprunt corrigée */}
                      <p className="text-xs text-muted-foreground">
                        Endettement projet (scénario actuel):{" "}
                        {row.currentCase?.debtCapacity > 0 ? (
                          <span className="font-medium text-foreground">
                            {formatCurrency(row.currentCase.debtCapacity)} 
                            <span className="text-xs text-muted-foreground ml-1">
                              (sur {row.currentCase.maxLoanDurationYears} ans max, 
                              mensualité dispo {formatCurrency(row.currentCase.maxBankMonthlyPayment)}/mois)
                            </span>
                          </span>
                        ) : row.currentCase?.maxLoanDurationYears <= 0 ? (
                          <span className="font-medium text-red-700">
                            Âge limite dépassé (70 ans) pour un nouveau crédit
                          </span>
                        ) : (
                          <span className="font-medium text-red-700">
                            Impossible de s'endetter davantage sans dépasser 35% DTI
                          </span>
                        )}
                      </p>
                      
                      {/* Info debug sur l'âge si besoin */}
                      <p className="text-[10px] text-muted-foreground/60">
                        Âge au projet: {row.currentCase?.ageAtProject} ans
                        {row.type === 'scpi' && row.currentCase?.scpiExitYear && (
                          <> • Sortie SCPI année {row.currentCase.scpiExitYear}</>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Active la grosse dépense pour obtenir un verdict de financement.</p>
                  )}
                  {row.type === "scpi" && row.worst.scpiExitYear && row.worst.scpiExitYear < (globalParams.creditDurationYears || globalParams.durationYears) ? (
                    <p className="text-xs text-amber-700">⚠️ Vente anticipée pendant le crédit: la rentabilité est pénalisée par le coût du levier.</p>
                  ) : row.type === "scpi" ? (
                    <p className="text-xs text-emerald-700">✅ Sortie tardive: le levier a eu plus de temps pour travailler.</p>
                  ) : null}
                </div>
              ))}
            </div>

            {etfScpiCrossovers.length > 0 && (
              <div className="rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3">Basculement ETF vs SCPI (par scénario)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="py-2 pr-3">Scénario</th>
                        <th className="py-2 pr-3">Année de bascule ETF &gt; SCPI</th>
                        <th className="py-2 pr-3">Leader final</th>
                        <th className="py-2 pr-3">Écart final ETF - SCPI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etfScpiCrossovers.map((row) => (
                        <tr key={row.scenarioLabel} className="border-b border-border/60">
                          <td className="py-2 pr-3">{row.scenarioLabel}</td>
                          <td className="py-2 pr-3 font-mono">{row.crossingYear != null ? `${row.crossingYear} ans` : "Aucune bascule"}</td>
                          <td className="py-2 pr-3">{row.finalLeader}</td>
                          <td className={`py-2 pr-3 font-mono ${row.finalDiff >= 0 ? "text-emerald-700" : "text-amber-700"}`}>{formatCurrency(row.finalDiff)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AddStrategyDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={handleAddStrategy} />
    </div>
  );
}
