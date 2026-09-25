"""E3: sandboxed Python execution for generated analysis code.

Security model (host-level sandbox, documented limitation):
- AST pre-scan rejects os/subprocess/socket/eval/exec, __import__ tricks,
  attribute escapes (os.system via getattr), and file opens outside the run dir.
- Execution runs `sys.executable -I` (isolated mode: no site-PYTHONPATH from
  the caller environment, no usercustomize), with an EMPTY environment except
  PATH/SYSTEMROOT on Windows, cwd pinned to the per-run temp dir, and a hard
  5s wall-clock timeout (kill on expiry).
- stdout/stderr captured with byte caps; exit code and duration recorded.
- True network isolation would need OS-level sandboxing (container / job
  object) — documented as scoped follow-up in coordination/DECISIONS.md.
"""

from __future__ import annotations

import ast
import os
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

BLOCKED_MODULES = frozenset(
    {
        "os",
        "subprocess",
        "socket",
        "shutil",
        "pathlib",
        "sys",
        "signal",
        "multiprocessing",
        "threading",
        "concurrent",
        "ctypes",
        "importlib",
        "runpy",
        "code",
        "codeop",
        "compileall",
        "py_compile",
        "pydoc",
        "webbrowser",
        "urllib",
        "http",
        "ftplib",
        "smtplib",
        "ssl",
        "asyncio",
        "pickle",
        "marshal",
        "dbm",
        "sqlite3",
        "inspect",
        "traceback",
        "gc",
        "weakref",
        "atexit",
        "builtins",
    }
)

BLOCKED_NAMES = frozenset(
    {
        "eval", "exec", "open", "compile", "__import__", "input", "exit", "quit", "help",
        # reflection escape hatches (getattr(os, 'system') style bypasses)
        "getattr", "setattr", "delattr", "globals", "locals", "vars", "dir",
        "__build_class__",
    }
)

DEFAULT_TIMEOUT_SECONDS = 5.0
MAX_OUTPUT_BYTES = 8 * 1024


class SandboxViolation(ValueError):
    """Raised when generated code fails the static sandbox check."""


@dataclass
class CodeRunResult:
    ok: bool
    stdout: str
    stderr: str
    exit_code: int
    duration_seconds: float
    reason: str = ""


class _SandboxVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.violations: list[str] = []

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            top = alias.name.split(".")[0]
            if top in BLOCKED_MODULES:
                self.violations.append(f"blocked import: {alias.name}")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module is not None:
            top = node.module.split(".")[0]
            if top in BLOCKED_MODULES:
                self.violations.append(f"blocked from-import: {node.module}")
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if node.id in BLOCKED_NAMES:
            self.violations.append(f"blocked builtin: {node.id}")
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        # catches getattr(os, 'system') style escapes only partially — the
        # direct references above carry the weight; this flags the pattern
        if node.attr in {"system", "popen", "spawn", "exec", "eval"}:
            self.violations.append(f"blocked attribute access: .{node.attr}")
        self.generic_visit(node)


def check_code(code: str, *, max_chars: int = 4000) -> None:
    """Static sandbox gate. Raises SandboxViolation on rejection."""
    if not code or not code.strip():
        raise SandboxViolation("empty code")
    if len(code) > max_chars:
        raise SandboxViolation(f"code exceeds {max_chars} chars")
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        raise SandboxViolation(f"syntax error: {exc}") from exc
    visitor = _SandboxVisitor()
    visitor.visit(tree)
    if visitor.violations:
        raise SandboxViolation("; ".join(sorted(set(visitor.violations))))


def run_python(code: str, *, timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS) -> CodeRunResult:
    """Run generated analysis code in the sandbox. Never raises for sandbox
    violations — those return ok=False with the reason recorded."""
    started = time.monotonic()
    try:
        check_code(code)
    except SandboxViolation as exc:
        return CodeRunResult(
            ok=False,
            stdout="",
            stderr="",
            exit_code=-1,
            duration_seconds=time.monotonic() - started,
            reason=str(exc),
        )

    env: dict[str, str] = {}
    if os.name == "nt":
        for key in ("PATH", "SYSTEMROOT", "SYSTEMDRIVE", "TEMP", "TMP"):
            value = os.environ.get(key)
            if value:
                env[key] = value

    with tempfile.TemporaryDirectory(prefix="nirva-code-") as tmpdir:
        script = Path(tmpdir) / "analysis.py"
        script.write_text(code, encoding="utf-8")
        try:
            proc = subprocess.run(
                [sys.executable, "-I", str(script)],
                cwd=tmpdir,
                env=env,
                capture_output=True,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired:
            return CodeRunResult(
                ok=False,
                stdout="",
                stderr="",
                exit_code=-1,
                duration_seconds=time.monotonic() - started,
                reason=f"timeout after {timeout_seconds}s",
            )
        except OSError as exc:
            return CodeRunResult(
                ok=False,
                stdout="",
                stderr="",
                exit_code=-1,
                duration_seconds=time.monotonic() - started,
                reason=f"spawn failed: {exc}",
            )
        duration = time.monotonic() - started
        return CodeRunResult(
            ok=proc.returncode == 0,
            stdout=proc.stdout.decode("utf-8", errors="replace")[:MAX_OUTPUT_BYTES],
            stderr=proc.stderr.decode("utf-8", errors="replace")[:MAX_OUTPUT_BYTES],
            exit_code=proc.returncode,
            duration_seconds=duration,
        )
