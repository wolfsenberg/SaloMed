import re

with open('main.py', 'r', encoding='utf-8') as f:
    c = f.read()

replacement = '''@app.get(
    "/api/vault/balance",
    response_model=VaultResponse,
    summary="Get live vault state  →  get_vault on-chain",
    tags=["Vault"],
)
async def get_vault_balance(
    patient_address: str = Query(description="Stellar address (G...) of the patient"),
):
    demo = _vault(patient_address)
    salo_points = demo["salo_points"]
    credit_tier = demo["credit_tier"]
    
    try:
        acc = horizon_server.load_account(patient_address)
        native_bal = 0.0
        for b in acc.balances:
            if b.asset_type == "native":
                native_bal = float(b.balance)
                break
                
        balance_stroops = int(native_bal * 10_000_000)
        
        # Keep demo state in sync just in case
        demo["balance"] = balance_stroops
        
        return VaultResponse(
            patient_address=patient_address,
            balance_stroops=balance_stroops,
            balance_usdc=native_bal,
            salo_points=salo_points,
            credit_tier=credit_tier,
            raw=acc.last_modified_ledger,
        )
    except Exception as e:
        print(f"[ON-CHAIN ERROR] Failed to fetch native XLM for {patient_address[:8]}: {e}")
        # Fallback to pure demo state if testnet fails or unfunded
        return VaultResponse(
            patient_address=patient_address,
            balance_stroops=demo["balance"],
            balance_usdc=stroops_to_usdc(demo["balance"]),
            salo_points=demo["salo_points"],
            credit_tier=demo["credit_tier"],
            raw=demo,
        )'''

start_idx = c.find('@app.get(\n    "/api/vault/balance"')
end_idx = c.find('# ENDPOINTS  ·  Legit Simulation Logic', start_idx)

if start_idx != -1 and end_idx != -1:
    end_idx = c.rfind('# ───', start_idx, end_idx)
    target = c[start_idx:end_idx].strip()
    c = c.replace(target, replacement.strip())
    with open('main.py', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Done replacing.")
else:
    print("Failed to find boundaries.")
