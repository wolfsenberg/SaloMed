export type ProviderType = 'hospital' | 'pharmacy';

export interface Provider {
  name: string;
  location: string;
  type: ProviderType;
  stellarAddress: string; // demo address — replace with real whitelisted keys in production
}

export const HOSPITALS: Provider[] = [
  { name: 'Philippine General Hospital (PGH)',               location: 'Manila',                    type: 'hospital', stellarAddress: 'GAPH1GENERALHOSPITAL1MANILA1DEMO1ADDRESS1SALOMED1PGH' },
  { name: 'Philippine Heart Center (PHC)',                   location: 'Quezon City',               type: 'hospital', stellarAddress: 'GAPHC2HEARTCENTER2QUEZONCITY2DEMO2ADDRESS2SALOMED2P' },
  { name: 'National Kidney and Transplant Institute (NKTI)', location: 'Quezon City',               type: 'hospital', stellarAddress: 'GANKT3KIDNEYTRANSPLANT3QC3DEMO3ADDRESS3SALOMED3NKTI' },
  { name: 'Lung Center of the Philippines (LCP)',            location: 'Quezon City',               type: 'hospital', stellarAddress: 'GALCP4LUNGCENTER4QUEZONCITY4DEMO4ADDRESS4SALOMED4L' },
  { name: 'Philippine Children\'s Medical Center (PCMC)',    location: 'Quezon City',               type: 'hospital', stellarAddress: 'GAPMC5CHILDRENSMEDICAL5QC5DEMO5ADDRESS5SALOMED5PCM' },
  { name: 'Philippine Orthopedic Center',                   location: 'Quezon City',               type: 'hospital', stellarAddress: 'GAPOC6ORTHOPEDIC6QUEZONCITY6DEMO6ADDRESS6SALOMED6PO' },
  { name: 'National Center for Mental Health (NCMH)',        location: 'Mandaluyong',               type: 'hospital', stellarAddress: 'GANCM7MENTALHEALTH7MANDALUYONG7DEMO7ADDRESS7SALOMED' },
  { name: 'St. Luke\'s Medical Center',                     location: 'Quezon City',               type: 'hospital', stellarAddress: 'GASLK8STLUKES8QUEZONCITY8DEMO8ADDRESS8SALOMED8SLKQC' },
  { name: 'St. Luke\'s Medical Center - Global City',       location: 'BGC, Taguig',               type: 'hospital', stellarAddress: 'GASLB9STLUKESBGC9TAGUIG9DEMO9ADDRESS9SALOMED9SLKBGC' },
  { name: 'Makati Medical Center (MMC)',                     location: 'Makati City',               type: 'hospital', stellarAddress: 'GAMMC10MAKATIMEDI10MAKATI10DEMO10ADDRESS10SALOMED1M' },
  { name: 'The Medical City (TMC)',                          location: 'Ortigas, Pasig City',       type: 'hospital', stellarAddress: 'GATMC11MEDICALCITY11PASIG11DEMO11ADDRESS11SALOMED11T' },
  { name: 'Asian Hospital and Medical Center',               location: 'Muntinlupa City',           type: 'hospital', stellarAddress: 'GAAHM12ASIANHOSPITAL12MUNTINLUPA12DEMO12ADDRESS12SA' },
  { name: 'Cardinal Santos Medical Center',                  location: 'San Juan City',             type: 'hospital', stellarAddress: 'GACRD13CARDINALSANTOS13SANJUAN13DEMO13ADDRESS13SAL' },
  { name: 'Manila Doctors Hospital',                        location: 'Ermita, Manila',            type: 'hospital', stellarAddress: 'GAMDH14MANILADOCTORS14ERMITA14DEMO14ADDRESS14SALOM' },
  { name: 'Chong Hua Hospital',                             location: 'Cebu',                      type: 'hospital', stellarAddress: 'GACHH15CHONGHUA15CEBU15DEMO15ADDRESS15SALOMED15CHH' },
  { name: 'Baguio General Hospital and Medical Center',      location: 'Baguio City',               type: 'hospital', stellarAddress: 'GABGH16BAGUIOGENERAL16BAGUIO16DEMO16ADDRESS16SALO1' },
  { name: 'Bicol Medical Center',                           location: 'Naga City',                 type: 'hospital', stellarAddress: 'GABMC17BICOLMEDICAL17NAGA17DEMO17ADDRESS17SALOMED17' },
  { name: 'Ilocos Training and Regional Medical Center',     location: 'San Fernando, La Union',   type: 'hospital', stellarAddress: 'GAITR18ILOCOSTRAINING18LAUNION18DEMO18ADDRESS18SAL' },
  { name: 'Jose B. Lingad Memorial General Hospital',        location: 'San Fernando, Pampanga',   type: 'hospital', stellarAddress: 'GAJBL19LINGADMEMORIAL19PAMPANGA19DEMO19ADDRESS19SA' },
  { name: 'Vicente Sotto Memorial Medical Center',          location: 'Cebu City',                 type: 'hospital', stellarAddress: 'GAVSM20VICENTESOTTO20CEBU20DEMO20ADDRESS20SALOMED20' },
  { name: 'Cebu Doctors\' University Hospital',             location: 'Cebu City',                 type: 'hospital', stellarAddress: 'GACDU21CEBYDOCTORS21CEBU21DEMO21ADDRESS21SALOMED21' },
  { name: 'Western Visayas Medical Center',                 location: 'Iloilo City',               type: 'hospital', stellarAddress: 'GAWVM22WESTERNVISAYAS22ILOILO22DEMO22ADDRESS22SALO' },
  { name: 'Corazon Locsin Montelibano Memorial Regional Hospital', location: 'Bacolod City',      type: 'hospital', stellarAddress: 'GACLM23CORAZONLOCSIN23BACOLOD23DEMO23ADDRESS23SAL2' },
  { name: 'Southern Philippines Medical Center (SPMC)',      location: 'Davao City',               type: 'hospital', stellarAddress: 'GASPM24SOUTHERNPHIL24DAVAO24DEMO24ADDRESS24SALOMED' },
  { name: 'Davao Doctors Hospital',                         location: 'Davao City',                type: 'hospital', stellarAddress: 'GADDH25DAVAODOCTORS25DAVAO25DEMO25ADDRESS25SALOMED' },
  { name: 'Northern Mindanao Medical Center',               location: 'Cagayan de Oro City',       type: 'hospital', stellarAddress: 'GANMM26NORTHERNMINDANAO26CDO26DEMO26ADDRESS26SALO2' },
  { name: 'Zamboanga City Medical Center',                  location: 'Zamboanga City',            type: 'hospital', stellarAddress: 'GAZCM27ZAMBOANGAMEDICAL27ZAMBO27DEMO27ADDRESS27SAL' },
];

export const PHARMACIES: Provider[] = [
  { name: 'Mercury Drug',            location: 'Nationwide', type: 'pharmacy', stellarAddress: 'GAMRD28MERCURYDRUG28NATIONWIDE28DEMO28ADDRESS28SALO' },
  { name: 'Watsons Philippines',     location: 'Nationwide', type: 'pharmacy', stellarAddress: 'GAWTS29WATSONSPHL29NATIONWIDE29DEMO29ADDRESS29SALO2' },
  { name: 'The Generics Pharmacy (TGP)', location: 'Nationwide', type: 'pharmacy', stellarAddress: 'GATGP30GENERICSPHARMA30NATIONWIDE30DEMO30ADDRESS30SA' },
  { name: 'Generika Drugstore',      location: 'Nationwide', type: 'pharmacy', stellarAddress: 'GAGRK31GENERIKA31NATIONWIDE31DEMO31ADDRESS31SALOMED3' },
  { name: 'Southstar Drug',          location: 'Nationwide', type: 'pharmacy', stellarAddress: 'GASSD32SOUTHSTARDRUG32NATIONWIDE32DEMO32ADDRESS32SAL' },
];

export const ALL_PROVIDERS: Provider[] = [...HOSPITALS, ...PHARMACIES];

export function getProviders(type: ProviderType): Provider[] {
  return type === 'hospital' ? HOSPITALS : PHARMACIES;
}
