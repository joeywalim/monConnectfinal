"""MonConnect Backend — Local Service Marketplace
FastAPI + MongoDB + JWT Auth + Razorpay (optional)
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
import logging
import uuid
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timedelta, timezone

try:
    import razorpay  # optional
except Exception:
    razorpay = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------- Config ----------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRE_MINUTES = int(os.environ.get('JWT_EXPIRE_MINUTES', '10080'))
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@townserve.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin@12345')
PROVIDER_REGISTRATION_FEE = int(os.environ.get('PROVIDER_REGISTRATION_FEE', '199'))  # INR

# ---------- DB ----------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------- App ----------
app = FastAPI(title="MonConnect API")
api_router = APIRouter(prefix="/api")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Razorpay client (optional)
rzp_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET and razorpay is not None:
    rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# ============= MODELS =============
Role = Literal['customer', 'provider', 'admin']
BookingStatus = Literal['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected']
PaymentStatus = Literal['unpaid', 'paid', 'cod']


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: Role
    is_verified: bool = False
    created_at: datetime


class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: Role = 'customer'


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


class CategoryModel(BaseModel):
    id: str
    name: str
    icon: str  # lucide icon name
    order: int = 0


class ServiceItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    price: float  # INR (rupees)
    category_id: str


class ProviderProfile(BaseModel):
    id: str  # same as user_id
    user_id: str
    name: str
    bio: Optional[str] = ""
    city: Optional[str] = ""
    phone: Optional[str] = ""
    photo_url: Optional[str] = ""
    primary_category_id: Optional[str] = None
    services: List[ServiceItem] = []
    rating_avg: float = 0.0
    rating_count: int = 0
    is_verified: bool = False
    created_at: datetime


class ProviderCreateBody(BaseModel):
    bio: Optional[str] = ""
    city: Optional[str] = ""
    primary_category_id: Optional[str] = None
    photo_url: Optional[str] = ""


class ServiceCreateBody(BaseModel):
    title: str
    description: str
    price: float
    category_id: str


class BookingCreate(BaseModel):
    provider_id: str
    service_id: str
    scheduled_at: datetime
    address: str
    notes: Optional[str] = ""
    payment_mode: Literal['cod', 'online'] = 'cod'


class BookingModel(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    customer_phone: Optional[str] = ""
    provider_id: str
    provider_name: str
    service_id: str
    service_title: str
    price: float
    scheduled_at: datetime
    address: str
    notes: Optional[str] = ""
    status: BookingStatus
    payment_mode: Literal['cod', 'online']
    payment_status: PaymentStatus
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    created_at: datetime


class StatusUpdateBody(BaseModel):
    status: BookingStatus


class ReviewCreate(BaseModel):
    booking_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = ""


class ReviewModel(BaseModel):
    id: str
    booking_id: str
    customer_id: str
    customer_name: str
    provider_id: str
    rating: int
    comment: str
    created_at: datetime


class PaymentOrderResponse(BaseModel):
    order_id: str
    amount: int  # paise
    currency: str
    key_id: str
    booking_id: str


class PaymentVerifyBody(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ============= AUTH HELPERS =============
def hash_password(p: str) -> str:
    return pwd_context.hash(p)


def verify_password(p: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(p, hashed)
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(*roles: str):
    async def _check(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {', '.join(roles)}")
        return user
    return _check


def to_user_public(u: dict) -> UserPublic:
    return UserPublic(
        id=u["id"],
        name=u["name"],
        email=u["email"],
        phone=u.get("phone"),
        role=u["role"],
        is_verified=u.get("is_verified", False),
        created_at=u["created_at"],
    )


# ============= AUTH ROUTES =============
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(body: RegisterBody):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    if body.role == 'admin':
        raise HTTPException(status_code=400, detail="Cannot self-register as admin")
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    user_doc = {
        "id": user_id,
        "name": body.name.strip(),
        "email": body.email.lower(),
        "phone": body.phone,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "is_verified": False,
        "created_at": now,
    }
    await db.users.insert_one(user_doc)
    # If provider, also create provider profile
    if body.role == 'provider':
        provider_doc = {
            "id": user_id,
            "user_id": user_id,
            "name": user_doc["name"],
            "bio": "",
            "city": "",
            "phone": body.phone or "",
            "photo_url": "",
            "primary_category_id": None,
            "services": [],
            "rating_avg": 0.0,
            "rating_count": 0,
            "is_verified": False,
            "is_paid": False,
            "registration_fee": PROVIDER_REGISTRATION_FEE,
            "registration_order_id": None,
            "registration_payment_id": None,
            "created_at": now,
        }
        await db.providers.insert_one(provider_doc)
    token = create_token(user_id, body.role)
    return AuthResponse(token=token, user=to_user_public(user_doc))


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(body: LoginBody):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["role"])
    return AuthResponse(token=token, user=to_user_public(user))


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return to_user_public(user)


# ============= CATEGORIES =============
@api_router.get("/categories", response_model=List[CategoryModel])
async def list_categories():
    docs = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return [CategoryModel(**d) for d in docs]


# ============= PROVIDERS =============
@api_router.get("/providers")
async def list_providers(category_id: Optional[str] = None, q: Optional[str] = None):
    # Only show providers who have paid the registration fee to the public.
    query: dict = {"is_paid": True}
    if category_id:
        query["$or"] = [
            {"primary_category_id": category_id},
            {"services.category_id": category_id},
        ]
    if q:
        regex = {"$regex": q, "$options": "i"}
        text_clause = [{"name": regex}, {"city": regex}, {"bio": regex}, {"services.title": regex}]
        if "$or" in query:
            query = {"$and": [query, {"$or": text_clause}]}
        else:
            query["$or"] = text_clause
    docs = await db.providers.find(query, {"_id": 0}).sort("rating_avg", -1).to_list(200)
    return docs


@api_router.get("/providers/{provider_id}")
async def get_provider(provider_id: str):
    doc = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Provider not found")
    if not doc.get("is_paid"):
        raise HTTPException(status_code=403, detail="Provider has not completed registration")
    return doc


@api_router.get("/providers/me/profile")
async def my_provider_profile(user: dict = Depends(require_role('provider'))):
    doc = await db.providers.find_one({"id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    return doc


@api_router.put("/providers/me/profile")
async def update_my_provider(body: ProviderCreateBody, user: dict = Depends(require_role('provider'))):
    update = {k: v for k, v in body.dict().items() if v is not None}
    await db.providers.update_one({"id": user["id"]}, {"$set": update})
    doc = await db.providers.find_one({"id": user["id"]}, {"_id": 0})
    return doc


@api_router.post("/providers/me/services")
async def add_service(body: ServiceCreateBody, user: dict = Depends(require_role('provider'))):
    svc = ServiceItem(**body.dict())
    await db.providers.update_one({"id": user["id"]}, {"$push": {"services": svc.dict()}})
    return svc


@api_router.delete("/providers/me/services/{service_id}")
async def delete_service(service_id: str, user: dict = Depends(require_role('provider'))):
    await db.providers.update_one({"id": user["id"]}, {"$pull": {"services": {"id": service_id}}})
    return {"deleted": service_id}


# ============= BOOKINGS =============
async def _enrich_booking_doc(doc: dict) -> dict:
    return doc


@api_router.post("/bookings")
async def create_booking(body: BookingCreate, user: dict = Depends(require_role('customer'))):
    provider = await db.providers.find_one({"id": body.provider_id}, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    service = next((s for s in provider.get("services", []) if s["id"] == body.service_id), None)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    bid = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = {
        "id": bid,
        "customer_id": user["id"],
        "customer_name": user["name"],
        "customer_phone": user.get("phone", ""),
        "provider_id": provider["id"],
        "provider_name": provider["name"],
        "service_id": service["id"],
        "service_title": service["title"],
        "price": float(service["price"]),
        "scheduled_at": body.scheduled_at,
        "address": body.address,
        "notes": body.notes or "",
        "status": "pending",
        "payment_mode": body.payment_mode,
        "payment_status": "cod" if body.payment_mode == "cod" else "unpaid",
        "razorpay_order_id": None,
        "razorpay_payment_id": None,
        "created_at": now,
    }
    await db.bookings.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/bookings/mine")
async def my_bookings(user: dict = Depends(get_current_user)):
    if user["role"] == 'customer':
        q = {"customer_id": user["id"]}
    elif user["role"] == 'provider':
        q = {"provider_id": user["id"]}
    else:
        q = {}
    docs = await db.bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    if user["role"] != 'admin' and user["id"] not in (doc["customer_id"], doc["provider_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    return doc


@api_router.patch("/bookings/{booking_id}/status")
async def update_status(booking_id: str, body: StatusUpdateBody, user: dict = Depends(get_current_user)):
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    # Authorization rules
    new_status = body.status
    role = user["role"]
    if role == 'provider' and user["id"] == doc["provider_id"]:
        allowed = {'confirmed', 'in_progress', 'completed', 'rejected'}
    elif role == 'customer' and user["id"] == doc["customer_id"]:
        allowed = {'cancelled'}
    elif role == 'admin':
        allowed = {'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected'}
    else:
        raise HTTPException(status_code=403, detail="Forbidden")
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot set status to {new_status}")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": new_status}})
    updated = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return updated


# ============= REVIEWS =============
@api_router.post("/reviews")
async def create_review(body: ReviewCreate, user: dict = Depends(require_role('customer'))):
    booking = await db.bookings.find_one({"id": body.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking["status"] != 'completed':
        raise HTTPException(status_code=400, detail="Can review only completed bookings")
    existing = await db.reviews.find_one({"booking_id": body.booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed")
    rid = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = {
        "id": rid,
        "booking_id": body.booking_id,
        "customer_id": user["id"],
        "customer_name": user["name"],
        "provider_id": booking["provider_id"],
        "rating": body.rating,
        "comment": body.comment or "",
        "created_at": now,
    }
    await db.reviews.insert_one(doc)
    # Update provider aggregate rating
    cursor = db.reviews.find({"provider_id": booking["provider_id"]}, {"_id": 0, "rating": 1})
    ratings = [r["rating"] async for r in cursor]
    avg = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
    await db.providers.update_one(
        {"id": booking["provider_id"]},
        {"$set": {"rating_avg": avg, "rating_count": len(ratings)}},
    )
    doc.pop("_id", None)
    return doc


@api_router.get("/reviews/provider/{provider_id}")
async def provider_reviews(provider_id: str):
    docs = await db.reviews.find({"provider_id": provider_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


# ============= PAYMENTS (Razorpay optional) =============
@api_router.post("/payments/create-order", response_model=PaymentOrderResponse)
async def create_payment_order(booking_id: str, user: dict = Depends(require_role('customer'))):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["customer_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    if not rzp_client:
        raise HTTPException(status_code=503, detail="Razorpay not configured. Add keys to backend/.env")
    amount_paise = int(round(booking["price"] * 100))
    rzp_order = rzp_client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": booking_id[:40],
        "payment_capture": 1,
    })
    await db.bookings.update_one({"id": booking_id}, {"$set": {"razorpay_order_id": rzp_order["id"]}})
    return PaymentOrderResponse(
        order_id=rzp_order["id"],
        amount=amount_paise,
        currency="INR",
        key_id=RAZORPAY_KEY_ID,
        booking_id=booking_id,
    )


@api_router.post("/payments/verify")
async def verify_payment(body: PaymentVerifyBody, user: dict = Depends(require_role('customer'))):
    if not rzp_client:
        raise HTTPException(status_code=503, detail="Razorpay not configured")
    try:
        rzp_client.utility.verify_payment_signature({
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    await db.bookings.update_one(
        {"id": body.booking_id, "customer_id": user["id"]},
        {"$set": {
            "payment_status": "paid",
            "razorpay_payment_id": body.razorpay_payment_id,
            "status": "confirmed",
        }},
    )
    return {"status": "paid"}


@api_router.post("/payments/registration-order")
async def create_registration_order(user: dict = Depends(require_role('provider'))):
    """Create a Razorpay order to pay the provider registration fee."""
    profile = await db.providers.find_one({"id": user["id"]}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    if profile.get("is_paid"):
        raise HTTPException(status_code=400, detail="Registration already paid")
    if not rzp_client:
        raise HTTPException(status_code=503, detail="Razorpay not configured. Use mock-pay or ask admin to mark you as paid.")
    amount_paise = PROVIDER_REGISTRATION_FEE * 100
    rzp_order = rzp_client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"reg-{user['id'][:30]}",
        "payment_capture": 1,
    })
    await db.providers.update_one({"id": user["id"]}, {"$set": {"registration_order_id": rzp_order["id"]}})
    return {
        "order_id": rzp_order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": RAZORPAY_KEY_ID,
        "fee_inr": PROVIDER_REGISTRATION_FEE,
    }


@api_router.post("/payments/registration-verify")
async def verify_registration_payment(body: PaymentVerifyBody, user: dict = Depends(require_role('provider'))):
    if not rzp_client:
        raise HTTPException(status_code=503, detail="Razorpay not configured")
    try:
        rzp_client.utility.verify_payment_signature({
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")
    await db.providers.update_one(
        {"id": user["id"]},
        {"$set": {
            "is_paid": True,
            "registration_payment_id": body.razorpay_payment_id,
        }},
    )
    return {"status": "paid"}


@api_router.post("/payments/registration-mock-pay")
async def mock_pay_registration(user: dict = Depends(require_role('provider'))):
    """Test-only: marks the provider as paid without Razorpay. Available when Razorpay keys aren't configured."""
    if rzp_client:
        raise HTTPException(status_code=400, detail="Razorpay is configured — use registration-order instead.")
    await db.providers.update_one(
        {"id": user["id"]},
        {"$set": {"is_paid": True, "registration_payment_id": "MOCK_DEV_PAY"}},
    )
    return {"status": "paid", "mode": "mock"}


# ============= ADMIN =============
@api_router.get("/admin/stats")
async def admin_stats(_: dict = Depends(require_role('admin'))):
    return {
        "users": await db.users.count_documents({}),
        "customers": await db.users.count_documents({"role": "customer"}),
        "providers": await db.users.count_documents({"role": "provider"}),
        "verified_providers": await db.providers.count_documents({"is_verified": True}),
        "bookings": await db.bookings.count_documents({}),
        "completed_bookings": await db.bookings.count_documents({"status": "completed"}),
        "reviews": await db.reviews.count_documents({}),
    }


@api_router.get("/admin/providers")
async def admin_list_providers(_: dict = Depends(require_role('admin'))):
    return await db.providers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.patch("/admin/providers/{provider_id}/verify")
async def admin_verify_provider(provider_id: str, verify: bool = True, _: dict = Depends(require_role('admin'))):
    await db.providers.update_one({"id": provider_id}, {"$set": {"is_verified": verify}})
    await db.users.update_one({"id": provider_id}, {"$set": {"is_verified": verify}})
    return {"id": provider_id, "is_verified": verify}


@api_router.patch("/admin/providers/{provider_id}/mark-paid")
async def admin_mark_paid(provider_id: str, paid: bool = True, _: dict = Depends(require_role('admin'))):
    await db.providers.update_one(
        {"id": provider_id},
        {"$set": {"is_paid": paid, "registration_payment_id": "ADMIN_MARKED" if paid else None}},
    )
    return {"id": provider_id, "is_paid": paid}


@api_router.get("/admin/bookings")
async def admin_list_bookings(_: dict = Depends(require_role('admin'))):
    return await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.get("/admin/users")
async def admin_list_users(_: dict = Depends(require_role('admin'))):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return docs


# ============= HEALTH =============
@api_router.get("/")
async def root():
    return {"status": "ok", "service": "MonConnect API"}


# ============= STARTUP SEED =============
DEFAULT_CATEGORIES = [
    {"name": "Electrician", "icon": "Zap", "order": 1},
    {"name": "Plumber", "icon": "Wrench", "order": 2},
    {"name": "Cleaner", "icon": "Sparkles", "order": 3},
    {"name": "Tutor", "icon": "GraduationCap", "order": 4},
    {"name": "Carpenter", "icon": "Hammer", "order": 5},
    {"name": "Painter", "icon": "PaintBucket", "order": 6},
    {"name": "AC Repair", "icon": "Wind", "order": 7},
    {"name": "Beautician", "icon": "Scissors", "order": 8},
]


@app.on_event("startup")
async def on_startup():
    # Seed admin
    admin = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if not admin:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "MonConnect Admin",
            "email": ADMIN_EMAIL.lower(),
            "phone": None,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "is_verified": True,
            "created_at": datetime.now(timezone.utc),
        })
        logger.info(f"Seeded admin: {ADMIN_EMAIL}")
    # Seed categories
    existing_count = await db.categories.count_documents({})
    if existing_count == 0:
        for c in DEFAULT_CATEGORIES:
            await db.categories.insert_one({
                "id": str(uuid.uuid4()),
                **c,
            })
        logger.info(f"Seeded {len(DEFAULT_CATEGORIES)} categories")
    # Seed sample providers (one per category) if no providers exist
    p_count = await db.providers.count_documents({})
    if p_count == 0:
        cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(20)
        sample_providers = [
            ("Ramesh Kumar", "Mumbai", "Electrician", "Expert electrician with 10+ years experience. Wiring, repairs, installations.", "https://images.unsplash.com/photo-1665242043190-0ef29390d289?w=400"),
            ("Suresh Sharma", "Mumbai", "Plumber", "Licensed plumber. Leakage fix, fitting, tank cleaning.", "https://images.unsplash.com/photo-1665242043190-0ef29390d289?w=400"),
            ("Anita Devi", "Mumbai", "Cleaner", "Professional home & deep cleaning. Trustworthy and timely.", "https://images.pexels.com/photos/6195114/pexels-photo-6195114.jpeg?auto=compress&w=400"),
            ("Priya Singh", "Mumbai", "Tutor", "Math & Science tutor for classes 6–10. Home tuition available.", "https://images.pexels.com/photos/6195114/pexels-photo-6195114.jpeg?auto=compress&w=400"),
            ("Mahesh Patel", "Mumbai", "Carpenter", "Furniture making, repair, polishing. 15 years experience.", "https://images.unsplash.com/photo-1646640381839-02748ae8ddf0?w=400"),
            ("Vinod Yadav", "Mumbai", "Painter", "Interior & exterior painting. Asian Paints certified.", "https://images.unsplash.com/photo-1646640381839-02748ae8ddf0?w=400"),
            ("Arjun Mehta", "Mumbai", "AC Repair", "AC servicing, gas filling, installation. All brands.", "https://images.unsplash.com/photo-1665242043190-0ef29390d289?w=400"),
            ("Kavita Rao", "Mumbai", "Beautician", "Bridal makeup, facials, threading. At-home services.", "https://images.pexels.com/photos/6195114/pexels-photo-6195114.jpeg?auto=compress&w=400"),
        ]
        cat_map = {c["name"]: c for c in cats}
        for name, city, cat_name, bio, photo in sample_providers:
            cat = cat_map.get(cat_name)
            if not cat:
                continue
            email = name.lower().replace(" ", ".") + "@townserve.in"
            uid = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            await db.users.insert_one({
                "id": uid,
                "name": name,
                "email": email,
                "phone": "+919999900000",
                "password_hash": hash_password("Provider@123"),
                "role": "provider",
                "is_verified": True,
                "created_at": now,
            })
            services = [
                ServiceItem(title=f"{cat_name} - Basic Visit", description=f"Basic {cat_name.lower()} service call", price=299.0, category_id=cat["id"]).dict(),
                ServiceItem(title=f"{cat_name} - Standard Service", description=f"Standard {cat_name.lower()} work up to 2 hours", price=599.0, category_id=cat["id"]).dict(),
            ]
            await db.providers.insert_one({
                "id": uid,
                "user_id": uid,
                "name": name,
                "bio": bio,
                "city": city,
                "phone": "+919999900000",
                "photo_url": photo,
                "primary_category_id": cat["id"],
                "services": services,
                "rating_avg": 4.5,
                "rating_count": 0,
                "is_verified": True,
                "is_paid": True,
                "registration_fee": PROVIDER_REGISTRATION_FEE,
                "registration_payment_id": "SEED",
                "created_at": now,
            })
        logger.info("Seeded sample providers")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# Include router + CORS
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
