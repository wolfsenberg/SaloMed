export type Language = 'taglish' | 'en' | 'tl';

export const TRANSLATIONS = {
  taglish: {
    // Navigation
    nav_vault: 'Vault',
    nav_payment: 'Payment',
    nav_loan: 'Loan',
    nav_remittance: 'Padala',
    nav_history: 'History',

    // Vault
    vault_status: 'Vault Status',
    vault_active: 'Active',
    vault_empty: 'Empty',
    vault_escrow: 'Escrow Balance',
    vault_cashback: 'SaloPoints',
    vault_cashback_desc: 'Earned from payments. Use this as an alternative balance when paying providers.',
    vault_topup: 'Top Up',
    vault_history: 'View History',
    vault_earn_title: 'How to Earn SaloPoints',
    vault_earn_tip1: 'Earn 2 SaloPoints per XLM when you pay at a hospital.',
    vault_earn_tip2: 'Earn 1 SaloPoint per XLM when you pay at a pharmacy.',
    vault_earn_tip3: 'Earn 1 SaloPoint per XLM when you send Padala to family.',
    vault_earn_tip4: 'Save up 50 points and convert to 1 XLM anytime.',
    vault_earn_tip5: 'Earn more points to get better loan rates.',

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
    connect_loan_desc: 'Connect your Freighter wallet to view loan options and apply.',
    connect_remit_title: 'Connect Your Wallet',
    connect_remit_desc: 'Please connect your Freighter wallet to send a Padala or fund another family member\'s vault.',
    connect_history_title: 'Connect Wallet',
    connect_history_desc: 'Connect your Freighter wallet to view your transaction history.',

    // Onboarding
    onboard_skip: 'Skip',
    onboard_next: 'Next',
    onboard_start: 'Get Started',
    onboard_slide1_title: 'Your Health Alkansya',
    onboard_slide1_desc: 'Unlike regular e-wallets, SaloMed vaults are Purpose-Bound. The funds you save here are strictly locked and can exclusively be spent on healthcare at whitelisted hospitals and pharmacies.',
    onboard_slide2_title: 'Zero-Crypto Anxiety',
    onboard_slide2_desc: 'Enjoy a seamless app experience that feels exactly like your everyday e-wallet. Fund your vault in PHP and scan to pay instantly, while unbreakable Stellar blockchain security runs quietly in the background.',
    onboard_slide3_title: 'The Ultimate Health Pasaload',
    onboard_slide3_desc: 'Send instant medical support to your family anywhere. With all transactions permanently recorded on-chain, you have guaranteed peace of mind that your padala is spent exactly on medicine and healthcare.',

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
    common_demo_testnet: 'Demo mode · Ensure Freighter is set to Testnet',
    common_demo_simulated: 'Demo mode — applications are simulated.',
  },
  en: {
    // Navigation
    nav_vault: 'Vault',
    nav_payment: 'Payment',
    nav_loan: 'Loan',
    nav_remittance: 'Remittance',
    nav_history: 'History',

    // Vault
    vault_status: 'Vault Status',
    vault_active: 'Active',
    vault_empty: 'Empty',
    vault_escrow: 'Escrow Balance',
    vault_cashback: 'SaloPoints',
    vault_cashback_desc: 'Earned from payments. Use this as an alternative balance when paying providers.',
    vault_topup: 'Top Up',
    vault_history: 'View History',
    vault_earn_title: 'How to Earn SaloPoints',
    vault_earn_tip1: 'Earn 2 SaloPoints per XLM when you pay at a hospital.',
    vault_earn_tip2: 'Earn 1 SaloPoint per XLM when you pay at a pharmacy.',
    vault_earn_tip3: 'Earn 1 SaloPoint per XLM when you send a remittance to family.',
    vault_earn_tip4: 'Save up 50 points and convert them to 1 XLM anytime.',
    vault_earn_tip5: 'Earn more points to get better loan rates.',

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
    connect_loan_desc: 'Connect your Freighter wallet to view loan options and apply.',
    connect_remit_title: 'Connect Your Wallet',
    connect_remit_desc: 'Please connect your Freighter wallet to send a remittance or fund another family member\'s vault.',
    connect_history_title: 'Connect Wallet',
    connect_history_desc: 'Connect your Freighter wallet to view your transaction history.',

    // Onboarding
    onboard_skip: 'Skip',
    onboard_next: 'Next',
    onboard_start: 'Get Started',
    onboard_slide1_title: 'Your Health Alkansya',
    onboard_slide1_desc: 'Unlike regular e-wallets, SaloMed vaults are Purpose-Bound. The funds you save here are strictly locked and can exclusively be spent on healthcare at whitelisted hospitals and pharmacies.',
    onboard_slide2_title: 'Zero-Crypto Anxiety',
    onboard_slide2_desc: 'Enjoy a seamless app experience that feels exactly like your everyday e-wallet. Fund your vault in PHP and scan to pay instantly, while unbreakable Stellar blockchain security runs quietly in the background.',
    onboard_slide3_title: 'The Ultimate Health Pasaload',
    onboard_slide3_desc: 'Send instant medical support to your family anywhere. With all transactions permanently recorded on-chain, you have guaranteed peace of mind that your remittance is spent exactly on medicine and healthcare.',

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
    common_demo_testnet: 'Demo mode · Ensure Freighter is set to Testnet',
    common_demo_simulated: 'Demo mode — applications are simulated.',
  },
  tl: {
    // Navigation
    nav_vault: 'Vault',
    nav_payment: 'Magbayad',
    nav_loan: 'Loan',
    nav_remittance: 'Padala',
    nav_history: 'Transaksyon',

    // Vault
    vault_status: 'Vault Status',
    vault_active: 'Aktibo',
    vault_empty: 'Walang Laman',
    vault_escrow: 'Escrow Balance',
    vault_cashback: 'SaloPoints',
    vault_cashback_desc: 'Nakukuha tuwing nagbabayad. Pwede itong gamitin na pambayad sa mga partner hospitals at pharmacies.',
    vault_topup: 'Mag-Top Up',
    vault_history: 'Tingnan ang mga Transaksyon',
    vault_earn_title: 'Paano Makakuha ng SaloPoints',
    vault_earn_tip1: 'Makakuha ng 2 SaloPoints bawat XLM kapag nagbayad sa hospital.',
    vault_earn_tip2: 'Makakuha ng 1 SaloPoint bawat XLM kapag nagbayad sa pharmacy.',
    vault_earn_tip3: 'Makakuha ng 1 SaloPoint bawat XLM kapag nagpadala sa pamilya.',
    vault_earn_tip4: 'Makaipon ng 50 points at i-convert sa 1 XLM kahit kailan.',
    vault_earn_tip5: 'Mas maraming points, mas mababa ang interest sa loan.',

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
    connect_loan_desc: 'Ikonekta ang iyong Freighter wallet para makita ang mga loan options at makapag-apply.',
    connect_remit_title: 'Ikonekta ang Iyong Wallet',
    connect_remit_desc: 'Ikonekta ang iyong Freighter wallet para magpadala o pondohan ang vault ng iyong pamilya.',
    connect_history_title: 'Ikonekta ang Wallet',
    connect_history_desc: 'Ikonekta ang iyong Freighter wallet para makita ang listahan ng iyong mga transaksyon.',

    // Onboarding
    onboard_skip: 'Laktawan',
    onboard_next: 'Susunod',
    onboard_start: 'Magsimula',
    onboard_slide1_title: 'Ang Iyong Health Alkansya',
    onboard_slide1_desc: 'Hindi tulad ng mga karaniwang e-wallet, ang SaloMed vaults ay may layunin. Ang perang iniipon mo rito ay naka-lock at tanging sa mga nakalistang ospital at parmasya lamang pwedeng gastusin para sa kalusugan.',
    onboard_slide2_title: 'Walang Kaba sa Crypto',
    onboard_slide2_desc: 'I-enjoy ang app na parang ordinaryong e-wallet lang. Pondohan ang iyong vault gamit ang PHP at mag-scan para makapagbayad agad, habang sinisiguro ng Stellar blockchain ang seguridad.',
    onboard_slide3_title: 'Ang Pinaka-aasahang Health Pasaload',
    onboard_slide3_desc: 'Magpadala ng tulong medikal sa iyong pamilya kahit saan. Dahil nakatala nang permanente ang lahat ng transaksyon sa blockchain, nakakasiguro kang ang padala mo ay napupunta talaga sa pambili ng gamot at pagpapagamot.',

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
    common_demo_testnet: 'Demo mode · Siguraduhing nasa Testnet ang Freighter',
    common_demo_simulated: 'Demo mode — simulated lamang ang mga applications.',
  }
};

export type TranslationKey = keyof typeof TRANSLATIONS.taglish;
