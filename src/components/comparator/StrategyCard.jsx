import { useState } from "react";
import { Trash2, TrendingUp, Building2, Home, PiggyBank } from "lucide-react";
import { computeIRRAnnual, formatCurrency } from "@/lib/investmentCalculations";
import StrategyETFForm from "./StrategyETFForm";
import StrategySCPIForm from "./StrategySCPIForm";
import StrategyRealEstateForm from "./StrategyRealEstateForm";

const STRATEGY_META = {
  etf: {
    icon: TrendingUp,
    label: "ETF DCA",
    color: "text-blue-600 bg-blue-50",
    borderColor: "border-blue-200",
  },
  scpi: {
    icon: Building2,
    label: "SCPI + Levier",
    color: "text-emerald-600 bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  realEstate: {
    icon: Home,
    label: "Immobilier locatif",
    color: "text-amber-600 bg-amber-50",
    borderColor: "border-amber-200",
  },
  savings: {
    icon: PiggyBank,
    label: "Épargne non investie",
    color: "text-slate-600 bg-slate-50",
    borderColor: "border-slate-200",
  },
};

export default function StrategyCard({ strategy, globalParams, allStrategies, onUpdate, onRemove, projection }) {
  const meta = STRATEGY_META[strategy.type];
  const Icon = meta.icon;
  const updateConfig = (c) => onUpdate({ ...strategy, config: c });
  const [showBrut, setShowBrut] = useState(false);

  const lastPoint = projection && projection.length > 0 ? projection[projection.length - 1] : null;
  const majorExpensePoint = projection?.find((p) => (p.majorExpenseNetPaid || 0) > 0 || (p.majorExpenseUnfunded || 0) > 0) || null;
  // ETF brut/net selon le type de stratégie
  const etfBrut = lastPoint
    ? (strategy.type === 'etf' ? lastPoint.capitalBrut : lastPoint.etfCapitalBrut)
    : null;
  const etfNet = lastPoint
    ? (strategy.type === 'etf' ? lastPoint.netValue : lastPoint.etfNet)
    : null;
  const isBankrupt = Boolean(lastPoint?.isBankrupt);
  const scpiBuybackPoint = strategy.type === 'scpi'
    ? (projection?.find((p) => (p.scpiExitMonth != null) || (p.creditBuybackCost || 0) > 0) || null)
    : null;
  const scpiBestExitPoint = strategy.type === "scpi" && projection?.length
    ? projection.reduce((best, p) => ((p.netValue || -Infinity) > (best.netValue || -Infinity) ? p : best), projection[0])
    : null;
  const investorMonthlyOutflow = (globalParams?.monthlySavings || 0) + (globalParams?.etfBonusMonthlySavings || 0);
  const strategyIRRAnnual = projection?.length
    ? computeIRRAnnual([
      -((globalParams?.capitalInitial || 0) + (globalParams?.capitalDisponible || 0)),
      ...projection.map(() => -investorMonthlyOutflow),
      (projection[projection.length - 1]?.netValue || 0),
    ])
    : null;
  const creditInterestRatio = strategy.type === "scpi" && lastPoint?.loanAmount > 0
    ? (lastPoint.cumulativeCreditInterestPaid || 0) / lastPoint.loanAmount
    : null;

  return (
    <div className={`bg-card rounded-xl border ${meta.borderColor} p-5 space-y-4 transition-all hover:shadow-sm`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${meta.color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <input
              value={strategy.name}
              onChange={(e) => onUpdate({ ...strategy, name: e.target.value })}
              className="text-sm font-semibold bg-transparent border-none outline-none text-foreground w-full"
              placeholder="Nom de la stratégie"
            />
            <p className="text-xs text-muted-foreground">{meta.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {etfNet != null && (
            <button
              onClick={() => setShowBrut(b => !b)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                etfNet < 0
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-muted/60 border-border text-foreground/70 hover:bg-muted'
              }`}
              title="Cliquer pour basculer brut/net"
            >
              {strategy.type === 'scpi' ? 'Poche ETF' : 'ETF'} {showBrut ? 'brut' : 'net'} ({globalParams.durationYears} ans) : {formatCurrency(showBrut ? etfBrut : etfNet)}
            </button>
          )}
          <button onClick={onRemove} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted/50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {isBankrupt && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          Banqueroute: actifs insuffisants pour solder le crédit à la fin de la projection.
        </div>
      )}
      {scpiBuybackPoint && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Sortie SCPI (année {scpiBuybackPoint.year}) :</span>{' '}
          produit net SCPI utilisé pour solder le crédit. Détail rachat: CRD {formatCurrency(scpiBuybackPoint.creditBuybackPrincipal || 0)}
          {" + "}IRA {formatCurrency(scpiBuybackPoint.creditBuybackPenalty || 0)}
          {" = "} {formatCurrency(scpiBuybackPoint.creditBuybackCost || 0)}.
          Couverture: SCPI {formatCurrency(scpiBuybackPoint.creditBuybackCoveredBySCPI || 0)},
          ETF net {formatCurrency(scpiBuybackPoint.creditBuybackCoveredByETF || 0)}
          {" "}({formatCurrency(scpiBuybackPoint.etfGrossSoldForBuyback || 0)} brut, impôt ETF {formatCurrency(scpiBuybackPoint.etfTaxPaidForBuyback || 0)}),
          reliquat {formatCurrency(scpiBuybackPoint.remainingBuybackAfterETF || 0)}.
        </div>
      )}

      {strategy.type === "etf" && (
        <StrategyETFForm config={strategy.config} globalParams={globalParams} allStrategies={allStrategies} onChange={updateConfig} projection={projection} strategyIRRAnnual={strategyIRRAnnual} />
      )}
      {strategy.type === "scpi" && (
        <StrategySCPIForm config={strategy.config} globalParams={globalParams} onChange={updateConfig} />
      )}
      {strategy.type === "realEstate" && (
        <StrategyRealEstateForm config={strategy.config} globalParams={globalParams} onChange={updateConfig} projection={projection} />
      )}
      {strategy.type === "savings" && (
        <p className="text-xs text-muted-foreground">Aucun paramètre — utilise le capital initial et l'effort d'épargne mensuel des paramètres communs.</p>
      )}
      {lastPoint && strategy.type === "etf" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Formule DCA ETF : Valeur brute = (capital initial + versements mensuels) capitalisée au rendement mensuel ; Valeur nette = Valeur brute - impôt sur plus-value.
          </p>
          {majorExpensePoint && (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Grosse dépense (année {majorExpensePoint.year})</p>
              <p>Prélevé sur cash initial : <span className="font-mono text-foreground">{formatCurrency(majorExpensePoint.majorExpenseFromInitialCash || majorExpensePoint.majorExpenseFromCash || 0)}</span></p>
              <p>Vente ETF nette : <span className="font-mono text-foreground">{formatCurrency((majorExpensePoint.majorExpenseNetPaid || 0) - (majorExpensePoint.majorExpenseFromCash || 0))}</span></p>
              <p>Impôt ETF payé à la vente : <span className="font-mono text-foreground">{formatCurrency(majorExpensePoint.majorExpenseTaxPaid || 0)}</span></p>
              {(majorExpensePoint.majorExpenseUnfunded || 0) > 0 && (
                <p className="text-destructive">Montant non financé : {formatCurrency(majorExpensePoint.majorExpenseUnfunded || 0)}</p>
              )}
            </div>
          )}
        </div>
      )}
      {lastPoint && strategy.type === "scpi" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Formule SCPI + ETF : l'effort mensuel sert au crédit SCPI, puis les loyers nets sont versés dans l'ETF. Après vente SCPI, les loyers s'arrêtent et seul l'effort mensuel continue vers ETF. Valeur totale = ETF net + valeur nette SCPI (frais, impôt, CRD et IRA) + cash résiduel.
          </p>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
            <p>
              Départ ETF : <span className="font-mono text-foreground">{formatCurrency(lastPoint.etfInitialCapital || 0)}</span>
            </p>
            <p>
              Versé depuis cashflows mensuels (inclut après sortie SCPI) : <span className="font-mono text-foreground">{formatCurrency(lastPoint.etfCashflowInvested || 0)}</span>
            </p>
            <p>
              Réinjecté depuis vente SCPI : <span className="font-mono text-foreground">{formatCurrency(lastPoint.etfReinvestedFromSCPISale || 0)}</span>
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
            <p>TRI annualisé estimé : <span className="font-mono text-foreground">{strategyIRRAnnual != null ? `${(strategyIRRAnnual * 100).toFixed(2)} %` : "—"}</span></p>
            <p>Intérêts crédit cumulés : <span className="font-mono text-foreground">{formatCurrency(lastPoint.cumulativeCreditInterestPaid || 0)}</span></p>
            <p>Ratio coût intérêts / emprunt : <span className="font-mono text-foreground">{creditInterestRatio != null ? `${(creditInterestRatio * 100).toFixed(1)} %` : "—"}</span></p>
            {scpiBestExitPoint && (
              <p className="text-foreground">Suggestion: valeur nette max autour de l'année <span className="font-mono">{scpiBestExitPoint.year}</span> ({formatCurrency(scpiBestExitPoint.netValue || 0)}).</p>
            )}
          </div>
          {majorExpensePoint && (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Grosse dépense (année {majorExpensePoint.year})</p>
              <p>Prélevé sur cash initial : <span className="font-mono text-foreground">{formatCurrency(majorExpensePoint.majorExpenseFromInitialCash || 0)}</span></p>
              <p>Prélevé sur cash issu vente SCPI : <span className="font-mono text-foreground">{formatCurrency(majorExpensePoint.majorExpenseFromSCPISaleCash || 0)}</span></p>
              <p>Vente ETF nette pour dépense : <span className="font-mono text-foreground">{formatCurrency((majorExpensePoint.majorExpenseNetPaid || 0) - (majorExpensePoint.majorExpenseFromCash || 0))}</span></p>
              <p>Impôt ETF à la vente : <span className="font-mono text-foreground">{formatCurrency(majorExpensePoint.majorExpenseTaxPaid || 0)}</span></p>
              <p>Valeur SCPI liquidée : <span className="font-mono text-foreground">{formatCurrency(majorExpensePoint.liquidationValue || 0)}</span></p>
              <p>Impôt plus-value SCPI : <span className="font-mono text-foreground">{formatCurrency(majorExpensePoint.scpiCapGainsTaxAmount || 0)}</span></p>
              {(majorExpensePoint.majorExpenseUnfunded || 0) > 0 && (
                <p className="text-destructive">Montant non financé : {formatCurrency(majorExpensePoint.majorExpenseUnfunded || 0)}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
