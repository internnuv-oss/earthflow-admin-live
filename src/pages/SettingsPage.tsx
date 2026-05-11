import { useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  BarChart3,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';

interface ScoringTier {
  id: string;
  scoreThreshold: number;
  col1Value: string;
  col2Value: string;
}

interface ScoringCategory {
  key: string;
  label: string;
  col1Header: string;
  col2Header: string;
  tiers: ScoringTier[];
  maxScore: number;
}

interface CommitmentItem {
  id: string;
  text: string;
  checkedByDefault: boolean;
}

type TemplateType = 'dealer' | 'farmer' | 'distributor';

const defaultTiers = (
  pairs: Array<[number, string, string]>,
): ScoringTier[] =>
  pairs.map(([score, c1, c2], i) => ({
    id: `t${i + 1}`,
    scoreThreshold: score,
    col1Value: c1,
    col2Value: c2,
  }));

const DEALER_CATEGORIES: ScoringCategory[] = [
  {
    key: 'scoreFinancial',
    label: 'Financial Health & Turnover',
    col1Header: 'Annual Turnover (INR)',
    col2Header: 'Payment Discipline / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, '₹5L - ₹10L', 'Frequent defaults; relies on local high-interest lenders; high debt.'],
      [4, '₹10L - ₹25L', '"Hand-to-mouth" cash flow; pays only after 60+ days or multiple reminders.'],
      [6, '₹25L - ₹60L', 'Stable; pays within standard 30-day credit cycles; uses bank CC limits.'],
      [8, '₹60L - ₹1 Cr', 'Strong liquidity; pays before due dates; high credit limit with MNCs.'],
      [10, '> ₹1 Cr', 'Cash-rich; often pays advance for extra margins; zero payment friction.'],
    ]),
  },
  {
    key: 'scoreReputation',
    label: 'Market Reputation',
    col1Header: 'Farmer & Peer Feedback',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, 'Negative feedback', 'Known for selling "expired" or "substandard" stock; price-cutter.'],
      [4, 'Neutral/Basic', 'Perceived as a "small player"; farmers go there only for convenience.'],
      [6, 'Reliable', 'Known for fair pricing and providing standard, genuine products.'],
      [8, 'Respected Advisor', 'Farmers seek his advice on pest management; high ethical standing.'],
      [10, 'Market Leader', 'Influences village-level decisions; acts as a "community leader."'],
    ]),
  },
  {
    key: 'scoreOperations',
    label: 'Shop Operations & Infrastructure',
    col1Header: 'Shop Setup',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, 'Very Basic', 'Single counter; no storage; mixed/unorganized stock.'],
      [4, 'Basic', 'Limited shelving; minimal display; informal billing.'],
      [6, 'Standard', 'Organized shelves; computerized billing; basic storage.'],
      [8, 'Advanced', 'Branded display; AC storage for sensitive products; trained staff.'],
      [10, 'Premium', 'Multi-location; warehouse; digital POS; demo / training rooms.'],
    ]),
  },
  {
    key: 'scoreFarmerNetwork',
    label: 'Farmer Network & Reach',
    col1Header: 'Active Farmer Base',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, '< 50 farmers', 'Walk-in only; no farmer database; limited village reach.'],
      [4, '50 - 150 farmers', 'Local village reach; informal farmer contact list.'],
      [6, '150 - 400 farmers', 'Multi-village reach; maintains farmer ledger / WhatsApp groups.'],
      [8, '400 - 800 farmers', 'Strong taluk-level network; runs farmer meetings regularly.'],
      [10, '> 800 farmers', 'District-level influence; organized farmer events and demos.'],
    ]),
  },
  {
    key: 'scoreTeam',
    label: 'Team & Professionalism',
    col1Header: 'Staff Strength',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, 'Owner only', 'No staff; family-run; no specialization.'],
      [4, '1 - 2 staff', 'Untrained helpers; basic counter support.'],
      [6, '3 - 5 staff', 'Mix of sales + billing staff; some product knowledge.'],
      [8, '6 - 9 staff', 'Trained agronomy / sales staff; defined roles.'],
      [10, '10+ staff', 'Professional team; field officers; structured hierarchy.'],
    ]),
  },
  {
    key: 'scorePortfolio',
    label: 'Current Portfolio',
    col1Header: 'Brands Carried',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, '1 - 3 brands', 'Mostly generic / local brands; no MNC presence.'],
      [4, '4 - 7 brands', 'Few regional brands; limited bio inputs.'],
      [6, '8 - 12 brands', 'Mix of MNC and regional brands; some bio products.'],
      [8, '13 - 18 brands', 'Strong MNC tie-ups; growing bio category.'],
      [10, '> 18 brands', 'Wide portfolio across categories incl. premium bio brands.'],
    ]),
  },
  {
    key: 'scoreExperience',
    label: 'Experience & Openness to Bio',
    col1Header: 'Years in Business',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, '< 2 years', 'New entrant; closed mindset; sticks to chemicals only.'],
      [4, '2 - 5 years', 'Limited experience; cautious about bio inputs.'],
      [6, '5 - 10 years', 'Established; open to trying selective bio products.'],
      [8, '10 - 20 years', 'Experienced; actively promotes selected bio brands.'],
      [10, '> 20 years', 'Veteran; strong advocate for bio / sustainable inputs.'],
    ]),
  },
  {
    key: 'scoreGrowth',
    label: 'Growth Orientation',
    col1Header: 'Expected Annual Growth',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, '< ₹2.5L', 'Stagnant; no plans to expand or invest.'],
      [4, '₹2.5L - ₹4L', 'Cautious; reinvests minimally.'],
      [6, '₹4L - ₹6L', 'Steady growth; willing to expand portfolio.'],
      [8, '₹6L - ₹8L', 'Aggressive; plans new categories / locations.'],
      [10, '> ₹8L', 'High-growth; investing in team, infra and brand building.'],
    ]),
  },
];

const DEALER_COMMITMENTS: CommitmentItem[] = [
  { id: 'c1', text: 'GLS Commitments Accepted', checkedByDefault: true },
  { id: 'c2', text: 'Regulatory Compliance Checklist', checkedByDefault: true },
  { id: 'c3', text: 'Credit Policy Accepted', checkedByDefault: true },
  { id: 'c4', text: 'Exclusivity Agreement', checkedByDefault: false },
  { id: 'c5', text: 'Payment Terms Agreed', checkedByDefault: true },
];

const FARMER_CATEGORIES: ScoringCategory[] = [
  {
    key: 'landSize',
    label: 'Land Holding Size',
    col1Header: 'Acres Owned',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, '< 1 acre', 'Marginal; subsistence farming.'],
      [4, '1 - 3 acres', 'Small holding; mixed crops.'],
      [6, '3 - 6 acres', 'Medium holding; some commercial crops.'],
      [8, '6 - 10 acres', 'Large holding; clear commercial focus.'],
      [10, '> 10 acres', 'Very large; progressive commercial farmer.'],
    ]),
  },
  {
    key: 'irrigation',
    label: 'Irrigation Access',
    col1Header: 'Source',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, 'Rainfed', 'Fully dependent on monsoon.'],
      [4, 'Open well', 'Seasonal access; limited reliability.'],
      [6, 'Borewell', 'Year-round but limited yield.'],
      [8, 'Canal + Borewell', 'Reliable multi-source irrigation.'],
      [10, 'Drip + Sprinkler', 'Modern irrigation; efficient water use.'],
    ]),
  },
];

const FARMER_COMMITMENTS: CommitmentItem[] = [
  { id: 'fc1', text: 'KYC / Aadhaar Verified', checkedByDefault: true },
  { id: 'fc2', text: 'Land Ownership Declaration', checkedByDefault: true },
  { id: 'fc3', text: 'Willing to Adopt Bio Inputs', checkedByDefault: false },
  { id: 'fc4', text: 'Consent for Field Visits', checkedByDefault: true },
];

const DISTRIBUTOR_CATEGORIES: ScoringCategory[] = [
  {
    key: 'turnover',
    label: 'Annual Turnover',
    col1Header: 'Turnover (INR)',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, '< ₹50L', 'Sub-scale; minimal market presence.'],
      [4, '₹50L - ₹1 Cr', 'Small distributor; localized.'],
      [6, '₹1 Cr - ₹3 Cr', 'Mid-scale; multi-district reach.'],
      [8, '₹3 Cr - ₹5 Cr', 'Large; state-level presence.'],
      [10, '> ₹5 Cr', 'Top-tier; multi-state operations.'],
    ]),
  },
  {
    key: 'warehouse',
    label: 'Warehouse Capacity',
    col1Header: 'Capacity (Tons)',
    col2Header: 'Remarks / Evidence',
    maxScore: 10,
    tiers: defaultTiers([
      [2, '< 50 tons', 'Single small godown.'],
      [4, '50 - 150 tons', 'Basic warehousing; limited segregation.'],
      [6, '150 - 300 tons', 'Organized; SKU-wise segregation.'],
      [8, '300 - 500 tons', 'Multi-warehouse; proper inventory.'],
      [10, '> 500 tons', 'Large network; climate-controlled storage.'],
    ]),
  },
];

const DISTRIBUTOR_COMMITMENTS: CommitmentItem[] = [
  { id: 'dc1', text: 'GST Registration Verified', checkedByDefault: true },
  { id: 'dc2', text: 'Warehouse Inspection Cleared', checkedByDefault: true },
  { id: 'dc3', text: 'Distribution Agreement Signed', checkedByDefault: true },
  { id: 'dc4', text: 'Exclusivity Clause Accepted', checkedByDefault: false },
  { id: 'dc5', text: 'Payment & Credit Terms Agreed', checkedByDefault: true },
];

interface SettingsPageProps {
  onLogout: () => void;
}

interface TemplateEditorProps {
  type: TemplateType;
  title: string;
  categories: ScoringCategory[];
  commitments: CommitmentItem[];
  setCategories: React.Dispatch<React.SetStateAction<ScoringCategory[]>>;
  setCommitments: React.Dispatch<React.SetStateAction<CommitmentItem[]>>;
}

const TemplateEditor = ({
  type,
  title,
  categories,
  commitments,
  setCategories,
  setCommitments,
}: TemplateEditorProps) => {
  const totalMax = useMemo(
    () => (categories || []).reduce((sum, c) => sum + (Number(c?.maxScore) || 0), 0),
    [categories],
  );

  const updateCategory = (idx: number, patch: Partial<ScoringCategory>) => {
    setCategories(prev => (prev || []).map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const addCategory = () => {
    setCategories(prev => [
      ...(prev || []),
      {
        key: `cat_${Date.now()}`,
        label: 'New criterion',
        col1Header: 'Column 1',
        col2Header: 'Remarks / Evidence',
        maxScore: 10,
        tiers: [
          { id: `t_${Date.now()}`, scoreThreshold: 2, col1Value: '', col2Value: '' },
        ],
      },
    ]);
  };

  const deleteCategory = (idx: number) => {
    setCategories(prev => (prev || []).filter((_, i) => i !== idx));
  };

  const updateTier = (catIdx: number, tierId: string, patch: Partial<ScoringTier>) => {
    setCategories(prev =>
      (prev || []).map((c, i) =>
        i === catIdx
          ? {
              ...c,
              tiers: (c.tiers || []).map(t => (t.id === tierId ? { ...t, ...patch } : t)),
            }
          : c,
      ),
    );
  };

  const addTier = (catIdx: number) => {
    setCategories(prev =>
      (prev || []).map((c, i) =>
        i === catIdx
          ? {
              ...c,
              tiers: [
                ...(c.tiers || []),
                {
                  id: `t_${Date.now()}`,
                  scoreThreshold:
                    ((c.tiers || []).at(-1)?.scoreThreshold || 0) + 2,
                  col1Value: '',
                  col2Value: '',
                },
              ],
            }
          : c,
      ),
    );
  };

  const deleteTier = (catIdx: number, tierId: string) => {
    setCategories(prev =>
      (prev || []).map((c, i) =>
        i === catIdx
          ? { ...c, tiers: (c.tiers || []).filter(t => t.id !== tierId) }
          : c,
      ),
    );
  };

  const updateCommitment = (id: string, patch: Partial<CommitmentItem>) => {
    setCommitments(prev => (prev || []).map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addCommitment = () => {
    setCommitments(prev => [
      ...(prev || []),
      { id: `c${Date.now()}`, text: 'New commitment', checkedByDefault: false },
    ]);
  };

  const deleteCommitment = (id: string) => {
    setCommitments(prev => (prev || []).filter(c => c.id !== id));
  };

  const handleSave = async () => {
    const template = {
      type,
      scoring_schema: (categories || []).map(c => ({
        key: c?.key,
        label: c?.label,
        col1_header: c?.col1Header,
        col2_header: c?.col2Header,
        max_score: c?.maxScore,
        tiers: (c?.tiers || []).map(t => ({
          id: t?.id,
          score_threshold: t?.scoreThreshold,
          col1_value: t?.col1Value,
          col2_value: t?.col2Value,
        })),
      })),
      commitments_schema: (commitments || []).map(c => ({
        id: c?.id,
        text: c?.text,
        checked_by_default: c?.checkedByDefault,
      })),
    };

    try {
      if (type === 'dealer') {
        // TODO: supabase.from('form_templates').upsert({ type: 'dealer', scoring_schema: ..., commitments_schema: ... })
      } else if (type === 'farmer') {
        // TODO: supabase.from('form_templates').upsert({ type: 'farmer', scoring_schema: ..., commitments_schema: ... })
      } else if (type === 'distributor') {
        // TODO: supabase.from('form_templates').upsert({ type: 'distributor', scoring_schema: ..., commitments_schema: ... })
      }
      console.log(`[Form Template - ${type}] Save payload:`, template);
      toast.success(`${title} saved`);
    } catch {
      toast.error(`Failed to save ${title}`);
    }
  };

  const saveLabel =
    type === 'dealer'
      ? 'Save Dealer Template'
      : type === 'farmer'
      ? 'Save Farmer Template'
      : 'Save Distributor Template';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Manage the global onboarding form template used by field SEs for {type}s.
        </p>
        <Button onClick={handleSave} className="gap-1">
          <Save className="h-4 w-4" /> {saveLabel}
        </Button>
      </div>

      {/* Section B: Scoring Categories */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Scoring / Evaluation Criteria
          <span className="ml-auto text-xs text-muted-foreground font-normal">
            Total max: <span className="font-semibold text-foreground">{totalMax}</span>
          </span>
        </h3>
        <Separator />

        <Accordion type="multiple" className="space-y-2 pt-2">
          {(categories || []).map((c, idx) => (
            <AccordionItem
              key={c?.key || idx}
              value={c?.key || `cat-${idx}`}
              className="border border-border rounded-md bg-card px-3"
            >
              <div className="flex items-center gap-2">
                <AccordionTrigger className="flex-1 hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-left">
                    <span className="text-sm font-medium">{c?.label || 'Untitled'}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(c?.tiers || []).length} tiers · max {c?.maxScore ?? 0})
                    </span>
                  </div>
                </AccordionTrigger>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={e => {
                    e.stopPropagation();
                    deleteCategory(idx);
                  }}
                  aria-label="Delete category"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <AccordionContent className="pt-2 pb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Category label</label>
                    <Input
                      value={c?.label || ''}
                      onChange={e => updateCategory(idx, { label: e.target.value })}
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Column 1 header</label>
                    <Input
                      value={c?.col1Header || ''}
                      onChange={e => updateCategory(idx, { col1Header: e.target.value })}
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Column 2 header</label>
                    <Input
                      value={c?.col2Header || ''}
                      onChange={e => updateCategory(idx, { col2Header: e.target.value })}
                      className="h-9 mt-1"
                    />
                  </div>
                </div>

                <div className="rounded-md border border-border overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted text-xs font-medium text-muted-foreground">
                    <div className="col-span-2">Score ≤</div>
                    <div className="col-span-4">{c?.col1Header || 'Column 1'}</div>
                    <div className="col-span-5">{c?.col2Header || 'Column 2'}</div>
                    <div className="col-span-1" />
                  </div>
                  <div className="divide-y divide-border">
                    {(c?.tiers || []).map(t => (
                      <div
                        key={t.id}
                        className="grid grid-cols-12 gap-2 px-3 py-2 items-center"
                      >
                        <div className="col-span-2">
                          <Input
                            type="number"
                            value={t?.scoreThreshold ?? 0}
                            onChange={e =>
                              updateTier(idx, t.id, {
                                scoreThreshold: Number(e.target.value) || 0,
                              })
                            }
                            className="h-9 max-w-[80px]"
                          />
                        </div>
                        <div className="col-span-4">
                          <Input
                            value={t?.col1Value || ''}
                            onChange={e =>
                              updateTier(idx, t.id, { col1Value: e.target.value })
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-5">
                          <Input
                            value={t?.col2Value || ''}
                            onChange={e =>
                              updateTier(idx, t.id, { col2Value: e.target.value })
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteTier(idx, t.id)}
                            aria-label="Delete tier"
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addTier(idx)}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add tier
                  </Button>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Max score</label>
                    <Input
                      type="number"
                      min={1}
                      value={c?.maxScore ?? 0}
                      onChange={e =>
                        updateCategory(idx, {
                          maxScore: Math.max(1, Number(e.target.value) || 0),
                        })
                      }
                      className="h-9 w-20"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Button size="sm" variant="outline" onClick={addCategory} className="gap-1 mt-2">
          <Plus className="h-4 w-4" /> Add new category
        </Button>
      </section>

      {/* Section C: Commitments */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Commitments & Compliance Statements
        </h3>
        <Separator />
        <div className="pt-2 space-y-2">
          {(commitments || []).map(c => (
            <div
              key={c.id}
              className="flex items-center gap-2 p-2 rounded-md border border-border bg-card"
            >
              <Checkbox
                checked={c?.checkedByDefault}
                onCheckedChange={v => updateCommitment(c.id, { checkedByDefault: !!v })}
                aria-label="Checked by default"
              />
              <Input
                value={c?.text || ''}
                onChange={e => updateCommitment(c.id, { text: e.target.value })}
                className="h-9 flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteCommitment(c.id)}
                aria-label="Delete commitment"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addCommitment} className="gap-1">
            <Plus className="h-4 w-4" /> Add commitment
          </Button>
        </div>
      </section>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} className="gap-1">
          <Save className="h-4 w-4" /> {saveLabel}
        </Button>
      </div>
    </div>
  );
};

const SettingsPage = ({ onLogout }: SettingsPageProps) => {
  const [dealerCategories, setDealerCategories] = useState<ScoringCategory[]>(DEALER_CATEGORIES);
  const [dealerCommitments, setDealerCommitments] = useState<CommitmentItem[]>(DEALER_COMMITMENTS);

  const [farmerCategories, setFarmerCategories] = useState<ScoringCategory[]>(FARMER_CATEGORIES);
  const [farmerCommitments, setFarmerCommitments] = useState<CommitmentItem[]>(FARMER_COMMITMENTS);

  const [distributorCategories, setDistributorCategories] =
    useState<ScoringCategory[]>(DISTRIBUTOR_CATEGORIES);
  const [distributorCommitments, setDistributorCommitments] =
    useState<CommitmentItem[]>(DISTRIBUTOR_COMMITMENTS);

  return (
    <AppLayout onLogout={onLogout}>
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" /> Form Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage global onboarding form templates for Dealers, Farmers, and Distributors.
        </p>
      </div>

      <Tabs defaultValue="dealers" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="dealers">Dealer Template</TabsTrigger>
          <TabsTrigger value="farmers">Farmer Template</TabsTrigger>
          <TabsTrigger value="distributors">Distributor Template</TabsTrigger>
        </TabsList>

        <TabsContent value="dealers" className="mt-4">
          <TemplateEditor
            type="dealer"
            title="Dealer Template"
            categories={dealerCategories}
            commitments={dealerCommitments}
            setCategories={setDealerCategories}
            setCommitments={setDealerCommitments}
          />
        </TabsContent>

        <TabsContent value="farmers" className="mt-4">
          <TemplateEditor
            type="farmer"
            title="Farmer Template"
            categories={farmerCategories}
            commitments={farmerCommitments}
            setCategories={setFarmerCategories}
            setCommitments={setFarmerCommitments}
          />
        </TabsContent>

        <TabsContent value="distributors" className="mt-4">
          <TemplateEditor
            type="distributor"
            title="Distributor Template"
            categories={distributorCategories}
            commitments={distributorCommitments}
            setCategories={setDistributorCategories}
            setCommitments={setDistributorCommitments}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default SettingsPage;
