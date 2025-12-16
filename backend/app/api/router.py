from fastapi import APIRouter

from app.api.routers import checkins, dashboard, diary, goals, habits, social, users

api_router = APIRouter()
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(habits.router, prefix="/habits", tags=["habits"])
api_router.include_router(goals.router, prefix="/goals", tags=["goals"])
api_router.include_router(checkins.router, prefix="/checkins", tags=["checkins"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(diary.router, prefix="/diary", tags=["diary"])
api_router.include_router(social.router, prefix="/social", tags=["social"])
