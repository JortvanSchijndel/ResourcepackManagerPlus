from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import os
import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
import base64
import yaml
import hashlib
import difflib
import requests
import uuid
import logging
import io
from dotenv import load_dotenv

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

# Ensure directories exist
BRANCHES_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

for branch in ["dev", "prod"]:
    initial_branch_path = BRANCHES_DIR / branch
    initial_branch_path.mkdir(parents=True, exist_ok=True)

# Login Manager Setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'


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

    data = request.json
    role = data.get('role')

    if role not in ['admin', 'normal']:
        return jsonify({"error": "Invalid role"}), 400

    users_data = load_users()
    users = users_data.get("users", [])

    updated = False
    for u in users:
        if u["id"] == user_id:
            u["role"] = role
            updated = True
            break

    if updated:
        save_users(users_data)
        return jsonify({"success": True})

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
        return {"tags": []}
    with open(CONFIG_FILE, 'r') as f:
        return yaml.safe_load(f) or {"tags": []}


def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
        yaml.dump(config, f)


def calculate_file_hash(file_path):
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def create_item_definition(item_def_path, model_path, has_tints=False):
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
        return jsonify({"success": True, "message": f"Branch '{branch_name}' deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/namespaces', methods=['GET'])
@login_required
def list_namespaces():
    namespaces = set()

    for branch_dir in BRANCHES_DIR.iterdir():
        if branch_dir.is_dir():
            assets_path = branch_dir / "assets"
            if assets_path.exists():
                for namespace_dir in assets_path.iterdir():
                    if namespace_dir.is_dir():
                        namespaces.add(namespace_dir.name)

    return jsonify({"namespaces": sorted(list(namespaces))})


@app.route('/api/models/<branch_name>', methods=['GET'])
@login_required
def list_models(branch_name):
    branch_path = _get_branch_path(branch_name)
    assets_path = branch_path / "assets"

    models = []
    if assets_path.exists():
        for namespace_dir in assets_path.iterdir():
            if not namespace_dir.is_dir():
                continue

            namespace = namespace_dir.name
            models_path = namespace_dir / "models" / "item"

            if models_path.exists():
                for model_identifier_dir in models_path.iterdir():
                    if not model_identifier_dir.is_dir():
                        continue

                    model_identifier = model_identifier_dir.name
                    json_files = list(model_identifier_dir.glob("*.json"))
                    bbmodel_files = list(model_identifier_dir.glob("*.bbmodel"))

                    if json_files:
                        model_files = [f for f in json_files if f.name != "metadata.json"]
                        if not model_files:
                            continue

                        model_file = model_files[0]
                        model_name = model_file.stem
                        metadata_file = model_identifier_dir / "metadata.json"
                        tags = []
                        status = "approved"
                        author = "unknown"
                        version = 1

                        if metadata_file.exists():
                            try:
                                with open(metadata_file, 'r') as f:
                                    metadata = json.load(f)
                                    tags = metadata.get('tags', [])
                                    status = metadata.get('status', 'approved')
                                    author = metadata.get('author', 'unknown')
                                    version = metadata.get('version', 1)
                                    if 'model_name' in metadata:
                                        model_name = metadata['model_name']
                            except Exception as e:
                                logging.error(f"Error reading metadata file: {e}")

                        models.append({
                            "name": model_name,
                            "namespace": namespace,
                            "model_identifier": model_identifier,
                            "path": str(model_file.relative_to(branch_path)),
                            "has_bbmodel": len(bbmodel_files) > 0,
                            "tags": tags,
                            "status": status,
                            "author": author,
                            "version": version
                        })

    return jsonify({"models": models})


@app.route('/api/audit/<branch_name>', methods=['GET'])
@login_required
def audit_models(branch_name):
    branch_path = _get_branch_path(branch_name)
    assets_path = branch_path / "assets"
    
    issues = []
    
    if assets_path.exists():
        for namespace_dir in assets_path.iterdir():
            if not namespace_dir.is_dir():
                continue

            namespace = namespace_dir.name
            models_path = namespace_dir / "models" / "item"

            if models_path.exists():
                for model_identifier_dir in models_path.iterdir():
                    if not model_identifier_dir.is_dir():
                        continue

                    model_identifier = model_identifier_dir.name
                    
                    # Check for .bbmodel
                    bbmodel_files = list(model_identifier_dir.glob("*.bbmodel"))
                    if not bbmodel_files:
                        issues.append({
                            "namespace": namespace,
                            "model_identifier": model_identifier,
                            "issue": "Missing .bbmodel file"
                        })
                    
                    # Check metadata and thumbnail
                    metadata_file = model_identifier_dir / "metadata.json"
                    if not metadata_file.exists():
                        issues.append({
                            "namespace": namespace,
                            "model_identifier": model_identifier,
                            "issue": "Missing metadata.json"
                        })
                    else:
                        try:
                            with open(metadata_file, 'r') as f:
                                metadata = json.load(f)
                                if not metadata.get("thumbnail"):
                                    issues.append({
                                        "namespace": namespace,
                                        "model_identifier": model_identifier,
                                        "issue": "Missing thumbnail"
                                    })
                        except Exception as e:
                            issues.append({
                                "namespace": namespace,
                                "model_identifier": model_identifier,
                                "issue": f"Corrupt metadata.json: {str(e)}"
                            })
                            
    return jsonify({"issues": issues})


@app.route('/api/model/<branch_name>/<namespace>/<model_identifier>/thumbnail', methods=['POST'])
@login_required
def update_thumbnail(branch_name, namespace, model_identifier):
    thumbnail_file = request.files.get('thumbnail')
    
    if not thumbnail_file:
        return jsonify({"error": "Thumbnail file required"}), 400
        
    branch_path = _get_branch_path(branch_name)
    models_dir = branch_path / "assets" / namespace / "models" / "item" / model_identifier
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
            
        return jsonify({"success": True, "message": "Thumbnail updated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/upload/<branch_name>', methods=['POST'])
@login_required
def upload_model(branch_name):
    bbmodel_file = request.files.get('bbmodel')
    json_file = request.files.get('json')
    thumbnail_file = request.files.get('thumbnail')

    namespace = request.form.get('namespace')
    model_name = request.form.get('modelName')
    model_identifier = request.form.get('modelIdentifier')
    tags = request.form.get('tags', '[]')

    try:
        tags = json.loads(tags)
    except Exception as e:
        logging.error(f"Error loading tags: {e}")
        tags = []

    if not namespace or not model_name or not model_identifier:
        return jsonify({"error": "All fields required"}), 400

    namespace = namespace.replace(" ", "_").lower()
    model_identifier = model_identifier.replace(" ", "_").lower()

    branch_path = _get_branch_path(branch_name)
    items_dir = branch_path / "assets" / namespace / "items"
    models_dir = branch_path / "assets" / namespace / "models" / "item" / model_identifier
    textures_dir = branch_path / "assets" / namespace / "textures" / "item" / model_identifier

    items_dir.mkdir(parents=True, exist_ok=True)
    models_dir.mkdir(parents=True, exist_ok=True)
    textures_dir.mkdir(parents=True, exist_ok=True)

    try:
        if bbmodel_file:
            bbmodel_path = models_dir / f"{model_identifier}.bbmodel"
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
            model_json_path = models_dir / f"{model_identifier}.json"
            json_file.save(model_json_path)

            with open(model_json_path, 'r') as f:
                model_data = json.load(f)

            if "textures" in model_data:
                for key, value in model_data["textures"].items():
                    if isinstance(value, str) and ":" in value:
                        parts = value.split(":")
                        if len(parts) == 2:
                            tex_namespace, tex_path = parts
                            if not tex_path.startswith("item/"):
                                clean_path = tex_path.replace('\\', '/').split('/')[-1]
                                model_data["textures"][key] = f"{tex_namespace}:item/{model_identifier}/{clean_path}"
                            else:
                                model_data["textures"][key] = f"{tex_namespace}:{tex_path}"
                    elif isinstance(value, str):
                        if not value.startswith("item/"):
                            clean_value = value.replace('\\', '/').split('/')[-1]
                            model_data["textures"][key] = f"{namespace}:item/{model_identifier}/{clean_value}"

            with open(model_json_path, 'w') as f:
                json.dump(model_data, f, indent=2)

        # Process thumbnail (save to metadata as base64)
        thumbnail_base64 = None
        if thumbnail_file:
            thumbnail_data = thumbnail_file.read()
            thumbnail_base64 = f"data:image/png;base64,{base64.b64encode(thumbnail_data).decode('utf-8')}"

        model_json_path = models_dir / f"{model_identifier}.json"
        has_tints = False
        if model_json_path.exists():
            try:
                with open(model_json_path, 'r') as f:
                    if '"tintindex":' in f.read():
                        has_tints = True
            except Exception as e:
                logging.error(f"Error checking for tints: {e}")

        item_def_path = items_dir / f"{model_identifier}.json"
        model_path = f"{namespace}:item/{model_identifier}/{model_identifier}"
        create_item_definition(item_def_path, model_path, has_tints)

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
            "thumbnail": thumbnail_base64 or existing_metadata.get("thumbnail")
        }

        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        return jsonify({
            "success": True,
            "message": f"Model saved to {namespace}:{model_identifier}",
            "item_definition": str(item_def_path.relative_to(branch_path)),
            "status": status
        })

    except Exception as e:
        return jsonify({"error": f"Error processing model: {str(e)}"}), 500


@app.route('/api/model/<branch_name>/<namespace>/<model_identifier>', methods=['POST'])
@login_required
def update_model(branch_name, namespace, model_identifier):
    new_namespace = request.form.get('namespace')
    new_model_name = request.form.get('modelName')
    new_model_identifier = request.form.get('modelIdentifier')

    if not new_namespace or not new_model_name or not new_model_identifier:
        return jsonify({"error": "All fields required"}), 400

    new_namespace = new_namespace.replace(" ", "_").lower()
    new_model_identifier = new_model_identifier.replace(" ", "_").lower()

    branch_path = _get_branch_path(branch_name)
    current_models_dir = branch_path / "assets" / namespace / "models" / "item" / model_identifier
    target_models_dir = branch_path / "assets" / new_namespace / "models" / "item" / new_model_identifier
    target_textures_dir = branch_path / "assets" / new_namespace / "textures" / "item" / new_model_identifier
    target_items_dir = branch_path / "assets" / new_namespace / "items"

    if new_namespace != namespace or new_model_identifier != model_identifier:
        old_models_dir = current_models_dir
        old_textures_dir = branch_path / "assets" / namespace / "textures" / "item" / model_identifier
        old_item_def = branch_path / "assets" / namespace / "items" / f"{model_identifier}.json"

        if not old_models_dir.exists():
            return jsonify({"error": "Original model not found"}), 404

        target_models_dir.mkdir(parents=True, exist_ok=True)
        target_textures_dir.mkdir(parents=True, exist_ok=True)
        target_items_dir.mkdir(parents=True, exist_ok=True)

        for file in old_models_dir.iterdir():
            shutil.move(str(file), str(target_models_dir / file.name))

        if old_textures_dir.exists():
            for file in old_textures_dir.iterdir():
                shutil.move(str(file), str(target_textures_dir / file.name))

        if old_item_def.exists():
            old_item_def.unlink()

        if old_models_dir.exists() and not any(old_models_dir.iterdir()):
            old_models_dir.rmdir()
        if old_textures_dir.exists() and not any(old_textures_dir.iterdir()):
            old_textures_dir.rmdir()

    if target_models_dir.exists():
        existing_jsons = [f for f in target_models_dir.glob("*.json") if f.name != "metadata.json"]
        existing_bbmodels = list(target_models_dir.glob("*.bbmodel"))

        has_new_json = 'json' in request.files and request.files['json'].filename
        has_new_bbmodel = 'bbmodel' in request.files and request.files['bbmodel'].filename

        for json_file in existing_jsons:
            if json_file.stem != new_model_identifier:
                if has_new_json:
                    json_file.unlink()
                else:
                    new_path = target_models_dir / f"{new_model_identifier}.json"
                    json_file.rename(new_path)

                    if new_namespace != namespace or new_model_identifier != model_identifier:
                        try:
                            with open(new_path, 'r') as f:
                                data = json.load(f)

                            updated = False
                            if "textures" in data:
                                for key, value in data["textures"].items():
                                    if f"{namespace}:item/{model_identifier}/" in value:
                                        data["textures"][key] = value.replace(
                                            f"{namespace}:item/{model_identifier}/",
                                            f"{new_namespace}:item/{new_model_identifier}/"
                                        )
                                        updated = True

                            if updated:
                                with open(new_path, 'w') as f:
                                    json.dump(data, f, indent=2)
                        except Exception as e:
                            logging.error(f"Error updating texture paths: {e}")

        for bb_file in existing_bbmodels:
            if bb_file.stem != new_model_identifier:
                if has_new_bbmodel:
                    bb_file.unlink()
                else:
                    bb_file.rename(target_models_dir / f"{new_model_identifier}.bbmodel")

    return upload_model(branch_name)


@app.route('/api/model/<branch_name>/<namespace>/<model_identifier>', methods=['GET'])
@login_required
def get_model(branch_name, namespace, model_identifier):
    branch_path = _get_branch_path(branch_name)
    models_dir = branch_path / "assets" / namespace / "models" / "item" / model_identifier

    if not models_dir.exists():
        return jsonify({"error": "Model not found"}), 404

    json_files = list(models_dir.glob("*.json"))
    bbmodel_files = list(models_dir.glob("*.bbmodel"))

    if not json_files:
        return jsonify({"error": "Model JSON not found"}), 404

    model_files = [f for f in json_files if f.name != "metadata.json"]

    if not model_files:
        return jsonify({"error": "Model JSON not found (only metadata.json)"}), 404

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


@app.route('/api/model/<branch_name>/<namespace>/<model_identifier>/approve', methods=['POST'])
@login_required
def approve_model(branch_name, namespace, model_identifier):
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    branch_path = _get_branch_path(branch_name)
    metadata_path = branch_path / "assets" / namespace / "models" / "item" / model_identifier / "metadata.json"

    if not metadata_path.exists():
        return jsonify({"error": "Model not found"}), 404

    try:
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        metadata["status"] = "approved"

        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/model/<branch_name>/<namespace>/<model_identifier>/comment', methods=['POST'])
@login_required
def add_comment(branch_name, namespace, model_identifier):
    data = request.json
    text = data.get('text')

    if not text:
        return jsonify({"error": "Comment text required"}), 400

    branch_path = _get_branch_path(branch_name)
    metadata_path = branch_path / "assets" / namespace / "models" / "item" / model_identifier / "metadata.json"

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

        return jsonify({"success": True, "comments": comments})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/model/<branch_name>/<namespace>/<model_identifier>', methods=['DELETE'])
@login_required
def delete_model(branch_name, namespace, model_identifier):
    if current_user.role != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    branch_path = _get_branch_path(branch_name)
    assets_path = branch_path / "assets"

    models_dir = assets_path / namespace / "models" / "item" / model_identifier
    if models_dir.exists():
        shutil.rmtree(models_dir)

    textures_dir = assets_path / namespace / "textures" / "item" / model_identifier
    if textures_dir.exists():
        shutil.rmtree(textures_dir)

    item_def = assets_path / namespace / "items" / f"{model_identifier}.json"
    if item_def.exists():
        item_def.unlink()

    items_dir = assets_path / namespace / "items"
    if items_dir.exists() and not any(items_dir.iterdir()):
        items_dir.rmdir()

    models_item_dir = assets_path / namespace / "models" / "item"
    if models_item_dir.exists() and not any(models_item_dir.iterdir()):
        models_item_dir.rmdir()
        models_dir_parent = assets_path / namespace / "models"
        if models_dir_parent.exists() and not any(models_dir_parent.iterdir()):
            models_dir_parent.rmdir()

    textures_item_dir = assets_path / namespace / "textures" / "item"
    if textures_item_dir.exists() and not any(textures_item_dir.iterdir()):
        textures_item_dir.rmdir()
        textures_dir_parent = assets_path / namespace / "textures"
        if textures_dir_parent.exists() and not any(textures_dir_parent.iterdir()):
            textures_dir_parent.rmdir()

    namespace_dir = assets_path / namespace
    if namespace_dir.exists() and not any(namespace_dir.iterdir()):
        namespace_dir.rmdir()

    return jsonify({"success": True, "message": "Model deleted"})


@app.route('/api/download/bbmodel/<branch_name>/<namespace>/<model_identifier>', methods=['GET'])
@login_required
def download_bbmodel(branch_name, namespace, model_identifier):
    branch_path = _get_branch_path(branch_name)
    models_dir = branch_path / "assets" / namespace / "models" / "item" / model_identifier

    bbmodel_files = list(models_dir.glob("*.bbmodel"))
    if not bbmodel_files:
        return jsonify({"error": "BBModel file not found"}), 404

    return send_file(
        bbmodel_files[0],
        as_attachment=True,
        download_name=f"{model_identifier}.bbmodel",
        max_age=0
    )


def get_review_models(branch_path_to_review):
    review_models = []
    assets_path = branch_path_to_review / "assets"
    if assets_path.exists():
        for namespace_dir in assets_path.iterdir():
            if not namespace_dir.is_dir(): continue

            models_path = namespace_dir / "models" / "item"
            if models_path.exists():
                for model_dir in models_path.iterdir():
                    if not model_dir.is_dir(): continue

                    metadata_file = model_dir / "metadata.json"
                    if metadata_file.exists():
                        try:
                            with open(metadata_file, 'r') as f:
                                meta = json.load(f)
                                if meta.get('status') == 'review':
                                    review_models.append({
                                        'namespace': namespace_dir.name,
                                        'identifier': model_dir.name
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
        ns = m['namespace']
        mid = m['identifier']
        excluded_paths.add(f"assets/{ns}/models/item/{mid}")
        excluded_paths.add(f"assets/{ns}/textures/item/{mid}")
        excluded_paths.add(f"assets/{ns}/items/{mid}.json")

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


@app.route('/api/texture/<branch_name>/<namespace>/<model_identifier>/<path:texture_path>', methods=['GET'])
@login_required
def get_texture(branch_name, namespace, model_identifier, texture_path):
    branch_path = _get_branch_path(branch_name)
    textures_dir = branch_path / "assets" / namespace / "textures" / "item" / model_identifier

    safe_path = os.path.normpath(texture_path)
    if safe_path.startswith('..') or safe_path.startswith('/'):
        return jsonify({"error": "Invalid path"}), 400

    file_path = textures_dir / safe_path

    if not file_path.exists() and not file_path.suffix:
        file_path = file_path.with_suffix('.png')

    if not file_path.exists():
        return jsonify({"error": "Texture not found"}), 404

    return send_file(file_path)


@app.route('/api/thumbnail/<branch_name>/<namespace>/<model_identifier>.png', methods=['GET'])
@login_required
def get_thumbnail(branch_name, namespace, model_identifier):
    branch_path = _get_branch_path(branch_name)
    
    # Check metadata.json for base64 thumbnail
    models_dir = branch_path / "assets" / namespace / "models" / "item" / model_identifier
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
        return jsonify({"success": True, "message": "Renamed successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('DEBUG', 'True').lower() == 'true'
    app.run(host=host, debug=debug, port=port)