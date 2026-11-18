"""Tiny local stand-in for Supabase, for end-to-end tests only.
/auth/v1/*    -> fake email-code auth (any 6 digits = 123456 works), issues real HS256 JWTs
/rest/v1/*    -> proxied to a real PostgREST on the real schema (RLS enforced)
/storage/v1/* -> accepts uploads into the caller's own folder only (mirrors the policy)
"""
import base64, hashlib, hmac, json, subprocess, time, uuid, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

SECRET = b"super-secret-jwt-token-with-at-least-32-characters-long"
PGRST = "http://127.0.0.1:3001"
LOG = open("e2e/out/local_supabase.log", "a")

def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def jwt(claims):
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()); p = b64(json.dumps(claims).encode())
    s = b64(hmac.new(SECRET, f"{h}.{p}".encode(), hashlib.sha256).digest())
    return f"{h}.{p}.{s}"
def decode(tok):
    try:
        h, p, s = tok.split(".")
        if b64(hmac.new(SECRET, f"{h}.{p}".encode(), hashlib.sha256).digest()) != s: return None
        return json.loads(base64.urlsafe_b64decode(p + "=="))
    except Exception: return None

def user_obj(uid, email):
    return {"id": uid, "aud": "authenticated", "role": "authenticated", "email": email,
            "email_confirmed_at": "2026-11-18T00:00:00Z", "app_metadata": {"provider": "email"},
            "user_metadata": {}, "created_at": "2026-11-18T00:00:00Z", "updated_at": "2026-11-18T00:00:00Z"}

def session(uid, email):
    now = int(time.time())
    at = jwt({"sub": uid, "email": email, "role": "authenticated", "aud": "authenticated", "exp": now + 3600, "iat": now})
    return {"access_token": at, "token_type": "bearer", "expires_in": 3600, "expires_at": now + 3600,
            "refresh_token": f"r-{uid}|{email}", "user": user_obj(uid, email)}

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body=None, headers=None):
        data = b"" if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin") or "*")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, X-Total-Count")
        for k, v in (headers or {}).items(): self.send_header(k, v)
        if body is not None and not (headers or {}).get("Content-Type"): self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers(); self.wfile.write(data)
    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""
    def claims(self):
        a = self.headers.get("Authorization", "")
        return decode(a[7:]) if a.startswith("Bearer ") else None

    def do_OPTIONS(self): self.send(204)
    def do_GET(self): self.route("GET")
    def do_POST(self): self.route("POST")
    def do_PATCH(self): self.route("PATCH")
    def do_PUT(self): self.route("PUT")
    def do_DELETE(self): self.route("DELETE")

    def route(self, m):
        path = self.path
        LOG.write(f"{m} {path}\n"); LOG.flush()
        if path.startswith("/auth/v1/"): return self.auth(m, path[9:])
        if path.startswith("/rest/v1/"): return self.rest(m, path[8:])
        if path.startswith("/storage/v1/"): return self.storage(m, path[12:])
        self.send(404, {"msg": "not found"})

    def auth(self, m, p):
        b = self.body()
        j = json.loads(b) if b else {}
        if p.startswith("otp"):
            return self.send(200, {})
        if p.startswith("verify"):
            if j.get("token") != "123456": return self.send(403, {"code": 403, "error_code": "otp_expired", "msg": "Token has expired or is invalid"})
            email = j["email"]; uid = str(uuid.uuid5(uuid.NAMESPACE_URL, email))
            subprocess.run(["psql", "-d", "e2e", "-qc",
                            f"insert into auth.users values ('{uid}') on conflict do nothing"], check=True)
            return self.send(200, session(uid, email))
        if p.startswith("token"):
            rt = j.get("refresh_token", "")
            if rt.startswith("r-"):
                uid, email = rt[2:].split("|", 1); return self.send(200, session(uid, email))
            return self.send(400, {"msg": "bad refresh"})
        if p.startswith("user"):
            c = self.claims()
            if not c or c.get("role") != "authenticated": return self.send(401, {"code": 401, "msg": "invalid JWT"})
            return self.send(200, user_obj(c["sub"], c.get("email")))
        if p.startswith("logout"): return self.send(204)
        self.send(404, {"msg": "auth route"})

    def rest(self, m, p):
        b = self.body()
        req = urllib.request.Request(PGRST + p, data=b or None, method=m)
        for k in ("Authorization", "Content-Type", "Accept", "Prefer", "Range", "Accept-Profile", "Content-Profile"):
            if self.headers.get(k): req.add_header(k, self.headers[k])
        try:
            with urllib.request.urlopen(req) as r:
                data = r.read(); code = r.status; hdrs = r.headers
        except urllib.error.HTTPError as e:
            data = e.read(); code = e.code; hdrs = e.headers
            LOG.write(f"   -> {code} {data[:300]!r}\n"); LOG.flush()
        out = {k: hdrs[k] for k in ("Content-Type", "Content-Range") if hdrs.get(k)}
        self.send(code, data, out)

    def storage(self, m, p):
        c = self.claims(); self.body()
        # object/avatars/<uid>/<file>
        parts = p.split("?")[0].split("/")
        if m == "POST" and parts[:2] == ["object", "avatars"]:
            if not c or parts[2] != c.get("sub"):
                return self.send(403, {"statusCode": "403", "error": "Unauthorized", "message": "new row violates row-level security policy"})
            return self.send(200, {"Key": "/".join(parts[1:]), "Id": str(uuid.uuid4())})
        self.send(404, {"message": "storage route"})

ThreadingHTTPServer(("127.0.0.1", 54321), H).serve_forever()
