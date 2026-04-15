import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TrendingUp, Building2, Home, PiggyBank } from "lucide-react";

const STRATEGY_TYPES = [
  {
    type: "etf",
    icon: TrendingUp,
    label: "ETF DCA",
    description: "Investissement régulier en ETF (Dollar Cost Averaging)",
    color: "text-blue-600 bg-blue-50 border-blue-200 hover:border-blue-400",
  },
  {
    type: "scpi",
    icon: Building2,
    label: "SCPI + Levier",
    description: "Parts de SCPI financées par crédit bancaire + ETF",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:border-emerald-400",
  },
  {
    type: "realEstate",
    icon: Home,
    label: "Immobilier locatif",
    description: "Achat d'un bien immobilier à crédit + ETF",
    color: "text-amber-600 bg-amber-50 border-amber-200 hover:border-amber-400",
  },
];

export default function AddStrategyDialog({ open, onOpenChange, onAdd }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une stratégie</DialogTitle>
          <DialogDescription>
            Choisissez le type de stratégie d'investissement à comparer
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {STRATEGY_TYPES.map((st) => {
            const Icon = st.icon;
            return (
              <button
                key={st.type}
                onClick={() => onAdd(st.type)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${st.color}`}
              >
                <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{st.label}</p>
                  <p className="text-xs text-muted-foreground">{st.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
