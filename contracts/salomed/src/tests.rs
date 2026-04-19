#![cfg(test)]

use soroban_sdk::{testutils::Address as _, token, Address, Env};

use crate::{CreditTier, SaloMedContract, SaloMedContractClient};

// ─── test harness ────────────────────────────────────────────────────────────

struct TestEnv {
    env: Env,
    client: SaloMedContractClient<'static>,
    admin: Address,
    hospital: Address,
    /// Pre-funded OFW wallet (1_000 USDC = 10_000_000_000 stroops)
    ofw: Address,
    token_id: Address,
}

fn setup() -> TestEnv {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = sac.address();

    let contract_id = env.register_contract(None, SaloMedContract);
    let client = SaloMedContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token_id);

    let hospital = Address::generate(&env);
    client.whitelist_hospital(&admin, &hospital);

    let ofw = Address::generate(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&ofw, &10_000_000_000); // 1 000 USDC

    TestEnv { env, client, admin, hospital, ofw, token_id }
}

// ─── deposit_remittance ───────────────────────────────────────────────────────

#[test]
fn test_deposit_creates_vault_with_correct_balance() {
    let t = setup();
    let beneficiary = Address::generate(&t.env);

    t.client.deposit_remittance(&t.ofw, &beneficiary, &50_000_000); // 5 USDC

    let vault = t.client.get_vault(&beneficiary);
    assert_eq!(vault.balance, 50_000_000);
    assert_eq!(vault.salo_points, 0);
    assert_eq!(vault.credit_tier, CreditTier::Bronze);
}

#[test]
fn test_multiple_deposits_accumulate() {
    let t = setup();
    let beneficiary = Address::generate(&t.env);

    t.client.deposit_remittance(&t.ofw, &beneficiary, &30_000_000);
    t.client.deposit_remittance(&t.ofw, &beneficiary, &20_000_000);

    assert_eq!(t.client.get_vault(&beneficiary).balance, 50_000_000);
}

// ─── pay_hospital ─────────────────────────────────────────────────────────────

#[test]
fn test_pay_hospital_deducts_balance_and_transfers_tokens() {
    let t = setup();
    let patient = Address::generate(&t.env);

    t.client.deposit_remittance(&t.ofw, &patient, &200_000_000); // 20 USDC
    t.client.pay_hospital(&patient, &t.hospital, &100_000_000); // pay 10 USDC

    let vault = t.client.get_vault(&patient);
    assert_eq!(vault.balance, 100_000_000, "vault should have 10 USDC left");

    // hospital should have received 10 USDC
    let hospital_balance = token::Client::new(&t.env, &t.token_id).balance(&t.hospital);
    assert_eq!(hospital_balance, 100_000_000);
}

#[test]
fn test_pay_hospital_awards_salo_points() {
    let t = setup();
    let patient = Address::generate(&t.env);

    t.client.deposit_remittance(&t.ofw, &patient, &500_000_000); // 50 USDC
    t.client.pay_hospital(&patient, &t.hospital, &100_000_000); // 10 USDC → 10 pts

    let vault = t.client.get_vault(&patient);
    assert_eq!(vault.salo_points, 10);
    assert_eq!(vault.credit_tier, CreditTier::Bronze); // still < 100
}

#[test]
#[should_panic(expected = "hospital not whitelisted")]
fn test_pay_unwhitelisted_hospital_rejected() {
    let t = setup();
    let patient = Address::generate(&t.env);
    let rogue = Address::generate(&t.env);

    t.client.deposit_remittance(&t.ofw, &patient, &100_000_000);
    t.client.pay_hospital(&patient, &rogue, &50_000_000);
}

#[test]
#[should_panic(expected = "insufficient vault balance")]
fn test_pay_over_balance_rejected() {
    let t = setup();
    let patient = Address::generate(&t.env);

    t.client.deposit_remittance(&t.ofw, &patient, &10_000_000); // 1 USDC
    t.client.pay_hospital(&patient, &t.hospital, &20_000_000); // try 2 USDC
}

// ─── credit tier transitions ──────────────────────────────────────────────────

#[test]
fn test_credit_tier_bronze_to_silver_to_gold() {
    let t = setup();
    let patient = Address::generate(&t.env);

    t.client.deposit_remittance(&t.ofw, &patient, &10_000_000_000); // lots of USDC

    // Pay 10 USDC → 10 pts → still Bronze
    t.client.pay_hospital(&patient, &t.hospital, &100_000_000);
    assert_eq!(t.client.get_vault(&patient).credit_tier, CreditTier::Bronze);

    // Award 90 more → total 100 → Silver
    t.client.award_points(&patient, &90);
    assert_eq!(t.client.get_vault(&patient).credit_tier, CreditTier::Silver);

    // Award 400 more → total 500 → Gold
    t.client.award_points(&patient, &400);
    assert_eq!(t.client.get_vault(&patient).credit_tier, CreditTier::Gold);
}

// ─── award_points ─────────────────────────────────────────────────────────────

#[test]
fn test_award_points_updates_vault() {
    let t = setup();
    let patient = Address::generate(&t.env);

    t.client.award_points(&patient, &250);

    let vault = t.client.get_vault(&patient);
    assert_eq!(vault.salo_points, 250);
    assert_eq!(vault.credit_tier, CreditTier::Silver);
}

// ─── whitelist management ─────────────────────────────────────────────────────

#[test]
fn test_remove_hospital_blocks_payment() {
    let t = setup();
    let patient = Address::generate(&t.env);

    t.client.deposit_remittance(&t.ofw, &patient, &100_000_000);
    assert!(t.client.is_whitelisted(&t.hospital));

    t.client.remove_hospital(&t.admin, &t.hospital);
    assert!(!t.client.is_whitelisted(&t.hospital));
}

#[test]
#[should_panic(expected = "not admin")]
fn test_whitelist_by_non_admin_rejected() {
    let t = setup();
    let impersonator = Address::generate(&t.env);
    let new_hospital = Address::generate(&t.env);

    t.client.whitelist_hospital(&impersonator, &new_hospital);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize_rejected() {
    let t = setup();
    let fake_token = Address::generate(&t.env);
    t.client.initialize(&t.admin, &fake_token);
}
