/**
 * Investment projection calculation engine.
 * Produces monthly arrays for each strategy type.
 */

// Monthly rate from annual rate
function monthlyRate(annualRate) {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

function monthlyRateFromAnnualForETF(annualRate, rateConvention = 'effective') {
  return rateConvention === 'nominal' ? annualRate / 12 : monthlyRate(annualRate);
}

// PMT formula (monthly payment for a loan)
function pmt(rate, nper, pv) {
  if (rate === 0) return pv / nper;
  return (pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
}

function sellETFForNetAmount(etfCapital, etfTotalInvested, netNeeded, taxRate) {
  if (netNeeded <= 0 || etfCapital <= 0) {
    return {
      etfCapital,
      etfTotalInvested,
      grossSold: 0,
      taxPaid: 0,
      netRaised: 0,
    };
  }
  const etfGain = Math.max(etfCapital - etfTotalInvested, 0);
  const etfGainRatio = etfCapital > 0 ? etfGain / etfCapital : 0;
  const effectiveTaxRateOnSale = etfGainRatio * taxRate;
  const netPerGross = Math.max(1 - effectiveTaxRateOnSale, 1e-9);
  const grossSold = Math.min(etfCapital, netNeeded / netPerGross);
  const taxPaid = grossSold * effectiveTaxRateOnSale;
  const netRaised = grossSold - taxPaid;
  const etfCostBasisRatio = etfCapital > 0 ? (etfTotalInvested / etfCapital) : 0;
  const etfCostBasisSold = grossSold * etfCostBasisRatio;

  return {
    etfCapital: Math.max(etfCapital - grossSold, 0),
    etfTotalInvested: Math.max(etfTotalInvested - etfCostBasisSold, 0),
    grossSold,
    taxPaid,
    netRaised,
  };
}

// Generate monthly return sequence based on market scenario
function generateMonthlyReturns(annualReturn, months, scenario = 'linear', rateConvention = 'effective') {
  const years = Math.ceil(months / 12);
  let yearlyReturns;

  if (scenario === 'crash_start') {
    const target = Math.pow(1 + annualReturn, years);
    const n = Math.min(2, years);
    const crashR = -0.30;
    const crashFactor = Math.pow(1 + crashR, n);
    const recovR = years - n > 0 ? Math.pow(target / crashFactor, 1 / (years - n)) - 1 : annualReturn;
    yearlyReturns = Array.from({ length: years }, (_, y) => y < n ? crashR : recovR);
  } else if (scenario === 'crash_end') {
    const target = Math.pow(1 + annualReturn, years);
    const n = Math.min(2, years);
    const crashR = -0.30;
    const crashFactor = Math.pow(1 + crashR, n);
    const growR = years - n > 0 ? Math.pow(target / crashFactor, 1 / (years - n)) - 1 : annualReturn;
    yearlyReturns = Array.from({ length: years }, (_, y) => y >= years - n ? crashR : growR);
  } else if (scenario === 'volatile') {
    const amp = Math.abs(annualReturn) * 1.5;
    yearlyReturns = Array.from({ length: years }, (_, y) => annualReturn + (y % 2 === 0 ? amp : -amp));
  } else {
    yearlyReturns = Array(years).fill(annualReturn);
  }

  return Array.from({ length: months }, (_, m) => {
    const yr = Math.min(Math.floor(m / 12), years - 1);
    return monthlyRateFromAnnualForETF(yearlyReturns[yr], rateConvention);
  });
}

// Compute effective ETF starting capital after deducting a down payment
// Priority: cash first, then ETF liquidation (with tax on gains)
export function computeEffectiveETFCapital(downPayment, capitalInitial, capitalDisponible, currentETFGainRate, taxRate) {
  const dp = downPayment || 0;
  if (dp <= 0) return capitalInitial;
  const fromCash = Math.min(dp, capitalDisponible || 0);
  const fromETF = dp - fromCash;
  if (fromETF <= 0) return capitalInitial;
  const gainRate = currentETFGainRate || 0;
  // To get `fromETF` net: gross = fromETF / (1 - gainRate * taxRate)
  const grossToSell = gainRate > 0 ? fromETF / (1 - gainRate * taxRate) : fromETF;
  return Math.max(0, capitalInitial - grossToSell);
}

// Exported helper for UI display
export function computeLoanPayment(loanAmount, creditRate, creditDurationYears) {
  if (loanAmount <= 0) return 0;
  return pmt(creditRate / 12, creditDurationYears * 12, loanAmount);
}

// Inverse PMT: how much can I borrow given a monthly payment?
export function computeLoanCapacity(monthlyPayment, creditRate, creditDurationYears) {
  const r = creditRate / 12;
  const n = creditDurationYears * 12;
  if (r === 0) return monthlyPayment * n;
  return monthlyPayment * (1 - Math.pow(1 + r, -n)) / r;
}

/**
 * SCPI: solve for loanAmount such that:
 *   effort = pmt(loan) - loan * yieldNet / 12
 * The downpayment buys additional SCPI shares independently (does not affect loan sizing).
 * => loan * (pmtFactor - yieldNet/12) = effort
 */
export function computeSCPILoanCapacity(monthlySavings, creditRate, creditDurationYears, scpiInitialYield, scpiTaxOnRent, scpiDownPayment) {
  const r = creditRate / 12;
  const n = creditDurationYears * 12;
  const pmtFactor = r === 0 ? 1 / n : (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const yieldNetMonthly = scpiInitialYield * (1 - scpiTaxOnRent) / 12;
  const denominator = pmtFactor - yieldNetMonthly;
  if (denominator <= 0) return 0;
  return monthlySavings / denominator;
}

/**
 * Real Estate: solve for propertyPrice such that:
 *   effort = pmt(loan) - netRent
 * where loan = propertyPrice*(1+notaryFees) - downPayment
 * and netRent = propertyPrice*rentalYield/12*(1-vacancyRate)*(1-taxOnRent) - fixedCosts*(1-taxOnRent)
 */
export function computeRealEstateCapacity({
  monthlySavings, creditRate, creditDurationYears, downPayment = 0,
  notaryFees = 0.08,
}) {
  // Prix = (emprunt max + apport) / (1 + frais notaire)
  // Emprunt max = ce qu'on peut emprunter avec l'effort d'épargne pur
  // Les loyers et charges n'affectent PAS le prix — ils impactent uniquement le versement ETF
  const loanMax = computeLoanCapacity(monthlySavings, creditRate, creditDurationYears);
  return (loanMax + downPayment) / (1 + notaryFees);
}

/**
 * ETF DCA Strategy
 */
export function calculateETF({
  capitalInitial, initialCapital, monthlyContribution, annualReturn, taxRate, durationYears,
  enableMajorExpense = false, majorExpenseYears, majorExpenseAmount = 0,
  etfScenario = 'linear', etfRateConvention = 'effective'
}) {
  const months = durationYears * 12;
  const majorExpenseMonth = enableMajorExpense
    ? Math.min(Math.max(1, Math.round((majorExpenseYears ?? durationYears) * 12)), months)
    : null;
  const startCapital = (initialCapital != null && initialCapital >= 0) ? initialCapital : capitalInitial;
  const monthlyReturns = generateMonthlyReturns(annualReturn, months, etfScenario, etfRateConvention);
  const results = [];

  let capital = startCapital;
  let totalInvested = startCapital;

  for (let m = 1; m <= months; m++) {
    const mr = monthlyReturns[m - 1];
    capital = (capital + monthlyContribution) * (1 + mr);
    totalInvested += monthlyContribution;

    let majorExpenseTaxPaid = 0;
    let majorExpenseNetPaid = 0;
    if (majorExpenseMonth && m === majorExpenseMonth && majorExpenseAmount > 0) {
      const sale = sellETFForNetAmount(capital, totalInvested, majorExpenseAmount, taxRate);
      capital = sale.etfCapital;
      totalInvested = sale.etfTotalInvested;
      majorExpenseTaxPaid = sale.taxPaid;
      majorExpenseNetPaid = sale.netRaised;
    }

    const isLastMonth = m === months;
    const gain = Math.max(capital - totalInvested, 0);
    const tax = isLastMonth ? gain * taxRate : 0;
    const netValue = capital - tax;

    results.push({
      month: m,
      year: Math.ceil(m / 12),
      capitalBrut: capital,
      totalInvested,
      gain,
      tax,
      majorExpenseTaxPaid,
      majorExpenseNetPaid,
      netValue,
    });
  }
  return results;
}

/**
 * SCPI + Leverage Strategy (ETF for remaining capital + SCPI financed by credit)
 */
export function calculateSCPILeverage({
  capitalInitial,
  etfStartCapital,
  etfAnnualReturn,
  taxRateETF,
  durationYears,
  monthlySavings,
  creditRate,
  creditDurationYears,
  scpiEntryFees,
  scpiExitFees,
  scpiInitialYield,
  scpiRentGrowth,
  scpiPropertyGrowth,
  scpiTaxOnRent,
  scpiPaymentFrequency,
  scpiDownPayment,
  enableMajorExpense = false,
  majorExpenseYears,
  majorExpenseAmount = 0,
  scpiOccupancyRate = 1,
  scpiCapitalGainsTax = 0,
  etfScenario = 'linear',
  etfRateConvention = 'effective',
}) {
  const etfInitCapital = etfStartCapital != null ? etfStartCapital : capitalInitial;
  // Utiliser le rendement effectif (plaquette × occupation) pour que le prêt soit cohérent avec l'effort réel
  const loanAmount = computeSCPILoanCapacity(monthlySavings, creditRate, creditDurationYears, scpiInitialYield * scpiOccupancyRate, scpiTaxOnRent, scpiDownPayment);
  const scpiPrice = loanAmount + (scpiDownPayment || 0);
  const months = durationYears * 12;
  const creditMonths = creditDurationYears * 12;
  const creditMonthlyRate = creditRate / 12;
  const monthlyPayment = pmt(creditMonthlyRate, creditMonths, loanAmount);
  const scpiCostBasis = scpiPrice * (1 - scpiEntryFees);
  const monthlyReturnsETF = generateMonthlyReturns(etfAnnualReturn, months, etfScenario, etfRateConvention);
  const majorExpenseMonth = enableMajorExpense
    ? Math.min(Math.max(1, Math.round((majorExpenseYears ?? durationYears) * 12)), months)
    : null;

  const results = [];
  let etfCapital = etfInitCapital;
  let etfTotalInvested = etfInitCapital;
  let etfCashflowInvested = 0;
  let etfReinvestedFromSCPISale = 0;
  let cashReserve = 0;
  let scpiValue = scpiCostBasis;
  // Apply occupancy rate stress to effective yield
  let annualRentBrut = scpiPrice * scpiInitialYield * scpiOccupancyRate;
  let crd = loanAmount;
  let scpiExited = false;
  let scpiActive = loanAmount > 0 || scpiCostBasis > 0;

  for (let m = 1; m <= months; m++) {
    const etfMr = monthlyReturnsETF[m - 1];
    let monthlyRentNet = 0;
    let rentReceived = 0;

    if (scpiActive) {
      const revalMr = monthlyRate(scpiPropertyGrowth);
      scpiValue = scpiValue * (1 + revalMr);
      if (m > 1) {
        annualRentBrut = annualRentBrut * (1 + monthlyRate(scpiRentGrowth));
      }
      // Accrue monthly rent (annualRentBrut/12) and pay in lump sums at interval
      // This ensures total annual rent is the same regardless of payment frequency
      monthlyRentNet = (annualRentBrut / 12) * (1 - scpiTaxOnRent);
      const monthInYear = ((m - 1) % 12) + 1;
      const paymentInterval = Math.round(12 / scpiPaymentFrequency);
      rentReceived = (paymentInterval > 0 && monthInYear % paymentInterval === 0) ? monthlyRentNet * paymentInterval : 0;
    }

    // Réinjection ETF:
    // - pendant le crédit: cashflow résiduel = épargne + loyers nets - mensualité
    // - après le crédit: épargne mensuelle complète + loyers nets
    let monthlyContributionETF = 0;
    if (scpiExited) {
      // Après sortie SCPI, tout l'effort d'épargne repart en ETF (plus de loyers SCPI)
      monthlyContributionETF = monthlySavings;
    } else if (m <= creditMonths && loanAmount > 0) {
      monthlyContributionETF = Math.max(monthlySavings + monthlyRentNet - monthlyPayment, 0);
    } else {
      // Après extinction du prêt, l'épargne mensuelle redevient disponible en plus des loyers
      monthlyContributionETF = monthlySavings + monthlyRentNet;
    }

    etfCapital = (etfCapital + monthlyContributionETF) * (1 + etfMr);
    etfTotalInvested += monthlyContributionETF;
    etfCashflowInvested += monthlyContributionETF;
    const isLastMonth = m === months;
    let etfTaxPaidEarly = 0;
    let etfSoldForBuyback = 0;
    let etfGrossSoldForBuyback = 0;
    let etfTaxPaidForBuyback = 0;
    let remainingBuybackAfterETF = 0;
    let remainingPaymentsCount = 0;
    let creditBuybackCost = 0;
    let creditBuybackCoveredBySCPI = 0;
    let creditBuybackCoveredByETF = 0;
    let scpiEquity = scpiActive ? (scpiValue - crd) : 0;
    let liquidationValue = 0;
    let scpiCapGainsTaxAmount = 0;

    // En stratégie SCPI, la grosse dépense déclenche la vente SCPI.
    const isExitMonth = Boolean(majorExpenseMonth)
      && scpiActive
      && m === majorExpenseMonth

    if (isExitMonth) {
      liquidationValue = scpiValue * (1 - scpiExitFees);
      const scpiGainNow = Math.max(liquidationValue - scpiCostBasis, 0);
      scpiCapGainsTaxAmount = scpiGainNow * scpiCapitalGainsTax;
      const liquidationNetSCPI = liquidationValue - scpiCapGainsTaxAmount;

      remainingPaymentsCount = m < creditMonths ? (creditMonths - m) : 0;
      // Un rachat anticipe le capital restant dû (pas la somme des mensualités futures).
      // Les intérêts futurs ne sont pas dus en cas de remboursement anticipé.
      creditBuybackCost = crd;
      creditBuybackCoveredBySCPI = Math.min(liquidationNetSCPI, creditBuybackCost);
      let remainingAfterSCPI = Math.max(creditBuybackCost - creditBuybackCoveredBySCPI, 0);

      if (remainingAfterSCPI > 0 && etfCapital > 0) {
        const etfGain = Math.max(etfCapital - etfTotalInvested, 0);
        const etfGainRatio = etfCapital > 0 ? etfGain / etfCapital : 0;
        const effectiveTaxRateOnSale = etfGainRatio * taxRateETF;
        const netPerGross = Math.max(1 - effectiveTaxRateOnSale, 1e-9);
        etfGrossSoldForBuyback = Math.min(etfCapital, remainingAfterSCPI / netPerGross);
        etfTaxPaidForBuyback = etfGrossSoldForBuyback * effectiveTaxRateOnSale;
        etfSoldForBuyback = etfGrossSoldForBuyback - etfTaxPaidForBuyback;
        creditBuybackCoveredByETF = etfSoldForBuyback;

        const etfCostBasisRatio = etfCapital > 0 ? (etfTotalInvested / etfCapital) : 0;
        const etfCostBasisSold = etfGrossSoldForBuyback * etfCostBasisRatio;
        etfCapital = Math.max(etfCapital - etfGrossSoldForBuyback, 0);
        etfTotalInvested = Math.max(etfTotalInvested - etfCostBasisSold, 0);
        etfTaxPaidEarly = etfTaxPaidForBuyback;

        remainingAfterSCPI = Math.max(remainingAfterSCPI - etfSoldForBuyback, 0);
      }

      remainingBuybackAfterETF = remainingAfterSCPI;
      const reinvestFromSCPI = Math.max(liquidationNetSCPI - creditBuybackCost, 0);
      if (reinvestFromSCPI > 0) {
        cashReserve += reinvestFromSCPI;
      }

      scpiExited = true;
      scpiActive = false;
      scpiValue = 0;
      annualRentBrut = 0;
      crd = 0;
      scpiEquity = -remainingBuybackAfterETF;
    }

    let interest = 0;
    let principalPaid = 0;
    if (scpiActive && crd > 0 && m <= creditMonths) {
      interest = crd * creditMonthlyRate;
      principalPaid = monthlyPayment - interest;
      crd = Math.max(crd - principalPaid, 0);
    } else if (scpiActive && m > creditMonths) {
      crd = 0;
    }

    // Liquidation finale si la SCPI est encore détenue à la fin de projection
    if (isLastMonth && scpiActive) {
      liquidationValue = scpiValue * (1 - scpiExitFees);
      const scpiGainFinal = Math.max(liquidationValue - scpiCostBasis, 0);
      scpiCapGainsTaxAmount = scpiGainFinal * scpiCapitalGainsTax;
      remainingPaymentsCount = m < creditMonths ? (creditMonths - m) : 0;
      // À l'horizon de projection, on valorise la dette par le CRD.
      creditBuybackCost = crd;
      const liquidationNetSCPI = liquidationValue - scpiCapGainsTaxAmount;
      creditBuybackCoveredBySCPI = Math.min(liquidationNetSCPI, creditBuybackCost);
      remainingBuybackAfterETF = Math.max(creditBuybackCost - creditBuybackCoveredBySCPI, 0);
      scpiEquity = liquidationNetSCPI - creditBuybackCost;
    }

    let majorExpenseNetPaid = 0;
    let majorExpenseTaxPaid = 0;
    let majorExpenseUnfunded = 0;
    if (majorExpenseMonth && m === majorExpenseMonth && majorExpenseAmount > 0) {
      let remainingNeed = majorExpenseAmount;
      const fromCash = Math.min(cashReserve, remainingNeed);
      if (fromCash > 0) {
        cashReserve = Math.max(cashReserve - fromCash, 0);
        remainingNeed -= fromCash;
        majorExpenseNetPaid += fromCash;
      }
      if (remainingNeed > 0) {
        const sale = sellETFForNetAmount(etfCapital, etfTotalInvested, remainingNeed, taxRateETF);
        etfCapital = sale.etfCapital;
        etfTotalInvested = sale.etfTotalInvested;
        majorExpenseTaxPaid = sale.taxPaid;
        majorExpenseNetPaid += sale.netRaised;
        remainingNeed = Math.max(remainingNeed - sale.netRaised, 0);
      }
      majorExpenseUnfunded = remainingNeed;
    }

    const etfGain = Math.max(etfCapital - etfTotalInvested, 0);
    const etfTaxFinal = isLastMonth ? etfGain * taxRateETF : 0;
    const etfTax = etfTaxFinal + etfTaxPaidEarly;
    const etfNet = etfCapital - etfTaxFinal;

    const totalNet = etfNet + scpiEquity + cashReserve - majorExpenseUnfunded;
    const shortfall = Math.max(-(totalNet), 0);
    const isBankrupt = shortfall > 0;

    results.push({
      month: m,
      year: Math.ceil(m / 12),
      etfNet,
      etfCapitalBrut: etfCapital,
      scpiValue,
      scpiEquity,
      crd,
      loanAmount,
      creditBuybackCost,
      creditBuybackCoveredBySCPI,
      creditBuybackCoveredByETF,
      remainingPaymentsCount,
      etfSoldForBuyback,
      remainingBuybackAfterETF,
      etfGrossSoldForBuyback,
      etfTaxPaidForBuyback,
      scpiExited,
      scpiExitMonth: isExitMonth ? m : null,
      isBankrupt,
      shortfall,
      etfTax,
      etfInitialCapital: etfInitCapital,
      etfCashflowInvested,
      etfReinvestedFromSCPISale,
      etfTotalInvested,
      majorExpenseTaxPaid,
      majorExpenseNetPaid,
      majorExpenseUnfunded,
      cashReserve,
      monthlyPayment: (scpiActive && m <= creditMonths && loanAmount > 0) ? monthlyPayment : 0,
      monthlyContributionETF,
      rentReceived,
      netValue: totalNet,
    });
  }
  return results;
}

/**
 * Real Estate (Rental property) + ETF for remaining capital
 */
export function calculateRealEstate({
  capitalInitial,
  etfStartCapital,
  etfAnnualReturn,
  taxRateETF,
  durationYears,
  monthlySavings,
  creditRate,
  creditDurationYears,
  propertyPrice,
  notaryFees,
  downPayment,
  rentalYield,
  maintenanceMonthly = 0,
  taxeFonciere = 0,
  rentIncreaseRate = 0.05,
  rentIncreaseFrequencyYears = 5,
  propertyGrowth,
  vacancyRate,
  taxOnRent,
  propertyCapitalGainsTax = 0,
  surplusAllocation = 'etf',
  enableMajorExpense = false,
  majorExpenseYears,
  majorExpenseAmount = 0,
  etfScenario = 'linear',
  etfRateConvention = 'effective',
}) {
  const etfStart = etfStartCapital != null ? etfStartCapital : capitalInitial;
  const months = durationYears * 12;
  const creditMonths = creditDurationYears * 12;
  const totalCost = propertyPrice * (1 + notaryFees);
  const loanAmount = Math.max(totalCost - downPayment, 0);
  const creditMonthlyRate = creditRate / 12;
  const monthlyPaymentVal = loanAmount > 0 ? pmt(creditMonthlyRate, creditMonths, loanAmount) : 0;
  const monthlyReturnsETF = generateMonthlyReturns(etfAnnualReturn, months, etfScenario, etfRateConvention);
  const majorExpenseMonth = enableMajorExpense
    ? Math.min(Math.max(1, Math.round((majorExpenseYears ?? durationYears) * 12)), months)
    : null;

  const results = [];
  let etfCapital = etfStart;
  let etfTotalInvested = etfStart;
  let propertyValue = propertyPrice;
  let currentMonthlyRentBase = propertyPrice * rentalYield / 12;
  let crd = loanAmount;

  for (let m = 1; m <= months; m++) {
    const etfMr = monthlyReturnsETF[m - 1];
    const propMr = monthlyRate(propertyGrowth);
    propertyValue = propertyValue * (1 + propMr);

    // Increase rent every rentIncreaseFrequencyYears years
    const yearIndex = Math.floor((m - 1) / 12);
    if (m > 1 && (m - 1) % 12 === 0 && yearIndex > 0 && yearIndex % rentIncreaseFrequencyYears === 0) {
      currentMonthlyRentBase = currentMonthlyRentBase * (1 + rentIncreaseRate);
    }

    const grossRent = currentMonthlyRentBase * (1 - vacancyRate);
    const netRentBeforeTax = grossRent - maintenanceMonthly - taxeFonciere / 12;
    const rentTax = Math.max(netRentBeforeTax, 0) * taxOnRent;
    const netRent = netRentBeforeTax - rentTax;

    // Amortissement mensuel normal
    let normalPaymentThisMonth = 0;
    if (crd > 0) {
      const interest = crd * creditMonthlyRate;
      const principalPaid = monthlyPaymentVal - interest;
      normalPaymentThisMonth = monthlyPaymentVal;
      crd = Math.max(crd - principalPaid, 0);
    }

    // Surplus = effort - mensualité normale
    const surplus = monthlySavings - normalPaymentThisMonth;

    let monthlyContributionETF;
    if (surplusAllocation === 'credit' && crd > 0 && surplus > 0) {
      // Remboursement anticipé avec le surplus
      crd = Math.max(crd - surplus, 0);
      monthlyContributionETF = netRent; // seul le loyer net va dans l'ETF
    } else {
      // Surplus + loyer net vers ETF
      monthlyContributionETF = surplus + netRent;
    }

    etfCapital = (etfCapital + monthlyContributionETF) * (1 + etfMr);
    etfTotalInvested += monthlyContributionETF;

    let majorExpenseTaxPaid = 0;
    let majorExpenseNetPaid = 0;
    if (majorExpenseMonth && m === majorExpenseMonth && majorExpenseAmount > 0) {
      const sale = sellETFForNetAmount(etfCapital, etfTotalInvested, majorExpenseAmount, taxRateETF);
      etfCapital = sale.etfCapital;
      etfTotalInvested = sale.etfTotalInvested;
      majorExpenseTaxPaid = sale.taxPaid;
      majorExpenseNetPaid = sale.netRaised;
    }

    const isLastMonth = m === months;
    const etfGain = Math.max(etfCapital - etfTotalInvested, 0);
    const etfTax = isLastMonth ? etfGain * taxRateETF : 0;
    const etfNet = etfCapital - etfTax;

    // Flat tax uniquement à la liquidation (dernière mensualité de la projection)
    const propGain = isLastMonth ? Math.max(propertyValue - propertyPrice, 0) : 0;
    const propCapGainsTax = propGain * propertyCapitalGainsTax;
    const propertyEquity = propertyValue - propCapGainsTax - crd;
    const totalNet = etfNet + propertyEquity;

    results.push({
      month: m,
      year: Math.ceil(m / 12),
      etfCapitalBrut: etfCapital,
      etfNet,
      propertyValue,
      propertyEquity,
      crd,
      monthlyPayment: (m <= creditMonths && loanAmount > 0) ? monthlyPaymentVal : 0,
      monthlyContributionETF,
      netRent,
      majorExpenseTaxPaid,
      majorExpenseNetPaid,
      netValue: totalNet,
    });
  }
  return results;
}

/**
 * Épargne non investie (pure accumulation, no returns)
 */
export function calculateSavings({ capitalInitial, monthlySavings, durationYears, enableMajorExpense = false, majorExpenseYears, majorExpenseAmount = 0 }) {
  const months = durationYears * 12;
  const majorExpenseMonth = enableMajorExpense
    ? Math.min(Math.max(1, Math.round((majorExpenseYears ?? durationYears) * 12)), months)
    : null;
  const results = [];
  for (let m = 1; m <= months; m++) {
    const gross = capitalInitial + monthlySavings * m;
    const expense = (majorExpenseMonth && m >= majorExpenseMonth) ? majorExpenseAmount : 0;
    const netValue = gross - expense;
    results.push({ month: m, year: Math.ceil(m / 12), netValue });
  }
  return results;
}

export function formatCurrency(value) {
  if (value == null || isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return "—";
  return (value * 100).toFixed(2) + " %";
}
