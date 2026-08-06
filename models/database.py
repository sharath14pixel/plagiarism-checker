import os
from typing import AsyncGenerator

from motor.motor_asyncio import AsyncIOMotorClient

DATABASE_URL = os.environ.get("DATABASE_URL", "mongodb://localhost:27017")
DB_NAME = "plagiarism_db"

client = None
db = None

async def init_db() -> None:
    """Initialize MongoDB connection and create indexes if necessary."""
    global client, db
    client = AsyncIOMotorClient(DATABASE_URL)
    db = client[DB_NAME]
    
    # Create unique index for users email
    await db.users.create_index("email", unique=True)
    
async def close_db() -> None:
    """Close MongoDB connection."""
    if client:
        client.close()

async def get_db() -> AsyncGenerator:
    """Dependency that returns the MongoDB database instance."""
    yield db
