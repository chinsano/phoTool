import argparse
import os
import subprocess
import sys
import time
from pathlib import Path
import socket
from urllib import request as urlrequest


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


def _can_connect(port: int, host: str = '127.0.0.1', timeout: float = 0.25) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _ensure_built() -> None:
    dist_index = SERVER_DIR / 'dist' / 'index.js'
    if dist_index.exists():
        return
    # Run workspace build
    subprocess.run(['npm.cmd', 'run', 'server:build'], cwd=str(ROOT), check=False)


def start(port: int, dev: bool = False, wait: bool = False) -> None:
    # If already running, skip
    existing = _read_pid()
    if existing and _is_pid_running(existing):
        print(f'Server already running (PID {existing}).')
        return

    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    # Rotate log: move current server.log to server.log.old (overwrite), start fresh server.log
    try:
        old_log = SERVER_DIR / 'server.log.old'
        try:
            os.replace(LOG_FILE, old_log)
        except FileNotFoundError:
            # no existing log to rotate
            pass
    except Exception:
        # ignore rotation errors and continue with a fresh log
        pass
    log = open(LOG_FILE, 'a', buffering=1, encoding='utf-8')

    env = os.environ.copy()
    env['PORT'] = str(port)

    if dev:
        # Prefer launching tsx directly to avoid shell policy issues
        tsx_cli = SERVER_DIR / 'node_modules' / 'tsx' / 'dist' / 'cli.js'
        if tsx_cli.exists():
            cmd = ['node', str(tsx_cli), 'watch', 'server/src/index.ts']
        else:
            # Fallback to npm.cmd workspace script from root
            cmd = ['npm.cmd', 'run', 'server:dev']
    else:
        _ensure_built()
        cmd = ['node', 'server/dist/index.js']
        # Reduce child processes by using production mode (disables pretty transport)
        env.setdefault('NODE_ENV', 'production')

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
        env=env,
    )

    _write_pid(proc.pid)
    if wait:
        # Wait for port to accept connections (up to ~10s)
        for _ in range(50):
            if _can_connect(port):
                break
            time.sleep(0.2)
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


def restart(port: int, dev: bool = False, wait: bool = False) -> None:
    stop(port)
    # Brief pause for OS to release handles
    time.sleep(0.5)
    start(port, dev, wait)


def main() -> int:
    parser = argparse.ArgumentParser(description='Manage phoTool server')
    parser.add_argument('--start', action='store_true', help='Start the server')
    parser.add_argument('--stop', action='store_true', help='Stop the server')
    parser.add_argument('--restart', action='store_true', help='Restart the server')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help='Port to watch/kill (default 5000)')
    parser.add_argument('--dev', action='store_true', help='Run in dev watch mode (tsx)')
    parser.add_argument('--wait', action='store_true', help='Wait until the port responds before returning')
    args = parser.parse_args()

    if args.start:
        start(args.port, args.dev, args.wait)
    elif args.stop:
        stop(args.port)
    elif args.restart:
        restart(args.port, args.dev, args.wait)
    else:
        parser.print_help()
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())


