"""TownServe Backend API Tests
Covers: auth, categories, providers, bookings, reviews, payments (503), admin
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # Read directly from frontend/.env as fallback
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"')
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@townserve.com"
ADMIN_PASSWORD = "Admin@12345"
# NOTE: Seeded providers use @townserve.test (RFC2606 reserved TLD) which Pydantic EmailStr rejects.
# Login is therefore impossible for seeded providers. We work around for non-auth tests by
# directly inserting a provider via admin/registration with a valid domain.
PROVIDER_EMAIL = "ramesh.kumar@townserve.test"
PROVIDER_PASSWORD = "Provider@123"

# Use a non-reserved domain so EmailStr passes
TEST_CUSTOMER_EMAIL = f"test_customer_{uuid.uuid4().hex[:8]}@example.com"
TEST_CUSTOMER_PASSWORD = "Customer@123"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def provider_token(s):
    # Register a new provider with valid email (seeded providers can't login due to EmailStr rejecting .test TLD)
    email = f"test_provider_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "Ramesh Kumar Test",
        "email": email,
        "phone": "+919999900000",
        "password": "Provider@123",
        "role": "provider",
    })
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    # Seed services
    cats = s.get(f"{API}/categories").json()
    s.put(f"{API}/providers/me/profile", headers={"Authorization": f"Bearer {token}"},
          json={"bio": "Test bio", "city": "Mumbai", "primary_category_id": cats[0]["id"]})
    s.post(f"{API}/providers/me/services", headers={"Authorization": f"Bearer {token}"},
           json={"title": "TEST Service", "description": "test svc", "price": 299.0, "category_id": cats[0]["id"]})
    return token


@pytest.fixture(scope="session")
def customer_token(s):
    # Register a fresh customer
    r = s.post(f"{API}/auth/register", json={
        "name": "Test Customer",
        "email": TEST_CUSTOMER_EMAIL,
        "phone": "+919999911111",
        "password": TEST_CUSTOMER_PASSWORD,
        "role": "customer",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and data["user"]["role"] == "customer"
    return data["token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------------- Auth ----------------
class TestAuth:
    def test_admin_login(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_invalid_login(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_provider_creates_profile(self, s):
        email = f"test_provider_{uuid.uuid4().hex[:8]}@townserve.test"
        r = s.post(f"{API}/auth/register", json={
            "name": "Test Provider",
            "email": email,
            "phone": "+919999900000",
            "password": "Provider@123",
            "role": "provider",
        })
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        # Verify profile auto-created
        pr = s.get(f"{API}/providers/me/profile", headers=H(token))
        assert pr.status_code == 200
        assert pr.json()["name"] == "Test Provider"

    def test_self_register_admin_blocked(self, s):
        r = s.post(f"{API}/auth/register", json={
            "name": "X", "email": f"x_{uuid.uuid4().hex[:6]}@t.test",
            "password": "Admin@12345", "role": "admin"
        })
        assert r.status_code == 400

    def test_duplicate_email(self, s):
        r = s.post(f"{API}/auth/register", json={
            "name": "Admin", "email": ADMIN_EMAIL,
            "password": "Admin@12345", "role": "customer"
        })
        assert r.status_code == 400

    def test_me_requires_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_me_returns_user(self, s, customer_token):
        r = s.get(f"{API}/auth/me", headers=H(customer_token))
        assert r.status_code == 200
        assert r.json()["email"] == TEST_CUSTOMER_EMAIL


# ---------------- Categories ----------------
class TestCategories:
    def test_list_categories(self, s):
        r = s.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 8
        names = [c["name"] for c in cats]
        for expected in ["Electrician", "Plumber", "Cleaner", "Tutor", "Carpenter", "Painter", "AC Repair", "Beautician"]:
            assert expected in names


# ---------------- Providers ----------------
class TestProviders:
    def test_list_providers(self, s):
        r = s.get(f"{API}/providers")
        assert r.status_code == 200
        providers = r.json()
        assert len(providers) >= 8
        assert "name" in providers[0]
        assert "services" in providers[0]

    def test_filter_by_category(self, s):
        cats = s.get(f"{API}/categories").json()
        electrician = next(c for c in cats if c["name"] == "Electrician")
        r = s.get(f"{API}/providers", params={"category_id": electrician["id"]})
        assert r.status_code == 200
        result = r.json()
        assert len(result) >= 1
        assert any("Ramesh" in p["name"] for p in result)

    def test_search_query(self, s):
        r = s.get(f"{API}/providers", params={"q": "Ramesh"})
        assert r.status_code == 200
        names = [p["name"] for p in r.json()]
        assert any("Ramesh" in n for n in names)

    def test_get_provider_by_id(self, s):
        providers = s.get(f"{API}/providers").json()
        pid = providers[0]["id"]
        r = s.get(f"{API}/providers/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_get_provider_404(self, s):
        r = s.get(f"{API}/providers/nonexistent-id")
        assert r.status_code == 404


# ---------------- Provider self-service ----------------
class TestProviderSelfService:
    def test_get_my_profile(self, s, provider_token):
        r = s.get(f"{API}/providers/me/profile", headers=H(provider_token))
        assert r.status_code == 200
        assert "Ramesh Kumar" in r.json()["name"]

    def test_update_profile(self, s, provider_token):
        r = s.put(f"{API}/providers/me/profile", headers=H(provider_token),
                  json={"bio": "Updated bio", "city": "Pune"})
        assert r.status_code == 200
        assert r.json()["bio"] == "Updated bio"

    def test_add_and_delete_service(self, s, provider_token):
        cats = s.get(f"{API}/categories").json()
        cid = cats[0]["id"]
        r = s.post(f"{API}/providers/me/services", headers=H(provider_token), json={
            "title": "TEST_Service", "description": "test", "price": 199.0, "category_id": cid
        })
        assert r.status_code == 200
        sid = r.json()["id"]
        # Verify persisted
        prof = s.get(f"{API}/providers/me/profile", headers=H(provider_token)).json()
        assert any(svc["id"] == sid for svc in prof["services"])
        # Delete
        rd = s.delete(f"{API}/providers/me/services/{sid}", headers=H(provider_token))
        assert rd.status_code == 200
        prof2 = s.get(f"{API}/providers/me/profile", headers=H(provider_token)).json()
        assert not any(svc["id"] == sid for svc in prof2["services"])

    def test_customer_cannot_access_provider_endpoints(self, s, customer_token):
        r = s.get(f"{API}/providers/me/profile", headers=H(customer_token))
        assert r.status_code == 403


# ---------------- Bookings ----------------
class TestBookings:
    def test_full_booking_flow(self, s, customer_token, provider_token):
        # Use the test provider (registered via fixture)
        me = s.get(f"{API}/auth/me", headers=H(provider_token)).json()
        provider = s.get(f"{API}/providers/{me['id']}").json()
        service = provider["services"][0]
        scheduled = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

        # Create booking
        r = s.post(f"{API}/bookings", headers=H(customer_token), json={
            "provider_id": provider["id"],
            "service_id": service["id"],
            "scheduled_at": scheduled,
            "address": "TEST 123 Some Street",
            "notes": "TEST booking",
            "payment_mode": "cod",
        })
        assert r.status_code == 200, r.text
        bk = r.json()
        assert bk["status"] == "pending"
        assert bk["payment_status"] == "cod"
        bid = bk["id"]

        # Customer can view in mine
        rm = s.get(f"{API}/bookings/mine", headers=H(customer_token))
        assert rm.status_code == 200
        assert any(b["id"] == bid for b in rm.json())

        # Provider can view in mine
        rmp = s.get(f"{API}/bookings/mine", headers=H(provider_token))
        assert any(b["id"] == bid for b in rmp.json())

        # Customer CANNOT confirm
        rc = s.patch(f"{API}/bookings/{bid}/status", headers=H(customer_token),
                     json={"status": "confirmed"})
        assert rc.status_code == 400

        # Provider confirms
        rp = s.patch(f"{API}/bookings/{bid}/status", headers=H(provider_token),
                     json={"status": "confirmed"})
        assert rp.status_code == 200
        assert rp.json()["status"] == "confirmed"

        # Provider sets in_progress
        rp2 = s.patch(f"{API}/bookings/{bid}/status", headers=H(provider_token),
                      json={"status": "in_progress"})
        assert rp2.status_code == 200

        # Provider completes
        rp3 = s.patch(f"{API}/bookings/{bid}/status", headers=H(provider_token),
                      json={"status": "completed"})
        assert rp3.status_code == 200
        assert rp3.json()["status"] == "completed"

        # Save for review test
        TestBookings.completed_bid = bid
        TestBookings.completed_provider_id = provider["id"]

    def test_invalid_provider_booking(self, s, customer_token):
        r = s.post(f"{API}/bookings", headers=H(customer_token), json={
            "provider_id": "nonexistent",
            "service_id": "nonexistent",
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "address": "test",
            "payment_mode": "cod",
        })
        assert r.status_code == 404

    def test_provider_cannot_create_booking(self, s, provider_token):
        r = s.post(f"{API}/bookings", headers=H(provider_token), json={
            "provider_id": "x", "service_id": "y",
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "address": "x", "payment_mode": "cod",
        })
        assert r.status_code == 403


# ---------------- Reviews ----------------
class TestReviews:
    def test_create_review_for_completed(self, s, customer_token):
        bid = getattr(TestBookings, "completed_bid", None)
        pid = getattr(TestBookings, "completed_provider_id", None)
        if not bid:
            pytest.skip("No completed booking from previous test")
        r = s.post(f"{API}/reviews", headers=H(customer_token), json={
            "booking_id": bid, "rating": 5, "comment": "TEST excellent!"
        })
        assert r.status_code == 200, r.text
        assert r.json()["rating"] == 5

        # Provider rating updated
        prov = s.get(f"{API}/providers/{pid}").json()
        assert prov["rating_count"] >= 1

        # Duplicate review blocked
        r2 = s.post(f"{API}/reviews", headers=H(customer_token), json={
            "booking_id": bid, "rating": 4, "comment": "again"
        })
        assert r2.status_code == 400


# ---------------- Payments (Razorpay 503) ----------------
class TestPayments:
    def test_create_order_returns_503(self, s, customer_token):
        # Need a booking id
        rm = s.get(f"{API}/bookings/mine", headers=H(customer_token)).json()
        if not rm:
            pytest.skip("No bookings")
        bid = rm[0]["id"]
        r = s.post(f"{API}/payments/create-order", headers=H(customer_token),
                   params={"booking_id": bid})
        assert r.status_code == 503


# ---------------- Admin ----------------
class TestAdmin:
    def test_admin_stats(self, s, admin_token):
        r = s.get(f"{API}/admin/stats", headers=H(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("users", "customers", "providers", "verified_providers", "bookings", "reviews"):
            assert k in d

    def test_admin_providers(self, s, admin_token):
        r = s.get(f"{API}/admin/providers", headers=H(admin_token))
        assert r.status_code == 200
        assert len(r.json()) >= 8

    def test_admin_verify_toggle(self, s, admin_token):
        providers = s.get(f"{API}/admin/providers", headers=H(admin_token)).json()
        pid = providers[0]["id"]
        r1 = s.patch(f"{API}/admin/providers/{pid}/verify",
                     headers=H(admin_token), params={"verify": "false"})
        assert r1.status_code == 200
        assert r1.json()["is_verified"] is False
        # Re-verify
        r2 = s.patch(f"{API}/admin/providers/{pid}/verify",
                     headers=H(admin_token), params={"verify": "true"})
        assert r2.status_code == 200
        assert r2.json()["is_verified"] is True

    def test_admin_bookings(self, s, admin_token):
        r = s.get(f"{API}/admin/bookings", headers=H(admin_token))
        assert r.status_code == 200

    def test_admin_users(self, s, admin_token):
        r = s.get(f"{API}/admin/users", headers=H(admin_token))
        assert r.status_code == 200
        # password_hash must NOT be exposed
        for u in r.json():
            assert "password_hash" not in u

    def test_non_admin_forbidden(self, s, customer_token):
        r = s.get(f"{API}/admin/stats", headers=H(customer_token))
        assert r.status_code == 403
