#![cfg(test)]

use soroban_sdk::{testutils::Address as _, token, Address, BytesN, Env, String};
use crate::{LusogContract, LusogContractClient, ServiceType};

fn setup() -> (Env, LusogContractClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = sac.address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, LusogContract);
    let client = LusogContractClient::new(&env, &contract_id);
    client.initialize(&admin, &token_id);

    let hospital = Address::generate(&env);
    client.register_hospital(&admin, &hospital);

    let patient = Address::generate(&env);
    token_client.mint(&patient, &10_000_000);

    (env, client, admin, hospital, patient)
}

fn make_id(env: &Env, seed: u8) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[0] = seed;
    BytesN::from_array(env, &bytes)
}

#[test]
fn test_happy_path_create_and_pay() {
    let (env, client, _admin, hospital, patient) = setup();
    let rid = make_id(&env, 1);

    client.create_billing(
        &hospital, &patient, &rid,
        &ServiceType::Consultation, &500_000,
        &String::from_str(&env, "OPD checkup"),
    );

    let rec = client.verify_receipt(&rid);
    assert_eq!(rec.amount, 500_000);
    assert!(!rec.paid);

    client.pay_bill(&patient, &rid);

    let rec = client.verify_receipt(&rid);
    assert!(rec.paid);

    let (total, paid) = client.get_stats();
    assert_eq!(total, 1);
    assert_eq!(paid, 500_000);
}

#[test]
#[should_panic(expected = "record already exists")]
fn test_duplicate_billing_rejected() {
    let (env, client, _admin, hospital, patient) = setup();
    let rid = make_id(&env, 2);

    client.create_billing(
        &hospital, &patient, &rid,
        &ServiceType::Laboratory, &200_000,
        &String::from_str(&env, "CBC"),
    );
    client.create_billing(
        &hospital, &patient, &rid,
        &ServiceType::Laboratory, &200_000,
        &String::from_str(&env, "CBC duplicate"),
    );
}

#[test]
fn test_patient_records_tracked() {
    let (env, client, _admin, hospital, patient) = setup();
    let r1 = make_id(&env, 10);
    let r2 = make_id(&env, 11);

    client.create_billing(
        &hospital, &patient, &r1,
        &ServiceType::Consultation, &300_000,
        &String::from_str(&env, "Checkup"),
    );
    client.create_billing(
        &hospital, &patient, &r2,
        &ServiceType::Pharmacy, &150_000,
        &String::from_str(&env, "Paracetamol"),
    );

    let recs = client.get_patient_records(&patient);
    assert_eq!(recs.len(), 2);

    let (total, _) = client.get_stats();
    assert_eq!(total, 2);
}