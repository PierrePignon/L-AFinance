let strategyCounter = 0;

export function getDefaultConfig(type) {
  switch (type) {
    case "etf":
      return {
        initialCapital: null, // null = use globalParams.capitalInitial
      };
    case "scpi":
      return {
        scpiDownPayment: 0,
        scpiOccupancyRate: 1,
        scpiEntryFees: 0,
        scpiExitFees: 0.10,
        scpiCapitalGainsTax: 0.30,
        scpiInitialYield: 0.0471,
        scpiRentGrowth: 0.01,
        scpiPropertyGrowth: 0.01,
        scpiTaxOnRent: 0.25,
        scpiPaymentFrequency: 4,
      };
    case "realEstate":
      return {
        surplusAllocation: 'etf', // 'etf' ou 'credit'
        propertyPrice: 200000,
        downPayment: 0,
        notaryFees: 0.08,
        rentalYield: 0.05,
        maintenanceMonthly: 0,
        taxeFonciere: 0,
        rentIncreaseRate: 0.05,
        rentIncreaseFrequencyYears: 5,
        propertyGrowth: 0.02,
        vacancyRate: 0.05,
        taxOnRent: 0.30,
        propertyCapitalGainsTax: 0.30,
      };
    default:
      return {};
  }
}

const LABELS = {
  etf: "ETF DCA",
  scpi: "SCPI + Levier",
  realEstate: "Immobilier locatif",
  savings: "Épargne non investie",
};

export function createStrategy(type) {
  strategyCounter++;
  return {
    id: `strat-${Date.now()}-${strategyCounter}`,
    type,
    name: `${LABELS[type]} #${strategyCounter}`,
    config: getDefaultConfig(type),
  };
}

export function getDefaultGlobalParams() {
  // Calcule l'effort calibré à 35% DTI pour SCPI avec durée=20ans, taux=3%
  const annualIncome = 32907;
  const currentMonthlyDebt = 700;
  const creditRate = 0.03;
  const creditDurationYears = 20;
  const durationYears = 20;
  const maxCreditPayment = Math.max(0, annualIncome / 12 * 0.35 - currentMonthlyDebt);
  const r = creditRate / 12;
  const n = creditDurationYears * 12;
  const pmtFactor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const scpiYieldNetMonthly = 0.0471 * (1 - 0.25) / 12;
  const denominator = pmtFactor - scpiYieldNetMonthly;
  const monthlySavings = Math.round(maxCreditPayment * denominator / pmtFactor);

  return {
    capitalInitial: 80000,
    capitalDisponible: 0,
    currentETFGainRate: 0,
    etfBonusMonthlySavings: 0,
    creditDurationYears,
    durationYears,
    monthlySavings,
    creditRate,
    annualIncome,
    currentMonthlyDebt,
    currentAge: 35,
    etfAnnualReturn: 0.08,
    etfRateConvention: 'effective',
    taxRate: 0.30,
    etfScenario: 'linear',
    enableMajorExpense: false,
    majorExpenseYears: 10,
    majorExpenseAmount: 0,
  };
}
