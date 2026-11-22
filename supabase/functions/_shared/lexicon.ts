// Lists the correction step matches against. Family-specific medicines and
// contacts come from the database at request time; these are the defaults.

export type Medicine = {
  name: string;
  /** "bp" | "sugar" | "thyroid" ... used for "BP tablet" -> family's BP medicine */
  purpose?: string;
  variants: string[];
};

export type Contact = {
  name: string;
  relation: string;
  phone: string;
  nicknames: string[];
};

export type Family = {
  id: string;
  parentName: string;
  medicines: Medicine[]; // the parent's own medicines (with purpose)
  contacts: Contact[];
};

/** About 50 medicines commonly prescribed to older adults in India, with spoken variants. */
export const COMMON_MEDICINES: Medicine[] = [
  { name: "Amlodipine", purpose: "bp", variants: ["amlo", "amlodipin", "amlodepine", "amlodipine", "amlong", "amlopres", "amlokind", "amlodip", "amlodapine", "amladipine", "aamlodipine"] },
  { name: "Metformin", purpose: "sugar", variants: ["metformin", "metphormin", "metformine", "metfarmin", "glycomet", "glyciphage", "metform", "metfor", "mitformin"] },
  { name: "Telmisartan", purpose: "bp", variants: ["telmisartan", "telma", "telmikind", "telmi", "telmisarton"] },
  { name: "Losartan", purpose: "bp", variants: ["losartan", "losar", "losacar", "repace", "losarton"] },
  { name: "Olmesartan", purpose: "bp", variants: ["olmesartan", "olmezest", "olmy", "olmesarton"] },
  { name: "Atenolol", purpose: "bp", variants: ["atenolol", "aten", "tenormin", "atenalol"] },
  { name: "Metoprolol", purpose: "bp", variants: ["metoprolol", "metolar", "prolomet", "metoprolal", "met xl"] },
  { name: "Ramipril", purpose: "bp", variants: ["ramipril", "cardace", "ramipryl"] },
  { name: "Enalapril", purpose: "bp", variants: ["enalapril", "envas", "enalapryl"] },
  { name: "Nifedipine", purpose: "bp", variants: ["nifedipine", "nifedipin", "depin", "calcigard"] },
  { name: "Cilnidipine", purpose: "bp", variants: ["cilnidipine", "cilacar", "cilnidipin"] },
  { name: "Hydrochlorothiazide", purpose: "bp", variants: ["hydrochlorothiazide", "hctz", "aquazide"] },
  { name: "Glimepiride", purpose: "sugar", variants: ["glimepiride", "amaryl", "glimisave", "glimepride", "glimipiride"] },
  { name: "Gliclazide", purpose: "sugar", variants: ["gliclazide", "diamicron", "glizid", "gliclazid"] },
  { name: "Sitagliptin", purpose: "sugar", variants: ["sitagliptin", "januvia", "istavel", "sitagliptine"] },
  { name: "Vildagliptin", purpose: "sugar", variants: ["vildagliptin", "galvus", "jalra", "zomelis"] },
  { name: "Voglibose", purpose: "sugar", variants: ["voglibose", "voglib", "vogli", "volibo"] },
  { name: "Dapagliflozin", purpose: "sugar", variants: ["dapagliflozin", "forxiga", "dapa", "oxra"] },
  { name: "Empagliflozin", purpose: "sugar", variants: ["empagliflozin", "jardiance", "empa"] },
  { name: "Insulin", purpose: "sugar", variants: ["insulin", "insulin injection", "insuline", "inslin", "mixtard", "lantus", "huminsulin"] },
  { name: "Atorvastatin", purpose: "cholesterol", variants: ["atorvastatin", "atorva", "storvas", "lipitor", "atorvastin"] },
  { name: "Rosuvastatin", purpose: "cholesterol", variants: ["rosuvastatin", "rosuvas", "rozavel", "rosuva", "crestor"] },
  { name: "Aspirin", purpose: "heart", variants: ["aspirin", "ecosprin", "disprin", "asprin", "ecospirin"] },
  { name: "Clopidogrel", purpose: "heart", variants: ["clopidogrel", "clopilet", "plavix", "clopitab", "deplatt"] },
  { name: "Warfarin", purpose: "heart", variants: ["warfarin", "warf", "acitrom", "acenocoumarol"] },
  { name: "Digoxin", purpose: "heart", variants: ["digoxin", "lanoxin", "digoxine"] },
  { name: "Furosemide", purpose: "heart", variants: ["furosemide", "lasix", "frusemide", "furosemid"] },
  { name: "Spironolactone", purpose: "heart", variants: ["spironolactone", "aldactone", "spiro"] },
  { name: "Levothyroxine", purpose: "thyroid", variants: ["levothyroxine", "thyroxine", "thyronorm", "eltroxin", "thyrox", "thyroid tablet"] },
  { name: "Pantoprazole", purpose: "gas", variants: ["pantoprazole", "pan 40", "pan40", "pantop", "pantocid", "pan d", "pantoprazol"] },
  { name: "Omeprazole", purpose: "gas", variants: ["omeprazole", "omez", "omeprazol"] },
  { name: "Rabeprazole", purpose: "gas", variants: ["rabeprazole", "rablet", "razo", "rabeprazol"] },
  { name: "Ranitidine", purpose: "gas", variants: ["ranitidine", "rantac", "aciloc", "zinetac"] },
  { name: "Domperidone", purpose: "gas", variants: ["domperidone", "domstal", "domperidon"] },
  { name: "Ondansetron", purpose: "nausea", variants: ["ondansetron", "emeset", "vomikind", "ondem"] },
  { name: "Paracetamol", purpose: "fever", variants: ["paracetamol", "dolo", "dolo 650", "crocin", "calpol", "paracitamol", "parasitamol"] },
  { name: "Ibuprofen", purpose: "pain", variants: ["ibuprofen", "brufen", "combiflam", "ibuprofin"] },
  { name: "Diclofenac", purpose: "pain", variants: ["diclofenac", "voveran", "diclo", "dynapar"] },
  { name: "Cetirizine", purpose: "allergy", variants: ["cetirizine", "cetzine", "okacet", "alerid", "cetrizine"] },
  { name: "Montelukast", purpose: "allergy", variants: ["montelukast", "montair", "montek", "romilast"] },
  { name: "Salbutamol", purpose: "breathing", variants: ["salbutamol", "asthalin", "ventolin", "inhaler"] },
  { name: "Calcium", purpose: "bones", variants: ["calcium", "shelcal", "calcimax", "ccm", "calcium tablet"] },
  { name: "Vitamin D3", purpose: "bones", variants: ["vitamin d", "vitamin d3", "uprise", "calcirol", "d3"] },
  { name: "Vitamin B12", purpose: "nerves", variants: ["vitamin b12", "b12", "methylcobalamin", "nurokind", "mecobalamin"] },
  { name: "Folic acid", purpose: "blood", variants: ["folic acid", "folvite", "folic"] },
  { name: "Iron", purpose: "blood", variants: ["iron tablet", "ferrous", "livogen", "autrin"] },
  { name: "Allopurinol", purpose: "gout", variants: ["allopurinol", "zyloric", "alopurinol"] },
  { name: "Tamsulosin", purpose: "prostate", variants: ["tamsulosin", "urimax", "veltam", "tamsulosine"] },
  { name: "Donepezil", purpose: "memory", variants: ["donepezil", "donep", "aricept"] },
  { name: "Gabapentin", purpose: "nerves", variants: ["gabapentin", "gabapin", "gabantin"] },
  { name: "Pregabalin", purpose: "nerves", variants: ["pregabalin", "pregabid", "lyrica", "pregalin"] },
  { name: "Prednisolone", purpose: "steroid", variants: ["prednisolone", "wysolone", "omnacortil"] },
  { name: "Azithromycin", purpose: "antibiotic", variants: ["azithromycin", "azithral", "azee", "azithro"] },
  { name: "Amoxicillin", purpose: "antibiotic", variants: ["amoxicillin", "mox", "augmentin", "amoxycillin"] },
];

/** Spoken phrases that refer to a medicine by what it is for ("BP tablet", "sugar goli"). */
export const PURPOSE_WORDS: Record<string, string[]> = {
  bp: ["bp", "bipi", "bee pee", "b p", "blood pressure", "pressure", "raktapotu", "raktha pootu"],
  sugar: ["sugar", "shugar", "suger", "diabetes", "madhumeham", "madhumeha"],
  thyroid: ["thyroid", "thairoid"],
  cholesterol: ["cholesterol", "kolestrol"],
};

/** Words for "tablet" in English, Telugu and Hindi. */
export const PILL_WORDS = [
  "tablet", "tablets", "tablet lu", "tabletlu", "goli", "golilu", "goliyan", "golii",
  "maatra", "mathra", "matra", "mandu", "mandulu", "dawai", "dava", "dawa", "medicine", "pill", "pills",
];

/** Words that mean "all my tablets" ("morning tablets anni ayipoyayi"). */
export const ALL_WORDS = ["anni", "annee", "saari", "sari", "sab", "all", "antha"];

export const DEMO_FAMILY: Family = {
  id: "demo-1",
  parentName: "Amma",
  medicines: [
    { name: "Amlodipine", purpose: "bp", variants: ["amlo", "amlong"] },
    { name: "Metformin", purpose: "sugar", variants: ["glycomet"] },
  ],
  contacts: [
    { name: "Ravi", relation: "son", phone: "+919000000001", nicknames: ["ravi", "abbayi", "abbai", "babu", "koduku", "beta", "bete", "son", "kodukku", "kumar", "ravi kumar", "sun", "my son"] },
    { name: "Priya", relation: "daughter", phone: "+919000000002", nicknames: ["priya", "ammayi", "ammai", "kuthuru", "kooturu", "beti", "bitiya", "daughter"] },
  ],
};

/** Case markers glued to a name in Telugu/Hindi ("abbayi-ki", "Ravi-ko"). */
export const NAME_SUFFIXES = ["", "ki", "ku", "ke", "ko", "kii", "tho", "to", "ni", "nu", "ga", "ka", "kee", "se", "di", "gaariki", "garu", "gari"];
