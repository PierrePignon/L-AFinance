import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3 } from "lucide-react";
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
  computeEffectiveETFCapital,
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
        annualReturn: g.etfAnnualReturn,
        taxRate: g.taxRate,
        durationYears: g.durationYears,
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
        {/* Global Parameters */}
        <GlobalParameters params={globalParams} onChange={setGlobalParams} />

        {/* Strategies */}
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

        {/* Chart & Summary */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <ProjectionChart projections={projections} savingsBaseline={savingsBaseline} />
          </div>
          <div>
            <SummaryTable projections={projections} globalParams={globalParams} />
          </div>
        </div>
      </main>

      <AddStrategyDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={handleAddStrategy} />
    </div>
  );
}
