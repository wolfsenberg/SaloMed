#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum ServiceType {
    Consultation,
    Laboratory,
    Pharmacy,
    Imaging,
    Emergency,
}

#[contracttype]
#[derive(Clone)]
pub struct BillingRecord {
    pub record_id: BytesN<32>,
    pub patient: Address,
    pub hospital: Address,
    pub service: ServiceType,
    pub amount: i128,
    pub timestamp: u64,
    pub paid: bool,
    pub description: String,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TokenId,
    Hospital(Address),
    Record(BytesN<32>),
    PatientRecords(Address),
    HospitalRecords(Address),
    TotalRecords,
    TotalPaid,
}

#[contract]
pub struct LusogContract;

#[contractimpl]
impl LusogContract {
    pub fn initialize(env: Env, admin: Address, token_id: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage().instance().set(&DataKey::TotalRecords, &0u32);
        env.storage().instance().set(&DataKey::TotalPaid, &0i128);
    }

    pub fn register_hospital(env: Env, admin: Address, hospital: Address) {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(admin == stored_admin, "only admin can register hospitals");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Hospital(hospital.clone()), &true);
        env.events().publish((symbol_short!("hosp_reg"),), hospital);
    }

    pub fn create_billing(
        env: Env,
        hospital: Address,
        patient: Address,
        record_id: BytesN<32>,
        service: ServiceType,
        amount: i128,
        description: String,
    ) {
        hospital.require_auth();

        // FOR DEMO: Allow any wallet to act as hospital
        // let is_hospital: bool = env.storage().instance()
        //     .get(&DataKey::Hospital(hospital.clone()))
        //     .unwrap_or(false);
        // assert!(is_hospital, "not a registered hospital");
        assert!(amount > 0, "amount must be positive");

        let existing: Option<BillingRecord> = env.storage().instance().get(&DataKey::Record(record_id.clone()));
        assert!(existing.is_none(), "record already exists");

        let record = BillingRecord {
            record_id: record_id.clone(),
            patient: patient.clone(),
            hospital: hospital.clone(),
            service,
            amount,
            timestamp: env.ledger().timestamp(),
            paid: false,
            description,
        };

        env.storage().instance().set(&DataKey::Record(record_id.clone()), &record);

        let mut patient_recs: Vec<BytesN<32>> = env.storage().instance()
            .get(&DataKey::PatientRecords(patient.clone()))
            .unwrap_or(Vec::new(&env));
        patient_recs.push_back(record_id.clone());
        env.storage().instance().set(&DataKey::PatientRecords(patient.clone()), &patient_recs);

        let mut hosp_recs: Vec<BytesN<32>> = env.storage().instance()
            .get(&DataKey::HospitalRecords(hospital.clone()))
            .unwrap_or(Vec::new(&env));
        hosp_recs.push_back(record_id.clone());
        env.storage().instance().set(&DataKey::HospitalRecords(hospital.clone()), &hosp_recs);

        let mut total: u32 = env.storage().instance().get(&DataKey::TotalRecords).unwrap();
        total += 1;
        env.storage().instance().set(&DataKey::TotalRecords, &total);

        env.events().publish((symbol_short!("billing"), record_id.clone()), patient);
    }

    pub fn pay_bill(env: Env, patient: Address, record_id: BytesN<32>) {
        patient.require_auth();

        let mut record: BillingRecord = env.storage().instance()
            .get(&DataKey::Record(record_id.clone()))
            .expect("record not found");
        assert!(!record.paid, "already paid");
        assert!(record.patient == patient, "not your bill");

        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        let client = token::Client::new(&env, &token_id);
        client.transfer(&patient, &record.hospital, &record.amount);

        record.paid = true;
        env.storage().instance().set(&DataKey::Record(record_id.clone()), &record);

        let mut total_paid: i128 = env.storage().instance().get(&DataKey::TotalPaid).unwrap();
        total_paid += record.amount;
        env.storage().instance().set(&DataKey::TotalPaid, &total_paid);

        env.events().publish((symbol_short!("paid"), record_id), patient);
    }

    pub fn verify_receipt(env: Env, record_id: BytesN<32>) -> BillingRecord {
        env.storage().instance()
            .get(&DataKey::Record(record_id))
            .expect("record not found")
    }

    pub fn get_patient_records(env: Env, patient: Address) -> Vec<BytesN<32>> {
        env.storage().instance()
            .get(&DataKey::PatientRecords(patient))
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_stats(env: Env) -> (u32, i128) {
        let total: u32 = env.storage().instance().get(&DataKey::TotalRecords).unwrap_or(0);
        let paid: i128 = env.storage().instance().get(&DataKey::TotalPaid).unwrap_or(0);
        (total, paid)
    }
}

#[cfg(test)]
mod tests;