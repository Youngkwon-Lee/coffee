import { cafesData } from "./cafesData.js";

export interface CafeMetadataEntry {
  id: string;
  name: string;
  aliases: string[];
  website?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

const BRAND_ALIAS_EXPANSIONS: Record<string, string[]> = {
  centercoffee: ["센터커피", "센터 코피", "센타커피", "centercoffee", "center coffee", "centre coffee"],
  momos: ["모모스", "모모스커피", "momos", "momos coffee", "momoscoffee"],
  fritz: ["프릳츠", "프릳츠커피", "프리츠", "프리츠커피", "fritz", "fritz coffee", "fritzcoffee"],
  lowkey: ["로우키", "로우키커피", "lowkey", "low key", "lowkeycoffee", "low key coffee"],
  terarosa: ["테라로사", "테라 로사", "terarosa", "tera rosa"],
  bluebottle: ["블루보틀", "블루 보틀", "bluebottle", "blue bottle"],
  anthracite: ["앤트러사이트", "앤쓰러사이트", "anthracite", "anthracite coffee"],
  hellcafe: ["헬카페", "hellcafe", "hell cafe"],
  bonanza: ["보난자", "보난자커피", "bonanza", "bonanza coffee"],
  defaultvalue: ["디폴트벨류", "디폴트밸류", "defaultvalue", "default value"],
};

export function normalizeCafeText(value: string) {
  return value
    .replace(/프리츠/gi, "프릳츠")
    .replace(/센터\s*코피/gi, "센터커피")
    .replace(/센타커피/gi, "센터커피")
    .replace(/coftee/gi, "coffee")
    .replace(/cofee/gi, "coffee")
    .replace(/coffe\b/gi, "coffee")
    .replace(/centre/gi, "center")
    .replace(/low\s*key/gi, "lowkey")
    .toLowerCase()
    .replace(/[\s"'`~!@#$%^&*()_\-+={[}\]|\\:;“”‘’<>,.?/]/g, "")
    .trim();
}

function getWebsiteBrandKey(website?: string) {
  if (!website) {
    return "";
  }

  try {
    const hostname = new URL(website).hostname.replace(/^www\./, "");
    return hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

export function expandBrandAliases(seedAliases: string[]) {
  const expanded = new Set<string>(seedAliases.filter(Boolean));

  for (const alias of seedAliases) {
    const compact = normalizeCafeText(alias);

    for (const [key, values] of Object.entries(BRAND_ALIAS_EXPANSIONS)) {
      const normalizedValues = values.map((value) => normalizeCafeText(value));
      if (compact.includes(key) || normalizedValues.some((value) => compact.includes(value))) {
        values.forEach((value) => expanded.add(value));
      }
    }

    if (/coffee/i.test(alias)) {
      expanded.add(alias.replace(/coffee/gi, "coftee"));
      expanded.add(alias.replace(/coffee/gi, "coffe"));
      expanded.add(alias.replace(/coffee/gi, "cofee"));
    }
  }

  return Array.from(expanded);
}

export function buildCafeAliases(name: string, website?: string, extraAliases: string[] = []) {
  const aliases = new Set<string>();
  const cleanedName = name.trim();

  if (cleanedName) {
    aliases.add(cleanedName);
    aliases.add(cleanedName.replace(/\s+/g, ""));
    aliases.add(cleanedName.replace(/\s*(본점|[가-힣A-Za-z0-9]+점)\s*$/i, "").trim());
  }

  const websiteBrandKey = getWebsiteBrandKey(website);
  if (websiteBrandKey) {
    aliases.add(websiteBrandKey);
  }

  extraAliases.forEach((alias) => aliases.add(alias));

  return expandBrandAliases(Array.from(aliases)).filter((alias) => alias.length >= 2);
}

export function buildCafeDocId(name: string, website?: string) {
  const websiteBrandKey = getWebsiteBrandKey(website);
  if (websiteBrandKey) {
    return normalizeCafeText(websiteBrandKey);
  }
  return normalizeCafeText(name);
}

const curatedCafeMetadata: CafeMetadataEntry[] = [
  {
    id: "centercoffee-hongdae",
    name: "센터커피 홍대점",
    address: "서울 마포구 와우산로29길 19",
    lat: 37.5563,
    lng: 126.9235,
    website: "https://centercoffee.co.kr/shop",
    aliases: buildCafeAliases("센터커피 홍대점", "https://centercoffee.co.kr/shop"),
  },
  {
    id: "centercoffee-myeongdong",
    name: "센터커피 명동점",
    website: "https://centercoffee.co.kr/shop",
    aliases: buildCafeAliases("센터커피 명동점", "https://centercoffee.co.kr/shop"),
  },
  {
    id: "momos-yeonnam",
    name: "모모스커피 연남점",
    address: "서울 마포구 연남로1길 7",
    lat: 37.5643,
    lng: 126.9258,
    website: "https://momos.co.kr",
    aliases: buildCafeAliases("모모스커피 연남점", "https://momos.co.kr"),
  },
  {
    id: "momos-yeongdo",
    name: "모모스커피 영도 로스터리 & 커피바",
    website: "https://momos.co.kr",
    aliases: buildCafeAliases("모모스커피 영도 로스터리 & 커피바", "https://momos.co.kr", ["영도 로스터리"]),
  },
  {
    id: "fritz-seochon",
    name: "프릳츠 서촌점",
    website: "https://fritz.co.kr",
    aliases: buildCafeAliases("프릳츠 서촌점", "https://fritz.co.kr"),
  },
  {
    id: "fritz-itaewon",
    name: "프릳츠커피 이태원점",
    address: "서울 용산구 이태원로 246",
    lat: 37.5347,
    lng: 126.9941,
    website: "https://fritz.co.kr",
    aliases: buildCafeAliases("프릳츠커피 이태원점", "https://fritz.co.kr"),
  },
  {
    id: "lowkey-seongsu",
    name: "로우키 성수",
    address: "서울 성동구 성수동2가 289-5",
    lat: 37.5447,
    lng: 127.0557,
    website: "https://lowkeycoffee.com",
    aliases: buildCafeAliases("로우키 성수", "https://lowkeycoffee.com", ["로우키커피"]),
  },
  {
    id: "terarosa-seoul-forest",
    name: "테라로사 서울숲점",
    address: "서울 성동구 뚝섬로1길 30",
    lat: 37.5447,
    lng: 127.0424,
    website: "https://terarosa.com",
    aliases: buildCafeAliases("테라로사 서울숲점", "https://terarosa.com"),
  },
  {
    id: "tailorcoffee-hapjeong",
    name: "테일러커피 합정점",
    website: "https://tailorcoffee.com",
    aliases: buildCafeAliases("테일러커피 합정점", "https://tailorcoffee.com"),
  },
  {
    id: "anthracite-hapjeong",
    name: "앤트러사이트 합정",
    website: "https://anthracitecoffee.com/shop",
    aliases: buildCafeAliases("앤트러사이트 합정", "https://anthracitecoffee.com/shop", ["앤쓰러사이트 합정"]),
  },
  {
    id: "hellcafe-sinsa",
    name: "헬카페 신사",
    website: "https://hellcafe.co.kr",
    aliases: buildCafeAliases("헬카페 신사", "https://hellcafe.co.kr"),
  },
  {
    id: "defaultvalue",
    name: "디폴트벨류",
    website: "https://defaultvalue.kr",
    aliases: buildCafeAliases("디폴트벨류", "https://defaultvalue.kr", ["디폴트밸류"]),
  },
  {
    id: "bonanza-mokdong",
    name: "보난자커피 목동 현대점",
    website: "https://bonanzacoffee.kr",
    aliases: buildCafeAliases("보난자커피 목동 현대점", "https://bonanzacoffee.kr"),
  },
  {
    // Firestore에는 있었지만 카탈로그에 없어 website가 비어 있었고, 그래서
    // 이미지 수집 대상에서도 빠져 있었다. 도메인은 응답 200으로 확인함.
    id: "coffeelibre",
    name: "커피리브레",
    website: "https://coffeelibre.kr",
    aliases: buildCafeAliases("커피리브레", "https://coffeelibre.kr", ["coffee libre", "리브레"]),
  },
];

type PurchaseCafeData = {
  name: string;
  purchase?: {
    website?: string;
  };
};

const baseCafeMetadata = (cafesData as PurchaseCafeData[]).map((entry) => ({
  id: buildCafeDocId(entry.name, entry.purchase?.website),
  name: entry.name,
  website: entry.purchase?.website,
  aliases: buildCafeAliases(entry.name, entry.purchase?.website),
})) satisfies CafeMetadataEntry[];

const metadataByKey = new Map<string, CafeMetadataEntry>();

for (const entry of baseCafeMetadata) {
  metadataByKey.set(normalizeCafeText(entry.name), entry);
}

for (const curated of curatedCafeMetadata) {
  const key = normalizeCafeText(curated.name);
  const existing = metadataByKey.get(key);
  if (!existing) {
    metadataByKey.set(key, curated);
    continue;
  }

  metadataByKey.set(key, {
    ...existing,
    ...curated,
    aliases: Array.from(new Set([...(existing.aliases || []), ...(curated.aliases || [])])),
  });
}

export const cafeMetadataCatalog = Array.from(metadataByKey.values());

export const fallbackCafeMetadata = cafeMetadataCatalog.filter(
  (entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng) && Boolean(entry.address)
);
