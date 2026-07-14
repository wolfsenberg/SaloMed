export type ProviderType = 'hospital' | 'pharmacy';

export interface Provider {
  name: string;
  location: string;
  type: ProviderType;
  /**
   * Payment target. In demo mode this doubles as the demo provider id; a real
   * checksum-valid Stellar address is used so the same directory works when the
   * app is switched to stellar_testnet mode.
   */
  paymentTarget: string;
}

export const HOSPITALS: Provider[] = [
  {
    name: 'Philippine General Hospital',
    location: 'Manila',
    type: 'hospital',
    paymentTarget: 'GDGXGJTIGCXMQTAG362YFKCBZ4FARG33SDOKCZ4DOTFP4J63EPCYMRKH',
  },
  {
    name: 'Philippine Heart Center',
    location: 'Quezon City',
    type: 'hospital',
    paymentTarget: 'GB5B7D54X2YWGSNO325RBP32ZIMNGLLIIXBHSRU5TJFPY4E6XLAGVV74',
  },
  {
    name: 'St. Luke\'s Medical Center',
    location: 'Quezon City',
    type: 'hospital',
    paymentTarget: 'GCTFXRJOGAKUZH5OKQTG77BDFHWD5CZ4YXKVJJR3SP3AIYPPBVKEIWK7',
  },
  {
    name: 'Makati Medical Center',
    location: 'Makati',
    type: 'hospital',
    paymentTarget: 'GDCYII5WNUNHGKW2XPLSC2YITBYLGUW3Y3IONY2PDJ43FYUZKCEBJQVY',
  },
  {
    name: 'The Medical City',
    location: 'Pasig',
    type: 'hospital',
    paymentTarget: 'GA3O3Q3J2KECID3WI4EUCNH52PQ722YHA3NQGEHCUIBZIFGFHOHQOUAV',
  },
  {
    name: 'Southern Philippines Medical Center',
    location: 'Davao',
    type: 'hospital',
    paymentTarget: 'GCUFGMEDXSPW3JBE6K4RNG56NPY5GYDMDQTJWPHDIGBA7RTPYGY5K4RT',
  },
  {
    name: 'Vicente Sotto Memorial Medical Center',
    location: 'Cebu',
    type: 'hospital',
    paymentTarget: 'GDSXB4TOKTSMTYJUZT5V5FSQCTL5VKCL5BM6FGZSSIPPQB6GAOZCE6ZK',
  },
  {
    name: 'Baguio General Hospital',
    location: 'Baguio',
    type: 'hospital',
    paymentTarget: 'GAE362LWPPTAVWORRFKLMI23YP74AOVVRX3TVL3Y2PQIOKJMCOD2K2ML',
  },
];

export const PHARMACIES: Provider[] = [
  {
    name: 'Mercury Drug',
    location: 'Nationwide',
    type: 'pharmacy',
    paymentTarget: 'GDETADKFTAUVSS2WWNP4E53BPKFDYHARX3QZAVWVWBJ4NA73DKMXCJIK',
  },
  {
    name: 'Watsons Pharmacy',
    location: 'Nationwide',
    type: 'pharmacy',
    paymentTarget: 'GB7MEBYH3DEKHKJGS6Z6WTL45MQEWRVY7T4KFQ4DSVVDMJGGMRFVQW4O',
  },
  {
    name: 'Southstar Drug',
    location: 'Luzon',
    type: 'pharmacy',
    paymentTarget: 'GB2H7FK4MSCYGURLHX3NZJ7DZPXGOYIMMS5QNEXTSNFM7WDWQTXV3ATF',
  },
  {
    name: 'Rose Pharmacy',
    location: 'Visayas',
    type: 'pharmacy',
    paymentTarget: 'GBEX57NASAYLM6WPKFRIHJGRMEXEFJGYZHCMBGTOX4U27YMR46D2XBLT',
  },
  {
    name: 'The Generics Pharmacy',
    location: 'Nationwide',
    type: 'pharmacy',
    paymentTarget: 'GCNHM5HIA2VGHKOOXR6UWFZAZYWZUDG7RW63P6CXLQAJYQ53WEKKAVTE',
  },
  {
    name: 'Generika Drugstore',
    location: 'Nationwide',
    type: 'pharmacy',
    paymentTarget: 'GD3WALJF5DL36KPI6MDM2PBIOBYDLK32CJLV6RDAHO5BQRUEFRGZRAYU',
  },
];

export function getProviders(type: ProviderType): Provider[] {
  return type === 'hospital' ? HOSPITALS : PHARMACIES;
}
