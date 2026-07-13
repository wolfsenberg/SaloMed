export type Language = 'taglish' | 'en' | 'tl';

export const TRANSLATIONS = {
  taglish: {
    // Navigation
    nav_vault: 'Vault',
    nav_payment: 'Payment',
    nav_loan: 'Salo',
    nav_remittance: 'Padala',
    nav_history: 'History',

    // Vault
    vault_status: 'Vault Status',
    vault_active: 'Active',
    vault_empty: 'Empty',
    vault_escrow: 'Escrow Balance',
    vault_cashback: 'SaloPoints',
    vault_cashback_desc: 'Earned from healthcare payments. Points improve your Salo tier and partner benefits.',
    vault_topup: 'Top Up',
    vault_history: 'View History',
    vault_earn_title: 'How to Earn SaloPoints',
    vault_earn_tip1: 'Earn 2 SaloPoints per XLM when you pay at a hospital.',
    vault_earn_tip2: 'Earn 1 SaloPoint per XLM when you pay at a pharmacy.',
    vault_earn_tip3: 'Padala funds family vaults but does not award SaloPoints.',
    vault_earn_tip4: 'SaloPoints are not cash and are not withdrawable.',
    vault_earn_tip5: 'Earn more points to get better Salo rates.',

    // Payment
    pay_title: 'SaloMed Verified Payment',
    pay_scan_desc: 'Scan your QR Code para makapagbayad sa kahit anong partnered hospital o pharmacy.',
    pay_scan_btn: 'Scan QR Code',
    pay_manual_btn: 'Enter Manually',
    pay_manual_title: 'Manual Payment',
    pay_enter_provider: 'Enter provider G-address',
    pay_amount: 'Amount to Pay',
    pay_pay_from: 'Pay From',
    pay_vault_balance: 'Vault Balance',
    pay_savings_balance: 'Savings Balance',
    pay_available_balance: 'Available Balance',
    pay_insufficient: 'Not enough balance',
    pay_insufficient_desc: 'Your {source} balance ({balance} XLM) is not enough to cover this payment.',
    pay_confirm_btn: 'Confirm Payment',
    pay_insufficient_btn: 'Insufficient Balance',

    // Remittance
    remit_title: 'SaloMed Verified Padala',
    remit_desc: 'Send XLM instantly sa pamilya mo dito sa Pilipinas.',
    remit_recipient: 'Recipient Address',
    remit_amount: 'Amount to Send',
    remit_send_btn: 'Send Padala',

    // Connect Prompts
    connect_vault_title: 'Welcome to SaloMed, Your Health Alkansya',
    connect_vault_desc: 'Connect your Freighter wallet to unlock purpose-bound savings and seamlessly manage your health expenses.',
    connect_pay_title: 'Connect Wallet to Pay',
    connect_pay_desc: 'Connect your Freighter wallet to generate QR codes and make payments.',
    connect_loan_title: 'Connect Wallet',
    connect_loan_desc: 'Connect your Freighter wallet to request Salo, health bill support when your vault falls short.',
    connect_remit_title: 'Connect Your Wallet',
    connect_remit_desc: 'Please connect your Freighter wallet to send a Padala or fund another family member\'s vault.',
    connect_history_title: 'Connect Wallet',
    connect_history_desc: 'Connect your Freighter wallet to view your transaction history.',

    // Onboarding
    onboard_skip: 'Skip',
    onboard_next: 'Next',
    onboard_start: 'Get Started',
    onboard_slide1_title: 'Your Health Alkansya',
    onboard_slide1_desc: 'A purpose-bound health vault secured on the Stellar network. Save for healthcare, and spend only at whitelisted hospitals and pharmacies.',
    onboard_slide2_title: 'Zero-Crypto Anxiety',
    onboard_slide2_desc: 'See your balance in Philippine Pesos, top up in a few taps, and pay for healthcare in a familiar mobile experience.',
    onboard_slide3_title: 'The Ultimate Health Pasaload',
    onboard_slide3_desc: 'Send health support to a family member straight to their locked vault. Every transfer is recorded on Stellar and verifiable on-chain.',

    // Language Selection
    lang_select_title: 'Choose a Language',
    lang_select_desc: 'How do you want to use SaloMed?',
    lang_taglish: 'Default',
    lang_en: 'English',
    lang_tl: 'Tagalog',
    lang_continue: 'Continue',

    // Common
    common_language: 'Language',
    common_connecting: 'Connecting…',
    common_connect_wallet: 'Connect Wallet',
    common_disconnect: 'Disconnect',
    common_desktop_view: 'Desktop View',
    common_mobile_view: 'Mobile View',
    common_demo_testnet: 'Secured on the Stellar network',
    common_demo_simulated: 'Every transaction is recorded on-chain and verifiable on Stellar.',
  },
  en: {
    // Navigation
    nav_vault: 'Vault',
    nav_payment: 'Payment',
    nav_loan: 'Salo',
    nav_remittance: 'Remittance',
    nav_history: 'History',

    // Vault
    vault_status: 'Vault Status',
    vault_active: 'Active',
    vault_empty: 'Empty',
    vault_escrow: 'Escrow Balance',
    vault_cashback: 'SaloPoints',
    vault_cashback_desc: 'Earned from healthcare payments. Points improve your Salo tier and partner benefits.',
    vault_topup: 'Top Up',
    vault_history: 'View History',
    vault_earn_title: 'How to Earn SaloPoints',
    vault_earn_tip1: 'Earn 2 SaloPoints per XLM when you pay at a hospital.',
    vault_earn_tip2: 'Earn 1 SaloPoint per XLM when you pay at a pharmacy.',
    vault_earn_tip3: 'Remittance funds family vaults but does not award SaloPoints.',
    vault_earn_tip4: 'SaloPoints are not cash and are not withdrawable.',
    vault_earn_tip5: 'Earn more points to get better Salo rates.',

    // Payment
    pay_title: 'SaloMed Verified Payment',
    pay_scan_desc: 'Scan a QR Code to pay at any partnered hospital or pharmacy.',
    pay_scan_btn: 'Scan QR Code',
    pay_manual_btn: 'Enter Manually',
    pay_manual_title: 'Manual Payment',
    pay_enter_provider: 'Enter provider G-address',
    pay_amount: 'Amount to Pay',
    pay_pay_from: 'Pay From',
    pay_vault_balance: 'Vault Balance',
    pay_savings_balance: 'Savings Balance',
    pay_available_balance: 'Available Balance',
    pay_insufficient: 'Not enough balance',
    pay_insufficient_desc: 'Your {source} balance ({balance} XLM) is not enough to cover this payment.',
    pay_confirm_btn: 'Confirm Payment',
    pay_insufficient_btn: 'Insufficient Balance',

    // Remittance
    remit_title: 'SaloMed Verified Remittance',
    remit_desc: 'Send XLM instantly to your family in the Philippines.',
    remit_recipient: 'Recipient Address',
    remit_amount: 'Amount to Send',
    remit_send_btn: 'Send Remittance',

    // Connect Prompts
    connect_vault_title: 'Welcome to SaloMed, Your Health Alkansya',
    connect_vault_desc: 'Connect your Freighter wallet to unlock purpose-bound savings and seamlessly manage your health expenses.',
    connect_pay_title: 'Connect Wallet to Pay',
    connect_pay_desc: 'Connect your Freighter wallet to generate QR codes and make payments.',
    connect_loan_title: 'Connect Wallet',
    connect_loan_desc: 'Connect your Freighter wallet to request Salo, health bill support when your vault falls short.',
    connect_remit_title: 'Connect Your Wallet',
    connect_remit_desc: 'Please connect your Freighter wallet to send a remittance or fund another family member\'s vault.',
    connect_history_title: 'Connect Wallet',
    connect_history_desc: 'Connect your Freighter wallet to view your transaction history.',

    // Onboarding
    onboard_skip: 'Skip',
    onboard_next: 'Next',
    onboard_start: 'Get Started',
    onboard_slide1_title: 'Your Health Alkansya',
    onboard_slide1_desc: 'A purpose-bound health vault secured on the Stellar network. Save for healthcare, and spend only at whitelisted hospitals and pharmacies.',
    onboard_slide2_title: 'Zero-Crypto Anxiety',
    onboard_slide2_desc: 'See your balance in Philippine Pesos, top up in a few taps, and pay for healthcare in a familiar mobile experience.',
    onboard_slide3_title: 'The Ultimate Health Pasaload',
    onboard_slide3_desc: 'Send health support to a family member straight to their locked vault. Every transfer is recorded on Stellar and verifiable on-chain.',

    // Language Selection
    lang_select_title: 'Choose a Language',
    lang_select_desc: 'How do you want to use SaloMed?',
    lang_taglish: 'Default',
    lang_en: 'English',
    lang_tl: 'Tagalog',
    lang_continue: 'Continue',

    // Common
    common_language: 'Language',
    common_connecting: 'Connecting…',
    common_connect_wallet: 'Connect Wallet',
    common_disconnect: 'Disconnect',
    common_desktop_view: 'Desktop View',
    common_mobile_view: 'Mobile View',
    common_demo_testnet: 'Secured on the Stellar network',
    common_demo_simulated: 'Every transaction is recorded on-chain and verifiable on Stellar.',
  },
  tl: {
    // Navigation
    nav_vault: 'Vault',
    nav_payment: 'Magbayad',
    nav_loan: 'Salo',
    nav_remittance: 'Padala',
    nav_history: 'Transaksyon',

    // Vault
    vault_status: 'Vault Status',
    vault_active: 'Aktibo',
    vault_empty: 'Walang Laman',
    vault_escrow: 'Escrow Balance',
    vault_cashback: 'SaloPoints',
    vault_cashback_desc: 'Nakukuha tuwing healthcare payment. Pinapabuti nito ang iyong Salo tier at partner benefits.',
    vault_topup: 'Mag-Top Up',
    vault_history: 'Tingnan ang mga Transaksyon',
    vault_earn_title: 'Paano Makakuha ng SaloPoints',
    vault_earn_tip1: 'Makakuha ng 2 SaloPoints bawat XLM kapag nagbayad sa hospital.',
    vault_earn_tip2: 'Makakuha ng 1 SaloPoint bawat XLM kapag nagbayad sa pharmacy.',
    vault_earn_tip3: 'Ang Padala ay para pondohan ang family vault, pero walang SaloPoints.',
    vault_earn_tip4: 'Ang SaloPoints ay hindi cash at hindi pwedeng i-withdraw.',
    vault_earn_tip5: 'Mas maraming points, mas mababa ang Salo rate.',

    // Payment
    pay_title: 'SaloMed Verified Payment',
    pay_scan_desc: 'I-scan ang QR Code para makapagbayad sa kahit anong partner hospital o parmasya.',
    pay_scan_btn: 'I-scan ang QR Code',
    pay_manual_btn: 'Manual na Ilagay',
    pay_manual_title: 'Manual na Pagbabayad',
    pay_enter_provider: 'Ilagay ang G-address ng provider',
    pay_amount: 'Halagang Babayaran',
    pay_pay_from: 'Kunin ang bayad mula sa',
    pay_vault_balance: 'Vault Balance',
    pay_savings_balance: 'Savings Balance',
    pay_available_balance: 'Available Balance',
    pay_insufficient: 'Kulang ang balanse',
    pay_insufficient_desc: 'Hindi sapat ang iyong {source} balance ({balance} XLM) para sa babayarang ito.',
    pay_confirm_btn: 'Kumpirmahin ang Pagbabayad',
    pay_insufficient_btn: 'Kulang ang Balanse',

    // Remittance
    remit_title: 'SaloMed Verified Padala',
    remit_desc: 'Magpadala agad ng XLM sa iyong pamilya dito sa Pilipinas.',
    remit_recipient: 'Recipient Address',
    remit_amount: 'Halagang Ipapadala',
    remit_send_btn: 'Ipadala',

    // Connect Prompts
    connect_vault_title: 'Maligayang Pagdating sa SaloMed, Ang Iyong Health Alkansya',
    connect_vault_desc: 'Ikonekta ang iyong Freighter wallet para magbukas ng savings na nakalaan at madaling pamahalaan ang iyong mga gastusing medikal.',
    connect_pay_title: 'Ikonekta ang Wallet para Magbayad',
    connect_pay_desc: 'Ikonekta ang iyong Freighter wallet para gumawa ng QR codes at makapagbayad.',
    connect_loan_title: 'Ikonekta ang Wallet',
    connect_loan_desc: 'Ikonekta ang iyong Freighter wallet para humiling ng Salo, pansalo kapag kulang ang vault sa medical bill.',
    connect_remit_title: 'Ikonekta ang Iyong Wallet',
    connect_remit_desc: 'Ikonekta ang iyong Freighter wallet para magpadala o pondohan ang vault ng iyong pamilya.',
    connect_history_title: 'Ikonekta ang Wallet',
    connect_history_desc: 'Ikonekta ang iyong Freighter wallet para makita ang listahan ng iyong mga transaksyon.',

    // Onboarding
    onboard_skip: 'Laktawan',
    onboard_next: 'Susunod',
    onboard_start: 'Magsimula',
    onboard_slide1_title: 'Ang Iyong Health Alkansya',
    onboard_slide1_desc: 'Isang health vault na naka-secure sa Stellar network. Mag-ipon para sa kalusugan, at magagamit lamang sa mga whitelisted na ospital at parmasya.',
    onboard_slide2_title: 'Walang Kaba sa Crypto',
    onboard_slide2_desc: 'Makikita ang balanse sa Piso, mag-top up sa ilang tap, at magbayad para sa kalusugan sa pamilyar na mobile experience.',
    onboard_slide3_title: 'Ang Pinaka-aasahang Health Pasaload',
    onboard_slide3_desc: 'Magpadala ng tulong pangkalusugan diretso sa naka-lock na vault ng pamilya. Bawat padala ay naka-record sa Stellar at verifiable on-chain.',

    // Language Selection
    lang_select_title: 'Pumili ng Wika',
    lang_select_desc: 'Paano mo gustong gamitin ang SaloMed?',
    lang_taglish: 'Default',
    lang_en: 'English',
    lang_tl: 'Tagalog',
    lang_continue: 'Magpatuloy',

    // Common
    common_language: 'Wika',
    common_connecting: 'Kumokonekta…',
    common_connect_wallet: 'Ikonekta ang Wallet',
    common_disconnect: 'I-disconnect',
    common_desktop_view: 'Desktop View',
    common_mobile_view: 'Mobile View',
    common_demo_testnet: 'Naka-secure sa Stellar network',
    common_demo_simulated: 'Bawat transaksyon ay naka-record on-chain at verifiable sa Stellar.',
  }
};

export type TranslationKey = keyof typeof TRANSLATIONS.taglish;
