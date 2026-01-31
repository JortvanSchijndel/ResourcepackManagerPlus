from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import os
import json
import shutil
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
import base64
import yaml
import hashlib
import re
import difflib
import requests
import uuid
import logging
import io
import threading
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from github_backup import load_settings as load_github_settings, save_settings as save_github_settings, backup_to_github

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'super_secret_key_change_this_in_production')
CORS(app, supports_credentials=True)

# Logging
logging.basicConfig(level=logging.INFO)

# Configuration
BASE_DIR = Path(__file__).parent
BRANCHES_DIR = BASE_DIR / "branches"
TEMP_DIR = BASE_DIR / "temp"
CONFIG_FILE = BASE_DIR / "config.yaml"
USERS_FILE = BASE_DIR / "users.yaml"
SERVERS_FILE = BASE_DIR / "servers.yaml"

# Branding storage
BRANDING_DIR = BASE_DIR / "branding"
BRANDING_DIR.mkdir(parents=True, exist_ok=True)
BRAND_ICON_PATH = BRANDING_DIR / "icon.png"
BRAND_DEFAULT = "oklch(0.58 0.256 293.597)"

# Ensure directories exist
BRANCHES_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

for branch in ["dev", "prod"]:
    initial_branch_path = BRANCHES_DIR / branch
    initial_branch_path.mkdir(parents=True, exist_ok=True)

# --- Background Tasks ---
def trigger_backup():
    """Triggers the GitHub backup in a new thread."""
    try:
        thread = threading.Thread(target=backup_to_github)
        thread.start()
    except Exception as e:
        logging.error(f"Failed to start backup thread: {e}")

def cleanup_temp_folder():
    """Deletes files in the temp folder older than 1 hour."""
    logging.info("Running temp folder cleanup...")
    now = datetime.now()
    for f in TEMP_DIR.iterdir():
        try:
            file_mod_time = datetime.fromtimestamp(f.stat().st_mtime)
            if now - file_mod_time > timedelta(hours=1):
                if f.is_file():
                    f.unlink()
                elif f.is_dir():
                    shutil.rmtree(f)
                logging.info(f"Removed old temp file/dir: {f.name}")
        except Exception as e:
            logging.error(f"Error cleaning up temp file {f.name}: {e}")

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_temp_folder, 'interval', hours=1)
scheduler.add_job(backup_to_github, 'interval', minutes=30)
scheduler.start()
# --- End Background Tasks ---

# Login Manager Setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Transparent PNG for missing textures
TRANSPARENT_PNG_DATA = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")

# User Model
class User(UserMixin):
    def __init__(self, user_id, username, password_hash, role):
        self.id = user_id
        self.username = username
        self.password_hash = password_hash
        self.role = role

    def to_dict(self):
        return {"id": self.id, "username": self.username, "role": self.role}


def load_users():
    if not USERS_FILE.exists():
        default_users = {"users": [{"id": "1", "username": "admin", "password": generate_password_hash("adminpassword"),
                                    "role": "admin"}]}
        with open(USERS_FILE, 'w') as f:
            yaml.dump(default_users, f)
        return default_users

    with open(USERS_FILE, 'r') as f:
        users_data = yaml.safe_load(f) or {"users": []}
        updated = False
        for user in users_data.get("users", []):
            if '$' not in user["password"]:
                user["password"] = generate_password_hash(user["password"])
                updated = True
        if updated:
            save_users(users_data)
        return users_data


def save_users(users_data):
    with open(USERS_FILE, 'w') as f:
        yaml.dump(users_data, f)
    trigger_backup()


@login_manager.user_loader
def load_user(user_id):
    users_data = load_users()
    for u in users_data.get("users", []):
        if u["id"] == user_id:
            return User(u["id"], u["username"], u["password"], u["role"])
    return None


def load_servers():
    if not SERVERS_FILE.exists():
        return {"servers": []}
    with open(SERVERS_FILE, 'r') as f:
        return yaml.safe_load(f) or {"servers": []}


def save_servers(servers_data):
    with open(SERVERS_FILE, 'w') as f:
        yaml.dump(servers_data, f)
    trigger_backup()


# Heartbeat
@app.route('/api/heartbeat', methods=['GET'])
def heartbeat():
    return jsonify({"status": "alive"}), 200


# Server Routes
@app.route('/api/servers', methods=['GET'])
@login_required
def list_servers():
    servers_data = load_servers()
    return jsonify(servers_data)


@app.route('/api/servers/heartbeat', methods=['GET'])
@login_required
def check_servers_heartbeat():
    servers_data = load_servers()
    server_statuses = []
    for server in servers_data.get("servers", []):
        try:
            url = f"{server['url'].rstrip('/')}/heartbeat"
            headers = {'X-API-Key': server.get('api_key', '')}
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200 and response.json().get('status') == 'alive':
                server_statuses.append({"id": server["id"], "connected": True})
            else:
                server_statuses.append({"id": server["id"], "connected": False})
        except requests.exceptions.RequestException:
            server_statuses.append({"id": server["id"], "connected": False})
    return jsonify({"statuses": server_statuses})


@app.route('/api/servers', methods=['POST'])
@login_required
def add_server():
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    data = request.json
    name = data.get('name')
    url = data.get('url')
    api_key = data.get('api_key')

    if not name or not url or not api_key:
        return jsonify({"error": "Name, URL, and API Key are required"}), 400

    servers_data = load_servers()
    servers = servers_data.get("servers", [])

    new_server = {
        "id": str(uuid.uuid4()),
        "name": name,
        "url": url,
        "api_key": api_key
    }

    servers.append(new_server)
    servers_data["servers"] = servers
    save_servers(servers_data)

    return jsonify({"success": True, "message": "Server added", "server": new_server})


@app.route('/api/servers/<server_id>', methods=['DELETE'])
@login_required
def delete_server(server_id):
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    servers_data = load_servers()
    servers = servers_data.get("servers", [])

    initial_len = len(servers)
    servers = [s for s in servers if s["id"] != server_id]

    if len(servers) < initial_len:
        servers_data["servers"] = servers
        save_servers(servers_data)
        return jsonify({"success": True, "message": "Server deleted"})

    return jsonify({"error": "Server not found"}), 404


@app.route('/api/push-to-server', methods=['POST'])
@login_required
def push_to_server():
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json
    branch_name = data.get('branch')
    server_id = data.get('serverId')

    if not branch_name or not server_id:
        return jsonify({"error": "Branch and Server ID required"}), 400

    servers_data = load_servers()
    server = next((s for s in servers_data.get("servers", []) if s["id"] == server_id), None)

    if not server:
        return jsonify({"error": "Server not found"}), 404

    zip_path = None
    try:
        zip_path = create_resource_pack_zip(branch_name)
        if not zip_path:
            return jsonify({"success": False, "message": f"No files to zip for branch '{branch_name}'"}), 400

        with open(zip_path, 'rb') as f:
            zip_data = f.read()

        headers = {
            'X-API-Key': server['api_key'],
            'Content-Type': 'application/zip',
            'Origin': request.headers.get('Origin'),
            'Referer': request.headers.get('Referer')
        }
        upload_url = f"{server['url'].rstrip('/')}/upload"

        response = requests.post(upload_url, data=zip_data, headers=headers, timeout=15)
        response.raise_for_status()

        return jsonify({"success": True, "message": f"Successfully pushed to {server['name']}"})
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to push to server {server['name']}: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    except Exception as e:
        logging.error(f"An unexpected error occurred during push: {e}")
        return jsonify({"success": False, "message": "An internal error occurred."}), 500
    finally:
        if zip_path and os.path.exists(zip_path):
            os.remove(zip_path)


def create_resource_pack_zip(branch_name):
    branch_path = _get_branch_path(branch_name)
    pack_meta = branch_path / "pack.mcmeta"
    if not pack_meta.exists():
        meta_data = {"pack": {"pack_format": 15, "description": "Resource Pack"}}
        with open(pack_meta, 'w') as f:
            json.dump(meta_data, f, indent=2)

    zip_path = TEMP_DIR / f"resourcepack_{branch_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"

    files_to_zip = [p for p in branch_path.rglob('*') if p.is_file() and '.bbmodel' not in p.name and p.name != 'metadata.json']
    if not files_to_zip:
        return None

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in files_to_zip:
            rel_path = file_path.relative_to(branch_path)
            zipf.write(file_path, rel_path)

    return zip_path


# Auth Routes
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    users_data = load_users()
    user_data = None
    for u in users_data.get("users", []):
        if u["username"] == username:
            user_data = u
            break

    if user_data and check_password_hash(user_data["password"], password):
        user = User(user_data["id"], user_data["username"], user_data["password"], user_data["role"])
        login_user(user)
        return jsonify({"success": True, "user": user.to_dict()})

    return jsonify({"error": "Invalid credentials"}), 401


@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"success": True})


@app.route('/api/me', methods=['GET'])
def get_current_user():
    if current_user.is_authenticated:
        return jsonify({"authenticated": True, "user": current_user.to_dict()})
    return jsonify({"authenticated": False})


@app.route('/api/me/update', methods=['PUT'])
@login_required
def update_current_user():
    data = request.json
    username = data.get('username')
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')

    if not username or not current_password:
        return jsonify({"error": "Username and current password required"}), 400

    users_data = load_users()
    users = users_data.get("users", [])

    user_idx = -1
    for i, u in enumerate(users):
        if u["id"] == current_user.id:
            user_idx = i
            break

    if user_idx == -1:
        return jsonify({"error": "User not found"}), 404

    user = users[user_idx]

    if not check_password_hash(user["password"], current_password):
        return jsonify({"error": "Incorrect password"}), 401

    if username != user["username"]:
        for u in users:
            if u["username"] == username and u["id"] != current_user.id:
                return jsonify({"error": "Username already taken"}), 400

    user["username"] = username
    if new_password:
        user["password"] = generate_password_hash(new_password)

    users[user_idx] = user
    users_data["users"] = users
    save_users(users_data)

    return jsonify({"success": True})


# User Management Routes (Admin only)
@app.route('/api/users', methods=['GET'])
@login_required
def list_users():
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    users_data = load_users()
    safe_users = []
    for u in users_data.get("users", []):
        safe_users.append({
            "id": u["id"],
            "username": u["username"],
            "role": u["role"]
        })
    return jsonify({"users": safe_users})


@app.route('/api/users', methods=['POST'])
@login_required
def create_user():
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'normal')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    if role not in ['admin', 'normal']:
        return jsonify({"error": "Invalid role"}), 400

    users_data = load_users()
    users = users_data.get("users", [])

    for u in users:
        if u["username"] == username:
            return jsonify({"error": "Username already exists"}), 400

    new_id = str(len(users) + 2)

    new_user = {
        "id": new_id,
        "username": username,
        "password": generate_password_hash(password),
        "role": role
    }

    users.append(new_user)
    users_data["users"] = users
    save_users(users_data)

    return jsonify({"success": True, "user": {"id": new_id, "username": username, "role": role}})


@app.route('/api/users/<user_id>', methods=['PUT'])
@login_required
def update_user_role(user_id):
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json or {}
    role = data.get('role')
    new_username = data.get('username')
    new_password = data.get('password')

    # Validate role if provided
    if role is not None and role not in ['admin', 'normal']:
        return jsonify({"error": "Invalid role"}), 400

    users_data = load_users()
    users = users_data.get("users", [])

    updated = False
    for i, u in enumerate(users):
        if u["id"] == user_id:
            # Update username if provided (and not taken)
            if new_username and new_username != u.get("username"):
                for other in users:
                    if other.get("username") == new_username and other.get("id") != user_id:
                        return jsonify({"error": "Username already exists"}), 400
                users[i]["username"] = new_username

            # Update password if provided (only when non-empty)
            if new_password:
                users[i]["password"] = generate_password_hash(new_password)

            # Update role if provided
            if role is not None:
                users[i]["role"] = role

            updated = True
            break

    if updated:
        users_data["users"] = users
        save_users(users_data)
        return jsonify({"success": True, "user": {"id": user_id, "username": users[i]["username"], "role": users[i]["role"]}})
    return jsonify({"error": "User not found"}), 404


@app.route('/api/users/<user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    if user_id == current_user.id:
        return jsonify({"error": "Cannot delete yourself"}), 400

    users_data = load_users()
    users = users_data.get("users", [])

    initial_len = len(users)
    users = [u for u in users if u["id"] != user_id]

    if len(users) < initial_len:
        users_data["users"] = users
        save_users(users_data)
        return jsonify({"success": True})

    return jsonify({"error": "User not found"}), 404


def _get_branch_path(branch_name):
    return BRANCHES_DIR / branch_name


def load_config():
    if not CONFIG_FILE.exists():
        default = {"tags": [], "categories": []}
        # create a minimal config file for first run
        with open(CONFIG_FILE, 'w') as f:
            yaml.dump(default, f)
        return default
    with open(CONFIG_FILE, 'r') as f:
        return yaml.safe_load(f) or {"tags": [], "categories": []}


def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
        yaml.dump(config, f)
    trigger_backup()


def calculate_file_hash(file_path):
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def create_item_definition(item_def_path, model_path, has_tints=False):
    # This might be used by the plugin or just as a record
    item_def = {
        "model": {
            "type": "minecraft:model",
            "model": model_path
        }
    }

    if has_tints:
        item_def["model"]["tints"] = [
            {
                "type": "minecraft:dye",
                "default": -6265536
            }
        ]

    with open(item_def_path, 'w') as f:
        json.dump(item_def, f, indent=2)


@app.route('/api/branches', methods=['GET'])
@login_required
def list_branches():
    branches = []
    for branch_dir in BRANCHES_DIR.iterdir():
        if branch_dir.is_dir():
            branches.append(branch_dir.name)
    return jsonify({"branches": sorted(branches)})


@app.route('/api/branches', methods=['POST'])
@login_required
def create_branch():
    data = request.json
    branch_name = data.get('name', '').strip().lower().replace(' ', '_')
    copy_from = data.get('copyFrom')

    if not branch_name:
        return jsonify({"error": "Branch name required"}), 400

    branch_path = _get_branch_path(branch_name)

    if branch_path.exists():
        return jsonify({"error": "Branch already exists"}), 400

    try:
        if copy_from:
            source_path = _get_branch_path(copy_from)
            if source_path.exists():
                shutil.copytree(source_path, branch_path)
            else:
                return jsonify({"error": f"Source branch '{copy_from}' not found"}), 404
        else:
            branch_path.mkdir(parents=True, exist_ok=True)
        
        trigger_backup()
        return jsonify({"success": True, "message": f"Branch '{branch_name}' created"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/branches/<branch_name>', methods=['DELETE'])
@login_required
def delete_branch(branch_name):
    if branch_name in ['dev', 'prod']:
        return jsonify({"error": "Cannot delete default branches"}), 400

    branch_path = _get_branch_path(branch_name)

    if not branch_path.exists():
        return jsonify({"error": "Branch not found"}), 404

    try:
        shutil.rmtree(branch_path)
        trigger_backup()
        return jsonify({"success": True, "message": f"Branch '{branch_name}' deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/namespaces', methods=['GET'])
@login_required
def list_namespaces():
    # Deprecated: use /api/categories
    return list_categories()


def parse_category(category_path):
    """
    Splits a category path (e.g. "cosmetics/hats/summer") into:
    - namespace: "cosmetics" (first segment)
    - subpath: "hats/summer" (remaining segments)
    
    Legacy behavior: returns (namespace, subpath)
    New behavior (if flattened): returns (flattened_namespace, "")
    """
    parts = category_path.replace('\\', '/').split('/')
    namespace = parts[0]
    subpath = "/".join(parts[1:]) if len(parts) > 1 else ""
    return namespace, subpath

def parse_category_flattened(category_path):
    """
    Flattens the category path to a single namespace string.
    e.g. "cosmetics/hats" -> "cosmetics-hats"
    """
    clean = category_path.replace('\\', '/').strip('/')
    return clean.replace('/', '-').lower(), ""

def resolve_model_path(branch_path, category_path, model_identifier):
    """
    Resolves the model path, checking both new (flattened) and legacy (nested) structures.
    Returns (path, namespace, subpath)
    """
    # Try flattened first (new standard)
    flat_ns, _ = parse_category_flattened(category_path)
    
    # Path: assets/<flat_ns>/models/item/<model_identifier>
    path1 = branch_path / "assets" / flat_ns / "models" / "item" / model_identifier
    
    if path1.exists():
        return path1, flat_ns, ""
        
    # Try legacy
    ns, sub = parse_category(category_path)
    
    path2 = branch_path / "assets" / ns / "models" / "item"
    if sub: path2 = path2 / sub
    path2 = path2 / model_identifier
    
    if path2.exists():
        return path2, ns, sub
        
    # Try legacy (non-nested but wrong namespace) - e.g. category="attractions/sakuraswirl" but path="assets/attractions/models/item/model_identifier"
    path3 = branch_path / "assets" / ns / "models" / "item" / model_identifier
    if path3.exists():
        return path3, ns, ""

    # Default to flattened for new files
    return path1, flat_ns, ""


@app.route('/api/models/<branch_name>', methods=['GET'])
@login_required
def list_models(branch_name):
    branch_path = _get_branch_path(branch_name)
    assets_path = branch_path / "assets"

    models = []
    if assets_path.exists():
        # Recursively scan for metadata files
        for metadata_file in assets_path.glob("**/metadata.json"):
            try:
                # Structure: assets/<namespace>/models/item/<subpath>/<model_identifier>/metadata.json
                # We need to reconstruct the category path from this.
                
                model_dir = metadata_file.parent
                # model_dir is .../<model_identifier>
                
                # Find where "models/item" is in the path to determine namespace and subpath
                # Path parts relative to assets: <namespace>/models/item/<subpath>/<model_identifier>
                
                rel_path = model_dir.relative_to(assets_path)
                parts = rel_path.parts
                
                if len(parts) >= 4 and parts[1] == 'models' and parts[2] == 'item':
                    namespace = parts[0]
                    # parts[3:-1] is the subpath (folders between item and model_identifier)
                    # parts[-1] is model_identifier
                    
                    subpath_parts = parts[3:-1]
                    model_identifier = parts[-1]
                    
                    subpath = "/".join(subpath_parts)
                    category = f"{namespace}/{subpath}" if subpath else namespace
                    
                    json_files = [f for f in model_dir.glob('*.json') if f.name != 'metadata.json']
                    bbmodel_files = list(model_dir.glob("*.bbmodel"))

                    if not json_files:
                        continue
                    
                    model_file = json_files[0]
                    model_name = model_file.stem

                    tags = []
                    status = "approved"
                    author = "unknown"
                    version = 1

                    try:
                        with open(metadata_file, 'r') as f:
                            metadata = json.load(f)
                            tags = metadata.get('tags', [])
                            status = metadata.get('status', 'approved')
                            author = metadata.get('author', 'unknown')
                            version = metadata.get('version', 1)
                            if 'model_name' in metadata:
                                model_name = metadata['model_name']
                            
                            # Use stored category if available (preserves UI hierarchy for flattened paths)
                            if 'category' in metadata:
                                category = metadata['category']
                    except Exception as e:
                        logging.error(f"Error reading metadata file: {e}")

                    models.append({
                        "name": model_name,
                        "namespace": category, # Return full category path as namespace for frontend compatibility
                        "model_identifier": model_identifier,
                        "path": str(model_file.relative_to(branch_path)),
                        "has_bbmodel": len(bbmodel_files) > 0,
                        "tags": tags,
                        "status": status,
                        "author": author,
                        "version": version
                    })
            except Exception as e:
                logging.error(f"Error processing metadata file {metadata_file}: {e}")
                continue

    return jsonify({"models": models})


@app.route('/api/audit/<branch_name>', methods=['GET'])
@login_required
def audit_models(branch_name):
    branch_path = _get_branch_path(branch_name)
    assets_path = branch_path / "assets"
    issues = []

    if assets_path.exists():
        for metadata_file in assets_path.glob("**/metadata.json"):
            try:
                model_dir = metadata_file.parent
                rel_path = model_dir.relative_to(assets_path)
                parts = rel_path.parts
                
                if len(parts) >= 4 and parts[1] == 'models' and parts[2] == 'item':
                    current_namespace = parts[0]
                    subpath_parts = parts[3:-1]
                    model_identifier = parts[-1]
                    subpath = "/".join(subpath_parts)

                    # Read metadata
                    category = None
                    thumbnail = None
                    try:
                        with open(metadata_file, 'r') as f:
                            meta = json.load(f)
                            category = meta.get('category')
                            thumbnail = meta.get('thumbnail')
                    except:
                        pass

                    # Issue 1: Legacy structure (subpath exists)
                    if subpath:
                         issues.append({
                            "namespace": category if category else f"{current_namespace}/{subpath}",
                            "model_identifier": model_identifier,
                            "issue": "Legacy folder structure (subcategories)"
                        })
                    # Issue 2: Namespace mismatch (if category exists but path is wrong, e.g. moved but not flattened?)
                    elif category:
                         expected_ns = category.replace('/', '-').replace('\\', '-').lower()
                         if current_namespace != expected_ns:
                             issues.append({
                                "namespace": category,
                                "model_identifier": model_identifier,
                                "issue": "Legacy folder structure (subcategories)"
                            })
                    
                    if not thumbnail:
                        issues.append({
                            "namespace": category if category else current_namespace,
                            "model_identifier": model_identifier,
                            "issue": "Missing thumbnail"
                        })
                    
                    # Issue 3 & 4: Check for #missing textures and incorrect namespaces
                    json_files = list(model_dir.glob("*.json"))
                    for json_file in json_files:
                        if json_file.name == "metadata.json": continue
                        try:
                            with open(json_file, 'r') as f:
                                model_data = json.load(f)
                                content_str = json.dumps(model_data)
                                
                                if '"#missing"' in content_str:
                                    if 'textures' not in model_data or 'missing' not in model_data['textures']:
                                        issues.append({
                                            "namespace": category if category else current_namespace,
                                            "model_identifier": model_identifier,
                                            "issue": "Broken texture reference (#missing)"
                                        })
                                
                                if 'textures' in model_data:
                                    expected_ns = category.replace('/', '-').replace('\\', '-').lower() if category else current_namespace
                                    
                                    # Check for missing particle texture
                                    if 'particle' not in model_data['textures']:
                                        issues.append({
                                            "namespace": category if category else current_namespace,
                                            "model_identifier": model_identifier,
                                            "issue": "Missing particle texture"
                                        })

                                    for tex_val in model_data['textures'].values():
                                        if isinstance(tex_val, str):
                                            # Check if namespace is incorrect (not matching expected_ns)
                                            if ":" in tex_val:
                                                ns, path = tex_val.split(":", 1)
                                                if ns != expected_ns:
                                                    issues.append({
                                                        "namespace": category if category else current_namespace,
                                                        "model_identifier": model_identifier,
                                                        "issue": f"Incorrect texture namespace ({ns})"
                                                    })
                                                    break
                                                
                                                # Check if texture path matches model identifier folder
                                                path_parts = path.split("/")
                                                if len(path_parts) > 1 and path_parts[0] == 'item' and path_parts[-2] != model_identifier:
                                                     issues.append({
                                                        "namespace": category if category else current_namespace,
                                                        "model_identifier": model_identifier,
                                                        "issue": f"Texture folder mismatch ({path_parts[-2]} != {model_identifier})"
                                                    })
                                                     break

                                            # Check if texture name lacks prefix
                                            path_part = tex_val.split(":")[-1]
                                            filename = path_part.split("/")[-1]
                                            if not filename.startswith("ingeniamc_"):
                                                issues.append({
                                                    "namespace": category if category else current_namespace,
                                                    "model_identifier": model_identifier,
                                                    "issue": "Texture missing prefix (ingeniamc_)"
                                                })
                                                break

                        except Exception as e:
                            logging.error(f"Error auditing textures in {json_file}: {e}")
                            pass

            except Exception as e:
                logging.error(f"Error auditing file {metadata_file}: {e}")

    return jsonify({"issues": issues})

@app.route('/api/audit/fix-textures/<branch_name>', methods=['POST'])
@login_required
def fix_texture_issues(branch_name):
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    branch_path = _get_branch_path(branch_name)
    assets_path = branch_path / "assets"
    
    fixed_files_count = 0
    errors = []

    if not assets_path.exists():
        return jsonify({"error": "Assets folder not found"}), 404

    for metadata_file in assets_path.glob("**/metadata.json"):
        try:
            model_dir = metadata_file.parent
            rel_path = model_dir.relative_to(assets_path)
            parts = rel_path.parts
            
            if len(parts) < 4 or parts[1] != 'models' or parts[2] != 'item':
                continue

            current_namespace = parts[0]
            model_identifier = parts[-1]
            
            json_files = [f for f in model_dir.glob("*.json") if f.name != "metadata.json"]
            if not json_files:
                continue
            
            model_json_path = json_files[0]

            with open(model_json_path, 'r') as f:
                model_data = json.load(f)

            was_updated = False

            # Fix #missing
            if '"#missing"' in json.dumps(model_data):
                if 'textures' not in model_data:
                    model_data['textures'] = {}
                if 'missing' not in model_data['textures']:
                    textures_dir = branch_path / "assets" / current_namespace / "textures" / "item" / model_identifier
                    textures_dir.mkdir(parents=True, exist_ok=True)
                    
                    missing_png_path = textures_dir / "ingeniamc_missing.png"
                    if not missing_png_path.exists():
                        with open(missing_png_path, 'wb') as f:
                            f.write(TRANSPARENT_PNG_DATA)
                    
                    model_data['textures']['missing'] = f"{current_namespace}:item/{model_identifier}/ingeniamc_missing"
                    was_updated = True

            # Fix incorrect namespaces and add prefix
            if 'textures' in model_data:
                textures_dir = branch_path / "assets" / current_namespace / "textures" / "item" / model_identifier
                
                # Fix missing particle texture
                if 'particle' not in model_data['textures']:
                    # Find first available texture
                    first_tex = next((v for k, v in model_data['textures'].items() if isinstance(v, str)), None)
                    if first_tex:
                        model_data['textures']['particle'] = first_tex
                        was_updated = True

                for key, value in model_data['textures'].items():
                    if isinstance(value, str):
                        original_value = value
                        new_value = value
                        
                        # Fix namespace
                        if ":" in new_value:
                            ns, path = new_value.split(":", 1)
                            if ns != current_namespace:
                                new_value = f"{current_namespace}:{path}"
                        
                        # Fix prefix and directory name
                        if ":" in new_value:
                            ns, path = new_value.split(":", 1)
                            path_parts = path.split("/")
                            filename = path_parts[-1]
                            
                            # Ensure directory name matches model identifier if it's a local texture
                            # e.g. item/snakeheadbottom/texture -> item/snakehead_bottom/texture
                            if len(path_parts) > 1 and path_parts[-2] != model_identifier:
                                # Only fix if it looks like a model-specific folder (inside item/)
                                if path_parts[0] == 'item':
                                     path_parts[-2] = model_identifier

                            if not filename.startswith("ingeniamc_"):
                                new_filename = f"ingeniamc_{filename}"
                                path_parts[-1] = new_filename
                                
                                new_path = "/".join(path_parts)
                                new_value = f"{ns}:{new_path}"
                                
                                # Rename physical file if it exists in this model's texture folder
                                # We assume the texture is local to this model if we are fixing it
                                old_file_path = textures_dir / f"{filename}.png"
                                new_file_path = textures_dir / f"{new_filename}.png"
                                
                                if old_file_path.exists():
                                    if not new_file_path.exists():
                                        old_file_path.rename(new_file_path)
                                    else:
                                        # New file already exists? Maybe we ran this partially?
                                        pass
                                elif not new_file_path.exists():
                                    # File not found, maybe it's a shared texture or vanilla?
                                    pass
                            else:
                                # Even if prefix is there, we might have updated the path parts (directory fix)
                                new_path = "/".join(path_parts)
                                new_value = f"{ns}:{new_path}"

                        if new_value != original_value:
                            model_data['textures'][key] = new_value
                            was_updated = True
            
            if was_updated:
                with open(model_json_path, 'w') as f:
                    json.dump(model_data, f, indent=2)
                fixed_files_count += 1

        except Exception as e:
            errors.append(f"Error processing {metadata_file}: {e}")
    
    if fixed_files_count > 0:
        trigger_backup()

    return jsonify({"success": True, "fixed_files": fixed_files_count, "errors": errors})

@app.route('/api/audit/fix-paths/<branch_name>', methods=['POST'])
@login_required
def fix_model_paths(branch_name):
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    branch_path = _get_branch_path(branch_name)
    assets_path = branch_path / "assets"
    
    moved_count = 0
    errors = []

    if assets_path.exists():
        # We need to collect all moves first to avoid modifying the tree while iterating
        moves = []
        
        for metadata_file in assets_path.glob("**/metadata.json"):
            try:
                model_dir = metadata_file.parent
                rel_path = model_dir.relative_to(assets_path)
                parts = rel_path.parts
                
                if len(parts) >= 4 and parts[1] == 'models' and parts[2] == 'item':
                    current_namespace = parts[0]
                    # parts[3:-1] is subpath inside models/item if any
                    subpath_parts = parts[3:-1]
                    model_identifier = parts[-1]
                    subpath_inside_namespace = "/".join(subpath_parts)

                    category = None
                    try:
                        with open(metadata_file, 'r') as f:
                            meta = json.load(f)
                            category = meta.get('category')
                    except:
                        pass
                    
                    should_move = False
                    expected_namespace = current_namespace

                    if subpath_inside_namespace:
                        # Case 1: Physical subfolders exist. We need to flatten.
                        should_move = True
                        if not category:
                            category = f"{current_namespace}/{subpath_inside_namespace}"
                        expected_namespace = category.replace('/', '-').replace('\\', '-').lower()
                    
                    elif category:
                        # Case 2: No subfolders, but maybe namespace doesn't match category
                        expected_namespace = category.replace('/', '-').replace('\\', '-').lower()
                        if current_namespace != expected_namespace:
                            should_move = True
                    
                    if should_move:
                        # Plan move
                        
                        # Old paths
                        # assets/<current_namespace>/models/item/<subpath>/<model_identifier>
                        old_models_dir = model_dir
                        
                        # assets/<current_namespace>/textures/item/<subpath>/<model_identifier>
                        old_textures_dir = branch_path / "assets" / current_namespace / "textures" / "item"
                        if subpath_inside_namespace:
                            old_textures_dir = old_textures_dir / subpath_inside_namespace
                        old_textures_dir = old_textures_dir / model_identifier
                        
                        # assets/<current_namespace>/items/<subpath>/<model_identifier>.json
                        old_item_def = branch_path / "assets" / current_namespace / "items"
                        if subpath_inside_namespace:
                            old_item_def = old_item_def / subpath_inside_namespace
                        old_item_def = old_item_def / f"{model_identifier}.json"
                        
                        # New paths
                        # assets/<expected_namespace>/models/item/<model_identifier>
                        new_models_dir = branch_path / "assets" / expected_namespace / "models" / "item" / model_identifier
                        
                        # assets/<expected_namespace>/textures/item/<model_identifier>
                        new_textures_dir = branch_path / "assets" / expected_namespace / "textures" / "item" / model_identifier
                        
                        # assets/<expected_namespace>/items/<model_identifier>.json
                        new_item_def = branch_path / "assets" / expected_namespace / "items" / f"{model_identifier}.json"
                        
                        moves.append({
                            "category": category,
                            "old_models": old_models_dir,
                            "old_textures": old_textures_dir,
                            "old_item_def": old_item_def,
                            "new_models": new_models_dir,
                            "new_textures": new_textures_dir,
                            "new_item_def": new_item_def,
                            "current_namespace": current_namespace,
                            "expected_namespace": expected_namespace,
                            "model_identifier": model_identifier,
                            "subpath": subpath_inside_namespace
                        })
            except Exception as e:
                errors.append(str(e))

        # Execute moves
        for move in moves:
            try:
                # Create new directories
                move["new_models"].parent.mkdir(parents=True, exist_ok=True)
                move["new_textures"].parent.mkdir(parents=True, exist_ok=True)
                move["new_item_def"].parent.mkdir(parents=True, exist_ok=True)
                
                # Move models dir
                if move["old_models"].exists():
                    if move["new_models"].exists():
                        shutil.rmtree(move["new_models"])
                    shutil.move(str(move["old_models"]), str(move["new_models"]))
                
                # Move textures dir
                if move["old_textures"].exists():
                    if move["new_textures"].exists():
                        shutil.rmtree(move["new_textures"])
                    shutil.move(str(move["old_textures"]), str(move["new_textures"]))
                
                # Move item def
                if move["old_item_def"].exists():
                    if move["new_item_def"].exists():
                        move["new_item_def"].unlink()
                    shutil.move(str(move["old_item_def"]), str(move["new_item_def"]))
                
                # Update metadata with category
                new_metadata_path = move["new_models"] / "metadata.json"
                if new_metadata_path.exists():
                    with open(new_metadata_path, 'r') as f:
                        meta = json.load(f)
                    
                    meta["category"] = move["category"]
                    
                    with open(new_metadata_path, 'w') as f:
                        json.dump(meta, f, indent=2)

                # Update model.json textures paths
                json_files = list(move["new_models"].glob("*.json"))
                for json_file in json_files:
                    if json_file.name == "metadata.json": continue
                    
                    with open(json_file, 'r') as f:
                        model_data = json.load(f)
                    
                    updated_json = False
                    if "textures" in model_data:
                        for key, value in model_data["textures"].items():
                            if isinstance(value, str):
                                if ":" in value:
                                    ns, path = value.split(":", 1)
                                    if ns == move["current_namespace"]:
                                        # Fix path by removing subpath prefix if present
                                        if move["subpath"]:
                                            prefix_item = f"item/{move['subpath']}/"
                                            if path.startswith(prefix_item):
                                                path = "item/" + path[len(prefix_item):]
                                        
                                        # Replace namespace
                                        new_value = f"{move['expected_namespace']}:{path}"
                                        model_data["textures"][key] = new_value
                                        updated_json = True
                    
                    if updated_json:
                        with open(json_file, 'w') as f:
                            json.dump(model_data, f, indent=2)

                # Update item definition file
                if move["new_item_def"].exists():
                    with open(move["new_item_def"], 'r') as f:
                        item_def = json.load(f)
                    
                    if "model" in item_def and "model" in item_def["model"]:
                        model_ref = item_def["model"]["model"]
                        if ":" in model_ref:
                            ns, path = model_ref.split(":", 1)
                            if ns == move["current_namespace"]:
                                # Fix path by removing subpath prefix if present
                                if move["subpath"]:
                                    prefix_item = f"item/{move['subpath']}/"
                                    if path.startswith(prefix_item):
                                        path = "item/" + path[len(prefix_item):]

                                item_def["model"]["model"] = f"{move['expected_namespace']}:{path}"
                                with open(move["new_item_def"], 'w') as f:
                                    json.dump(item_def, f, indent=2)
                
                # Cleanup empty old directories
                def cleanup(path, root):
                    try:
                        while path != root and path.exists():
                            if not any(path.iterdir()):
                                path.rmdir()
                                path = path.parent
                            else:
                                break
                    except OSError:
                        pass
                
                cleanup(move["old_models"].parent, branch_path / "assets")
                cleanup(move["old_textures"].parent, branch_path / "assets")
                cleanup(move["old_item_def"].parent, branch_path / "assets")
                
                moved_count += 1
            except Exception as e:
                errors.append(f"Failed to move {move['category']}: {e}")

    if moved_count > 0:
        trigger_backup()

    return jsonify({"success": True, "moved": moved_count, "errors": errors})


@app.route('/api/model/<branch_name>/<path:namespace>/<model_identifier>/thumbnail', methods=['POST'])
@login_required
def update_thumbnail(branch_name, namespace, model_identifier):
    thumbnail_file = request.files.get('thumbnail')
    
    if not thumbnail_file:
        return jsonify({"error": "Thumbnail file required"}), 400
        
    branch_path = _get_branch_path(branch_name)
    
    # Use resolver to find the model path
    models_dir, _, _ = resolve_model_path(branch_path, namespace, model_identifier)
    
    metadata_path = models_dir / "metadata.json"
    
    if not metadata_path.exists():
        return jsonify({"error": "Metadata not found"}), 404
        
    try:
        thumbnail_data = thumbnail_file.read()
        thumbnail_base64 = f"data:image/png;base64,{base64.b64encode(thumbnail_data).decode('utf-8')}"
        
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
            
        metadata["thumbnail"] = thumbnail_base64
        metadata["updated"] = datetime.now().isoformat()
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        trigger_backup()
        return jsonify({"success": True, "message": "Thumbnail updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/upload/<branch_name>', methods=['POST'])
@login_required
def upload_model(branch_name):
    bbmodel_file = request.files.get('bbmodel')
    json_file = request.files.get('json')
    thumbnail_file = request.files.get('thumbnail')

    category_path = request.form.get('namespace') # This is the full category path e.g. "cosmetics/hats"
    model_name = request.form.get('modelName')
    model_identifier = request.form.get('modelIdentifier')
    tags = request.form.get('tags', '[]')

    try:
        tags = json.loads(tags)
    except Exception as e:
        logging.error(f"Error loading tags: {e}")
        tags = []

    if not category_path or not model_name or not model_identifier:
        return jsonify({"error": "All fields required"}), 400

    category_path = category_path.replace(" ", "_").lower()
    model_identifier = model_identifier.replace(" ", "_").lower()
    model_base_name = Path(model_identifier).name

    # Use flattened namespace for new uploads
    real_namespace, _ = parse_category_flattened(category_path)
    subpath = "" # Always empty for flattened structure

    branch_path = _get_branch_path(branch_name)
    
    # Standard Minecraft paths
    # assets/<namespace>/models/item/<subpath>/<model_identifier>/
    # assets/<namespace>/textures/item/<subpath>/<model_identifier>/
    
    base_assets = branch_path / "assets" / real_namespace
    
    models_base = base_assets / "models" / "item"
    textures_base = base_assets / "textures" / "item"
    
    # subpath is empty
        
    models_dir = models_base / model_identifier
    textures_dir = textures_base / model_identifier
    
    # We also create an "items" definition file, though its use is custom
    # assets/<namespace>/items/<subpath>/<model_identifier>.json ?
    # Or just assets/<namespace>/items/<model_identifier>.json?
    # Let's keep it simple and put it in items/
    items_dir = base_assets / "items"
    # subpath is empty

    items_dir.mkdir(parents=True, exist_ok=True)
    models_dir.mkdir(parents=True, exist_ok=True)
    textures_dir.mkdir(parents=True, exist_ok=True)

    try:
        if bbmodel_file:
            bbmodel_path = models_dir / f"{model_base_name}.bbmodel"
            bbmodel_file.save(bbmodel_path)

            with open(bbmodel_path, 'r') as f:
                bbmodel_data = json.load(f)

            if "textures" in bbmodel_data:
                for texture in bbmodel_data["textures"]:
                    if "source" in texture and texture["source"].startswith("data:image"):
                        tex_name = texture.get("name", "texture")
                        if not tex_name.endswith('.png'):
                            tex_name += ".png"
                        tex_path = textures_dir / tex_name
                        tex_data = texture["source"].split(",")[1]
                        with open(tex_path, 'wb') as f:
                            f.write(base64.b64decode(tex_data))

                        if "frame_time" in texture and texture["frame_time"] > 1:
                            frametime = texture["frame_time"]
                            final_frametime = frametime - 1
                            if final_frametime > 1:
                                mcmeta_path = tex_path.with_suffix('.png.mcmeta')
                                mcmeta_content = {"animation": {"frametime": final_frametime}}
                                with open(mcmeta_path, 'w') as f:
                                    json.dump(mcmeta_content, f, indent=2)

        if json_file:
            model_json_path = models_dir / f"{model_base_name}.json"
            json_file.save(model_json_path)

            with open(model_json_path, 'r') as f:
                model_data = json.load(f)

            # Fix texture paths
            # Texture path should be: <namespace>:item/<subpath>/<model_identifier>/<texture_name>
            texture_prefix = f"{real_namespace}:item"
            if subpath:
                texture_prefix += f"/{subpath}"
            texture_prefix += f"/{model_identifier}"

            if "textures" in model_data:
                for key, value in model_data["textures"].items():
                    if isinstance(value, str):
                        # If it's already absolute, leave it? Or fix it?
                        # If it's relative (no namespace), assume it's local
                        if ":" not in value:
                             clean_value = value.replace('\\', '/').split('/')[-1]
                             model_data["textures"][key] = f"{texture_prefix}/{clean_value}"
                        elif value.startswith(f"{real_namespace}:"):
                             # Check if it needs update
                             pass

            with open(model_json_path, 'w') as f:
                json.dump(model_data, f, indent=2)

        # Process thumbnail (save to metadata as base64)
        thumbnail_base64 = None
        if thumbnail_file:
            thumbnail_data = thumbnail_file.read()
            thumbnail_base64 = f"data:image/png;base64,{base64.b64encode(thumbnail_data).decode('utf-8')}"

        model_json_path = models_dir / f"{model_base_name}.json"
        has_tints = False
        if model_json_path.exists():
            try:
                with open(model_json_path, 'r') as f:
                    if '"tintindex":' in f.read():
                        has_tints = True
            except Exception as e:
                logging.error(f"Error checking for tints: {e}")

        item_def_path = items_dir / f"{model_identifier}.json"
        
        # Model path for item definition: <namespace>:item/<subpath>/<model_identifier>/<model_base_name>
        model_path_ref = f"{real_namespace}:item"
        if subpath:
            model_path_ref += f"/{subpath}"
        model_path_ref += f"/{model_identifier}/{model_base_name}"
        
        create_item_definition(item_def_path, model_path_ref, has_tints)

        existing_metadata = {}
        metadata_path = models_dir / "metadata.json"
        if metadata_path.exists():
            try:
                with open(metadata_path, 'r') as f:
                    existing_metadata = json.load(f)
            except Exception as e:
                logging.error(f"Error reading metadata: {e}")

        version = existing_metadata.get("version", 0) + 1

        if existing_metadata:
            status = existing_metadata.get("status", "approved")
        else:
            status = "approved" if current_user.role == 'admin' else "review"

        if current_user.role != 'admin':
            status = "review"

        metadata = {
            "tags": tags,
            "model_name": model_name,
            "created": existing_metadata.get("created", datetime.now().isoformat()),
            "updated": datetime.now().isoformat(),
            "status": status,
            "author": existing_metadata.get("author", current_user.username),
            "last_editor": current_user.username,
            "version": version,
            "comments": existing_metadata.get("comments", []),
            "thumbnail": thumbnail_base64 or existing_metadata.get("thumbnail"),
            "category": category_path # Store original category path
        }

        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        trigger_backup()
        return jsonify({
            "success": True,
            "message": f"Model saved to {category_path}:{model_identifier}",
            "item_definition": str(item_def_path.relative_to(branch_path)),
            "status": status
        })

    except Exception as e:
        logging.error(f"Upload failed: {e}")
        return jsonify({"error": f"Error processing model: {str(e)}"}), 500


@app.route('/api/model/<branch_name>/<path:namespace>/<model_identifier>', methods=['POST'])
@login_required
def update_model(branch_name, namespace, model_identifier):
    # namespace here is the category path e.g. "cosmetics/hats"
    new_category_path = request.form.get('namespace')
    new_model_name = request.form.get('modelName')
    new_model_identifier = request.form.get('modelIdentifier')

    if not new_category_path or not new_model_name or not new_model_identifier:
        return jsonify({"error": "All fields required"}), 400

    new_category_path = new_category_path.replace(" ", "_").lower()
    new_model_identifier = new_model_identifier.replace(" ", "_").lower()

    branch_path = _get_branch_path(branch_name)
    
    # Resolve old paths
    old_models_dir, old_ns, old_sub = resolve_model_path(branch_path, namespace, model_identifier)
    
    old_base = branch_path / "assets" / old_ns
    old_textures_dir = old_base / "textures" / "item"
    if old_sub: old_textures_dir = old_textures_dir / old_sub
    old_textures_dir = old_textures_dir / model_identifier
    
    old_item_def = old_base / "items"
    if old_sub: old_item_def = old_item_def / old_sub
    old_item_def = old_item_def / f"{model_identifier}.json"

    # Construct new paths (always flattened)
    new_ns, _ = parse_category_flattened(new_category_path)
    new_sub = ""
    
    new_base = branch_path / "assets" / new_ns
    new_models_dir = new_base / "models" / "item"
    if new_sub: new_models_dir = new_models_dir / new_sub
    new_models_dir = new_models_dir / new_model_identifier
    
    new_textures_dir = new_base / "textures" / "item"
    if new_sub: new_textures_dir = new_textures_dir / new_sub
    new_textures_dir = new_textures_dir / new_model_identifier
    
    new_item_def = new_base / "items"
    if new_sub: new_item_def = new_item_def / new_sub
    new_item_def = new_item_def / f"{new_model_identifier}.json"

    # Move files if paths changed
    if str(old_models_dir) != str(new_models_dir):
        if not old_models_dir.exists():
            return jsonify({"error": "Original model not found"}), 404

        new_models_dir.parent.mkdir(parents=True, exist_ok=True)
        new_textures_dir.parent.mkdir(parents=True, exist_ok=True)
        new_item_def.parent.mkdir(parents=True, exist_ok=True)

        # Move model dir
        if new_models_dir.exists():
             shutil.rmtree(new_models_dir)
        temp_dir = TEMP_DIR / uuid.uuid4().hex
        shutil.move(str(old_models_dir), temp_dir)
        shutil.move(temp_dir, new_models_dir)

        # Move textures dir
        if old_textures_dir.exists():
            if new_textures_dir.exists():
                shutil.rmtree(new_textures_dir)
            temp_tex_dir = TEMP_DIR / uuid.uuid4().hex
            shutil.move(str(old_textures_dir), temp_tex_dir)
            shutil.move(temp_tex_dir, new_textures_dir)

        # Remove old item def (will be recreated)
        if old_item_def.exists():
            old_item_def.unlink()

        # Cleanup empty old dirs
        def cleanup(path, root):
            try:
                while path != root and path.exists():
                    if not any(path.iterdir()):
                        path.rmdir()
                        path = path.parent
                    else:
                        break
            except OSError:
                pass
        
        cleanup(old_models_dir.parent, branch_path / "assets")
        cleanup(old_textures_dir.parent, branch_path / "assets")
        cleanup(old_item_def.parent, branch_path / "assets")

    # Handle file updates (renaming inside files handled by upload_model logic mostly, but we need to rename files if identifier changed)
    if new_model_identifier != model_identifier:
        # Rename .json and .bbmodel inside new_models_dir
        for f in new_models_dir.glob("*"):
            if f.name == "metadata.json": continue
            if f.stem == model_identifier:
                f.rename(f.with_name(f.name.replace(model_identifier, new_model_identifier)))
                
    # Call upload_model to process updates and regenerate metadata/item def
    return upload_model(branch_name)


@app.route('/api/model/<branch_name>/<path:namespace>/<model_identifier>', methods=['GET'])
@login_required
def get_model(branch_name, namespace, model_identifier):
    branch_path = _get_branch_path(branch_name)
    
    models_dir, _, _ = resolve_model_path(branch_path, namespace, model_identifier)

    if not models_dir.exists():
        return jsonify({"error": "Model not found"}), 404

    json_files = list(models_dir.glob("*.json"))
    bbmodel_files = list(models_dir.glob("*.bbmodel"))

    model_files = [f for f in json_files if f.name != "metadata.json"]

    if not model_files:
        return jsonify({"error": "Model JSON not found"}), 404

    model_file = model_files[0]

    with open(model_file, 'r') as f:
        model_data = json.load(f)

    bbmodel_data = None
    if bbmodel_files:
        try:
            with open(bbmodel_files[0], 'r') as f:
                bbmodel_data = json.load(f)
        except Exception as e:
            logging.error(f"Error reading bbmodel file: {e}")

    metadata = {}
    metadata_file = models_dir / "metadata.json"
    if metadata_file.exists():
        try:
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
        except Exception as e:
            logging.error(f"Error reading metadata file: {e}")

    model_name = metadata.get('model_name', model_file.stem)

    return jsonify({
        "minecraft_model": model_data,
        "bbmodel": bbmodel_data,
        "namespace": namespace,
        "model_identifier": model_identifier,
        "name": model_name,
        "metadata": metadata
    })


@app.route('/api/model/<branch_name>/<path:namespace>/<model_identifier>/approve', methods=['POST'])
@login_required
def approve_model(branch_name, namespace, model_identifier):
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    branch_path = _get_branch_path(branch_name)
    models_dir, _, _ = resolve_model_path(branch_path, namespace, model_identifier)
    
    metadata_path = models_dir / "metadata.json"

    if not metadata_path.exists():
        return jsonify({"error": "Model not found"}), 404

    try:
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        metadata["status"] = "approved"

        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        trigger_backup()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/model/<branch_name>/<path:namespace>/<model_identifier>/comment', methods=['POST'])
@login_required
def add_comment(branch_name, namespace, model_identifier):
    data = request.json
    text = data.get('text')

    if not text:
        return jsonify({"error": "Comment text required"}), 400

    branch_path = _get_branch_path(branch_name)
    models_dir, _, _ = resolve_model_path(branch_path, namespace, model_identifier)
    
    metadata_path = models_dir / "metadata.json"

    if not metadata_path.exists():
        return jsonify({"error": "Model not found"}), 404

    try:
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        comments = metadata.get("comments", [])
        comments.append({
            "user": current_user.username,
            "text": text,
            "timestamp": datetime.now().isoformat()
        })
        metadata["comments"] = comments

        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        trigger_backup()
        return jsonify({"success": True, "comments": comments})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/model/<branch_name>/<path:namespace>/<model_identifier>', methods=['DELETE'])
@login_required
def delete_model(branch_name, namespace, model_identifier):
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    branch_path = _get_branch_path(branch_name)
    
    # Resolve paths
    models_dir, real_ns, subpath = resolve_model_path(branch_path, namespace, model_identifier)
    
    base_assets = branch_path / "assets" / real_ns
    
    textures_dir = base_assets / "textures" / "item"
    if subpath: textures_dir = textures_dir / subpath
    textures_dir = textures_dir / model_identifier
    
    item_def = base_assets / "items"
    if subpath: item_def = item_def / subpath
    item_def = item_def / f"{model_identifier}.json"

    if models_dir.exists():
        shutil.rmtree(models_dir)

    if textures_dir.exists():
        shutil.rmtree(textures_dir)

    if item_def.exists():
        item_def.unlink()

    def cleanup_empty_dirs(path, root):
        try:
            while path != root and path.exists():
                if not any(path.iterdir()):
                    path.rmdir()
                    path = path.parent
                else:
                    break
        except OSError:
            pass

    cleanup_empty_dirs(models_dir.parent, branch_path / "assets")
    cleanup_empty_dirs(textures_dir.parent, branch_path / "assets")
    cleanup_empty_dirs(item_def.parent, branch_path / "assets")
    
    trigger_backup()
    return jsonify({"success": True, "message": "Model deleted"})


@app.route('/api/download/bbmodel/<branch_name>/<path:namespace>/<model_identifier>', methods=['GET'])
@login_required
def download_bbmodel(branch_name, namespace, model_identifier):
    branch_path = _get_branch_path(branch_name)
    models_dir, _, _ = resolve_model_path(branch_path, namespace, model_identifier)
    
    model_base_name = Path(model_identifier).name

    bbmodel_files = list(models_dir.glob(f"{model_base_name}.bbmodel"))
    if not bbmodel_files:
        return jsonify({"error": "BBModel file not found"}), 404

    return send_file(
        bbmodel_files[0],
        as_attachment=True,
        download_name=f"{model_base_name}.bbmodel",
        max_age=0
    )


def get_review_models(branch_path_to_review):
    review_models = []
    assets_path = branch_path_to_review / "assets"
    if assets_path.exists():
        # scan recursively for metadata.json
        for metadata_file in assets_path.glob("**/metadata.json"):
            try:
                with open(metadata_file, 'r') as f:
                    meta = json.load(f)
                    if meta.get('status') == 'review':
                        # Reconstruct category path
                        model_dir = metadata_file.parent
                        rel_path = model_dir.relative_to(assets_path)
                        parts = rel_path.parts
                        if len(parts) >= 4:
                            namespace = parts[0]
                            subpath_parts = parts[3:-1]
                            model_identifier = parts[-1]
                            subpath = "/".join(subpath_parts)
                            category = f"{namespace}/{subpath}" if subpath else namespace
                            
                            review_models.append({
                                'namespace': category,
                                'identifier': model_identifier
                            })
            except Exception as e:
                logging.error(f"Error reading metadata file: {e}")
    return review_models


@app.route('/api/download/pack/<branch_name>', methods=['GET'])
@login_required
def download_pack(branch_name):
    branch_path = _get_branch_path(branch_name)
    pack_meta = branch_path / "pack.mcmeta"
    if not pack_meta.exists():
        meta_data = {
            "pack": {
                "pack_format": 69,
                "description": "IngeniaMC Resource Pack - 1.21.10+"
            }
        }
        with open(pack_meta, 'w') as f:
            json.dump(meta_data, f, indent=2)

    review_models = get_review_models(branch_path)
    excluded_paths = set()
    for m in review_models:
        cat = m['namespace']
        mid = m['identifier']
        
        # We need to resolve the path to exclude it correctly
        # But here we are iterating files in zip.
        # We can just resolve the path and get relative path string
        
        models_dir, real_ns, sub = resolve_model_path(branch_path, cat, mid)
        
        # assets/<ns>/models/item/<sub>/<mid>
        base = f"assets/{real_ns}"
        sub_str = f"/{sub}" if sub else ""
        
        excluded_paths.add(f"{base}/models/item{sub_str}/{mid}")
        excluded_paths.add(f"{base}/textures/item{sub_str}/{mid}")
        excluded_paths.add(f"{base}/items{sub_str}/{mid}.json")

    zip_path = TEMP_DIR / f"resourcepack_{branch_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(branch_path):
            for file in files:
                if not file.endswith('.bbmodel') and file != 'metadata.json':
                    file_path = Path(root) / file
                    rel_path = file_path.relative_to(branch_path)
                    rel_path_str = str(rel_path).replace('\\', '/')

                    is_excluded = False
                    for excluded in excluded_paths:
                        if rel_path_str.startswith(excluded):
                            is_excluded = True
                            break

                    if not is_excluded:
                        zipf.write(file_path, rel_path)

    return send_file(
        zip_path,
        as_attachment=True,
        download_name=f"ingeniamc_resourcepack_{branch_name}.zip",
        max_age=0
    )


@app.route('/api/compare', methods=['POST'])
@login_required
def compare_branches():
    data = request.json
    source = data.get('source')
    target = data.get('target')

    if not source or not target:
        return jsonify({"error": "Source and target branches required"}), 400

    source_path = _get_branch_path(source)
    target_path = _get_branch_path(target)

    if not source_path.exists():
        return jsonify({"error": f"Source branch '{source}' not found"}), 404
    if not target_path.exists():
        return jsonify({"error": f"Target branch '{target}' not found"}), 404

    source_files = {}
    for root, _, files in os.walk(source_path):
        for file in files:
            abs_path = Path(root) / file
            rel_path = str(abs_path.relative_to(source_path)).replace('\\', '/')
            source_files[rel_path] = abs_path

    target_files = {}
    for root, _, files in os.walk(target_path):
        for file in files:
            abs_path = Path(root) / file
            rel_path = str(abs_path.relative_to(target_path)).replace('\\', '/')
            target_files[rel_path] = abs_path

    differences = []

    for rel_path, src_abs_path in source_files.items():
        if rel_path not in target_files:
            differences.append({"path": rel_path, "status": "added"})
        else:
            tgt_abs_path = target_files[rel_path]
            if calculate_file_hash(src_abs_path) != calculate_file_hash(tgt_abs_path):
                differences.append({"path": rel_path, "status": "modified"})

    for rel_path in target_files:
        if rel_path not in source_files:
            differences.append({"path": rel_path, "status": "deleted"})

    return jsonify({"differences": differences})


@app.route('/api/compare/file', methods=['POST'])
@login_required
def compare_file_content():
    data = request.json
    source = data.get('source')
    target = data.get('target')
    path = data.get('path')

    if not source or not target or not path:
        return jsonify({"error": "Source, target and path required"}), 400

    source_path = _get_branch_path(source) / path
    target_path = _get_branch_path(target) / path

    source_content = ""
    target_content = ""

    try:
        if source_path.exists():
            try:
                with open(source_path, 'r', encoding='utf-8') as f:
                    source_content = f.read()
            except UnicodeDecodeError:
                source_content = "(Binary file)"

        if target_path.exists():
            try:
                with open(target_path, 'r', encoding='utf-8') as f:
                    target_content = f.read()
            except UnicodeDecodeError:
                target_content = "(Binary file)"

        diff = list(difflib.unified_diff(
            target_content.splitlines(),
            source_content.splitlines(),
            fromfile=f'{target}/{path}',
            tofile=f'{source}/{path}',
            lineterm=''
        ))

        return jsonify({
            "diff": diff,
            "sourceContent": source_content,
            "targetContent": target_content,
            "isBinary": source_content == "(Binary file)" or target_content == "(Binary file)"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/merge', methods=['POST'])
@login_required
def merge_branches():
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json
    source = data.get('source')
    target = data.get('target')
    operations = data.get('operations')

    if not source or not target:
        return jsonify({"error": "Source and target branches required"}), 400

    if source == target:
        return jsonify({"error": "Cannot merge branch to itself"}), 400

    source_path = _get_branch_path(source)
    target_path = _get_branch_path(target)

    if not source_path.exists():
        return jsonify({"error": f"Source branch '{source}' not found"}), 404

    try:
        if operations is None:
            if target_path.exists():
                shutil.rmtree(target_path)
            shutil.copytree(source_path, target_path)
            trigger_backup()
            return jsonify({
                "success": True,
                "message": f"Merged {source} → {target} (Full Overwrite)",
                "timestamp": datetime.now().isoformat()
            })

        success_count = 0
        error_count = 0

        for op in operations:
            path = op.get('path')
            action = op.get('action')

            if not path or not action:
                continue

            src_file = source_path / path
            tgt_file = target_path / path

            try:
                if action == 'copy':
                    if src_file.exists():
                        tgt_file.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(src_file, tgt_file)
                        success_count += 1
                elif action == 'delete':
                    if tgt_file.exists():
                        tgt_file.unlink()
                        parent = tgt_file.parent
                        while parent != target_path:
                            if not any(parent.iterdir()):
                                parent.rmdir()
                                parent = parent.parent
                            else:
                                break
                        success_count += 1
            except Exception as e:
                print(f"Error processing {path}: {e}")
                error_count += 1
        
        if success_count > 0:
            trigger_backup()

        return jsonify({
            "success": True,
            "message": f"Processed {success_count} operations ({error_count} errors)",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({"error": f"Merge failed: {str(e)}"}), 500


@app.route('/api/tags', methods=['GET', 'OPTIONS'])
@login_required
def list_tags():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    config = load_config()
    return jsonify({"tags": config.get("tags", [])})


# Categories (namespaces) managed via config + filesystem discovery
@app.route('/api/categories', methods=['GET'])
@login_required
def list_categories():
    """
    Return configured categories combined with discovered namespaces from branches/assets.
    Response shape: { "categories": [...] }
    """
    config = load_config()
    categories = set(config.get("categories", []) or [])

    # discover namespaces from filesystem (preserve existing behavior)
    for branch_dir in BRANCHES_DIR.iterdir():
        if branch_dir.is_dir():
            assets_path = branch_dir / "assets"
            if assets_path.exists():
                for metadata_file in assets_path.glob("**/metadata.json"):
                    try:
                        # Reconstruct category path
                        model_dir = metadata_file.parent
                        rel_path = model_dir.relative_to(assets_path)
                        parts = rel_path.parts
                        if len(parts) >= 4:
                            namespace = parts[0]
                            subpath_parts = parts[3:-1]
                            subpath = "/".join(subpath_parts)
                            category = f"{namespace}/{subpath}" if subpath else namespace
                            
                            # Check metadata for category override
                            with open(metadata_file, 'r') as f:
                                meta = json.load(f)
                                if 'category' in meta:
                                    category = meta['category']
                                    
                            categories.add(category)
                    except Exception:
                        continue

    return jsonify({"categories": sorted(list(categories))})


@app.route('/api/categories', methods=['POST'])
@login_required
def create_category():
    """
    Add a category (admin only). Expects JSON { "category": "<name>" }.
    Returns the new categories list.
    """
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    category = data.get('category') or data.get('name')
    if not category:
        return jsonify({"error": "Category required"}), 400

    cat = category.strip().replace(" ", "_").lower()
    cat = cat.replace("//", "/").strip("/")
    if not re.match(r'^[a-z0-9._\-\/]+$', cat):
        return jsonify({"error": "Invalid category name"}), 400

    config = load_config()
    cats = config.get("categories", []) or []
    if cat in cats:
        return jsonify({"error": "Category already exists"}), 400

    cats.append(cat)
    config["categories"] = sorted(list(set(cats)))
    save_config(config)

    return jsonify({"success": True, "categories": config["categories"]})


@app.route('/api/categories', methods=['DELETE'])
@login_required
def delete_category():
    """
    Delete a configured category (admin only). Expects JSON { "category": "<name>" }.
    Note: this does not remove files on disk; it only removes the entry from config.
    """
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    category = data.get('category') or data.get('name')
    if not category:
        return jsonify({"error": "Category required"}), 400

    cat = category.strip().replace(" ", "_").lower()
    cat = cat.replace("//", "/").strip("/")

    config = load_config()
    cats = config.get("categories", []) or []
    if cat not in cats:
        return jsonify({"error": "Category not found"}), 404

    cats = [c for c in cats if c != cat]
    config["categories"] = cats
    save_config(config)

    return jsonify({"success": True, "categories": config["categories"]})


@app.route('/api/tags', methods=['POST', 'OPTIONS'])
@login_required
def create_tag():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    tag_data = request.get_json()

    if not tag_data:
        return jsonify({"error": "Tag data required"}), 400

    tag = tag_data.get("tag")
    color = tag_data.get("color")
    group = tag_data.get("group")

    if not tag or not color:
        return jsonify({"error": "tag and color are required"}), 400

    config = load_config()
    tags = config.get("tags", [])

    tag_id = tag_data.get("id") or tag.lower().replace(" ", "-")

    exists = False
    for t in tags:
        if isinstance(t, dict):
            if t.get("id") == tag_id:
                exists = True
                break
            if t.get("tag", "").lower() == tag.lower():
                exists = True
                break

    if exists:
        return jsonify({"error": "Tag already exists"}), 400

    new_tag = {
        "id": tag_id,
        "tag": tag,
        "color": color,
        "group": group
    }

    tags.append(new_tag)
    config["tags"] = tags
    save_config(config)

    return jsonify({"success": True, "tags": tags})


@app.route('/api/tags', methods=['DELETE', 'OPTIONS'])
@login_required
def delete_tag():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    tag_data = request.json
    if not tag_data or 'id' not in tag_data:
        return jsonify({"error": "Tag ID is required"}), 400

    tag_id_to_delete = tag_data['id']

    config = load_config()
    tags = config.get("tags", [])
    initial_count = len(tags)

    tags = [t for t in tags if not (isinstance(t, dict) and t.get('id') == tag_id_to_delete)]

    if len(tags) == initial_count:
        return jsonify({"error": "Tag not found"}), 404

    config["tags"] = tags
    save_config(config)

    for branch_dir in BRANCHES_DIR.iterdir():
        if not branch_dir.is_dir():
            continue

        assets_path = branch_dir / "assets"
        if not assets_path.exists():
            continue

        for metadata_file in assets_path.glob("**/metadata.json"):
            try:
                with open(metadata_file, 'r+') as f:
                    metadata = json.load(f)

                    if 'tags' in metadata and isinstance(metadata['tags'], list):
                        original_tags = len(metadata['tags'])
                        metadata['tags'] = [t for t in metadata['tags'] if t != tag_id_to_delete]

                        if len(metadata['tags']) < original_tags:
                            f.seek(0)
                            json.dump(metadata, f, indent=2)
                            f.truncate()
            except (IOError, json.JSONDecodeError) as e:
                print(f"Could not process {metadata_file}: {e}")
                continue

    return jsonify({"success": True, "message": "Tag deleted and references removed", "tags": tags})


@app.route('/api/tags/<tag_id>', methods=['PUT', 'OPTIONS'])
@login_required
def update_tag(tag_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    tag_data = request.get_json()

    if not tag_data:
        return jsonify({"error": "Tag data required"}), 400

    new_tag_name = tag_data.get("tag")
    new_tag_color = tag_data.get("color")
    new_tag_group = tag_data.get("group")

    if not new_tag_name or not new_tag_color:
        return jsonify({"error": "Tag name and color are required"}), 400

    config = load_config()
    tags = config.get("tags", [])

    updated = False
    for i, t in enumerate(tags):
        if isinstance(t, dict) and t.get("id") == tag_id:
            # Check if new tag name already exists for a different tag
            for other_tag in tags:
                if other_tag.get("id") != tag_id and other_tag.get("tag", "").lower() == new_tag_name.lower():
                    return jsonify({"error": "Tag name already exists for another tag"}), 400

            tags[i]["tag"] = new_tag_name
            tags[i]["color"] = new_tag_color
            tags[i]["group"] = new_tag_group if new_tag_group else None
            updated = True
            break

    if not updated:
        return jsonify({"error": "Tag not found"}), 404

    config["tags"] = tags
    save_config(config)

    return jsonify({"success": True, "message": "Tag updated successfully", "tags": tags})


@app.route('/api/tag-groups/<old_group_name>', methods=['PUT', 'OPTIONS'])
@login_required
def rename_tag_group(old_group_name):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json()
    new_group_name = data.get('new_group_name')

    if not new_group_name:
        return jsonify({"error": "New group name required"}), 400

    config = load_config()
    tags = config.get("tags", [])

    updated_count = 0
    for tag in tags:
        if isinstance(tag, dict) and tag.get("group") == old_group_name:
            tag["group"] = new_group_name
            updated_count += 1

    if updated_count == 0:
        return jsonify({"error": "No tags found with that group name"}), 404

    config["tags"] = tags
    save_config(config)

    # Return the updated list of tags to allow frontend to refresh its state
    return jsonify({"success": True, "message": f"{updated_count} tags updated. Group '{old_group_name}' renamed to '{new_group_name}'", "tags": tags})


# Branding endpoints
def get_png_size(data: bytes):
    """
    Read PNG image bytes and return (width, height) without external deps.
    Returns None on invalid PNG.
    """
    try:
        if data[:8] != b'\x89PNG\r\n\x1a\n':
            return None
        # IHDR chunk begins at offset 8: 4 bytes length, 4 bytes 'IHDR', then width(4) height(4)
        # width at bytes 16:20, height at 20:24
        width = int.from_bytes(data[16:20], 'big')
        height = int.from_bytes(data[20:24], 'big')
        return width, height
    except Exception:
        return None


@app.route('/api/branding', methods=['GET'])
def get_branding():
    config = load_config()
    branding = config.get("branding", {})
    brand = branding.get("brand", BRAND_DEFAULT)
    name = branding.get("name", "")
    icon_exists = BRAND_ICON_PATH.exists()
    icon_url = f"/api/branding/icon" if icon_exists else None
    return jsonify({"brand": brand, "name": name, "icon": bool(icon_exists), "icon_url": icon_url})


@app.route('/api/branding/color', methods=['POST'])
@login_required
def set_brand_color():
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    brand = data.get('brand')
    if not brand:
        return jsonify({"error": "Brand color required"}), 400

    config = load_config()
    config['branding'] = config.get('branding', {})
    config['branding']['brand'] = brand
    save_config(config)

    return jsonify({"success": True, "brand": brand})


@app.route('/api/branding/name', methods=['POST'])
@login_required
def set_brand_name():
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    name = data.get('name')
    if name is None:
        return jsonify({"error": "Brand name required"}), 400

    config = load_config()
    config['branding'] = config.get('branding', {})
    config['branding']['name'] = name
    save_config(config)

    return jsonify({"success": True, "name": name})


@app.route('/api/branding/icon', methods=['POST'])
@login_required
def upload_brand_icon():
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    icon_file = request.files.get('icon')
    if not icon_file:
        return jsonify({"error": "Icon file required"}), 400

    try:
        data = icon_file.read()
        size = get_png_size(data)
        if not size:
            return jsonify({"error": "Invalid PNG file"}), 400
        w, h = size
        if w != 256 or h != 256:
            return jsonify({"error": "Icon must be 256x256 PNG"}), 400

        with open(BRAND_ICON_PATH, 'wb') as f:
            f.write(data)

        return jsonify({"success": True})
    except Exception as e:
        logging.error(f"Failed to save branding icon: {e}")
        return jsonify({"error": "Failed to save icon"}), 500


@app.route('/api/branding/icon', methods=['GET'])
def get_brand_icon():
    if not BRAND_ICON_PATH.exists():
        return jsonify({"error": "Icon not found"}), 404
    return send_file(BRAND_ICON_PATH, mimetype='image/png')


@app.route('/api/texture/<branch_name>/<path:namespace>/<model_identifier>/<path:texture_path>', methods=['GET'])
@login_required
def get_texture(branch_name, namespace, model_identifier, texture_path):
    branch_path = _get_branch_path(branch_name)
    
    # Resolve paths
    _, real_ns, subpath = resolve_model_path(branch_path, namespace, model_identifier)
    
    textures_dir = branch_path / "assets" / real_ns / "textures" / "item"
    if subpath: textures_dir = textures_dir / subpath
    textures_dir = textures_dir / model_identifier

    safe_path = os.path.normpath(texture_path)
    if safe_path.startswith('..') or safe_path.startswith('/'):
        return jsonify({"error": "Invalid path"}), 400

    file_path = textures_dir / safe_path

    if not file_path.exists() and not file_path.suffix:
        file_path = file_path.with_suffix('.png')

    if not file_path.exists():
        return jsonify({"error": "Texture not found"}), 404

    return send_file(file_path)


@app.route('/api/thumbnail/<branch_name>/<path:namespace>/<model_identifier>.png', methods=['GET'])
@login_required
def get_thumbnail(branch_name, namespace, model_identifier):
    branch_path = _get_branch_path(branch_name)
    models_dir, _, _ = resolve_model_path(branch_path, namespace, model_identifier)

    metadata_path = models_dir / "metadata.json"
    
    if metadata_path.exists():
        try:
            with open(metadata_path, 'r') as f:
                meta = json.load(f)
                if meta.get("thumbnail"):
                    # data:image/png;base64,....
                    parts = meta["thumbnail"].split(",", 1)
                    if len(parts) == 2:
                        data = base64.b64decode(parts[1])
                        return send_file(io.BytesIO(data), mimetype='image/png')
        except Exception as e:
            logging.error(f"Error reading thumbnail from metadata: {e}")
        
    return jsonify({"error": "Thumbnail not found"}), 404


@app.route('/api/files', methods=['GET'])
@login_required
def list_files_in_branch():
    branch_name = request.args.get('branch')
    if not branch_name:
        return jsonify({"error": "Branch required"}), 400

    branch_path = _get_branch_path(branch_name)
    if not branch_path.exists():
        return jsonify({"error": "Branch not found"}), 404

    files = []
    for root, dirs, filenames in os.walk(branch_path):
        for filename in filenames:
            file_path = Path(root) / filename
            rel_path = file_path.relative_to(branch_path)
            files.append(str(rel_path).replace('\\', '/'))
        
        for dirname in dirs:
            dir_path = Path(root) / dirname
            rel_path = dir_path.relative_to(branch_path)
            files.append(str(rel_path).replace('\\', '/') + "/")

    return jsonify({"files": sorted(files)})


@app.route('/api/files/content', methods=['GET'])
@login_required
def get_file_content():
    branch_name = request.args.get('branch')
    path = request.args.get('path')

    if not branch_name or not path:
        return jsonify({"error": "Branch and path required"}), 400

    branch_path = _get_branch_path(branch_name)
    file_path = branch_path / path

    try:
        file_path.relative_to(branch_path)
    except ValueError:
        return jsonify({"error": "Invalid path"}), 400

    if not file_path.exists():
        return jsonify({"error": "File not found"}), 404

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({"content": content})
    except UnicodeDecodeError:
        return jsonify({"error": "Cannot read binary file"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/files/save', methods=['POST'])
@login_required
def save_file_content():
    data = request.json
    branch_name = data.get('branch')
    path = data.get('path')
    content = data.get('content')

    if not branch_name or not path or content is None:
        return jsonify({"error": "Branch, path and content required"}), 400

    branch_path = _get_branch_path(branch_name)
    file_path = branch_path / path

    try:
        file_path.relative_to(branch_path)
    except ValueError:
        return jsonify({"error": "Invalid path"}), 400

    if not file_path.exists():
        file_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        trigger_backup()
        return jsonify({"success": True, "message": "File saved"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/files/create', methods=['POST'])
@login_required
def create_file_or_folder():
    data = request.json
    branch_name = data.get('branch')
    path = data.get('path')
    is_folder = data.get('isFolder', False)

    if not branch_name or not path:
        return jsonify({"error": "Branch and path required"}), 400

    branch_path = _get_branch_path(branch_name)
    target_path = branch_path / path

    try:
        target_path.relative_to(branch_path)
    except ValueError:
        return jsonify({"error": "Invalid path"}), 400

    if target_path.exists():
        return jsonify({"error": "File or folder already exists"}), 400

    try:
        if is_folder:
            target_path.mkdir(parents=True, exist_ok=True)
        else:
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.touch()
        
        trigger_backup()
        return jsonify({"success": True, "message": f"{'Folder' if is_folder else 'File'} created"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/files/delete', methods=['POST'])
@login_required
def delete_file_or_folder():
    data = request.json
    branch_name = data.get('branch')
    path = data.get('path')

    if not branch_name or not path:
        return jsonify({"error": "Branch and path required"}), 400

    branch_path = _get_branch_path(branch_name)
    target_path = branch_path / path

    try:
        target_path.relative_to(branch_path)
    except ValueError:
        return jsonify({"error": "Invalid path"}), 400

    if not target_path.exists():
        return jsonify({"error": "File or folder not found"}), 404

    try:
        if target_path.is_dir():
            shutil.rmtree(target_path)
        else:
            target_path.unlink()
        
        trigger_backup()
        return jsonify({"success": True, "message": "Deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/files/upload', methods=['POST'])
@login_required
def upload_file():
    branch_name = request.form.get('branch')
    path = request.form.get('path')
    file = request.files.get('file')

    if not branch_name or not path or not file:
        return jsonify({"error": "Branch, path and file required"}), 400

    branch_path = _get_branch_path(branch_name)
    target_path = branch_path / path / file.filename

    try:
        target_path.relative_to(branch_path)
    except ValueError:
        return jsonify({"error": "Invalid path"}), 400

    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        file.save(target_path)
        trigger_backup()
        return jsonify({"success": True, "message": "File uploaded"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/files/rename', methods=['POST'])
@login_required
def rename_file():
    data = request.json
    branch_name = data.get('branch')
    old_path = data.get('oldPath')
    new_path = data.get('newPath')

    if not branch_name or not old_path or not new_path:
        return jsonify({"error": "Branch, oldPath and newPath required"}), 400

    branch_path = _get_branch_path(branch_name)
    old_file_path = branch_path / old_path
    new_file_path = branch_path / new_path

    try:
        old_file_path.relative_to(branch_path)
        new_file_path.relative_to(branch_path)
    except ValueError:
        return jsonify({"error": "Invalid path"}), 400

    if not old_file_path.exists():
        return jsonify({"error": "File not found"}), 404

    if new_file_path.exists():
        return jsonify({"error": "Destination already exists"}), 400

    try:
        new_file_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(old_file_path), str(new_file_path))
        trigger_backup()
        return jsonify({"success": True, "message": "Renamed successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# GitHub Backup Routes
@app.route('/api/github/settings', methods=['GET'])
@login_required
def get_github_settings():
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    settings = load_github_settings()
    # Never send the token to the frontend
    settings['token'] = 'PATISCURRENTLYSET' if settings.get('token') else ''
    return jsonify(settings)

@app.route('/api/github/settings', methods=['POST'])
@login_required
def set_github_settings():
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    
    new_settings = request.json
    current_settings = load_github_settings()

    # Only update the token if a new one is provided and it's not the placeholder
    if 'token' in new_settings and new_settings['token'] and new_settings['token'] != 'PATISCURRENTLYSET':
        current_settings['token'] = new_settings['token']
    
    current_settings['repoUrl'] = new_settings.get('repoUrl', '')
    current_settings['enabled'] = new_settings.get('enabled', False)

    save_github_settings(current_settings)
    trigger_backup()
    return jsonify({"success": True, "message": "Settings saved."})


if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'True') == 'true'
    extra_dirs = [str(d) for d in [BRANCHES_DIR, BRANDING_DIR] if d.exists()]
    extra_files = extra_dirs + [str(f) for f in [CONFIG_FILE, USERS_FILE, SERVERS_FILE] if f.exists()]
    app.run(host=host, debug=debug, port=port, use_reloader=debug, extra_files=extra_files)
