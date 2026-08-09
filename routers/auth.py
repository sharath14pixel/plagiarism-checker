from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
# pyrefly: ignore [missing-import]
from motor.motor_asyncio import AsyncIOMotorDatabase  # type: ignore

from models.database import get_db
from models.schemas import Token, UserCreate, UserResponse
from utils.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_password_hash,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    hashed_pwd = get_password_hash(user_data.password)
    new_user_dict = {
        "email": user_data.email,
        "hashed_password": hashed_pwd,
        "created_at": datetime.utcnow()
    }
    result = await db.users.insert_one(new_user_dict)
    
    return UserResponse(
        id=str(result.inserted_id),
        email=new_user_dict["email"],
        created_at=new_user_dict["created_at"].isoformat(),
    )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Authenticate a user and return a JWT access token."""
    # Authenticate user
    user = await db.users.find_one({"email": form_data.username})
    
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate JWT
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["_id"])}, expires_delta=access_token_expires
    )

    return Token(access_token=access_token, user_id=str(user["_id"]))
