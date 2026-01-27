from __future__ import annotations

import gzip
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _require_bin(name: str) -> str:
    p = shutil.which(name)
    if not p:
        pytest.skip(f"Missing required binary: {name}")
    return p


def _default_admin_db() -> str:
    # 'postgres' is the typical admin db for psql/createdb/dropdb
    return os.environ.get("PGDATABASE", "postgres")


def _base_pg_env() -> dict[str, str]:
    """
    Use PG* vars if present; otherwise rely on local defaults.

    Note: we do not override PGUSER/PGPASSWORD; caller environment controls auth.
    """

    env = os.environ.copy()
    env.setdefault("PGHOST", "localhost")
    env.setdefault("PGPORT", "5432")
    env.setdefault("PGDATABASE", _default_admin_db())
    return env


def _can_connect_psql() -> bool:
    psql = _require_bin("psql")
    env = _base_pg_env()
    try:
        subprocess.run(
            [psql, "-v", "ON_ERROR_STOP=1", "-tAc", "select 1"],
            env=env,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


def _choose_dump_path() -> Path:
    # Prefer explicit env var
    if os.environ.get("HOMIQ_SQL_DUMP"):
        return Path(os.environ["HOMIQ_SQL_DUMP"]).expanduser().resolve()

    # Repo root dump shipped with the project
    p = _repo_root() / "homiq-promienko.sql.gz"
    if p.exists():
        return p

    pytest.skip("No SQL dump found. Set HOMIQ_SQL_DUMP to a .sql or .sql.gz file.")


def _restore_plain_sql_to_db(dbname: str, dump_path: Path, env: dict[str, str]) -> None:
    createdb = _require_bin("createdb")
    dropdb = _require_bin("dropdb")
    psql = _require_bin("psql")

    subprocess.run([dropdb, "--if-exists", dbname], env=env, check=True)
    subprocess.run([createdb, "-E", "UTF8", dbname], env=env, check=True)

    if dump_path.suffix == ".gz":
        with gzip.open(dump_path, "rb") as f:
            subprocess.run(
                [psql, "-v", "ON_ERROR_STOP=1", "-d", dbname],
                env=env,
                check=True,
                stdin=f,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    else:
        subprocess.run(
            [psql, "-v", "ON_ERROR_STOP=1", "-d", dbname, "-f", str(dump_path)],
            env=env,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def _run_extractor(dsn: str, out_dir: Path) -> None:
    extractor = _repo_root() / "Reverse engineering" / "tools" / "homiq_extract_db.py"
    subprocess.run(
        ["python3", str(extractor), "--dsn", dsn, "--out", str(out_dir), "--single-file"],
        check=True,
        stdout=subprocess.DEVNULL,
    )


@pytest.mark.integration
def test_restore_and_extract_real_db() -> None:
    # Skip if no server/auth available
    if not _can_connect_psql():
        pytest.skip("Cannot connect to Postgres via psql (check PG* env / auth / server).")

    env = _base_pg_env()
    dump_path = _choose_dump_path()

    # Isolate by unique db name
    dbname = f"homiq_test_{os.getpid()}"
    try:
        _restore_plain_sql_to_db(dbname, dump_path, env)

        # Build DSN for extractor (prefer env vars for auth)
        host = env.get("PGHOST", "localhost")
        port = env.get("PGPORT", "5432")
        user = os.environ.get("PGUSER")
        password = os.environ.get("PGPASSWORD")

        dsn = f"host={host} port={port} dbname={dbname}"
        if user:
            dsn += f" user={user}"
        if password:
            dsn += f" password={password}"

        with tempfile.TemporaryDirectory(prefix="homiq-export-") as tmp:
            out_dir = Path(tmp)
            _run_extractor(dsn, out_dir)

            assert (out_dir / "meta.json").exists()
            assert (out_dir / "entities.json").exists()
            assert (out_dir / "tables" / "modules.json").exists()
            assert (out_dir / "tables" / "inputs.json").exists()
            assert (out_dir / "tables" / "outputs.json").exists()
            assert (out_dir / "export.json").exists()
    finally:
        dropdb = shutil.which("dropdb")
        if dropdb:
            subprocess.run([dropdb, "--if-exists", dbname], env=env, check=False)

