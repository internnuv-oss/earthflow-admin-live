import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { FileText, Edit, Save, X, Loader2, Plus, Trash2, UploadCloud, ExternalLink, Check, ChevronsUpDown } from 'lucide-react';
import { KeyValueGrid, Section, renderValue } from '@/lib/jsonViewer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DealerRow } from './DealerTable';

// --- MOBILE APP SELECTION CONSTANTS ---
const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli", "Daman and Diu", "Delhi", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", 
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", 
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const INDIAN_BANKS = [
  "State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", 
  "Punjab National Bank", "Bank of Baroda", "Bank of India", "Union Bank of India"
].sort();

const DEMO_SUPPLIERS = ["Bayer", "Syngenta", "UPL", "Corteva", "FMC", "PI Industries", "Coromandel", "IFFCO"];
const DEMO_CHEMICALS = ["Urea", "DAP", "MOP", "SSP", "Complex Fertilizers", "Herbicides", "Insecticides", "Fungicides"];
const DEMO_BIOS = ["Bio-Fertilizers", "Bio-Pesticides", "Mycorrhiza", "Seaweed Extract", "Amino Acids", "Humic Acid", "PGPR"];
const DEMO_OTHERS = ["Seeds", "Micronutrients", "Tractors", "Implements", "Irrigation Equipment", "Tarpaulins"];

// --- SCORING CONSTANTS & HELPERS ---
const SCORING_ASPECTS = [
  { key: 'scoreFinancial', rem: 'remFinancial', label: 'Financial Health & Turnover', params: 'Annual turnover, payment discipline with suppliers' },
  { key: 'scoreReputation', rem: 'remReputation', label: 'Market Reputation', params: 'Feedback from local farmers & neighbouring dealers' },
  { key: 'scoreOperations', rem: 'remOperations', label: 'Shop Operations & Infrastructure', params: 'Shop visibility, storage space & condition, display area, hygiene' },
  { key: 'scoreFarmerNetwork', rem: 'remFarmerNetwork', label: 'Farmer Network & Reach', params: 'No. of regular farmer customers (target 50–200+), villages covered, loyalty' },
  { key: 'scoreTeam', rem: 'remTeam', label: 'Team & Professionalism', params: 'Owner involvement, staff quality, willingness to undergo training' },
  { key: 'scorePortfolio', rem: 'remPortfolio', label: 'Current Portfolio', params: 'Products currently sold (chemicals, seeds, bio), % bio sales if any' },
  { key: 'scoreExperience', rem: 'remExperience', label: 'Experience & Openness to Bio', params: 'Past experience with biologicals, openness to GLS packages & Field Executive' },
  { key: 'scoreGrowth', rem: 'remGrowth', label: 'Growth Orientation', params: 'Interest in Authorised/Exclusive status, capacity for ₹2.5–7.5 Lacs revenue' },
];

const getDynamicTableData = (key: string, score: number) => {
  if (key === 'scoreFinancial') {
    if (score <= 2) return ["₹5L - ₹10L", "Frequent defaults; relies on local high-interest lenders; high debt."];
    if (score <= 4) return ["₹10L - ₹25L", "\"Hand-to-mouth\" cash flow; pays only after 60+ days."];
    if (score <= 6) return ["₹25L - ₹60L", "Stable; pays within standard 30-day credit cycles."];
    if (score <= 8) return ["₹60L - ₹1 Cr", "Strong liquidity; pays before due dates; high credit limit."];
    return ["> ₹1 Cr", "Cash-rich; often pays advance for extra margins; zero friction."];
  }
  if (key === 'scoreReputation') {
    if (score <= 2) return ["Negative feedback", "Known for selling expired or substandard stock."];
    if (score <= 4) return ["Neutral/Basic", "Perceived as a small player; visited only for convenience."];
    if (score <= 6) return ["Reliable", "Known for fair pricing and providing standard, genuine products."];
    if (score <= 8) return ["Respected Advisor", "Farmers seek his advice; high ethical standing."];
    return ["Market Leader", "Influences village-level decisions; acts as a community leader."];
  }
  if (key === 'scoreOperations') {
    if (score <= 2) return ["<200 sq. ft. shop", "No godown; stock kept in shop/outside; messy."];
    if (score <= 4) return ["Standard shop", "No separate godown; stock piled in corners."];
    if (score <= 6) return ["Clean shop + Room", "Small storage room attached; pallets used; visible counters."];
    if (score <= 8) return ["Large shop + Godown", "1 dedicated off-site godown; prime location; clean branding."];
    return ["\"Model\" Outlet", "2+ large godowns; separate office; digital billing."];
  }
  if (key === 'scoreFarmerNetwork') {
    if (score <= 2) return ["< 40 farmers", "Limited to the immediate neighborhood only."];
    if (score <= 4) return ["40 - 80 farmers", "Covers 2-3 nearby villages."];
    if (score <= 6) return ["80 - 150 farmers", "Covers 4-7 villages; good repeat walk-in customers."];
    if (score <= 8) return ["150 - 250 farmers", "Covers 8-12 villages; massive loyalty."];
    return ["> 250 farmers", "Covers 15+ villages (Entire Block)."];
  }
  if (key === 'scoreTeam') {
    if (score <= 2) return ["Owner absent", "No staff; shop managed by untrained family/helpers."];
    if (score <= 4) return ["Owner semi-active", "1 helper (unskilled); resistant to new methods."];
    if (score <= 6) return ["Owner active", "1-2 trained staff; participates in training occasionally."];
    if (score <= 8) return ["Professional Setup", "3+ staff; dedicated field person; eager for tech growth."];
    return ["Highly Proactive", "Organized team; demo executive; hosts farmer training."];
  }
  if (key === 'scorePortfolio') {
    if (score <= 2) return ["Commodities", "Only Urea/DAP; focuses on low-margin generic bulk."];
    if (score <= 4) return ["Generic Mix", "Mostly seeds & 80% generic/unbranded pesticides."];
    if (score <= 6) return ["Balanced", "Mix of branded and generic; stocks standard seeds."];
    if (score <= 8) return ["High-Value", "Focuses on specialty chemicals; values quality over price."];
    return ["Premium", "Specialized in Horticulture/IPM; pushes high-end solutions."];
  }
  if (key === 'scoreExperience') {
    if (score <= 2) return ["Negative", "\"Bio doesn't work\" mindset; 0% Bio sales."];
    if (score <= 4) return ["Skeptical", "Has tried poor quality bio before; <3% Bio sales."];
    if (score <= 6) return ["Open", "Sells bio on recommendation; 3-8% Bio sales."];
    if (score <= 8) return ["Bio-Proactive", "Willing to stock packages; 8-15% Bio sales."];
    return ["\"Bio-Expert\"", "Actively pushes biologicals as first-line defense; >15% Bio sales."];
  }
  if (key === 'scoreGrowth') {
    if (score <= 2) return ["< ₹1 Lac", "No interest; \"just another supplier\" attitude."];
    if (score <= 4) return ["₹1 - ₹2 Lacs", "Content with current scale; no commitment to targets."];
    if (score <= 6) return ["₹2.5 - ₹4 Lacs", "Wants \"Authorized\" status; will share farmer data."];
    if (score <= 8) return ["₹4 - ₹6 Lacs", "High interest in exclusivity; requests branding help."];
    return ["₹7.5 Lacs +", "Wants to be the lead regional partner; drives massive volume."];
  }
  return ["Evaluation", "Score determines capability."];
};

// --- SEARCHABLE MULTI-SELECT DROPDOWN COMPONENT ---
const SearchableMultiSelect = ({ label, options, selected, onChange }: { label: string, options: string[], selected: string[], onChange: (val: string[]) => void }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal text-sm bg-background border border-input h-9 px-3">
          <span className="truncate">{selected.length > 0 ? selected.join(', ') : `Select ${label}...`}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      if (isSelected) onChange(selected.filter(x => x !== opt));
                      else onChange([...selected, opt]);
                    }}
                  >
                    <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                      <Check className="h-4 w-4" />
                    </div>
                    <span>{opt}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// --- SEARCHABLE SINGLE SELECT DROPDOWN COMPONENT ---
const SearchableSingleSelect = ({ label, options, value, onChange, placeholder }: { label: string, options: string[], value: string, onChange: (val: string) => void, placeholder?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal text-sm bg-background border border-input h-9 px-3">
          <span className="truncate">{value || placeholder || `Select ${label}...`}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface Props { 
  dealer: DealerRow | null; 
  open: boolean; 
  onClose: () => void;
  onSaved?: () => void;
}

const safeArray = (val: any): string[] => {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string' && val) return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

const DealerDetailSheet = ({ dealer: d, open, onClose, onSaved }: Props) => {
  const { toast } = useToast();
  
  // --- EDIT STATE ---
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // === STEP 1: BASIC INFO ===
  const [shopName, setShopName] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [landlineNumber, setLandlineNumber] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [gst, setGst] = useState('');
  const [pan, setPan] = useState('');
  const [estYear, setEstYear] = useState('');
  const [firmType, setFirmType] = useState('');
  const [loc, setLoc] = useState({ state: '', city: '', taluka: '', village: '' });
  const [owners, setOwners] = useState<{name: string}[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  // === STEP 2: SCORING ===
  const [scoringData, setScoringData] = useState<Record<string, any>>({});

  // === STEP 3: BUSINESS DETAILS ===
  const [hasAdditionalLocations, setHasAdditionalLocations] = useState('');
  const [additionalShops, setAdditionalShops] = useState<any[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [isLinkedToDistributor, setIsLinkedToDistributor] = useState('');
  const [linkedDistributors, setLinkedDistributors] = useState<any[]>([]);
  const [proposedStatus, setProposedStatus] = useState('');
  const [willingDemoFarmers, setWillingDemoFarmers] = useState('');
  const [demoFarmers, setDemoFarmers] = useState<any[]>([]);

  // === STEP 6: DOCUMENTS & FILE UPLOADER ===
  const [documentsObj, setDocumentsObj] = useState<Record<string, any>>({});
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);

  // === STEP 7: ANNEXURES ===
  const [seTerritories, setSeTerritories] = useState<any[]>([]);
  const [sePrincipalSuppliers, setSePrincipalSuppliers] = useState<string[]>([]);
  const [seChemicalProducts, setSeChemicalProducts] = useState<string[]>([]);
  const [seBioProducts, setSeBioProducts] = useState<string[]>([]);
  const [seOtherProducts, setSeOtherProducts] = useState<string[]>([]);
  const [seHasCreditReferences, setSeHasCreditReferences] = useState('');
  const [seCreditReferences, setSeCreditReferences] = useState<any[]>([]);
  const [seWillShareSales, setSeWillShareSales] = useState('No');
  const [seGrowthVision, setSeGrowthVision] = useState('');
  const [seSecurityDeposit, setSeSecurityDeposit] = useState('');
  const [sePaymentProofText, setSePaymentProofText] = useState('');

  // Cascading Location States
  const [stateData, setStateData] = useState<any>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [talukas, setTalukas] = useState<string[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(false);

  // Load cascading datasets based on chosen State
  useEffect(() => {
    if (!loc.state || !isEditing) { setStateData(null); setCities([]); return; }
    const fetchStateData = async () => {
      setLoadingLoc(true);
      try {
        const res = await fetch(`https://raw.githubusercontent.com/internnuv-oss/indian-cities-and-villages/master/By%20States/${encodeURIComponent(loc.state)}.json`);
        if (!res.ok) throw new Error("State location catalog not found.");
        setStateData(await res.json());
      } catch (e) {
        setCities([]); setStateData(null);
      } finally { setLoadingLoc(false); }
    };
    fetchStateData();
  }, [loc.state, isEditing]);

  useEffect(() => {
    if (!stateData || !stateData.districts) return setCities([]);
    setCities(stateData.districts.map((d: any) => d.district).sort());
  }, [stateData]);

  useEffect(() => {
    if (!loc.city || !stateData || !stateData.districts) return setTalukas([]);
    const dist = stateData.districts.find((d: any) => d.district === loc.city);
    if (dist && dist.subDistricts) setTalukas(dist.subDistricts.map((sd: any) => sd.subDistrict).sort());
    else setTalukas([]);
  }, [loc.city, stateData]);

  // LOAD DATA ON OPEN
  useEffect(() => {
    if (d && open) {
      setShopName(d.primary_shop_name || '');
      setContactMobile(d.contact_mobile || '');
      setAddress(d.primary_address || '');
      setGst(d.gst_number || '');
      setPan(d.pan_number || '');
      setEstYear(d.est_year || '');
      setFirmType(d.firm_type || '');

      const pl = d.primary_shop_location || {};
      setLoc({ state: pl.state || '', city: pl.city || '', taluka: pl.taluka || '', village: pl.village || '' });
      setLandlineNumber(pl.landlineNumber || '');
      setLandmark(pl.landmark || '');

      setOwners(Array.isArray(d.owners_list) && d.owners_list.length ? d.owners_list : [{name: ''}]);
      setBankAccounts(Array.isArray(d.bank_details?.bankAccounts) ? d.bank_details.bankAccounts : []);

      setScoringData(d.scoring || {});

      const comms = d.commitments || {};
      setProposedStatus(comms.proposedStatus || '');
      setWillingDemoFarmers(comms.willingDemoFarmers || '');
      setHasAdditionalLocations(comms.hasAdditionalLocations || '');
      setIsLinkedToDistributor(comms.isLinkedToDistributor || '');

      const addlLocs = d.additional_locations || {};
      setAdditionalShops(Array.isArray(addlLocs.additionalShops) ? addlLocs.additionalShops : []);
      setGodowns(Array.isArray(addlLocs.godowns) ? addlLocs.godowns : []);

      setLinkedDistributors(Array.isArray(d.distributor_links) ? d.distributor_links : []);
      setDemoFarmers(Array.isArray(d.demo_farmers_data) ? d.demo_farmers_data : []);

      setDocumentsObj(d.documents || {});

      const anx = d.annexures || {};
      setSeTerritories(Array.isArray(anx.seTerritories) ? anx.seTerritories.map((t: any) => ({
        ...t, 
        village: Array.isArray(t?.village) ? t.village.join(', ') : (t?.village || ''),
        majorCrops: Array.isArray(t?.majorCrops) ? t.majorCrops.join(', ') : (t?.majorCrops || '')
      })) : []);
      setSePrincipalSuppliers(safeArray(anx.sePrincipalSuppliers));
      setSeChemicalProducts(safeArray(anx.seChemicalProducts));
      setSeBioProducts(safeArray(anx.seBioProducts));
      setSeOtherProducts(safeArray(anx.seOtherProducts));
      
      setSeHasCreditReferences(anx.seHasCreditReferences || '');
      setSeCreditReferences(Array.isArray(anx.seCreditReferences) ? anx.seCreditReferences : []);
      setSeWillShareSales(anx.seWillShareSales ? 'Yes' : 'No');
      setSeGrowthVision(anx.seGrowthVision || '');
      setSeSecurityDeposit(anx.seSecurityDeposit || '');
      setSePaymentProofText(anx.sePaymentProofText || '');
    }
  }, [d, open, isEditing]);

  // CLINICAL IN-APP COMPLIANT FORM VALIDATION ENGINE
  const validateForm = () => {
    if (!shopName.trim() || shopName.trim().length < 2) return "Shop Name is required (Min 2 characters).";
    if (!firmType) return "Type of Firm is required.";
    if (!/^\d{4}$/.test(estYear)) return "Establishment Year must be a 4-digit number.";
    if (!loc.state) return "State is required.";
    if (!loc.city) return "City/District is required.";
    if (!loc.taluka) return "Taluka/Tehsil is required.";
    if (!loc.village.trim()) return "Village is required.";
    if (!address.trim() || address.trim().length < 5) return "Shop Address is required (Min 5 characters).";
    
    if (!/^\d{10}$/.test(contactMobile)) return "Mobile Number must be exactly 10 digits.";
    if (landlineNumber && !/^[0-9]{3,5}[- ]?[0-9]{6,8}$/.test(landlineNumber)) return "Invalid Landline format.";
    
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst)) return "Invalid GST format pattern.";
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) return "Invalid PAN format pattern.";

    for (let i = 0; i < bankAccounts.length; i++) {
      const b = bankAccounts[i];
      if (!b.accountType || !b.bankName || !b.bankBranch || !b.accountName || !b.accountNumber || !b.bankIfsc) {
        return `All fields are strictly required for Bank Account ${i + 1}.`;
      }
      if (!/^\d{9,18}$/.test(b.accountNumber)) return `Account Number must be 9-18 digits for Bank Account ${i + 1}.`;
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(b.bankIfsc)) return `Invalid IFSC format pattern for Bank Account ${i + 1}.`;
    }

    if (seHasCreditReferences === 'Yes') {
      for (let i = 0; i < seCreditReferences.length; i++) {
        const ref = seCreditReferences[i];
        if (!ref.name.trim()) return `Name is required for Credit Reference ${i + 1}.`;
        if (ref.contact && !/^\d{10}$/.test(ref.contact)) return `Contact number must be 10 digits for Reference ${i + 1}.`;
      }
    }

    if (seSecurityDeposit && parseInt(seSecurityDeposit) > 0) {
      if (!sePaymentProofText.trim() && !documentsObj?.['se_payment_proof']) {
        return "Payment proof (Text reference or attachment) is required for deposits matching greater than ₹0.";
      }
    }

    return null; 
  };

  // CLOUDINARY FILE UPLOAD HANDLER
  const handleFileUpload = async () => {
    if (!newDocName.trim() || !newDocFile) {
      toast({ title: "Missing info", description: "Please provide a document name and select a file.", variant: "destructive" });
      return;
    }
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', newDocFile);
      formData.append('upload_preset', 'YOUR_UPLOAD_PRESET'); 
      const cloudinaryUrl = 'https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload';

      const res = await fetch(cloudinaryUrl, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.secure_url) {
        setDocumentsObj(prev => ({ ...prev, [newDocName.trim()]: data.secure_url }));
        setNewDocName(''); setNewDocFile(null);
        toast({ title: "Upload Success", description: "File successfully uploaded." });
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSave = async () => {
    if (!d) return;

    const validationError = validateForm();
    if (validationError) {
      toast({ title: "Validation Error", description: validationError, variant: "destructive" });
      return;
    }

    setSaving(true);
    const primaryContact = owners.length > 0 ? owners[0].name : '';
    const historyEntry = { timestamp: new Date().toISOString(), action: 'Admin Edited Profile', updated_status: d.status };
    const update_history = [...(d.update_history || []), historyEntry];

    // ==========================================
    // 1. IF IT'S A DRAFT: Update the drafts table
    // ==========================================
    if (d.status === 'DRAFT') {
      const draft_data = {
        shopName, contactMobile, landlineNumber, address, landmark,
        gstNumber: gst, panNumber: pan, estYear, firmType,
        state: loc.state, city: loc.city, taluka: loc.taluka, village: loc.village,
        owners, bankAccounts,
        hasAdditionalLocations, additionalShops, godowns,
        isLinkedToDistributor, linkedDistributors,
        proposedStatus, willingDemoFarmers, demoFarmers,
        documents: documentsObj,
        seTerritories: seTerritories.map(t => ({
          ...t,
          village: t.village.split(',').map((s:string)=>s.trim()).filter(Boolean),
          majorCrops: t.majorCrops.split(',').map((s:string)=>s.trim()).filter(Boolean)
        })),
        sePrincipalSuppliers,
        seChemicalProducts,
        seBioProducts,
        seOtherProducts,
        seHasCreditReferences, seCreditReferences,
        seWillShareSales: seWillShareSales === 'Yes',
        seGrowthVision, seSecurityDeposit, sePaymentProofText
      };

      const { error } = await (supabase as any)
        .from('drafts')
        .update({ draft_data, updated_at: new Date().toISOString(), update_history })
        .or(`id.eq.${d.id},entity_id.eq.${d.id}`);

      setSaving(false);
      if (error) return toast({ title: 'Failed to save draft', description: error.message, variant: 'destructive' });
      toast({ title: 'Success', description: 'Draft updated successfully.' });
      setIsEditing(false);
      if (onSaved) onSaved(); 
      onClose();
      return;
    }

    // ==========================================
    // 2. IF IT'S SUBMITTED: Update the dealers table
    // ==========================================
    const primary_shop_location = { ...loc, landmark, landlineNumber };
    const bank_details = { ...d.bank_details, bankAccounts };
    const additional_locations = { additionalShops, godowns };
    
    const commitments = {
      ...d.commitments,
      proposedStatus, willingDemoFarmers, hasAdditionalLocations, isLinkedToDistributor
    };

    const scoresArray = SCORING_ASPECTS.map(a => Number(scoringData[a.key]) || 0);
    const total_score = scoresArray.reduce((acc, val) => acc + val, 0);
    let category = 'C-Category';
    if (total_score > 60) category = 'Elite'; 
    else if (total_score >= 46) category = 'A-Category'; 
    else if (total_score >= 26) category = 'B-Category';

    const annexures = {
      ...d.annexures,
      seTerritories: seTerritories.map(t => ({
        ...t,
        village: t.village.split(',').map((s:string)=>s.trim()).filter(Boolean),
        majorCrops: t.majorCrops.split(',').map((s:string)=>s.trim()).filter(Boolean)
      })),
      sePrincipalSuppliers,
      seChemicalProducts,
      seBioProducts,
      seOtherProducts,
      seHasCreditReferences,
      seCreditReferences,
      seGrowthVision,
      seSecurityDeposit,
      sePaymentProofText
    };

    const { error } = await (supabase as any)
      .from('dealers')
      .update({
        primary_shop_name: shopName,
        contact_person: primaryContact,
        contact_mobile: contactMobile,
        primary_address: address,
        gst_number: gst,
        pan_number: pan,
        est_year: estYear,
        firm_type: firmType,
        primary_shop_location,
        owners_list: owners,
        bank_details,
        additional_locations,
        distributor_links: linkedDistributors,
        demo_farmers_data: demoFarmers,
        commitments,
        scoring: scoringData, 
        total_score, 
        category, 
        annexures, 
        documents: documentsObj, 
        update_history 
      })
      .eq('id', d.id);

    setSaving(false);

    if (error) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Dealer details updated successfully.' });
      setIsEditing(false);
      if (onSaved) onSaved(); 
      onClose();
    }
  };

  const updateArr = (setter: any, idx: number, key: string, val: any) => setter((prev: any) => prev.map((item: any, i: number) => i === idx ? { ...item, [key]: val } : item));
  const removeArr = (setter: any, idx: number) => setter((prev: any) => prev.filter((_: any, i: number) => i !== idx));

  if (!d) return null;

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) { setIsEditing(false); onClose(); } }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="space-y-1 mb-2">
                  <Label className="text-xs text-muted-foreground">Shop Name *</Label>
                  <Input value={shopName} onChange={e => setShopName(e.target.value)} className="text-lg font-bold h-9 w-full max-w-sm" />
                </div>
              ) : (
                <>
                  <SheetTitle className="text-xl truncate">{d?.primary_shop_name || 'Dealer'}</SheetTitle>
                  <SheetDescription className="sr-only">Dealer details and configuration panel.</SheetDescription> 
                </>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span>Onboarded by {d?.profiles?.name || 'N/A'}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge>{d?.status || 'DRAFT'}</Badge>
              {!isEditing && d?.category && <Badge variant="secondary">{d.category}</Badge>}

              {!isEditing && (
                <Button size="sm" variant="outline" className="h-8 mt-1" onClick={() => setIsEditing(true)}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit Profile
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 flex flex-wrap h-auto gap-2">
            <TabsTrigger value="basic">1. Basic</TabsTrigger>
            <TabsTrigger value="scoring">2. Scoring</TabsTrigger>
            <TabsTrigger value="business">3. Business</TabsTrigger>
            <TabsTrigger value="docs">6. Docs</TabsTrigger>
            <TabsTrigger value="anx">7. Annexures</TabsTrigger>
            <TabsTrigger value="eval">View</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1 mt-3">
            <div className="px-6 pb-8">
              
              {/* TAB 1: BASIC INFO */}
              <TabsContent value="basic" className="space-y-4 mt-0">
                <Section title="Primary Shop Details">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label>Mobile Number *</Label><Input value={contactMobile} maxLength={10} type="tel" onChange={e => setContactMobile(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>Landline Number</Label><Input value={landlineNumber} type="tel" onChange={e => setLandlineNumber(e.target.value)} /></div>
                        
                        <div className="space-y-1.5">
                          <Label>State *</Label>
                          <SearchableSingleSelect label="State" options={INDIAN_STATES} value={loc.state} onChange={v => setLoc(p => ({ ...p, state: v, city: '', taluka: '' }))} placeholder="Select State" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>{loadingLoc ? "City/District (Loading...) *" : "City/District *"}</Label>
                          <SearchableSingleSelect label="District" options={cities} value={loc.city} onChange={v => setLoc(p => ({ ...p, city: v, taluka: '' }))} placeholder="Select District" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Taluka *</Label>
                          <SearchableSingleSelect label="Taluka" options={talukas} value={loc.taluka} onChange={v => setLoc(p => ({ ...p, taluka: v }))} placeholder="Select Taluka" />
                        </div>

                        <div className="space-y-1.5"><Label>Village *</Label><Input value={loc.village} onChange={e => setLoc(p => ({...p, village: e.target.value}))} /></div>
                        <div className="space-y-1.5 sm:col-span-2"><Label>Full Address *</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>Landmark</Label><Input value={landmark} onChange={e => setLandmark(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>GST Number *</Label><Input value={gst} maxLength={15} onChange={e => setGst(e.target.value.toUpperCase())} /></div>
                        <div className="space-y-1.5"><Label>PAN Number *</Label><Input value={pan} maxLength={10} onChange={e => setPan(e.target.value.toUpperCase())} /></div>
                        <div className="space-y-1.5"><Label>Established Year *</Label><Input value={estYear} maxLength={4} onChange={e => setEstYear(e.target.value)} /></div>
                        
                        <div className="space-y-1.5">
                          <Label>Firm Type *</Label>
                          <SearchableSingleSelect label="Firm Type" options={['Proprietorship', 'Partnership', 'Pvt Ltd']} value={firmType} onChange={setFirmType} placeholder="Select type" />
                        </div>
                      </div>
                      
                      <div className="space-y-2 mt-4 pt-4 border-t border-border">
                        <Label className="font-bold">Owners / Partners</Label>
                        {owners.map((owner, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <Input placeholder="Full Name" value={owner.name} onChange={e => updateArr(setOwners, i, 'name', e.target.value)} className="flex-1 h-8" />
                            {i > 0 && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeArr(setOwners, i)}><Trash2 className="h-4 w-4"/></Button>}
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setOwners(p => [...p, {name:''}])}><Plus className="h-4 w-4 mr-2"/> Add Owner</Button>
                      </div>
                    </div>
                  ) : (
                    <KeyValueGrid data={{ 'Contact Person': d?.contact_person, 'Mobile': d?.contact_mobile, 'Address': d?.primary_address, 'GST': d?.gst_number, 'PAN': d?.pan_number, 'Firm Type': d?.firm_type, 'Established': d?.est_year }} />
                  )}
                </Section>
                
                <Section title="Bank Accounts">
                  {isEditing ? (
                    <div className="space-y-4">
                      {bankAccounts.map((acc, i) => (
                        <div key={i} className="p-3 bg-muted/20 border border-border rounded-md relative space-y-3">
                          <div className="flex justify-between items-center mb-1">
                            <Label className="font-bold text-primary">Account {i + 1}</Label>
                            {i > 0 && <Button variant="ghost" size="icon" className="text-destructive h-6 w-6" onClick={() => removeArr(setBankAccounts, i)}><Trash2 className="h-4 w-4"/></Button>}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Bank Name *</Label>
                              <SearchableSingleSelect label="Bank Name" options={INDIAN_BANKS} value={acc.bankName} onChange={v => updateArr(setBankAccounts, i, 'bankName', v)} placeholder="Select Bank" />
                            </div>
                            <div className="space-y-1"><Label className="text-[10px]">Account Name *</Label><Input value={acc.accountName} onChange={e => updateArr(setBankAccounts, i, 'accountName', e.target.value)} className="h-8" /></div>
                            <div className="space-y-1"><Label className="text-[10px]">Account Number *</Label><Input value={acc.accountNumber} maxLength={18} onChange={e => updateArr(setBankAccounts, i, 'accountNumber', e.target.value)} className="h-8" /></div>
                            <div className="space-y-1"><Label className="text-[10px]">IFSC *</Label><Input value={acc.bankIfsc} maxLength={11} onChange={e => updateArr(setBankAccounts, i, 'bankIfsc', e.target.value.toUpperCase())} className="h-8" /></div>
                            <div className="space-y-1"><Label className="text-[10px]">Branch *</Label><Input value={acc.bankBranch} onChange={e => updateArr(setBankAccounts, i, 'bankBranch', e.target.value)} className="h-8" /></div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Type *</Label>
                              <SearchableSingleSelect label="Account Type" options={['Savings', 'Current', 'Overdraft', 'Cash Credit (CC)']} value={acc.accountType} onChange={v => updateArr(setBankAccounts, i, 'accountType', v)} placeholder="Type" />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setBankAccounts(p => [...p, {bankName:'', accountName:'', accountNumber:'', bankIfsc:'', bankBranch:'', accountType:''}])}><Plus className="h-4 w-4 mr-2" /> Add Bank Account</Button>
                    </div>
                  ) : (
                    renderValue(d?.bank_details?.bankAccounts)
                  )}
                </Section>
              </TabsContent>

              {/* TAB 2: SCORING */}
              <TabsContent value="scoring" className="space-y-4 mt-0">
                <Section title="Dealer Profiling & Scoring">
                  {isEditing ? (
                    <div className="space-y-6">
                      {SCORING_ASPECTS.map((aspect) => {
                        const currentScore = Number(scoringData[aspect.key]) || 1;
                        const [evalLabel, evalDesc] = getDynamicTableData(aspect.key, currentScore);
                        
                        return (
                          <div key={aspect.key} className="bg-muted/10 p-4 rounded-lg border border-border">
                            <div className="flex justify-between items-center mb-2">
                              <Label className="font-bold text-base">{aspect.label}</Label>
                              <div className="flex items-center gap-2">
                                <Label className="text-xs font-semibold text-primary">Score (1-10):</Label>
                                <Input type="number" min="1" max="10" value={scoringData[aspect.key] || ''} onChange={e => setScoringData(p => ({...p, [aspect.key]: Number(e.target.value)}))} className="w-16 h-8 text-center font-bold" />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">{aspect.params}</p>
                            
                            <div className="bg-primary/5 border border-primary/20 p-3 rounded-md mb-3">
                              <Label className="text-xs font-bold text-primary block mb-1">Score Implication: <span className="text-foreground">{evalLabel}</span></Label>
                              <p className="text-xs font-medium text-muted-foreground italic">{evalDesc}</p>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs">Remarks</Label>
                              <Textarea value={scoringData[aspect.rem] || ''} onChange={e => setScoringData(p => ({...p, [aspect.rem]: e.target.value}))} placeholder="Type notes here..." className="min-h-[60px]" />
                            </div>
                          </div>
                        );
                      })}
                      
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
                        <Label className="font-bold text-red-700">Red Flags Noted (If Any)</Label>
                        <Textarea value={scoringData.redFlags || ''} onChange={e => setScoringData(p => ({...p, redFlags: e.target.value}))} placeholder="Enter any critical warnings..." className="bg-white border-red-200" />
                      </div>
                    </div>
                  ) : (
                    <KeyValueGrid data={{ ...d?.scoring, 'Total Score': d?.total_score, 'Category': d?.category }} />
                  )}
                </Section>
              </TabsContent>

              {/* TAB 3: BUSINESS */}
              <TabsContent value="business" className="space-y-4 mt-0">
                <Section title="Business Area & Expansion">
                  {isEditing ? (
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <Label>Proposed Status *</Label>
                        <Select value={proposedStatus} onValueChange={setProposedStatus}>
                          <SelectTrigger className="w-64"><SelectValue placeholder="Select Status" /></SelectTrigger>
                          <SelectContent><SelectItem value="Authorised Dealer">Authorised Dealer</SelectItem><SelectItem value="Exclusive Dealer">Exclusive Dealer</SelectItem><SelectItem value="Dealer">Dealer</SelectItem></SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 border-t border-border pt-4">
                        <Label className="font-bold">Additional Shops & Godowns</Label>
                        <div className="space-y-1.5 mb-2">
                          <Label className="text-xs text-muted-foreground">Does the dealer have another shop or godown?</Label>
                          <Select value={hasAdditionalLocations} onValueChange={setHasAdditionalLocations}>
                            <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Yes/No" /></SelectTrigger>
                            <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                          </Select>
                        </div>
                        {hasAdditionalLocations === 'Yes' && (
                          <div className="p-3 border border-border bg-muted/20 rounded-md space-y-4">
                            <div>
                              <Label className="text-xs font-semibold mb-2 block">Additional Shops</Label>
                              {additionalShops.map((shop, i) => (
                                <div key={i} className="flex gap-2 items-center mb-2">
                                  <Input placeholder="Shop Name" value={shop.shopName} onChange={e => updateArr(setAdditionalShops, i, 'shopName', e.target.value)} className="flex-1 h-8" />
                                  <Input placeholder="Address" value={shop.address} onChange={e => updateArr(setAdditionalShops, i, 'address', e.target.value)} className="flex-1 h-8" />
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeArr(setAdditionalShops, i)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                              ))}
                              <Button variant="outline" size="sm" className="w-full border-dashed h-8" onClick={() => setAdditionalShops(p => [...p, {shopName:'', address:''}])}><Plus className="h-4 w-4 mr-2"/> Add Shop</Button>
                            </div>
                            <div>
                              <Label className="text-xs font-semibold mb-2 block">Godowns</Label>
                              {godowns.map((gd, i) => (
                                <div key={i} className="flex gap-2 items-center mb-2">
                                  <Input placeholder="Address" value={gd.address} onChange={e => updateArr(setGodowns, i, 'address', e.target.value)} className="flex-1 h-8" />
                                  <Input placeholder="Capacity" type="number" value={gd.capacity} onChange={e => updateArr(setGodowns, i, 'capacity', e.target.value)} className="w-24 h-8" />
                                  <Input placeholder="Unit" value={gd.capacityUnit} onChange={e => updateArr(setGodowns, i, 'capacityUnit', e.target.value)} className="w-20 h-8" />
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeArr(setGodowns, i)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                              ))}
                              <Button variant="outline" size="sm" className="w-full border-dashed h-8" onClick={() => setGodowns(p => [...p, {address:'', capacity:'', capacityUnit:'Sq.ft'}])}><Plus className="h-4 w-4 mr-2"/> Add Godown</Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 border-t border-border pt-4">
                        <Label className="font-bold">Linked Distributors</Label>
                        <div className="space-y-1.5 mb-2">
                          <Label className="text-xs text-muted-foreground">Are you linked to any distributor?</Label>
                          <Select value={isLinkedToDistributor} onValueChange={setIsLinkedToDistributor}>
                            <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Yes/No" /></SelectTrigger>
                            <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                          </Select>
                        </div>
                        {isLinkedToDistributor === 'Yes' && (
                          <div className="space-y-2">
                            {linkedDistributors.map((dist, i) => (
                              <div key={i} className="flex gap-2 items-center">
                                <Input placeholder="Distributor Name" value={dist.name} onChange={e => updateArr(setLinkedDistributors, i, 'name', e.target.value)} className="flex-1 h-8" />
                                <Input placeholder="Contact" maxLength={10} type="tel" value={dist.contact} onChange={e => updateArr(setLinkedDistributors, i, 'contact', e.target.value)} className="w-32 h-8" />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeArr(setLinkedDistributors, i)}><Trash2 className="h-4 w-4"/></Button>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" className="w-full border-dashed h-8" onClick={() => setLinkedDistributors(p => [...p, {name:'', contact:''}])}><Plus className="h-4 w-4 mr-2"/> Add Distributor</Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 border-t border-border pt-4">
                        <Label className="font-bold">Demo Farmers</Label>
                        <div className="space-y-1.5 mb-2">
                          <Label className="text-xs text-muted-foreground">Willing to work with 5–10 demo farmers? *</Label>
                          <Select value={willingDemoFarmers} onValueChange={setWillingDemoFarmers}>
                            <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Yes/No" /></SelectTrigger>
                            <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                          </Select>
                        </div>
                        {willingDemoFarmers === 'Yes' && (
                          <div className="space-y-2">
                            {demoFarmers.map((farmer, i) => (
                              <div key={i} className="flex gap-2 items-center mb-2">
                                <Input placeholder="Name" value={farmer.name} onChange={e => updateArr(setDemoFarmers, i, 'name', e.target.value)} className="flex-1 h-8" />
                                <Input placeholder="Contact" maxLength={10} type="tel" value={farmer.contact} onChange={e => updateArr(setDemoFarmers, i, 'contact', e.target.value)} className="w-32 h-8" />
                                <Input placeholder="Address" value={farmer.address} onChange={e => updateArr(setDemoFarmers, i, 'address', e.target.value)} className="flex-1 h-8" />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeArr(setDemoFarmers, i)}><Trash2 className="h-4 w-4"/></Button>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" className="w-full border-dashed h-8" onClick={() => setDemoFarmers(p => [...p, {name:'', contact:'', address:''}])}><Plus className="h-4 w-4 mr-2"/> Add Demo Farmer</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <KeyValueGrid data={{ 'Proposed Status': d?.commitments?.proposedStatus, 'Additional Locations?': d?.commitments?.hasAdditionalLocations, 'Linked Distributor?': d?.commitments?.isLinkedToDistributor, 'Demo Farmers?': d?.commitments?.willingDemoFarmers }} />
                      <div className="mt-4"><h4 className="font-semibold text-sm mb-2">Additional Shops & Godowns</h4>{renderValue(d?.additional_locations)}</div>
                      <div className="mt-4"><h4 className="font-semibold text-sm mb-2">Distributor Links</h4>{renderValue(d?.distributor_links)}</div>
                      <div className="mt-4"><h4 className="font-semibold text-sm mb-2">Demo Farmers</h4>{renderValue(d?.demo_farmers_data)}</div>
                    </>
                  )}
                </Section>
              </TabsContent>

              {/* TAB 6: DOCUMENTS & UPLOADS */}
              <TabsContent value="docs" className="space-y-4 mt-0">
                <Section title="Dealer Documents & Attachments">
                  {isEditing ? (
                    <div className="space-y-6">
                      
                      <div className="space-y-2">
                        {Object.entries(documentsObj).map(([key, val]) => (
                          <div key={key} className="flex gap-2 items-center bg-muted/20 p-2 rounded-md border border-border">
                            <Label className="w-1/3 font-semibold break-all">{key}</Label>
                            
                            {typeof val === 'string' && val.startsWith('http') ? (
                              <a href={val} target="_blank" rel="noreferrer" className="flex-1 text-blue-600 hover:underline text-sm truncate flex items-center">
                                View File <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            ) : (
                              <span className="flex-1 text-sm text-muted-foreground italic truncate">
                                {typeof val === 'string' ? val : JSON.stringify(val)}
                              </span>
                            )}
                            
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => { 
                              const newObj = {...documentsObj}; delete newObj[key]; setDocumentsObj(newObj); 
                            }}>
                              <Trash2 className="h-4 w-4"/>
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 border border-dashed border-border rounded-lg bg-muted/10 space-y-3">
                        <Label className="font-bold text-sm">Upload New Document</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Document Name</Label>
                            <Input placeholder="e.g., pan_card, gst_cert" value={newDocName} onChange={e => setNewDocName(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Select File</Label>
                            <Input type="file" onChange={e => e.target.files && setNewDocFile(e.target.files[0])} className="cursor-pointer file:text-sm file:text-primary file:font-semibold file:border-0 file:bg-transparent file:cursor-pointer" />
                          </div>
                        </div>
                        <Button variant="secondary" onClick={handleFileUpload} disabled={uploadingDoc || !newDocName || !newDocFile} className="w-full">
                          {uploadingDoc ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/> Uploading to Cloudinary...</> : <><UploadCloud className="h-4 w-4 mr-2"/> Upload & Attach to Profile</>}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(d?.documents || {}).map(([key, val]: any) => (
                        <div key={key} className="flex gap-2 p-2 border-b border-border items-center">
                           <Label className="w-1/3 font-semibold break-all capitalize">{key.replace(/_/g, ' ')}</Label>
                           {typeof val === 'string' && val.startsWith('http') ? (
                              <a href={val} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm truncate flex items-center">
                                View Attachment <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground italic truncate">
                                {typeof val === 'string' ? val : JSON.stringify(val)}
                              </span>
                            )}
                        </div>
                      ))}
                      {Object.keys(d?.documents || {}).length === 0 && <p className="text-muted-foreground text-sm italic">No documents attached.</p>}
                    </div>
                  )}
                </Section>
              </TabsContent>

              {/* TAB 7: ANNEXURES */}
              <TabsContent value="anx" className="space-y-4 mt-0">
                <Section title="Territories & Products (SE Evaluated)">
                  {isEditing ? (
                    <div className="space-y-4">
                      
                      <div className="space-y-2">
                        <Label className="font-bold">Target Territories</Label>
                        {seTerritories.map((t, i) => (
                          <div key={i} className="flex flex-col gap-2 bg-muted/20 p-3 rounded-md border border-border relative">
                            <div className="flex justify-between items-center">
                              <Label className="text-xs font-semibold">Territory {i+1}</Label>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeArr(setSeTerritories, i)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input placeholder="Taluka" value={t.taluka} onChange={e => updateArr(setSeTerritories, i, 'taluka', e.target.value)} className="h-8" />
                              <Input placeholder="Area (Acres)" type="number" value={t.cultivableArea} onChange={e => updateArr(setSeTerritories, i, 'cultivableArea', e.target.value)} className="h-8" />
                              <Input placeholder="Villages (Comma Sep)" value={t.village} onChange={e => updateArr(setSeTerritories, i, 'village', e.target.value)} className="col-span-2 h-8" />
                              <Input placeholder="Major Crops (Comma Sep)" value={t.majorCrops} onChange={e => updateArr(setSeTerritories, i, 'majorCrops', e.target.value)} className="col-span-2 h-8" />
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full border-dashed h-8" onClick={() => setSeTerritories(p => [...p, {taluka:'', village:'', cultivableArea:'', majorCrops:''}])}><Plus className="h-4 w-4 mr-2"/> Add Territory</Button>
                      </div>

                      <div className="space-y-1.5 border-t border-border pt-4">
                        <Label>Principal Suppliers</Label>
                        <SearchableMultiSelect label="Suppliers" options={DEMO_SUPPLIERS} selected={sePrincipalSuppliers} onChange={setSePrincipalSuppliers} />
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label>Chemical Products</Label>
                        <SearchableMultiSelect label="Chemicals" options={DEMO_CHEMICALS} selected={seChemicalProducts} onChange={setSeChemicalProducts} />
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label>Bio/Organic Products</Label>
                        <SearchableMultiSelect label="Bio Products" options={DEMO_BIOS} selected={seBioProducts} onChange={setSeBioProducts} />
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label>Other Products</Label>
                        <SearchableMultiSelect label="Other Products" options={DEMO_OTHERS} selected={seOtherProducts} onChange={setSeOtherProducts} />
                      </div>
                      
                      <div className="space-y-2 border-t border-border pt-4">
                        <div className="space-y-1.5 mb-2">
                          <Label className="text-xs text-muted-foreground">Will share sales data?</Label>
                          <Select value={seWillShareSales} onValueChange={setSeWillShareSales}>
                            <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Yes/No" /></SelectTrigger>
                            <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5"><Label>2-Year Growth Vision</Label><Textarea value={seGrowthVision} onChange={e => setSeGrowthVision(e.target.value)} className="h-16" /></div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                        <div className="space-y-1.5"><Label>Security Deposit Amount</Label><Input value={seSecurityDeposit} type="number" onChange={e => setSeSecurityDeposit(e.target.value)} /></div>
                        <div className="space-y-1.5"><Label>Payment Proof Text/ID</Label><Input value={sePaymentProofText} onChange={e => setSePaymentProofText(e.target.value)} /></div>
                      </div>

                      <div className="space-y-2 border-t border-border pt-4">
                        <div className="flex gap-2 items-center mb-2">
                          <Label className="font-bold flex-1">Credit References</Label>
                          <Select value={seHasCreditReferences} onValueChange={setSeHasCreditReferences}><SelectTrigger className="w-32 h-8"><SelectValue placeholder="Has Ref?" /></SelectTrigger><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent></Select>
                        </div>
                        {seHasCreditReferences === 'Yes' && (
                          <div className="space-y-2">
                            {seCreditReferences.map((ref, i) => (
                              <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-muted/20 p-2 rounded-md border border-border">
                                <Input placeholder="Name" value={ref.name} onChange={e => updateArr(setSeCreditReferences, i, 'name', e.target.value)} className="w-full sm:w-1/3 h-8" />
                                <Input placeholder="Contact" maxLength={10} type="tel" value={ref.contact} onChange={e => updateArr(setSeCreditReferences, i, 'contact', e.target.value)} className="w-full sm:w-1/4 h-8" />
                                <Input placeholder="Behavior Remarks" value={ref.behavior} onChange={e => updateArr(setSeCreditReferences, i, 'behavior', e.target.value)} className="flex-1 h-8" />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeArr(setSeCreditReferences, i)}><Trash2 className="h-4 w-4"/></Button>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" className="w-full border-dashed h-8" onClick={() => setSeCreditReferences(p => [...p, {name:'', contact:'', behavior:''}])}><Plus className="h-4 w-4 mr-2"/> Add Reference</Button>
                          </div>
                        )}
                      </div>

                    </div>
                  ) : (
                    <KeyValueGrid data={d?.annexures} />
                  )}
                </Section>
              </TabsContent>

              {/* VIEW ONLY EVALUATIONS */}
              <TabsContent value="eval" className="space-y-4 mt-0">
                <Section title="Scoring Snapshot (Calculated)">
                  {d?.total_score != null && <p className="text-sm font-semibold mb-2">Total Score: <span className="text-primary">{d.total_score}</span> / 80</p>}
                  {d?.category && <p className="text-sm font-semibold mb-4">Assigned Category: <Badge variant="secondary">{d.category}</Badge></p>}
                  <p className="text-xs text-muted-foreground italic mb-2">To see a full breakdown of individual scores and evaluations, navigate to the "Scoring" tab.</p>
                </Section>
                <Section title="GLS Commitments">
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {Array.isArray(d?.commitments?.glsCommitments) ? d?.commitments?.glsCommitments.map((c: string, i: number) => <li key={i}>{c}</li>) : <li>{d?.commitments?.glsCommitments || 'None'}</li>}
                  </ul>
                </Section>
                <Section title="Compliance Checklist">
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {Array.isArray(d?.commitments?.complianceChecklist) ? d?.commitments?.complianceChecklist.map((c: string, i: number) => <li key={i}>{c}</li>) : <li>{d?.commitments?.complianceChecklist || 'None'}</li>}
                  </ul>
                </Section>
              </TabsContent>

            </div>
          </ScrollArea>
        </Tabs>

        {isEditing && (
          <SheetFooter className="px-6 py-4 border-t border-border bg-muted/20 mt-auto">
            <div className="flex w-full justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={saving}>
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default DealerDetailSheet;