"""Admin API router package.

Aggregates the per-domain admin route modules under a single ``/api/admin``
router so that ``server.py`` can keep using ``app.include_router(admin.router)``
unchanged.
"""

from fastapi import APIRouter

from . import appeals, content, moderation, system, users

router = APIRouter(prefix="/api/admin", tags=["admin"])

router.include_router(users.router)
router.include_router(content.router)
router.include_router(moderation.router)
router.include_router(appeals.router)
router.include_router(system.router)
