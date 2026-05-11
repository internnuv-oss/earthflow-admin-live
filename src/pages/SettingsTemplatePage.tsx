import { useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
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
  FileText,
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

interface AnnexureField {
  id: string;
  label: string;
  isInput: boolean;
}
interface Annexure {
  id: string;
  title: string;
  fields: AnnexureField[];
}
interface TermCondition {
  id: string;
  title: string;
  content: string;
  obligations?: string;
}
interface FinalCommitment {
  id: string;
  text: string;
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
];

const DEALER_COMMITMENTS: CommitmentItem[] = [
  { id: 'c1', text: 'GLS Commitments Accepted', checkedByDefault: true },
  { id: 'c2', text: 'Regulatory Compliance Checklist', checkedByDefault: true },
  { id: 'c3', text: 'Credit Policy Accepted', checkedByDefault: true },
  { id: 'c4', text: 'Exclusivity Agreement', checkedByDefault: false },
  { id: 'c5', text: 'Payment Terms Agreed', checkedByDefault: true },
];

const FARMER_COMMITMENTS: CommitmentItem[] = [
  { id: 'fc1', text: 'KYC / Aadhaar Verified', checkedByDefault: true },
  { id: 'fc2', text: 'Land Ownership Declaration', checkedByDefault: true },
  { id: 'fc3', text: 'Willing to Adopt Bio Inputs', checkedByDefault: false },
  { id: 'fc4', text: 'Consent for Field Visits', checkedByDefault: true },
];

const DISTRIBUTOR_COMMITMENTS: CommitmentItem[] = [
  { id: 'dc1', text: 'GST Registration Verified', checkedByDefault: true },
  { id: 'dc2', text: 'Warehouse Inspection Cleared', checkedByDefault: true },
  { id: 'dc3', text: 'Distribution Agreement Signed', checkedByDefault: true },
  { id: 'dc4', text: 'Exclusivity Clause Accepted', checkedByDefault: false },
  { id: 'dc5', text: 'Payment & Credit Terms Agreed', checkedByDefault: true },
];

const DEALER_ANNEXURES: Annexure[] = [
  { id: 'anx1', title: 'Annexure – A: Territory Coverage', fields: [
    { id: 'f1', label: 'Talukas covered:', isInput: true },
    { id: 'f2', label: 'Villages covered:', isInput: true },
    { id: 'f3', label: 'Total cultivable area:', isInput: true },
    { id: 'f4', label: 'Major crops in territory:', isInput: true },
  ]},
  { id: 'anx2', title: 'Annexure – B: Principal Companies & Product Range', fields: [
    { id: 'f5', label: '1. Principal suppliers:', isInput: true },
    { id: 'f6', label: '2. Chemical products range:', isInput: true },
    { id: 'f7', label: '3. Biological / organic products range:', isInput: true },
    { id: 'f8', label: '4. Other products:', isInput: true },
  ]},
  { id: 'anx3', title: 'Annexure – C: Infrastructure Details', fields: [
    { id: 'f9', label: 'Godown / storage capacity:', isInput: true },
    { id: 'f10', label: 'Photos required:', isInput: false },
  ]},
  { id: 'anx4', title: 'Annexure – D: Bank & Credit References', fields: [
    { id: 'f11', label: 'List of references with Name, Contact, and Behavior/Feedback.', isInput: true },
  ]},
  { id: 'anx5', title: 'Annexure – E: Monthly Sales Reporting Format', fields: [
    { id: 'f12', label: 'Confirmation that they will share monthly GLS sales breakup.', isInput: false },
  ]},
  { id: 'anx6', title: 'Annexure – F: Future Expansion Plan', fields: [
    { id: 'f13', label: 'Their 2-year growth vision and willingness to focus on biologicals.', isInput: true },
  ]},
];

const DEALER_TERMS: TermCondition[] = [
  { id: 't1', title: '1. Territory:', content: 'The Dealer shall operate primarily in the villages / area mentioned in Annexure A. The Dealer agrees not to actively sell GLS products outside the agreed area without prior approval.' },
  { id: 't2', title: '2. Status & Focus:', content: 'As an Authorised Dealer, the Dealer can directly honour GLS farmer schemes... As an Exclusive Dealer, the Dealer shall focus primarily on GLS biological products...' },
  { id: 't3', title: '3. Payment Terms:', content: 'Payment to be made to the linked Distributor as per mutually agreed terms. Timely payment is essential...' },
  { id: 't8', title: '8. Legal & Compliance:', content: 'The Dealer must hold and maintain all necessary licenses...' },
  { id: 't9', title: '9. Data Sharing and Confidentiality:', content: 'The Dealer agrees to share with GLS all necessary data generated during the partnership, including Farmer details and Sales records.', obligations: 'All shared data will be used by GLS only for the purpose of supporting farmers...\nThe Dealer shall collect farmer consent...\nBoth parties shall keep all shared information confidential...' },
  { id: 't10', title: '10. Termination:', content: 'Either party may terminate the appointment with 30 days written notice...' },
  { id: 't11', title: '11. Jurisdiction:', content: 'All disputes shall be subject to the exclusive jurisdiction of courts in Vadodara, Gujarat.' },
];

const DEALER_FINAL_COMMITMENTS: FinalCommitment[] = [
  { id: 'fc1', text: 'Promote GLS biological inputs following recommended crop packages.' },
  { id: 'fc2', text: 'Allow GLS field team to engage with my farmers for demos and support.' },
  { id: 'fc3', text: 'Honour loyalty program and Farm Card benefits for farmers.' },
  { id: 'fc4', text: 'Maintain proper storage and display for GLS products.' },
];

const seedCategories = (type: TemplateType): ScoringCategory[] => {
  if (type === 'dealer') return DEALER_CATEGORIES;
  if (type === 'farmer') return FARMER_CATEGORIES;
  return DISTRIBUTOR_CATEGORIES;
};

const seedCommitments = (type: TemplateType): CommitmentItem[] => {
  if (type === 'dealer') return DEALER_COMMITMENTS;
  if (type === 'farmer') return FARMER_COMMITMENTS;
  return DISTRIBUTOR_COMMITMENTS;
};

const seedAnnexures = (type: TemplateType): Annexure[] =>
  type === 'dealer' ? DEALER_ANNEXURES : [];
const seedTerms = (type: TemplateType): TermCondition[] =>
  type === 'dealer' ? DEALER_TERMS : [];
const seedFinalCommitments = (type: TemplateType): FinalCommitment[] =>
  type === 'dealer' ? DEALER_FINAL_COMMITMENTS : [];

interface SettingsTemplatePageProps {
  type: TemplateType;
  onLogout: () => void;
}

const SettingsTemplatePage = ({ type, onLogout }: SettingsTemplatePageProps) => {
  const [categories, setCategories] = useState<ScoringCategory[]>(() => seedCategories(type));
  const [commitments, setCommitments] = useState<CommitmentItem[]>(() => seedCommitments(type));
  const [annexures, setAnnexures] = useState<Annexure[]>(() => seedAnnexures(type));
  const [terms, setTerms] = useState<TermCondition[]>(() => seedTerms(type));
  const [finalCommitments, setFinalCommitments] = useState<FinalCommitment[]>(() =>
    seedFinalCommitments(type),
  );

  const totalMax = useMemo(
    () => (categories || []).reduce((sum, c) => sum + (Number(c?.maxScore) || 0), 0),
    [categories],
  );

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

  // ===== Scoring CRUD =====
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
        tiers: [{ id: `t_${Date.now()}`, scoreThreshold: 2, col1Value: '', col2Value: '' }],
      },
    ]);
  };
  const deleteCategory = (idx: number) =>
    setCategories(prev => (prev || []).filter((_, i) => i !== idx));

  const updateTier = (catIdx: number, tierId: string, patch: Partial<ScoringTier>) => {
    setCategories(prev =>
      (prev || []).map((c, i) =>
        i === catIdx
          ? { ...c, tiers: (c.tiers || []).map(t => (t.id === tierId ? { ...t, ...patch } : t)) }
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
                  scoreThreshold: ((c.tiers || []).at(-1)?.scoreThreshold || 0) + 2,
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
        i === catIdx ? { ...c, tiers: (c.tiers || []).filter(t => t.id !== tierId) } : c,
      ),
    );
  };

  // ===== Commitments CRUD =====
  const updateCommitment = (id: string, patch: Partial<CommitmentItem>) =>
    setCommitments(prev => (prev || []).map(c => (c.id === id ? { ...c, ...patch } : c)));
  const addCommitment = () =>
    setCommitments(prev => [
      ...(prev || []),
      { id: `c${Date.now()}`, text: 'New commitment', checkedByDefault: false },
    ]);
  const deleteCommitment = (id: string) =>
    setCommitments(prev => (prev || []).filter(c => c.id !== id));

  // ===== Annexures CRUD =====
  const updateAnnexure = (id: string, patch: Partial<Annexure>) =>
    setAnnexures(prev => (prev || []).map(a => (a.id === id ? { ...a, ...patch } : a)));
  const addAnnexure = () =>
    setAnnexures(prev => [
      ...(prev || []),
      { id: `anx_${Date.now()}`, title: 'New Annexure', fields: [] },
    ]);
  const deleteAnnexure = (id: string) =>
    setAnnexures(prev => (prev || []).filter(a => a.id !== id));
  const addAnnexureField = (annexureId: string) =>
    setAnnexures(prev =>
      (prev || []).map(a =>
        a.id === annexureId
          ? {
              ...a,
              fields: [
                ...(a.fields || []),
                { id: `f_${Date.now()}`, label: '', isInput: true },
              ],
            }
          : a,
      ),
    );
  const updateAnnexureField = (
    annexureId: string,
    fieldId: string,
    patch: Partial<AnnexureField>,
  ) =>
    setAnnexures(prev =>
      (prev || []).map(a =>
        a.id === annexureId
          ? {
              ...a,
              fields: (a.fields || []).map(f => (f.id === fieldId ? { ...f, ...patch } : f)),
            }
          : a,
      ),
    );
  const deleteAnnexureField = (annexureId: string, fieldId: string) =>
    setAnnexures(prev =>
      (prev || []).map(a =>
        a.id === annexureId
          ? { ...a, fields: (a.fields || []).filter(f => f.id !== fieldId) }
          : a,
      ),
    );

  // ===== Terms CRUD =====
  const updateTerm = (id: string, patch: Partial<TermCondition>) =>
    setTerms(prev => (prev || []).map(t => (t.id === id ? { ...t, ...patch } : t)));
  const addTerm = () =>
    setTerms(prev => [
      ...(prev || []),
      { id: `term_${Date.now()}`, title: 'New term', content: '' },
    ]);
  const deleteTerm = (id: string) =>
    setTerms(prev => (prev || []).filter(t => t.id !== id));
  const toggleObligations = (id: string) =>
    setTerms(prev =>
      (prev || []).map(t =>
        t.id === id ? { ...t, obligations: t.obligations === undefined ? '' : undefined } : t,
      ),
    );

  // ===== Final Commitments CRUD =====
  const updateFinalCommitment = (id: string, text: string) =>
    setFinalCommitments(prev => (prev || []).map(f => (f.id === id ? { ...f, text } : f)));
  const addFinalCommitment = () =>
    setFinalCommitments(prev => [
      ...(prev || []),
      { id: `fc_${Date.now()}`, text: '' },
    ]);
  const deleteFinalCommitment = (id: string) =>
    setFinalCommitments(prev => (prev || []).filter(f => f.id !== id));

  // ===== Save =====
  const handleSave = () => {
    const payload = {
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
      agreement_schema: {
        annexures: (annexures || []).map(a => ({
          id: a?.id,
          title: a?.title,
          fields: (a?.fields || []).map(f => ({
            id: f?.id,
            label: f?.label,
            is_input: f?.isInput,
          })),
        })),
        terms: (terms || []).map(t => ({
          id: t?.id,
          title: t?.title,
          content: t?.content,
          obligations: t?.obligations,
        })),
        final_commitments: (finalCommitments || []).map(f => ({
          id: f?.id,
          text: f?.text,
        })),
      },
    };

    // TODO: supabase.from('form_templates').upsert({ type, scoring_schema, commitments_schema, agreement_schema })
    console.log(`[Form Template - ${type}] Save payload:`, payload);
    toast.success(`${typeLabel} onboarding template saved`);
  };

  return (
    <AppLayout onLogout={onLogout}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            Manage {typeLabel} Onboarding Template
          </h2>
          <p className="text-sm text-muted-foreground">
            Global form template used by field SEs to onboard {type}s.
          </p>
        </div>
        <Button onClick={handleSave} className="gap-1">
          <Save className="h-4 w-4" /> Save Template
        </Button>
      </div>

      <Tabs defaultValue="criteria" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="criteria">Scoring Criteria</TabsTrigger>
          <TabsTrigger value="commitments">GLS Commitments</TabsTrigger>
          <TabsTrigger value="agreement">Legal Agreement</TabsTrigger>
        </TabsList>

        {/* Tab 1: Scoring Criteria */}
        <TabsContent value="criteria" className="mt-4 space-y-2">
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
        </TabsContent>

        {/* Tab 2: Commitments */}
        <TabsContent value="commitments" className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> GLS Commitments & Compliance Statements
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
        </TabsContent>

        {/* Tab 3: Legal Agreement */}
        <TabsContent value="agreement" className="mt-4 space-y-6">
          {/* Block 1: Annexures */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <FileText className="h-4 w-4" /> Annexures
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {(annexures || []).length} annexures
              </span>
            </h3>
            <Separator />
            <div className="pt-2 space-y-3">
              {(annexures || []).map(anx => (
                <Card key={anx.id} className="p-3 space-y-3 border border-border">
                  <div className="flex items-center gap-2">
                    <Input
                      value={anx?.title || ''}
                      onChange={e => updateAnnexure(anx.id, { title: e.target.value })}
                      placeholder="Annexure title"
                      className="h-9 flex-1 font-medium"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteAnnexure(anx.id)}
                      aria-label="Delete annexure"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(anx?.fields || []).map(f => (
                      <div
                        key={f.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded-md border border-border bg-muted/30"
                      >
                        <Input
                          value={f?.label || ''}
                          onChange={e =>
                            updateAnnexureField(anx.id, f.id, { label: e.target.value })
                          }
                          placeholder="Field label / statement"
                          className="h-9 flex-1"
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                          <Checkbox
                            checked={!!f?.isInput}
                            onCheckedChange={v =>
                              updateAnnexureField(anx.id, f.id, { isInput: !!v })
                            }
                          />
                          Requires SE Input?
                        </label>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteAnnexureField(anx.id, f.id)}
                          aria-label="Delete field"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addAnnexureField(anx.id)}
                      className="gap-1"
                    >
                      <Plus className="h-4 w-4" /> Add field
                    </Button>
                  </div>
                </Card>
              ))}
              <Button size="sm" variant="outline" onClick={addAnnexure} className="gap-1">
                <Plus className="h-4 w-4" /> Add annexure
              </Button>
            </div>
          </section>

          <Separator />

          {/* Block 2: Terms & Conditions */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <FileText className="h-4 w-4" /> Terms & Conditions
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {(terms || []).length} terms
              </span>
            </h3>
            <Separator />
            <div className="pt-2 space-y-3">
              {(terms || []).map(t => (
                <Card key={t.id} className="p-3 space-y-2 border border-border">
                  <div className="flex items-center gap-2">
                    <Input
                      value={t?.title || ''}
                      onChange={e => updateTerm(t.id, { title: e.target.value })}
                      placeholder="Term title"
                      className="h-9 flex-1 font-medium"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteTerm(t.id)}
                      aria-label="Delete term"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <Textarea
                    value={t?.content || ''}
                    onChange={e => updateTerm(t.id, { content: e.target.value })}
                    placeholder="Term content"
                    className="min-h-[100px] text-sm"
                  />
                  {t?.obligations !== undefined ? (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Obligations Details</label>
                      <Textarea
                        value={t?.obligations || ''}
                        onChange={e => updateTerm(t.id, { obligations: e.target.value })}
                        placeholder="Obligations under this term"
                        className="min-h-[100px] text-sm bg-muted"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleObligations(t.id)}
                        className="gap-1 text-destructive"
                      >
                        <X className="h-4 w-4" /> Remove obligations
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleObligations(t.id)}
                      className="gap-1"
                    >
                      <Plus className="h-4 w-4" /> Add obligations section
                    </Button>
                  )}
                </Card>
              ))}
              <Button size="sm" variant="outline" onClick={addTerm} className="gap-1">
                <Plus className="h-4 w-4" /> Add term
              </Button>
            </div>
          </section>

          <Separator />

          {/* Block 3: I/We Agree To */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> I / We Agree To (Final Commitments)
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {(finalCommitments || []).length} items
              </span>
            </h3>
            <Separator />
            <div className="pt-2 space-y-2">
              {(finalCommitments || []).map(fc => (
                <div
                  key={fc.id}
                  className="flex items-center gap-2 p-2 rounded-md border border-border bg-card"
                >
                  <Input
                    value={fc?.text || ''}
                    onChange={e => updateFinalCommitment(fc.id, e.target.value)}
                    placeholder="Commitment text"
                    className="h-9 flex-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteFinalCommitment(fc.id)}
                    aria-label="Delete commitment"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addFinalCommitment} className="gap-1">
                <Plus className="h-4 w-4" /> Add commitment
              </Button>
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} className="gap-1">
          <Save className="h-4 w-4" /> Save Template
        </Button>
      </div>
    </AppLayout>
  );
};

export default SettingsTemplatePage;
