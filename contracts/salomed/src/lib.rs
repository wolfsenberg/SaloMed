#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum CreditTier {
    Bronze,
    Silver,
    Gold,
}

/// Escrow vault for a single user. Balance is in stroops (1 USDC = 10_000_000).
#[contracttype]
#[derive(Clone)]
pub struct HealthVault {
    pub balance: i128,
    pub salo_points: u32,
    pub credit_tier: CreditTier,
}

#[contracttype]
pub enum DataKey {
    Admin,
    TokenId,
    Vault(Address),
    Hospital(Address),
}

#[contract]
pub struct SaloMedContract;

#[contractimpl]
impl SaloMedContract {
    /// One-time setup. Stores the admin and the USDC token contract address.
    pub fn initialize(env: Env, admin: Address, token_id: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
    }

    /// Admin-only: add a hospital or pharmacy to the payment whitelist.
    pub fn whitelist_hospital(env: Env, admin: Address, hospital: Address) {
        Self::assert_admin(&env, &admin);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Hospital(hospital), &true);
    }

    /// Admin-only: remove a provider from the whitelist.
    pub fn remove_hospital(env: Env, admin: Address, hospital: Address) {
        Self::assert_admin(&env, &admin);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Hospital(hospital), &false);
    }

    /// OFW remits USDC into a beneficiary's escrow vault.
    /// The OFW transfers USDC to this contract; the contract records it in the vault.
    pub fn deposit_remittance(env: Env, ofw: Address, beneficiary: Address, amount: i128) {
        assert!(amount > 0, "amount must be positive");
        ofw.require_auth();

        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        token::Client::new(&env, &token_id)
            .transfer(&ofw, &env.current_contract_address(), &amount);

        let mut vault = Self::load_vault(&env, &beneficiary);
        vault.balance += amount;
        vault.credit_tier = Self::tier_for(vault.salo_points);
        env.storage().instance().set(&DataKey::Vault(beneficiary), &vault);
    }

    /// Patient pays a whitelisted hospital directly from their vault.
    /// Awards 1 SaloPoint per 1 USDC paid and recomputes the credit tier.
    pub fn pay_hospital(env: Env, patient: Address, hospital: Address, amount: i128) {
        assert!(amount > 0, "amount must be positive");
        patient.require_auth();

        let is_whitelisted: bool = env
            .storage()
            .instance()
            .get(&DataKey::Hospital(hospital.clone()))
            .unwrap_or(false);
        assert!(is_whitelisted, "hospital not whitelisted");

        let mut vault = Self::load_vault(&env, &patient);
        assert!(vault.balance >= amount, "insufficient vault balance");

        vault.balance -= amount;
        // 1 SaloPoint per full USDC paid (10_000_000 stroops = 1 USDC)
        vault.salo_points = vault
            .salo_points
            .saturating_add((amount / 10_000_000) as u32);
        vault.credit_tier = Self::tier_for(vault.salo_points);
        env.storage().instance().set(&DataKey::Vault(patient), &vault);

        let token_id: Address = env.storage().instance().get(&DataKey::TokenId).unwrap();
        token::Client::new(&env, &token_id)
            .transfer(&env.current_contract_address(), &hospital, &amount);
    }

    /// Admin-only: grant bonus SaloPoints (e.g. for early savings or loyalty rewards).
    pub fn award_points(env: Env, patient: Address, points: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut vault = Self::load_vault(&env, &patient);
        vault.salo_points = vault.salo_points.saturating_add(points);
        vault.credit_tier = Self::tier_for(vault.salo_points);
        env.storage().instance().set(&DataKey::Vault(patient), &vault);
    }

    pub fn get_vault(env: Env, patient: Address) -> HealthVault {
        Self::load_vault(&env, &patient)
    }

    pub fn is_whitelisted(env: Env, hospital: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Hospital(hospital))
            .unwrap_or(false)
    }

    // ─── private helpers ─────────────────────────────────────────────────────

    fn assert_admin(env: &Env, caller: &Address) {
        let stored: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(*caller == stored, "not admin");
    }

    fn load_vault(env: &Env, user: &Address) -> HealthVault {
        env.storage()
            .instance()
            .get(&DataKey::Vault(user.clone()))
            .unwrap_or(HealthVault {
                balance: 0,
                salo_points: 0,
                credit_tier: CreditTier::Bronze,
            })
    }

    /// Tier thresholds: Bronze <100 | Silver 100–499 | Gold 500+
    fn tier_for(points: u32) -> CreditTier {
        if points >= 500 {
            CreditTier::Gold
        } else if points >= 100 {
            CreditTier::Silver
        } else {
            CreditTier::Bronze
        }
    }
}

#[cfg(test)]
mod tests;
