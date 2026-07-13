from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from enum import Enum
from pathlib import Path
from typing import Any

from stellar_sdk import StrKey


STROOPS_PER_ASSET = 10_000_000
ASSET_QUANTUM = Decimal("0.0000001")
PHP_QUANTUM = Decimal("0.01")

# Whitelisted demo provider directory. provider_id is a real, checksum-valid
# Stellar address so the same directory works when switched to stellar_testnet.
# These IDs must stay in sync with frontend/lib/whitelist.ts.
SEED_PROVIDERS = [
    ("GDGXGJTIGCXMQTAG362YFKCBZ4FARG33SDOKCZ4DOTFP4J63EPCYMRKH", "Philippine General Hospital", "hospital"),
    ("GB5B7D54X2YWGSNO325RBP32ZIMNGLLIIXBHSRU5TJFPY4E6XLAGVV74", "Philippine Heart Center", "hospital"),
    ("GCTFXRJOGAKUZH5OKQTG77BDFHWD5CZ4YXKVJJR3SP3AIYPPBVKEIWK7", "St. Luke's Medical Center", "hospital"),
    ("GDCYII5WNUNHGKW2XPLSC2YITBYLGUW3Y3IONY2PDJ43FYUZKCEBJQVY", "Makati Medical Center", "hospital"),
    ("GA3O3Q3J2KECID3WI4EUCNH52PQ722YHA3NQGEHCUIBZIFGFHOHQOUAV", "The Medical City", "hospital"),
    ("GCUFGMEDXSPW3JBE6K4RNG56NPY5GYDMDQTJWPHDIGBA7RTPYGY5K4RT", "Southern Philippines Medical Center", "hospital"),
    ("GDSXB4TOKTSMTYJUZT5V5FSQCTL5VKCL5BM6FGZSSIPPQB6GAOZCE6ZK", "Vicente Sotto Memorial Medical Center", "hospital"),
    ("GAE362LWPPTAVWORRFKLMI23YP74AOVVRX3TVL3Y2PQIOKJMCOD2K2ML", "Baguio General Hospital", "hospital"),
    ("GDETADKFTAUVSS2WWNP4E53BPKFDYHARX3QZAVWVWBJ4NA73DKMXCJIK", "Mercury Drug", "pharmacy"),
    ("GB7MEBYH3DEKHKJGS6Z6WTL45MQEWRVY7T4KFQ4DSVVDMJGGMRFVQW4O", "Watsons Pharmacy", "pharmacy"),
    ("GB2H7FK4MSCYGURLHX3NZJ7DZPXGOYIMMS5QNEXTSNFM7WDWQTXV3ATF", "Southstar Drug", "pharmacy"),
    ("GBEX57NASAYLM6WPKFRIHJGRMEXEFJGYZHCMBGTOX4U27YMR46D2XBLT", "Rose Pharmacy", "pharmacy"),
    ("GCNHM5HIA2VGHKOOXR6UWFZAZYWZUDG7RW63P6CXLQAJYQ53WEKKAVTE", "The Generics Pharmacy", "pharmacy"),
    ("GD3WALJF5DL36KPI6MDM2PBIOBYDLK32CJLV6RDAHO5BQRUEFRGZRAYU", "Generika Drugstore", "pharmacy"),
]


class RuntimeMode(str, Enum):
    DEMO = "demo"
    STELLAR_TESTNET = "stellar_testnet"
    PDAX_UAT = "pdax_uat"
    PDAX_PROD = "pdax_prod"


@dataclass(frozen=True)
class RuntimeSettings:
    mode: RuntimeMode
    asset_code: str
    contract_id: str
    network: str
    expected_token_id: str
    admin_address: str
    php_per_asset: str
    admin_api_key: str
    database_path: str
    database_url: str

    @property
    def php_per_asset_decimal(self) -> Decimal:
        value = Decimal(self.php_per_asset)
        if value <= 0:
            raise ValueError("PHP_PER_ASSET must be positive")
        return value.quantize(PHP_QUANTUM)

    @classmethod
    def from_env(cls) -> "RuntimeSettings":
        raw_mode = os.getenv("SALOMED_MODE", "demo").strip().lower()
        try:
            mode = RuntimeMode(raw_mode)
        except ValueError as exc:
            allowed = ", ".join(item.value for item in RuntimeMode)
            raise RuntimeError(f"Invalid SALOMED_MODE={raw_mode!r}; expected one of: {allowed}") from exc

        asset_code = os.getenv("SALOMED_ASSET_CODE", "XLM").strip().upper()
        if asset_code not in ("XLM", "USDC"):
            raise RuntimeError("SaloMed supports XLM (native) or USDC as the vault asset")

        settings = cls(
            mode=mode,
            asset_code=asset_code,
            contract_id=os.getenv(
                "CONTRACT_ID", "CA6X5ZJ24LBJBCRHSAJK5EXB7CMEED2X2JTDLTPBOZC3SM4ABZYNIRCG"
            ).strip().upper(),
            network=os.getenv("STELLAR_NETWORK", "testnet").strip().lower(),
            expected_token_id=os.getenv("SALOMED_EXPECTED_TOKEN_ID", "").strip().upper(),
            admin_address=os.getenv("ADMIN_ADDRESS", "").strip().upper(),
            php_per_asset=os.getenv("PHP_PER_USDC", "56.00").strip(),
            admin_api_key=os.getenv("SALOMED_ADMIN_API_KEY", "").strip(),
            database_path=os.getenv(
                "SALOMED_DB_PATH",
                str(Path(__file__).resolve().parent / "data" / "salomed.sqlite3"),
            ),
            database_url=os.getenv("DATABASE_URL", "").strip(),
        )
        settings.php_per_asset_decimal

        if mode is not RuntimeMode.DEMO:
            expected_network = "mainnet" if mode is RuntimeMode.PDAX_PROD else "testnet"
            if settings.network != expected_network:
                raise RuntimeError(f"{mode.value} requires STELLAR_NETWORK={expected_network}")
            try:
                StrKey.decode_contract(settings.contract_id)
            except Exception as exc:
                raise RuntimeError(f"{mode.value} requires a valid CONTRACT_ID") from exc
            try:
                StrKey.decode_contract(settings.expected_token_id)
            except Exception as exc:
                raise RuntimeError(f"{mode.value} requires a valid SALOMED_EXPECTED_TOKEN_ID") from exc
            try:
                StrKey.decode_ed25519_public_key(settings.admin_address)
            except Exception as exc:
                raise RuntimeError(f"{mode.value} requires a valid ADMIN_ADDRESS") from exc
            if os.getenv("SALOMED_CONTRACT_CONFIG_VERIFIED", "").strip().lower() != "true":
                raise RuntimeError(
                    f"{mode.value} is blocked until get_token_id/get_admin are verified against the intended "
                    "USDC SAC and administrator, and SALOMED_CONTRACT_CONFIG_VERIFIED=true is set"
                )

        if mode in {RuntimeMode.PDAX_UAT, RuntimeMode.PDAX_PROD}:
            missing = [
                key
                for key in ("PDAX_USERNAME", "PDAX_PASSWORD", "PDAX_WEBHOOK_SECRET")
                if not _is_real_secret(os.getenv(key, ""))
            ]
            if missing:
                raise RuntimeError(f"{mode.value} requires real values for: {', '.join(missing)}")
            if os.getenv("PDAX_PRIVATE_SPEC_VERIFIED", "").strip().lower() != "true":
                raise RuntimeError(
                    f"{mode.value} is blocked until PDAX_PRIVATE_SPEC_VERIFIED=true confirms "
                    "that the issued private API contract was checked line-by-line"
                )

        if mode is RuntimeMode.PDAX_PROD and os.getenv("PDAX_PRODUCTION_APPROVED", "").lower() != "true":
            raise RuntimeError("pdax_prod is blocked until PDAX_PRODUCTION_APPROVED=true is explicitly set")

        return settings


def _is_real_secret(value: str) -> bool:
    lowered = value.strip().lower()
    return bool(lowered) and not any(
        marker in lowered
        for marker in ("placeholder", "replace", "redacted", "example", "your_")
    )


def validate_stellar_address(address: str) -> str:
    normalized = address.strip().upper()
    try:
        StrKey.decode_ed25519_public_key(normalized)
    except Exception as exc:
        raise LedgerError("INVALID_STELLAR_ADDRESS", "Invalid Stellar public address", 422) from exc
    return normalized


def asset_to_stroops(value: str | Decimal) -> int:
    try:
        decimal = Decimal(str(value)).quantize(ASSET_QUANTUM, rounding=ROUND_DOWN)
    except (InvalidOperation, ValueError) as exc:
        raise LedgerError("INVALID_AMOUNT", "Invalid asset amount", 422) from exc
    if decimal <= 0:
        raise LedgerError("INVALID_AMOUNT", "Amount must be positive", 422)
    return int(decimal * STROOPS_PER_ASSET)


def stroops_to_asset(stroops: int) -> str:
    return f"{Decimal(stroops) / STROOPS_PER_ASSET:.7f}"


def php_to_centavos(value: str | Decimal) -> int:
    try:
        decimal = Decimal(str(value)).quantize(PHP_QUANTUM, rounding=ROUND_DOWN)
    except (InvalidOperation, ValueError) as exc:
        raise LedgerError("INVALID_AMOUNT", "Invalid PHP amount", 422) from exc
    if decimal <= 0:
        raise LedgerError("INVALID_AMOUNT", "Amount must be positive", 422)
    return int(decimal * 100)


class LedgerError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class DemoLedger:
    """Durable single-source ledger for explicitly simulated SaloMed flows."""

    def __init__(self, database_path: str, php_per_asset: Decimal) -> None:
        self.database_path = database_path
        self.php_per_asset = php_per_asset
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS vaults (
                    address TEXT PRIMARY KEY,
                    balance_stroops INTEGER NOT NULL DEFAULT 0 CHECK(balance_stroops >= 0),
                    salo_points INTEGER NOT NULL DEFAULT 0 CHECK(salo_points >= 0),
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS providers (
                    provider_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    provider_type TEXT NOT NULL CHECK(provider_type IN ('hospital', 'pharmacy')),
                    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1))
                );

                CREATE TABLE IF NOT EXISTS transactions (
                    transaction_id TEXT PRIMARY KEY,
                    operation_id TEXT NOT NULL,
                    address TEXT NOT NULL,
                    type TEXT NOT NULL,
                    direction TEXT NOT NULL,
                    amount_stroops INTEGER NOT NULL,
                    amount_php_centavos INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    counterparty TEXT,
                    provider_id TEXT,
                    points_delta INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    source TEXT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_transactions_address_created
                ON transactions(address, created_at DESC);

                CREATE TABLE IF NOT EXISTS operations (
                    idempotency_key TEXT PRIMARY KEY,
                    operation_type TEXT NOT NULL,
                    request_fingerprint TEXT NOT NULL,
                    response_json TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );
                """
            )
            connection.executemany(
                """
                INSERT INTO providers(provider_id, name, provider_type, active)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(provider_id) DO UPDATE SET
                    name=excluded.name,
                    provider_type=excluded.provider_type
                """,
                SEED_PROVIDERS,
            )
            # Idempotent migration: add the additive `source` column to
            # already-existing local databases created before it was introduced.
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(transactions)").fetchall()
            }
            if "source" not in columns:
                connection.execute("ALTER TABLE transactions ADD COLUMN source TEXT")

    @staticmethod
    def _fingerprint(payload: dict[str, Any]) -> str:
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))

    @staticmethod
    def _tier(points: int) -> str:
        if points >= 500:
            return "Gold"
        if points >= 100:
            return "Silver"
        return "Bronze"

    @staticmethod
    def _ensure_vault(connection: sqlite3.Connection, address: str) -> None:
        connection.execute(
            "INSERT OR IGNORE INTO vaults(address, updated_at) VALUES (?, ?)",
            (address, int(time.time())),
        )

    def _replay(
        self,
        connection: sqlite3.Connection,
        idempotency_key: str,
        operation_type: str,
        fingerprint: str,
    ) -> dict[str, Any] | None:
        row = connection.execute(
            "SELECT operation_type, request_fingerprint, response_json FROM operations WHERE idempotency_key=?",
            (idempotency_key,),
        ).fetchone()
        if row is None:
            return None
        if row["operation_type"] != operation_type or row["request_fingerprint"] != fingerprint:
            raise LedgerError(
                "IDEMPOTENCY_CONFLICT",
                "Idempotency key was already used for a different request",
                409,
            )
        response = json.loads(row["response_json"])
        response["replayed"] = True
        return response

    @staticmethod
    def _store_operation(
        connection: sqlite3.Connection,
        idempotency_key: str,
        operation_type: str,
        fingerprint: str,
        response: dict[str, Any],
    ) -> None:
        connection.execute(
            """
            INSERT INTO operations(idempotency_key, operation_type, request_fingerprint, response_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                idempotency_key,
                operation_type,
                fingerprint,
                json.dumps(response, sort_keys=True),
                int(time.time()),
            ),
        )

    def get_vault(self, address: str) -> dict[str, Any]:
        address = validate_stellar_address(address)
        with self._connect() as connection:
            self._ensure_vault(connection, address)
            row = connection.execute(
                "SELECT balance_stroops, salo_points FROM vaults WHERE address=?",
                (address,),
            ).fetchone()
        points = int(row["salo_points"])
        balance = int(row["balance_stroops"])
        return {
            "address": address,
            "balance_stroops": balance,
            "balance_asset": stroops_to_asset(balance),
            "asset_code": "USDC",
            "salo_points": points,
            "credit_tier": self._tier(points),
            "source": "demo_ledger",
            "simulated": True,
        }

    def list_providers(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT provider_id, name, provider_type FROM providers WHERE active=1 ORDER BY name"
            ).fetchall()
        return [dict(row) for row in rows]

    def topup(
        self,
        beneficiary_address: str,
        amount_php: str | Decimal,
        idempotency_key: str,
        source: str | None = None,
    ) -> dict[str, Any]:
        beneficiary = validate_stellar_address(beneficiary_address)
        centavos = php_to_centavos(amount_php)
        php = Decimal(centavos) / 100
        stroops = asset_to_stroops(php / self.php_per_asset)
        payload = {"beneficiary": beneficiary, "amount_php_centavos": centavos}
        fingerprint = self._fingerprint(payload)

        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            replay = self._replay(connection, idempotency_key, "topup", fingerprint)
            if replay:
                connection.commit()
                return replay
            self._ensure_vault(connection, beneficiary)
            now = int(time.time())
            transaction_id = f"DEMO-{uuid.uuid4().hex.upper()}"
            connection.execute(
                "UPDATE vaults SET balance_stroops=balance_stroops+?, updated_at=? WHERE address=?",
                (stroops, now, beneficiary),
            )
            connection.execute(
                """
                INSERT INTO transactions
                    (transaction_id, operation_id, address, type, direction,
                     amount_stroops, amount_php_centavos, status, counterparty,
                     provider_id, points_delta, created_at, source)
                VALUES (?, ?, ?, 'topup', 'received', ?, ?, 'success', NULL, NULL, 0, ?, ?)
                """,
                (transaction_id, idempotency_key, beneficiary, stroops, centavos, now, source),
            )
            response = {
                "success": True,
                "mode": "demo",
                "simulated": True,
                "transaction_id": transaction_id,
                "status": "completed",
                "beneficiary_address": beneficiary,
                "amount_php": f"{php:.2f}",
                "amount_asset": stroops_to_asset(stroops),
                "asset_code": "USDC",
                "replayed": False,
            }
            self._store_operation(connection, idempotency_key, "topup", fingerprint, response)
            connection.commit()
            return response

    def payment(
        self,
        patient_address: str,
        provider_id: str,
        amount_asset: str | Decimal,
        idempotency_key: str,
    ) -> dict[str, Any]:
        patient = validate_stellar_address(patient_address)
        stroops = asset_to_stroops(amount_asset)
        payload = {"patient": patient, "provider_id": provider_id, "amount_stroops": stroops}
        fingerprint = self._fingerprint(payload)

        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            replay = self._replay(connection, idempotency_key, "payment", fingerprint)
            if replay:
                connection.commit()
                return replay
            provider = connection.execute(
                "SELECT name, provider_type FROM providers WHERE provider_id=? AND active=1",
                (provider_id,),
            ).fetchone()
            if provider is None:
                raise LedgerError("PROVIDER_NOT_WHITELISTED", "Provider is not whitelisted", 403)
            self._ensure_vault(connection, patient)
            vault = connection.execute(
                "SELECT balance_stroops, salo_points FROM vaults WHERE address=?",
                (patient,),
            ).fetchone()
            if int(vault["balance_stroops"]) < stroops:
                raise LedgerError("INSUFFICIENT_VAULT_BALANCE", "Insufficient vault balance", 409)

            points = stroops // STROOPS_PER_ASSET
            now = int(time.time())
            transaction_id = f"DEMO-{uuid.uuid4().hex.upper()}"
            centavos = int(
                (Decimal(stroops) / STROOPS_PER_ASSET * self.php_per_asset * 100).quantize(
                    Decimal("1"), rounding=ROUND_DOWN
                )
            )
            connection.execute(
                """
                UPDATE vaults
                SET balance_stroops=balance_stroops-?, salo_points=salo_points+?, updated_at=?
                WHERE address=?
                """,
                (stroops, points, now, patient),
            )
            connection.execute(
                """
                INSERT INTO transactions
                    (transaction_id, operation_id, address, type, direction,
                     amount_stroops, amount_php_centavos, status, counterparty,
                     provider_id, points_delta, created_at, source)
                VALUES (?, ?, ?, 'payment', 'sent', ?, ?, 'success', ?, ?, ?, ?, NULL)
                """,
                (
                    transaction_id,
                    idempotency_key,
                    patient,
                    stroops,
                    centavos,
                    provider["name"],
                    provider_id,
                    points,
                    now,
                ),
            )
            response = {
                "success": True,
                "mode": "demo",
                "simulated": True,
                "transaction_id": transaction_id,
                "status": "completed",
                "patient_address": patient,
                "provider_id": provider_id,
                "provider_name": provider["name"],
                "provider_type": provider["provider_type"],
                "amount_asset": stroops_to_asset(stroops),
                "asset_code": "USDC",
                "points_earned": points,
                "replayed": False,
            }
            self._store_operation(connection, idempotency_key, "payment", fingerprint, response)
            connection.commit()
            return response

    def remittance(
        self,
        sender_address: str,
        beneficiary_address: str,
        amount_asset: str | Decimal,
        idempotency_key: str,
    ) -> dict[str, Any]:
        sender = validate_stellar_address(sender_address)
        beneficiary = validate_stellar_address(beneficiary_address)
        if sender == beneficiary:
            raise LedgerError("SAME_VAULT", "Sender and beneficiary must be different", 422)
        stroops = asset_to_stroops(amount_asset)
        payload = {"sender": sender, "beneficiary": beneficiary, "amount_stroops": stroops}
        fingerprint = self._fingerprint(payload)

        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            replay = self._replay(connection, idempotency_key, "remittance", fingerprint)
            if replay:
                connection.commit()
                return replay
            self._ensure_vault(connection, sender)
            self._ensure_vault(connection, beneficiary)
            balance = connection.execute(
                "SELECT balance_stroops FROM vaults WHERE address=?",
                (sender,),
            ).fetchone()["balance_stroops"]
            if int(balance) < stroops:
                raise LedgerError("INSUFFICIENT_VAULT_BALANCE", "Insufficient vault balance", 409)

            now = int(time.time())
            operation_id = f"DEMO-{uuid.uuid4().hex.upper()}"
            sent_id = f"{operation_id}-S"
            received_id = f"{operation_id}-R"
            centavos = int(
                (Decimal(stroops) / STROOPS_PER_ASSET * self.php_per_asset * 100).quantize(
                    Decimal("1"), rounding=ROUND_DOWN
                )
            )
            connection.execute(
                "UPDATE vaults SET balance_stroops=balance_stroops-?, updated_at=? WHERE address=?",
                (stroops, now, sender),
            )
            connection.execute(
                "UPDATE vaults SET balance_stroops=balance_stroops+?, updated_at=? WHERE address=?",
                (stroops, now, beneficiary),
            )
            connection.executemany(
                """
                INSERT INTO transactions
                    (transaction_id, operation_id, address, type, direction,
                     amount_stroops, amount_php_centavos, status, counterparty,
                     provider_id, points_delta, created_at, source)
                VALUES (?, ?, ?, 'padala', ?, ?, ?, 'success', ?, NULL, 0, ?, NULL)
                """,
                [
                    (sent_id, operation_id, sender, "sent", stroops, centavos, beneficiary, now),
                    (received_id, operation_id, beneficiary, "received", stroops, centavos, sender, now),
                ],
            )
            response = {
                "success": True,
                "mode": "demo",
                "simulated": True,
                "transaction_id": operation_id,
                "status": "completed",
                "sender_address": sender,
                "beneficiary_address": beneficiary,
                "amount_asset": stroops_to_asset(stroops),
                "asset_code": "USDC",
                "replayed": False,
            }
            self._store_operation(connection, idempotency_key, "remittance", fingerprint, response)
            connection.commit()
            return response

    def history(self, address: str, limit: int = 50) -> list[dict[str, Any]]:
        address = validate_stellar_address(address)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT transaction_id, type, direction, amount_stroops, amount_php_centavos,
                       status, counterparty, provider_id, points_delta, created_at, source
                FROM transactions
                WHERE address=?
                ORDER BY created_at DESC, transaction_id DESC
                LIMIT ?
                """,
                (address, max(1, min(limit, 100))),
            ).fetchall()
        return [
            {
                "transaction_id": row["transaction_id"],
                "type": row["type"],
                "direction": row["direction"],
                "amount_asset": stroops_to_asset(int(row["amount_stroops"])),
                "asset_code": "USDC",
                "amount_php": f"{Decimal(row['amount_php_centavos']) / 100:.2f}",
                "status": row["status"],
                "counterparty": row["counterparty"],
                "provider_id": row["provider_id"],
                "points_delta": int(row["points_delta"]),
                "created_at": int(row["created_at"]),
                "source": row["source"],
                "simulated": True,
            }
            for row in rows
        ]


class PostgresLedger:
    """
    Persistent demo ledger backed by managed PostgreSQL.

    Mirrors DemoLedger's public interface exactly (get_vault, list_providers,
    topup, payment, remittance, history) and returns identical response shapes,
    so the runtime router does not need to know which backend is active.

    Used in deployed environments (e.g. Render) where the container filesystem
    is ephemeral and SQLite would reset on every spin-down or redeploy.
    """

    def __init__(self, database_url: str, php_per_asset: Decimal) -> None:
        import psycopg  # imported lazily so local SQLite runs need no driver

        self._psycopg = psycopg
        # Render exposes the URL as postgres://; psycopg wants postgresql://
        if database_url.startswith("postgres://"):
            database_url = "postgresql://" + database_url[len("postgres://"):]
        self.database_url = database_url
        self.php_per_asset = php_per_asset
        self._initialize()

    def _connect(self):
        return self._psycopg.connect(self.database_url, autocommit=False)

    def _initialize(self) -> None:
        with self._connect() as connection:
            with connection.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS vaults (
                        address TEXT PRIMARY KEY,
                        balance_stroops BIGINT NOT NULL DEFAULT 0 CHECK(balance_stroops >= 0),
                        salo_points BIGINT NOT NULL DEFAULT 0 CHECK(salo_points >= 0),
                        updated_at BIGINT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS providers (
                        provider_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        provider_type TEXT NOT NULL CHECK(provider_type IN ('hospital', 'pharmacy')),
                        active SMALLINT NOT NULL DEFAULT 1 CHECK(active IN (0, 1))
                    );
                    CREATE TABLE IF NOT EXISTS transactions (
                        transaction_id TEXT PRIMARY KEY,
                        operation_id TEXT NOT NULL,
                        address TEXT NOT NULL,
                        type TEXT NOT NULL,
                        direction TEXT NOT NULL,
                        amount_stroops BIGINT NOT NULL,
                        amount_php_centavos BIGINT NOT NULL,
                        status TEXT NOT NULL,
                        counterparty TEXT,
                        provider_id TEXT,
                        points_delta BIGINT NOT NULL DEFAULT 0,
                        created_at BIGINT NOT NULL,
                        source TEXT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_transactions_address_created
                    ON transactions(address, created_at DESC);
                    CREATE TABLE IF NOT EXISTS operations (
                        idempotency_key TEXT PRIMARY KEY,
                        operation_type TEXT NOT NULL,
                        request_fingerprint TEXT NOT NULL,
                        response_json TEXT NOT NULL,
                        created_at BIGINT NOT NULL
                    );
                    """
                )
                # Idempotent migration: add the additive `source` column to
                # already-deployed tables created before it was introduced.
                cur.execute(
                    "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source TEXT"
                )
                cur.executemany(
                    """
                    INSERT INTO providers(provider_id, name, provider_type, active)
                    VALUES (%s, %s, %s, 1)
                    ON CONFLICT(provider_id) DO UPDATE SET
                        name=EXCLUDED.name,
                        provider_type=EXCLUDED.provider_type
                    """,
                    SEED_PROVIDERS,
                )
            connection.commit()

    @staticmethod
    def _fingerprint(payload: dict[str, Any]) -> str:
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))

    @staticmethod
    def _tier(points: int) -> str:
        if points >= 500:
            return "Gold"
        if points >= 100:
            return "Silver"
        return "Bronze"

    @staticmethod
    def _ensure_vault(cur, address: str) -> None:
        cur.execute(
            "INSERT INTO vaults(address, updated_at) VALUES (%s, %s) ON CONFLICT(address) DO NOTHING",
            (address, int(time.time())),
        )

    def _replay(self, cur, idempotency_key, operation_type, fingerprint):
        cur.execute(
            "SELECT operation_type, request_fingerprint, response_json FROM operations WHERE idempotency_key=%s",
            (idempotency_key,),
        )
        row = cur.fetchone()
        if row is None:
            return None
        if row[0] != operation_type or row[1] != fingerprint:
            raise LedgerError(
                "IDEMPOTENCY_CONFLICT",
                "Idempotency key was already used for a different request",
                409,
            )
        response = json.loads(row[2])
        response["replayed"] = True
        return response

    @staticmethod
    def _store_operation(cur, idempotency_key, operation_type, fingerprint, response) -> None:
        cur.execute(
            """
            INSERT INTO operations(idempotency_key, operation_type, request_fingerprint, response_json, created_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (idempotency_key, operation_type, fingerprint, json.dumps(response, sort_keys=True), int(time.time())),
        )

    def get_vault(self, address: str) -> dict[str, Any]:
        address = validate_stellar_address(address)
        with self._connect() as connection:
            with connection.cursor() as cur:
                self._ensure_vault(cur, address)
                cur.execute(
                    "SELECT balance_stroops, salo_points FROM vaults WHERE address=%s",
                    (address,),
                )
                row = cur.fetchone()
            connection.commit()
        balance = int(row[0])
        points = int(row[1])
        return {
            "address": address,
            "balance_stroops": balance,
            "balance_asset": stroops_to_asset(balance),
            "asset_code": "USDC",
            "salo_points": points,
            "credit_tier": self._tier(points),
            "source": "postgres_ledger",
            "simulated": True,
        }

    def list_providers(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            with connection.cursor() as cur:
                cur.execute(
                    "SELECT provider_id, name, provider_type FROM providers WHERE active=1 ORDER BY name"
                )
                rows = cur.fetchall()
            connection.commit()
        return [
            {"provider_id": r[0], "name": r[1], "provider_type": r[2]}
            for r in rows
        ]

    def topup(self, beneficiary_address: str, amount_php, idempotency_key: str, source: str | None = None) -> dict[str, Any]:
        beneficiary = validate_stellar_address(beneficiary_address)
        centavos = php_to_centavos(amount_php)
        php = Decimal(centavos) / 100
        stroops = asset_to_stroops(php / self.php_per_asset)
        fingerprint = self._fingerprint({"beneficiary": beneficiary, "amount_php_centavos": centavos})

        with self._connect() as connection:
            with connection.cursor() as cur:
                replay = self._replay(cur, idempotency_key, "topup", fingerprint)
                if replay:
                    connection.commit()
                    return replay
                self._ensure_vault(cur, beneficiary)
                now = int(time.time())
                transaction_id = f"DEMO-{uuid.uuid4().hex.upper()}"
                cur.execute(
                    "UPDATE vaults SET balance_stroops=balance_stroops+%s, updated_at=%s WHERE address=%s",
                    (stroops, now, beneficiary),
                )
                cur.execute(
                    """
                    INSERT INTO transactions
                        (transaction_id, operation_id, address, type, direction,
                         amount_stroops, amount_php_centavos, status, counterparty,
                         provider_id, points_delta, created_at, source)
                    VALUES (%s, %s, %s, 'topup', 'received', %s, %s, 'success', NULL, NULL, 0, %s, %s)
                    """,
                    (transaction_id, idempotency_key, beneficiary, stroops, centavos, now, source),
                )
                response = {
                    "success": True,
                    "mode": "demo",
                    "simulated": True,
                    "transaction_id": transaction_id,
                    "status": "completed",
                    "beneficiary_address": beneficiary,
                    "amount_php": f"{php:.2f}",
                    "amount_asset": stroops_to_asset(stroops),
                    "asset_code": "USDC",
                    "replayed": False,
                }
                self._store_operation(cur, idempotency_key, "topup", fingerprint, response)
            connection.commit()
            return response

    def payment(self, patient_address: str, provider_id: str, amount_asset, idempotency_key: str) -> dict[str, Any]:
        patient = validate_stellar_address(patient_address)
        stroops = asset_to_stroops(amount_asset)
        fingerprint = self._fingerprint({"patient": patient, "provider_id": provider_id, "amount_stroops": stroops})

        with self._connect() as connection:
            with connection.cursor() as cur:
                replay = self._replay(cur, idempotency_key, "payment", fingerprint)
                if replay:
                    connection.commit()
                    return replay
                cur.execute(
                    "SELECT name, provider_type FROM providers WHERE provider_id=%s AND active=1",
                    (provider_id,),
                )
                provider = cur.fetchone()
                if provider is None:
                    raise LedgerError("PROVIDER_NOT_WHITELISTED", "Provider is not whitelisted", 403)
                self._ensure_vault(cur, patient)
                cur.execute("SELECT balance_stroops FROM vaults WHERE address=%s FOR UPDATE", (patient,))
                balance = int(cur.fetchone()[0])
                if balance < stroops:
                    raise LedgerError("INSUFFICIENT_VAULT_BALANCE", "Insufficient vault balance", 409)
                points = stroops // STROOPS_PER_ASSET
                now = int(time.time())
                transaction_id = f"DEMO-{uuid.uuid4().hex.upper()}"
                centavos = int(
                    (Decimal(stroops) / STROOPS_PER_ASSET * self.php_per_asset * 100).quantize(
                        Decimal("1"), rounding=ROUND_DOWN
                    )
                )
                cur.execute(
                    "UPDATE vaults SET balance_stroops=balance_stroops-%s, salo_points=salo_points+%s, updated_at=%s WHERE address=%s",
                    (stroops, points, now, patient),
                )
                cur.execute(
                    """
                    INSERT INTO transactions
                        (transaction_id, operation_id, address, type, direction,
                         amount_stroops, amount_php_centavos, status, counterparty,
                         provider_id, points_delta, created_at, source)
                    VALUES (%s, %s, %s, 'payment', 'sent', %s, %s, 'success', %s, %s, %s, %s, NULL)
                    """,
                    (transaction_id, idempotency_key, patient, stroops, centavos, provider[0], provider_id, points, now),
                )
                response = {
                    "success": True,
                    "mode": "demo",
                    "simulated": True,
                    "transaction_id": transaction_id,
                    "status": "completed",
                    "patient_address": patient,
                    "provider_id": provider_id,
                    "provider_name": provider[0],
                    "provider_type": provider[1],
                    "amount_asset": stroops_to_asset(stroops),
                    "asset_code": "USDC",
                    "points_earned": points,
                    "replayed": False,
                }
                self._store_operation(cur, idempotency_key, "payment", fingerprint, response)
            connection.commit()
            return response

    def remittance(self, sender_address: str, beneficiary_address: str, amount_asset, idempotency_key: str) -> dict[str, Any]:
        sender = validate_stellar_address(sender_address)
        beneficiary = validate_stellar_address(beneficiary_address)
        if sender == beneficiary:
            raise LedgerError("SAME_VAULT", "Sender and beneficiary must be different", 422)
        stroops = asset_to_stroops(amount_asset)
        fingerprint = self._fingerprint({"sender": sender, "beneficiary": beneficiary, "amount_stroops": stroops})

        with self._connect() as connection:
            with connection.cursor() as cur:
                replay = self._replay(cur, idempotency_key, "remittance", fingerprint)
                if replay:
                    connection.commit()
                    return replay
                self._ensure_vault(cur, sender)
                self._ensure_vault(cur, beneficiary)
                cur.execute("SELECT balance_stroops FROM vaults WHERE address=%s FOR UPDATE", (sender,))
                balance = int(cur.fetchone()[0])
                if balance < stroops:
                    raise LedgerError("INSUFFICIENT_VAULT_BALANCE", "Insufficient vault balance", 409)
                now = int(time.time())
                operation_id = f"DEMO-{uuid.uuid4().hex.upper()}"
                centavos = int(
                    (Decimal(stroops) / STROOPS_PER_ASSET * self.php_per_asset * 100).quantize(
                        Decimal("1"), rounding=ROUND_DOWN
                    )
                )
                cur.execute(
                    "UPDATE vaults SET balance_stroops=balance_stroops-%s, updated_at=%s WHERE address=%s",
                    (stroops, now, sender),
                )
                cur.execute(
                    "UPDATE vaults SET balance_stroops=balance_stroops+%s, updated_at=%s WHERE address=%s",
                    (stroops, now, beneficiary),
                )
                cur.executemany(
                    """
                    INSERT INTO transactions
                        (transaction_id, operation_id, address, type, direction,
                         amount_stroops, amount_php_centavos, status, counterparty,
                         provider_id, points_delta, created_at, source)
                    VALUES (%s, %s, %s, 'padala', %s, %s, %s, 'success', %s, NULL, 0, %s, NULL)
                    """,
                    [
                        (f"{operation_id}-S", operation_id, sender, "sent", stroops, centavos, beneficiary, now),
                        (f"{operation_id}-R", operation_id, beneficiary, "received", stroops, centavos, sender, now),
                    ],
                )
                response = {
                    "success": True,
                    "mode": "demo",
                    "simulated": True,
                    "transaction_id": operation_id,
                    "status": "completed",
                    "sender_address": sender,
                    "beneficiary_address": beneficiary,
                    "amount_asset": stroops_to_asset(stroops),
                    "asset_code": "USDC",
                    "replayed": False,
                }
                self._store_operation(cur, idempotency_key, "remittance", fingerprint, response)
            connection.commit()
            return response

    def history(self, address: str, limit: int = 50) -> list[dict[str, Any]]:
        address = validate_stellar_address(address)
        with self._connect() as connection:
            with connection.cursor() as cur:
                cur.execute(
                    """
                    SELECT transaction_id, type, direction, amount_stroops, amount_php_centavos,
                           status, counterparty, provider_id, points_delta, created_at, source
                    FROM transactions
                    WHERE address=%s
                    ORDER BY created_at DESC, transaction_id DESC
                    LIMIT %s
                    """,
                    (address, max(1, min(limit, 100))),
                )
                rows = cur.fetchall()
            connection.commit()
        return [
            {
                "transaction_id": r[0],
                "type": r[1],
                "direction": r[2],
                "amount_asset": stroops_to_asset(int(r[3])),
                "asset_code": "USDC",
                "amount_php": f"{Decimal(r[4]) / 100:.2f}",
                "status": r[5],
                "counterparty": r[6],
                "provider_id": r[7],
                "points_delta": int(r[8]),
                "created_at": int(r[9]),
                "source": r[10],
                "simulated": True,
            }
            for r in rows
        ]


def create_demo_ledger(settings: "RuntimeSettings") -> "DemoLedger | PostgresLedger":
    """
    Select the persistence backend for the demo ledger:
    - PostgresLedger when DATABASE_URL is set (deployed / production).
    - DemoLedger (SQLite) otherwise (local development).
    Both expose the same interface.
    """
    if settings.database_url:
        return PostgresLedger(settings.database_url, settings.php_per_asset_decimal)
    return DemoLedger(settings.database_path, settings.php_per_asset_decimal)
