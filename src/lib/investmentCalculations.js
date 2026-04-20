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

function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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
  } else if (scenario === 'sideways') {
    yearlyReturns = Array.from({ length: years }, (_, y) => {
      const cycle = y % 6;
      if (cycle === 0) return -0.08;
      if (cycle === 1) return 0.12;
      if (cycle === 2) return -0.04;
      if (cycle === 3) return 0.10;
      if (cycle === 4) return -0.02;
      return annualReturn;
    });
  } else if (scenario === 'dotcom_2008') {
    yearlyReturns = Array.from({ length: years }, (_, y) => {
      if (y === 1) return -0.22;
      if (y === 2) return -0.16;
      if (y === 8) return -0.38;
      if (y === 9) return 0.19;
      if (y === 10) return 0.14;
      return annualReturn;
    });
  } else if (scenario === 'stochastic_mild' || scenario === 'stochastic_crisis') {
    const rand = seededRandom(scenario === 'stochastic_mild' ? 20260420 : 20260421);
    const drift = annualReturn;
    const vol = scenario === 'stochastic_mild' ? 0.12 : 0.20;
    const crashProb = scenario === 'stochastic_mild' ? 0.03 : 0.08;
    yearlyReturns = Array.from({ length: years }, () => {
      const u = rand();
      const v = rand();
      const z = Math.sqrt(-2 * Math.log(Math.max(u, 1e-9))) * Math.cos(2 * Math.PI * v);
      const normalLike = drift + z * vol;
      if (rand() < crashProb) return Math.max(-0.45, normalLike - 0.20);
      return Math.max(-0.45, Math.min(0.45, normalLike));
    });
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

export function computeRemainingCashAfterDownPayment(downPayment, capitalDisponible) {
  const dp = downPayment || 0;
  const cash = capitalDisponible || 0;
  return Math.max(cash - Math.min(dp, cash), 0);
}

function computeEarlyRepaymentPenalty(crd, annualCreditRate, remainingPaymentsCount) {
  if (crd <= 0 || remainingPaymentsCount <= 0) return 0;
  // Indemnite standard (France): min(6 mois d'interets, 3% du capital rembourse).
  const sixMonthsInterest = crd * annualCreditRate * 0.5;
  const legalCap = crd * 0.03;
  return Math.min(sixMonthsInterest, legalCap);
}

function computeIrrMonthly(cashflows, maxIterations = 100, tolerance = 1e-7) {
  if (!cashflows || cashflows.length < 2) return null;
  const hasPositive = cashflows.some((v) => v > 0);
  const hasNegative = cashflows.some((v) => v < 0);
  if (!hasPositive || !hasNegative) return null;

  let rate = 0.005;
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dNpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const denom = Math.pow(1 + rate, t);
      npv += cashflows[t] / denom;
      if (t > 0) {
        dNpv += (-t * cashflows[t]) / (denom * (1 + rate));
      }
    }
    if (Math.abs(npv) < tolerance) return rate;
    if (Math.abs(dNpv) < 1e-12) break;
    const nextRate = rate - npv / dNpv;
    if (!isFinite(nextRate) || nextRate <= -0.9999 || nextRate > 10) break;
    rate = nextRate;
  }
  return null;
}

export function computeIRRAnnual(cashflows) {
  const monthlyIrr = computeIrrMonthly(cashflows);
  if (monthlyIrr == null) return null;
  return Math.pow(1 + monthlyIrr, 12) - 1;
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
  etfBonusMonthlySavings = 0,
  availableCash = 0,
  initialETFGainRate = 0,
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
  const initialCostBasis = Math.max(startCapital * (1 - (initialETFGainRate || 0)), 0);
  let totalInvested = initialCostBasis;
  let cashReserve = availableCash;

  for (let m = 1; m <= months; m++) {
    const mr = monthlyReturns[m - 1];
    const monthlyETFContribution = monthlyContribution + etfBonusMonthlySavings;
    capital = (capital + monthlyETFContribution) * (1 + mr);
    totalInvested += monthlyETFContribution;

    let majorExpenseTaxPaid = 0;
    let majorExpenseNetPaid = 0;
    let majorExpenseFromCash = 0;
    let majorExpenseUnfunded = 0;
    if (majorExpenseMonth && m === majorExpenseMonth && majorExpenseAmount > 0) {
      let remainingNeed = majorExpenseAmount;
      const fromCash = Math.min(cashReserve, remainingNeed);
      if (fromCash > 0) {
        cashReserve = Math.max(cashReserve - fromCash, 0);
        remainingNeed -= fromCash;
        majorExpenseFromCash = fromCash;
        majorExpenseNetPaid += fromCash;
      }
      if (remainingNeed > 0) {
        const sale = sellETFForNetAmount(capital, totalInvested, remainingNeed, taxRate);
        capital = sale.etfCapital;
        totalInvested = sale.etfTotalInvested;
        majorExpenseTaxPaid = sale.taxPaid;
        majorExpenseNetPaid += sale.netRaised;
        remainingNeed = Math.max(remainingNeed - sale.netRaised, 0);
      }
      majorExpenseUnfunded = remainingNeed;
    }

    const isLastMonth = m === months;
    const gain = Math.max(capital - totalInvested, 0);
    const tax = isLastMonth ? gain * taxRate : 0;
    const netValue = capital - tax + cashReserve - majorExpenseUnfunded;

    results.push({
      month: m,
      year: Math.ceil(m / 12),
      capitalBrut: capital,
      totalInvested,
      gain,
      tax,
      majorExpenseTaxPaid,
      majorExpenseNetPaid,
      majorExpenseFromCash,
      majorExpenseUnfunded,
      cashReserve,
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
  etfBonusMonthlySavings = 0,
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
  availableCash = 0,
  initialETFGainRate = 0,
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
  const etfInitialCostBasis = Math.max(etfInitCapital * (1 - (initialETFGainRate || 0)), 0);
  let etfTotalInvested = etfInitialCostBasis;
  let etfCashflowInvested = 0;
  let etfReinvestedFromSCPISale = 0;
  let cashReserve = availableCash;
  let initialCashReserve = availableCash;
  let cumulativeCreditInterestPaid = 0;
  let cumulativeCreditPrincipalPaid = 0;
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
    monthlyContributionETF += etfBonusMonthlySavings;

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
    let creditBuybackPenalty = 0;
    let creditBuybackPrincipal = 0;
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
      creditBuybackPrincipal = crd;
      creditBuybackPenalty = computeEarlyRepaymentPenalty(crd, creditRate, remainingPaymentsCount);
      // Un rachat anticipe le capital restant du + IRA plafonnee.
      creditBuybackCost = creditBuybackPrincipal + creditBuybackPenalty;
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
      cumulativeCreditInterestPaid += interest;
      cumulativeCreditPrincipalPaid += principalPaid;
    } else if (scpiActive && m > creditMonths) {
      crd = 0;
    }

    // Liquidation finale si la SCPI est encore détenue à la fin de projection
    if (isLastMonth && scpiActive) {
      liquidationValue = scpiValue * (1 - scpiExitFees);
      const scpiGainFinal = Math.max(liquidationValue - scpiCostBasis, 0);
      scpiCapGainsTaxAmount = scpiGainFinal * scpiCapitalGainsTax;
      remainingPaymentsCount = m < creditMonths ? (creditMonths - m) : 0;
      creditBuybackPrincipal = crd;
      creditBuybackPenalty = computeEarlyRepaymentPenalty(crd, creditRate, remainingPaymentsCount);
      // A l'horizon, on valorise la sortie avec CRD + IRA plafonnee.
      creditBuybackCost = creditBuybackPrincipal + creditBuybackPenalty;
      const liquidationNetSCPI = liquidationValue - scpiCapGainsTaxAmount;
      creditBuybackCoveredBySCPI = Math.min(liquidationNetSCPI, creditBuybackCost);
      remainingBuybackAfterETF = Math.max(creditBuybackCost - creditBuybackCoveredBySCPI, 0);
      scpiEquity = liquidationNetSCPI - creditBuybackCost;
    }

    let majorExpenseNetPaid = 0;
    let majorExpenseTaxPaid = 0;
    let majorExpenseFromCash = 0;
    let majorExpenseFromInitialCash = 0;
    let majorExpenseFromSCPISaleCash = 0;
    let majorExpenseUnfunded = 0;
    if (majorExpenseMonth && m === majorExpenseMonth && majorExpenseAmount > 0) {
      let remainingNeed = majorExpenseAmount;
      const fromInitialCash = Math.min(initialCashReserve, remainingNeed);
      if (fromInitialCash > 0) {
        initialCashReserve = Math.max(initialCashReserve - fromInitialCash, 0);
        cashReserve = Math.max(cashReserve - fromInitialCash, 0);
        remainingNeed -= fromInitialCash;
        majorExpenseFromInitialCash = fromInitialCash;
        majorExpenseFromCash += fromInitialCash;
        majorExpenseNetPaid += fromInitialCash;
      }
      const fromSCPISaleCash = Math.min(cashReserve, remainingNeed);
      if (fromSCPISaleCash > 0) {
        cashReserve = Math.max(cashReserve - fromSCPISaleCash, 0);
        remainingNeed -= fromSCPISaleCash;
        majorExpenseFromSCPISaleCash = fromSCPISaleCash;
        majorExpenseFromCash += fromSCPISaleCash;
        majorExpenseNetPaid += fromSCPISaleCash;
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
      creditBuybackPrincipal,
      creditBuybackPenalty,
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
      majorExpenseFromCash,
      majorExpenseFromInitialCash,
      majorExpenseFromSCPISaleCash,
      majorExpenseUnfunded,
      cashReserve,
      liquidationValue,
      scpiCapGainsTaxAmount,
      monthlyPayment: (scpiActive && m <= creditMonths && loanAmount > 0) ? monthlyPayment : 0,
      monthlyContributionETF,
      rentReceived,
      cumulativeCreditInterestPaid,
      cumulativeCreditPrincipalPaid,
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
  etfBonusMonthlySavings = 0,
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
  availableCash = 0,
  initialETFGainRate = 0,
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
  const etfInitialCostBasis = Math.max(etfStart * (1 - (initialETFGainRate || 0)), 0);
  let etfTotalInvested = etfInitialCostBasis;
  let cashReserve = availableCash;
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
    monthlyContributionETF += etfBonusMonthlySavings;

    etfCapital = (etfCapital + monthlyContributionETF) * (1 + etfMr);
    etfTotalInvested += monthlyContributionETF;

    let majorExpenseTaxPaid = 0;
    let majorExpenseNetPaid = 0;
    let majorExpenseFromCash = 0;
    let majorExpenseUnfunded = 0;
    if (majorExpenseMonth && m === majorExpenseMonth && majorExpenseAmount > 0) {
      let remainingNeed = majorExpenseAmount;
      const fromCash = Math.min(cashReserve, remainingNeed);
      if (fromCash > 0) {
        cashReserve = Math.max(cashReserve - fromCash, 0);
        remainingNeed -= fromCash;
        majorExpenseFromCash = fromCash;
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

    const isLastMonth = m === months;
    const etfGain = Math.max(etfCapital - etfTotalInvested, 0);
    const etfTax = isLastMonth ? etfGain * taxRateETF : 0;
    const etfNet = etfCapital - etfTax;

    // Flat tax uniquement à la liquidation (dernière mensualité de la projection)
    const propGain = isLastMonth ? Math.max(propertyValue - propertyPrice, 0) : 0;
    const propCapGainsTax = propGain * propertyCapitalGainsTax;
    const propertyEquity = propertyValue - propCapGainsTax - crd;
    const totalNet = etfNet + propertyEquity + cashReserve - majorExpenseUnfunded;

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
      majorExpenseFromCash,
      majorExpenseUnfunded,
      cashReserve,
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
