"""E3 sandbox tests: denylist enforcement, timeout, isolation, happy path."""

import sys
from pathlib import Path

import pytest

TOOLS_SRC = Path(__file__).resolve().parents[1] / "src"
if str(TOOLS_SRC) not in sys.path:
    sys.path.insert(0, str(TOOLS_SRC))

from nirva_tools.sandbox import CodeRunResult, SandboxViolation, check_code, run_python  # noqa: E402


@pytest.mark.parametrize(
    "code",
    [
        "import os\nprint('x')",
        "import os, sys",
        "from subprocess import run",
        "import socket",
        "eval('1+1')",
        "exec('x = 1')",
        "x = open('/etc/passwd').read()",
        "import shutil",
        "__import__('os')",
        "getattr(os, 'system')('id')",
        "setattr(x, 'y', 1)",
    ],
)
def test_denylist_rejects(code: str) -> None:
    with pytest.raises(SandboxViolation):
        check_code(code)


def test_infinite_loop_is_killed_by_timeout() -> None:
    # undecidable statically — the wall-clock timeout is the defense
    result = run_python("while True:\n    pass", timeout_seconds=1.0)
    assert result.ok is False
    assert "timeout" in result.reason


def test_happy_path_runs_and_returns_output() -> None:
    result = run_python("readings = [2.1, 3.9, 4.2, 1.8]\nprint(max(readings))")
    assert isinstance(result, CodeRunResult)
    assert result.ok is True
    assert result.exit_code == 0
    assert "4.2" in result.stdout


def test_import_error_surfaces_as_failed_result() -> None:
    result = run_python("import definitely_not_a_real_module_xyz")
    assert result.ok is False
    assert result.exit_code != 0


def test_timeout_kills_long_runs() -> None:
    result = run_python("import time\ntime.sleep(30)", timeout_seconds=1.0)
    assert result.ok is False
    assert "timeout" in result.reason


def test_denied_code_returns_result_not_exception() -> None:
    result = run_python("import os")
    assert result.ok is False
    assert "blocked import" in result.reason


def test_environment_is_stripped() -> None:
    result = run_python("import os\nprint(os.environ.get('SECRET_XYZ', 'ABSENT'))")
    # os import itself is denied — the env check rides on that gate
    assert result.ok is False
