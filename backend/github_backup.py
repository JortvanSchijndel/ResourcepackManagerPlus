import os
import shutil
import subprocess
import yaml
from pathlib import Path
import logging

# Configuration
BASE_DIR = Path(__file__).parent
CONFIG_FILE = BASE_DIR / "github_config.yaml"
REPO_DIR = BASE_DIR / "github_backup_repo"
SOURCE_BRANCHES_DIR = BASE_DIR / "branches"
SOURCE_CONFIG_FILE = BASE_DIR / "config.yaml"

logging.basicConfig(level=logging.INFO)

def load_settings():
    if not CONFIG_FILE.exists():
        return {"repoUrl": "", "token": "", "enabled": False}
    with open(CONFIG_FILE, 'r') as f:
        return yaml.safe_load(f) or {"repoUrl": "", "token": "", "enabled": False}

def save_settings(settings):
    with open(CONFIG_FILE, 'w') as f:
        yaml.dump(settings, f)

def run_git_command(args, cwd):
    try:
        result = subprocess.run(['git'] + args, cwd=cwd, check=True, capture_output=True, text=True)
        logging.info(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        logging.error(f"Git command failed: {e.stderr}")
        return False

def backup_to_github():
    settings = load_settings()
    if not settings.get("enabled"):
        logging.info("GitHub backup is disabled.")
        return

    repo_url = settings.get("repoUrl")
    token = settings.get("token")

    if not repo_url or not token:
        logging.error("GitHub repo URL or token not configured.")
        return

    # Add token to repo URL for authentication
    # https://<token>@github.com/user/repo.git
    auth_repo_url = repo_url.replace("https://", f"https://{token}@")

    # 1. Clone or pull
    if not REPO_DIR.exists():
        REPO_DIR.mkdir(parents=True, exist_ok=True)
        if not run_git_command(['clone', auth_repo_url, '.'], REPO_DIR):
            logging.error("Failed to clone repository.")
            return
    else:
        if not run_git_command(['pull'], REPO_DIR):
            logging.error("Failed to pull from repository.")
            # Continue anyway, maybe a push will fix it

    # 2. Copy files
    try:
        # Clear existing backup files
        backup_branches_dir = REPO_DIR / "branches"
        if backup_branches_dir.exists():
            shutil.rmtree(backup_branches_dir)
        
        backup_config_file = REPO_DIR / "config.yaml"
        if backup_config_file.exists():
            os.remove(backup_config_file)

        # Copy source to backup repo
        if SOURCE_BRANCHES_DIR.exists():
            shutil.copytree(SOURCE_BRANCHES_DIR, backup_branches_dir)
        
        if SOURCE_CONFIG_FILE.exists():
            shutil.copy2(SOURCE_CONFIG_FILE, backup_config_file)

    except Exception as e:
        logging.error(f"Error copying files to backup repository: {e}")
        return

    # 3. Commit and push
    if not run_git_command(['add', '.'], REPO_DIR):
        logging.error("Failed to stage changes.")
        return

    # Check for changes
    status_result = subprocess.run(['git', 'status', '--porcelain'], cwd=REPO_DIR, capture_output=True, text=True)
    if not status_result.stdout.strip():
        logging.info("No changes to commit.")
        return

    if not run_git_command(['commit', '-m', 'Automated backup'], REPO_DIR):
        logging.info("No changes to commit or commit failed.")
        return # No changes is not an error

    if not run_git_command(['push'], REPO_DIR):
        logging.error("Failed to push changes.")
        return
    
    logging.info("GitHub backup successful.")

if __name__ == '__main__':
    # For testing
    backup_to_github()
