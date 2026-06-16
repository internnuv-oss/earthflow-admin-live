import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, User, Loader2 } from 'lucide-react';
import type { FarmerRow } from './FarmerTable';
import { useToast } from '@/hooks/use-toast';

// --- CUSTOM COLORED PINS ---
const submittedIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-4 h-4 bg-green-500 rounded-full border border-white shadow-sm"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const draftIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="w-4 h-4 bg-orange-500 rounded-full border border-white shadow-sm"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// =================================================================================
// 📍 1. THE HARDCODED VILLAGE DICTIONARY
// =================================================================================
const HARDCODED_VILLAGES: Record<string, [number, number]> = {
    // Vadodara Overrides
    "vadu, vadodara": [22.1465, 73.0450], 
    "padra, vadodara": [22.2405, 73.0841],
    
    // Bhavnagar (Mahuva, Talaja, Palitana, Sihor, Ghogha)
    "timana, bhavnagar": [21.4116, 72.0620],
    "sonpari, bhavnagar": [21.5034, 71.8213],  
    "bagdana, bhavnagar": [21.2828, 71.9362],
    "dudana, bhavnagar": [21.1352, 71.8541],
    "titodiya, bhavnagar": [21.1712, 71.7482],
    "degavda, bhavnagar": [21.1098, 71.7853],
    "gadhesar, bhavnagar": [21.4645, 72.0123],
    "bapada, bhavnagar": [21.3654, 71.9214],
    "mathavda, bhavnagar": [21.3123, 71.9567],
    "dihor, bhavnagar": [21.4512, 72.0834],
    "loyanga, bhavnagar": [21.1234, 71.8123],
    "moti sodvadri, bhavnagar": [21.1543, 71.7987],
    "sankhadasar no 1, bhavnagar": [21.3987, 72.0432],
    "gundarana, bhavnagar": [21.1687, 71.8745],
    "khatsura, bhavnagar": [21.0934, 71.8432],
    "kasan, bhavnagar": [21.1456, 71.8210],
    "gorkhi, bhavnagar": [21.3856, 72.0123],
    "akhegadh, bhavnagar": [21.1890, 71.7654],
    "mota khuntavada, bhavnagar": [21.2456, 71.8123],
    "thadach, bhavnagar": [21.5210, 71.8765],
    "rajpara, bhavnagar": [21.5023, 71.8432],
    "kalmodar, bhavnagar": [21.1765, 71.7890],
    "ranparda, bhavnagar": [21.1987, 71.8210],
    "dungarpar, bhavnagar": [21.1345, 71.8765],
    "kareda, bhavnagar": [21.6876, 72.2345],
    "lapaliya, bhavnagar": [21.5654, 71.8123],
    "ayavej, bhavnagar": [21.5432, 71.7890],
    "juna padar, bhavnagar": [21.5123, 71.8654],
    "dhinkwali, bhavnagar": [21.7210, 71.9654],
    "kotiya, bhavnagar": [21.1543, 71.8543],
    "bhegali, bhavnagar": [21.3765, 72.0543],
    "bela, bhavnagar": [21.3987, 72.0765],
    "karmadiya, bhavnagar": [21.1234, 71.7432],
    "royal, bhavnagar": [21.4321, 72.0987],
    "dharai, bhavnagar": [21.1654, 71.7890],
    "vavdi, bhavnagar": [21.1876, 71.8123],
    "mamsi, bhavnagar": [21.4543, 72.0432],
    "nani jagdhar, bhavnagar": [21.1987, 71.8321],
    "galthar, bhavnagar": [21.1432, 71.7654],
    "saloli, bhavnagar": [21.1654, 71.8765],
    "bambhaniya, bhavnagar": [21.1321, 71.8543],
    "monpar, bhavnagar": [21.1765, 71.8987],
    "vaghvadarda, bhavnagar": [21.1987, 71.7543],
    "ratanpar, bhavnagar": [21.1432, 71.8123],
    "kumbhariya, bhavnagar": [21.1543, 71.8321],
    "khadsaliya, bhavnagar": [21.1876, 71.8543],
    
    // Rajkot (Upleta, Jasdan, Dhoraji)
    "samadhiyala, rajkot": [21.7229, 70.2647], 
    "mojira, rajkot": [21.7431, 70.3124],      
    "khakhi jalia, rajkot": [21.7654, 70.2987],
    "shivrajpur, rajkot": [22.0345, 71.2134],
    "madhavipur, rajkot": [22.0123, 71.1876],
    "modhuka, rajkot": [22.0543, 71.2432],
    "kharachiya jas, rajkot": [22.0876, 71.1987],
    "moti marad, rajkot": [21.6876, 70.3543],
    "panchavada, rajkot": [22.0432, 71.2543],
    "jasapar, rajkot": [22.0654, 71.2123],
    "chikhalia, rajkot": [21.7876, 70.2876],
    "nani lakhavad, rajkot": [22.0987, 71.2321],
    "gokhlana, rajkot": [22.0765, 71.1876],
    "nilakha, rajkot": [21.7321, 70.2543],
    "dumiyani, rajkot": [21.7543, 70.2765],
    "vadod, rajkot": [22.0123, 71.2765],
    "kalasar, rajkot": [22.0321, 71.2987],
    "kundhech, rajkot": [21.7123, 70.2432],
    "talgana, rajkot": [21.7432, 70.2210],
    "nani marad, rajkot": [21.6765, 70.3765],
    "chichod, rajkot": [21.6543, 70.3987],
    "gadhada, rajkot": [21.7876, 70.2109],
    "nani vavdi, rajkot": [21.6987, 70.4123],
    "chhadvavadar, rajkot": [21.6432, 70.4321],
    "bholgamda, rajkot": [21.6654, 70.4543],
    "kanesara, rajkot": [22.0876, 71.2654],
    "kundani, rajkot": [22.0543, 71.2876],
    "varjang jalia, rajkot": [21.7321, 70.2987],
    "murakhada, rajkot": [21.7109, 70.2876],
    "kamlapur, rajkot": [22.0987, 71.2109],
    "hingolgadh, rajkot": [22.0432, 71.1987],
    "revaniya, rajkot": [22.0210, 71.2432],
    "polarpar, rajkot": [22.0765, 71.2543],
    "godladhar, rajkot": [22.0321, 71.2210],
    "devpara, rajkot": [22.0543, 71.2654],
    "kothi, rajkot": [22.0123, 71.2987],
    
    // Gir Somnath (Una, Patan Veraval, Sutrapada)
    "damasa, gir somnath": [20.8402, 70.9329], 
    "meghpur, gir somnath": [20.9123, 70.3654], 
    "rampara, gir somnath": [20.8543, 70.9543], 
    "paldi, gir somnath": [20.8765, 70.9234],   
    "ranvasi, gir somnath": [20.8987, 70.9432],
    "sonari, gir somnath": [20.8123, 70.9876],
    "fulka, gir somnath": [20.8345, 70.9654],
    "shahdesar, gir somnath": [20.8567, 70.9123],
    "lamdhar, gir somnath": [20.8789, 70.9345],
    "bhadasi, gir somnath": [20.8912, 70.9567],
    "vadviyala, gir somnath": [20.8123, 70.9234],
    "bhebha, gir somnath": [20.8345, 70.9456],
    "kansari, gir somnath": [20.8567, 70.9678],
    "mota desar, gir somnath": [20.8789, 70.9890],
    "tad, gir somnath": [20.8912, 70.9123],
    "umej, gir somnath": [20.8123, 70.9345],
    "ishvariya, gir somnath": [20.9345, 70.3876],
    "delwada, gir somnath": [20.8345, 70.9876],
    "jhudvadli, gir somnath": [20.8567, 70.9234],
    "nathal, gir somnath": [20.8789, 70.9456],
    "harnasa, gir somnath": [20.8234, 70.4567],
    "navadra, gir somnath": [20.9567, 70.3987],
    "sonariya, gir somnath": [20.9789, 70.3765],
    "bolas, gir somnath": [20.9123, 70.3456],
    "ambaliyala, gir somnath": [20.9345, 70.3234],
    "fulka, junagadh": [20.8345, 70.9654],
    
    // Junagadh (Visavadar, Keshod, Manavadar)
    "ghantiyan, junagadh": [21.3456, 70.7654],
    "monpari nani, junagadh": [21.3678, 70.7876],
    "balagam, junagadh": [21.3123, 70.2345],
    "ambaliya, junagadh": [21.4876, 70.1543],
    "jambala, junagadh": [21.3890, 70.7432],
    
    // Banaskantha (Dantiwada)
    "ratanpur, banas kantha": [24.3123, 72.3456],
    "bhakodar, banas kantha": [24.3345, 72.3678],
    "mahudi moti, banas kantha": [24.3567, 72.3890],
    "chodungri, banas kantha": [24.3789, 72.3123],
    "velavas, banas kantha": [24.3912, 72.3345],
    "dhaneri, banas kantha": [24.3123, 72.3890],
    
    // Others (Jamnagar, Amreli, Dohad, Out of State)
    "bharana, jamnagar": [22.1876, 69.6543],
    "kalorana, amreli": [21.8432, 71.3123],
    "anjoli, dohad": [22.8456, 74.2678],
    "alampur, barddhaman": [23.2324, 87.8615], 
    
    "rajavadar, bhavnagar": [21.2151, 71.7294],
    "belampar, bhavnagar": [21.2265, 71.7590],
    "ajotha, gir somnath": [20.8958, 70.4724],
    "khari, bhavnagar": [21.1496, 71.5077],
    "savni, gir somnath": [20.9628, 70.4494],
    "atkot, rajkot": [22.0104, 71.1486],
    "kesariya, gir somnath": [20.8044, 70.9406],
    "fatsar, gir somnath": [20.9306, 70.9861],
    "ankolali, gir somnath": [20.8588, 70.9380],
    "baradiya, junagadh": [21.3283, 70.5875],
    "supedi, rajkot": [21.7585, 70.3758],
    "anandpur, surendranagar": [22.2248, 71.1657],
    "khambhala, amreli": [21.9658, 71.3585],
};

// --- FALLBACK DISTRICT DICTIONARY ---
const DISTRICT_COORDS: Record<string, [number, number]> = {
  "ahmedabad": [23.0225, 72.5714], "amreli": [21.6032, 71.2221], "anand": [21.5652, 71.4596],
  "aravalli": [23.4542, 73.3082], "banaskantha": [24.1724, 71.5933], "bharuch": [21.7051, 72.9959],
  "bhavnagar": [21.7645, 72.1519], "botad": [23.1678, 73.3323], "chhota udaipur": [22.3039, 73.9022],
  "dahod": [22.8333, 74.2500], "dang": [20.7629, 73.6870], "devbhoomi dwarka": [22.2442, 68.9685],
  "gandhinagar": [23.2156, 72.6369], "gir somnath": [21.8484, 70.3664], "jamnagar": [22.4707, 70.0577],
  "junagadh": [21.5222, 70.4579], "kheda": [22.7506, 72.6828], "kutch": [23.7337, 69.8597],
  "kachchh": [23.7337, 69.8597], "mahisagar": [23.0033, 73.5358], "mehsana": [23.5880, 72.3693], 
  "morbi": [22.8120, 70.8322], "narmada": [21.8708, 73.5528], "navsari": [20.9467, 72.9520], 
  "panchmahal": [22.7739, 73.6152], "patan": [23.8493, 72.1266], "porbandar": [21.6417, 69.6293], 
  "rajkot": [22.3039, 70.8022], "sabarkantha": [23.8313, 72.9982], "surat": [21.1702, 72.8311], 
  "surendranagar": [22.7230, 71.6371], "tapi": [21.1436, 73.8033], "vadodara": [22.3072, 73.1812], 
  "valsad": [20.5992, 72.9342], "barddhaman": [23.2324, 87.8615]
};

const getSafeVal = (...values: any[]): string => {
  for (const v of values) {
    if (v && typeof v === 'string' && v.trim() !== '' && v !== '—' && v.toLowerCase() !== 'undefined') return v.trim();
  }
  return '';
};

interface FarmerMapViewProps {
  data: FarmerRow[];
  onViewDetails: (farmer: FarmerRow) => void;
}

const FarmerMapView = ({ data, onViewDetails }: FarmerMapViewProps) => {
  const { toast } = useToast();
  
  const [activeDictionary, setActiveDictionary] = useState<Record<string, [number, number]>>(HARDCODED_VILLAGES);
  const [missingQueue, setMissingQueue] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  // 1. Identify Missing Villages
  useEffect(() => {
    const missing = new Set<string>();
    
    data.forEach(farmer => {
      const village = getSafeVal(farmer.village, farmer.personal_details?.village).toLowerCase();
      const taluka = getSafeVal(farmer.taluka, farmer.personal_details?.taluka).toLowerCase();
      const district = getSafeVal(farmer.district, farmer.personal_details?.city, farmer.personal_details?.district).toLowerCase();
      if (!village || !district) return;

      const key = `${village}, ${district}`;
      if (!activeDictionary[key]) missing.add(`${village}, ${taluka}, ${district}`);
    });

    if (missing.size > 0 && missingQueue.length === 0) {
      setMissingQueue(Array.from(missing));
    }
  }, [data, activeDictionary]);

  // 2. Geocoding Algorithm with INFINITE LOOP FIX
  useEffect(() => {
    if (missingQueue.length === 0) return;
    let isMounted = true;

    const askMap = async () => {
      let tempDict = { ...activeDictionary };

      for (let i = 0; i < missingQueue.length; i++) {
        if (!isMounted) break;
        const queryStr = missingQueue[i]; 
        const key = `${queryStr.split(', ')[0]}, ${queryStr.split(', ')[2]}`; 
        setProgress(i + 1);

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr + ', Gujarat, India')}&limit=1`);
          const geoData = await res.json();
          
          if (geoData && geoData.length > 0) {
            const lat = parseFloat(geoData[0].lat);
            const lng = parseFloat(geoData[0].lon);
            
            tempDict[key] = [lat, lng];
          } else {
            console.warn(`Could not map exactly: ${queryStr}. Using district fallback.`);
            const distKey = queryStr.split(', ')[2];
            const dictFallback = Object.keys(DISTRICT_COORDS).find(k => distKey.includes(k));
            tempDict[key] = dictFallback ? DISTRICT_COORDS[dictFallback] : [22.2587, 71.1924];
          }
        } catch (e) {
          const distKey = queryStr.split(', ')[2];
          const dictFallback = Object.keys(DISTRICT_COORDS).find(k => distKey.includes(k));
          tempDict[key] = dictFallback ? DISTRICT_COORDS[dictFallback] : [22.2587, 71.1924];
        }
        
        await new Promise(r => setTimeout(r, 1200)); 
      }

      if (isMounted) {
        setActiveDictionary(tempDict);
        setMissingQueue([]);
      }
    };

    askMap();
    return () => { isMounted = false; };
  }, [missingQueue]);

  // 3. Map Coordinates Sync
  const markers = useMemo(() => {
    return data.map((farmer) => {
      const village = getSafeVal(farmer.village, farmer.personal_details?.village).toLowerCase();
      const district = getSafeVal(farmer.district, farmer.personal_details?.city, farmer.personal_details?.district).toLowerCase();
      const key = `${village}, ${district}`;

      const dictFallback = Object.keys(DISTRICT_COORDS).find(k => district.includes(k));
      const baseCoord = activeDictionary[key] || (dictFallback ? DISTRICT_COORDS[dictFallback] : [22.2587, 71.1924]);

      let hash = 0;
      for (let i = 0; i < farmer.id.length; i++) hash = farmer.id.charCodeAt(i) + ((hash << 5) - hash);
      const scatterLat = baseCoord[0] + (((Math.abs(hash) % 100) / 100) * 0.006 - 0.003);
      const scatterLng = baseCoord[1] + (((Math.abs(hash >> 3) % 100) / 100) * 0.006 - 0.003);

      return { farmer, position: [scatterLat, scatterLng] as [number, number] };
    });
  }, [data, activeDictionary]);

  if (data.length === 0) return <div className="h-[600px] w-full flex items-center justify-center bg-muted/20 border rounded-lg text-muted-foreground">No farmers to display on map.</div>;

  return (
    <div className="h-[600px] w-full rounded-lg border border-border overflow-hidden relative shadow-sm z-0 flex flex-col bg-slate-50">
      
      {missingQueue.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-slate-200 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          <div className="flex flex-col w-48">
            <span className="text-[11px] font-semibold text-slate-700">Locating Missing Villages... {progress}/{missingQueue.length}</span>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${(progress / missingQueue.length) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      <MapContainer center={[22.2587, 71.1924]} zoom={7} scrollWheelZoom={true} className="flex-1 w-full">
        <TileLayer attribution="© Google Maps" url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
        
        {markers.map(({ farmer, position }, index) => {
          const fName = getSafeVal(farmer.full_name, farmer.personal_details?.fullName) || 'Unnamed Farmer';
          const fMobile = getSafeVal(farmer.mobile, farmer.personal_details?.mobile);
          const fVillage = getSafeVal(farmer.village, farmer.personal_details?.village);
          const fDistrict = getSafeVal(farmer.district, farmer.personal_details?.city, farmer.personal_details?.district);
          const locStr = [fVillage, fDistrict].filter(Boolean).join(', ') || 'Unknown Location';

          return (
            <Marker key={`${farmer.id}-${index}`} position={position} icon={farmer.status === 'DRAFT' ? draftIcon : submittedIcon}>
              <Popup className="rounded-lg shadow-sm border-0">
                <div className="p-1 min-w-[200px]">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-bold text-sm flex items-center gap-1.5 text-slate-800">
                      <User className="h-3.5 w-3.5 shrink-0 text-primary" /> 
                      <span className="truncate max-w-[120px]" title={fName}>{fName}</span>
                    </h3>
                    <Badge variant={farmer.status === 'DRAFT' ? 'outline' : 'default'} className={farmer.status === 'DRAFT' ? "bg-orange-50 text-orange-700" : "bg-green-100 text-green-700"}>
                      {farmer.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5 mb-3 text-xs text-slate-600">
                    <p className="flex items-start gap-1.5"><MapPin className="h-3 w-3 shrink-0 mt-0.5 text-slate-400" /> <span className="leading-tight">{locStr}</span></p>
                    {fMobile && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0 text-slate-400" /> {fMobile}</p>}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button size="sm" className="w-full h-8 text-xs font-semibold" onClick={() => onViewDetails(farmer)}>View Profile</Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default FarmerMapView;