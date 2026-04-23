import os
import json
import hmac
import hashlib
import secrets
import time
from flask import Flask, request, jsonify
from flask_cors import CORS

# PythonAnywhere에서는 변수명이 반드시 'app'이어야 합니다.
app = Flask(__name__)
CORS(app)

# 데이터를 저장할 파일 경로 설정
DATA_FILE = 'team_data.json'

# 관리자 비밀번호 (pythoneverywhere.com에서 직접 수정)
ADMIN_PASSWORD = 'CHANGE_ME'

# 토큰 서명용 시크릿 (나중에 직접 수정 — 긴 랜덤 문자열 권장)
ADMIN_SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING'

# 토큰 유효 기간 (초). 7일.
TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60


def _make_token():
    """HMAC 토큰: <nonce>.<expiry>.<signature> — expiry까지 서명에 포함"""
    nonce = secrets.token_urlsafe(24)
    expiry = str(int(time.time()) + TOKEN_TTL_SECONDS)
    payload = f"{nonce}.{expiry}"
    sig = hmac.new(ADMIN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _verify_token(token):
    if not token:
        return False
    parts = token.split('.')
    if len(parts) != 3:
        return False
    nonce, expiry, sig = parts
    payload = f"{nonce}.{expiry}"
    expected = hmac.new(ADMIN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return False
    try:
        if int(expiry) < int(time.time()):
            return False
    except ValueError:
        return False
    return True


def _require_admin():
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return False
    return _verify_token(auth[7:])

@app.route('/enroll', methods=['POST'])
def enroll():
    new_member = request.get_json()

    # 1. 기존 파일 읽기 (없으면 빈 리스트 준비)
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            try:
                member_list = json.load(f)
            except json.JSONDecodeError:
                member_list = []
    else:
        member_list = []

    # 2. 새 지원자 정보 추가
    member_list.append(new_member)

    # 3. 업데이트된 리스트를 파일에 덮어쓰기
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(member_list, f, ensure_ascii=False, indent=4)

    return jsonify({"message": "PythonAnywhere 서버에 안전하게 저장되었습니다!"}), 200


@app.route('/admin/login', methods=['POST'])
def admin_login():
    body = request.get_json(silent=True) or {}
    password = body.get('password', '')
    if not hmac.compare_digest(password, ADMIN_PASSWORD):
        return jsonify({"error": "비밀번호가 일치하지 않습니다."}), 401
    return jsonify({"token": _make_token()}), 200


@app.route('/admin/submissions', methods=['GET'])
def admin_submissions():
    if not _require_admin():
        return jsonify({"error": "Unauthorized"}), 401

    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            try:
                member_list = json.load(f)
            except json.JSONDecodeError:
                member_list = []
    else:
        member_list = []

    return jsonify({"submissions": member_list, "count": len(member_list)}), 200


@app.route('/admin/toggle-hidden/<app_id>', methods=['POST'])
def toggle_hidden(app_id):
    if not _require_admin():
        return jsonify({"error": "Unauthorized"}), 401

    if not os.path.exists(DATA_FILE):
        return jsonify({"error": "No data file"}), 404

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        try:
            member_list = json.load(f)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid JSON"}), 400

    for sub in member_list:
        if sub.get('applicationId') == app_id:
            sub['hidden'] = not sub.get('hidden', False)
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(member_list, f, ensure_ascii=False, indent=4)
            return jsonify({"hidden": sub['hidden']}), 200

    return jsonify({"error": "Team not found"}), 404