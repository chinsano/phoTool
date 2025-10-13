import argparse
import os
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SERVER_DIR = ROOT / 'server'
PID_FILE = SERVER_DIR / '.server.pid'
LOG_FILE = SERVER_DIR / 'server.log'
DEFAULT_PORT = 5000


def _is_pid_running(pid: int) -> bool:
    try:
        # Use tasklist to check if PID exists on Windows
        result = subprocess.run(
            ['tasklist', '/FI', f'PID eq {pid}'],
            capture_output=True, text=True, check=False
        )
        return str(pid) in result.stdout
    except Exception:
        return False


def _write_pid(pid: int) -> None:
    PID_FILE.write_text(str(pid), encoding='utf-8')


def _read_pid() -> int | None:
    try:
        return int(PID_FILE.read_text(encoding='utf-8').strip())
    except Exception:
        return None


def _kill_pid_tree(pid: int) -> None:
    # Kill process and its children
    subprocess.run(['taskkill', '/PID', str(pid), '/F', '/T'], check=False)


def _pids_listening_on_port(port: int) -> list[int]:
    # netstat output parsing for Windows
    try:
        res = subprocess.run(
            ['netstat', '-ano', '-p', 'TCP'], capture_output=True, text=True, check=False
        )
        pids: set[int] = set()
        for line in res.stdout.splitlines():
            line = line.strip()
            # Look for LISTENING entries on desired port
            if 'LISTENING' in line and f':{port} ' in line:
                parts = line.split()
                if parts:
                    try:
                        pids.add(int(parts[-1]))
                    except ValueError:
                        pass
        return list(pids)
    except Exception:
        return []


def start(port: int) -> None:
    # If already running, skip
    existing = _read_pid()
    if existing and _is_pid_running(existing):
        print(f'Server already running (PID {existing}).')
        return

    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    log = open(LOG_FILE, 'a', buffering=1, encoding='utf-8')

    # Prefer launching tsx directly to avoid shell policy issues
    tsx_cli = SERVER_DIR / 'node_modules' / 'tsx' / 'dist' / 'cli.js'
    if tsx_cli.exists():
        cmd = ['node', str(tsx_cli), 'watch', 'server/src/index.ts']
    else:
        # Fallback to npm.cmd workspace script from root
        cmd = ['npm.cmd', 'run', 'server:dev']

    DETACHED_PROCESS = 0x00000008
    CREATE_NEW_PROCESS_GROUP = 0x00000200
    CREATE_NO_WINDOW = 0x08000000
    flags = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW

    proc = subprocess.Popen(
        cmd,
        cwd=str(ROOT),
        stdout=log,
        stderr=log,
        stdin=subprocess.DEVNULL,
        creationflags=flags,
        shell=False,
    )

    _write_pid(proc.pid)
    # Optionally wait a moment for port to bind
    for _ in range(20):
        if _pids_listening_on_port(port):
            break
        time.sleep(0.25)
    print(f'Server started (PID {proc.pid}). Logs: {LOG_FILE}')


def stop(port: int) -> None:
    stopped = False
    pid = _read_pid()
    if pid and _is_pid_running(pid):
        _kill_pid_tree(pid)
        stopped = True
    else:
        # Fallback: kill by port
        for p in _pids_listening_on_port(port):
            _kill_pid_tree(p)
            stopped = True
    try:
        if PID_FILE.exists():
            PID_FILE.unlink()
    except Exception:
        pass
    print('Server stopped.' if stopped else 'No running server found.')


def restart(port: int) -> None:
    stop(port)
    # Brief pause for OS to release handles
    time.sleep(0.5)
    start(port)


def main() -> int:
    parser = argparse.ArgumentParser(description='Manage phoTool server')
    parser.add_argument('--start', action='store_true', help='Start the server')
    parser.add_argument('--stop', action='store_true', help='Stop the server')
    parser.add_argument('--restart', action='store_true', help='Restart the server')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='Port to watch/kill (default 5000)')
    args = parser.parse_args()

    if args.start:
        start(args.port)
    elif args.stop:
        stop(args.port)
    elif args.restart:
        restart(args.port)
    else:
        parser.print_help()
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())


