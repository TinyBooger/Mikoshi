from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import InvitationCode, User
from utils.session import get_current_admin_user, get_current_user
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timedelta, UTC
import secrets
import string

router = APIRouter(prefix="/api/invitations", tags=["invitations"])


class GenerateCodeRequest(BaseModel):
    max_uses: Optional[int] = 1
    expires_in_days: Optional[int] = 30
    notes: Optional[str] = None


class ValidateCodeRequest(BaseModel):
    code: str


def generate_invitation_code(length: int = 12) -> str:
    """Generate a random invitation code"""
    # Use uppercase letters and numbers for readability
    alphabet = string.ascii_uppercase + string.digits
    # Remove confusing characters like O, 0, I, 1
    alphabet = alphabet.replace('O', '').replace('0', '').replace('I', '').replace('1', '')
    return ''.join(secrets.choice(alphabet) for _ in range(length))


@router.post("/generate")
def generate_code(
    request: GenerateCodeRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Generate a new invitation code - Admin only"""
    # Generate unique code
    code = generate_invitation_code()
    while db.query(InvitationCode).filter(InvitationCode.code == code).first():
        code = generate_invitation_code()
    
    # Calculate expiration date
    expires_at = None
    if request.expires_in_days and request.expires_in_days > 0:
        expires_at = datetime.now(UTC) + timedelta(days=request.expires_in_days)
    
    # Create invitation code
    invitation = InvitationCode(
        code=code,
        created_by=current_admin.id,
        expires_at=expires_at,
        max_uses=request.max_uses or 1,
        notes=request.notes
    )
    
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    
    return {
        "message": "Invitation code generated successfully",
        "code": invitation.code,
        "expires_at": invitation.expires_at,
        "max_uses": invitation.max_uses
    }


@router.post("/validate")
def validate_code(
    request: ValidateCodeRequest,
    db: Session = Depends(get_db)
):
    """Validate an invitation code (public endpoint for signup)"""
    invitation = db.query(InvitationCode).filter(
        InvitationCode.code == request.code.upper()
    ).first()
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid invitation code")
    
    if not invitation.is_active:
        raise HTTPException(status_code=400, detail="This invitation code has been revoked")
    
    if invitation.use_count >= invitation.max_uses:
        raise HTTPException(status_code=400, detail="This invitation code has reached its usage limit")
    
    if invitation.expires_at and datetime.now(UTC) > invitation.expires_at:
        raise HTTPException(status_code=400, detail="This invitation code has expired")
    
    return {
        "valid": True,
        "message": "Invitation code is valid",
        "uses_remaining": invitation.max_uses - invitation.use_count
    }


@router.get("")
def list_codes(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """List all invitation codes - Admin only"""
    codes = db.query(InvitationCode).order_by(desc(InvitationCode.created_at)).all()
    
    result = []
    for code in codes:
        # Get the username if used_by exists
        used_by_username = None
        if code.used_by:
            user = db.query(User).filter(User.id == code.used_by).first()
            if user:
                used_by_username = user.name
        
        result.append({
            "code": code.code,
            "created_by": code.created_by,
            "created_at": code.created_at,
            "expires_at": code.expires_at,
            "used_by": code.used_by,
            "used_by_username": used_by_username,
            "used_at": code.used_at,
            "is_active": code.is_active,
            "max_uses": code.max_uses,
            "use_count": code.use_count,
            "notes": code.notes,
            "status": "expired" if (code.expires_at and datetime.now(UTC) > code.expires_at) 
                     else "exhausted" if code.use_count >= code.max_uses
                     else "revoked" if not code.is_active
                     else "active"
        })
    
    return result


@router.delete("/{code}")
def revoke_code(
    code: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Revoke an invitation code - Admin only"""
    invitation = db.query(InvitationCode).filter(InvitationCode.code == code).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation code not found")
    
    invitation.is_active = False
    db.commit()
    
    return {"message": "Invitation code revoked successfully"}


@router.patch("/{code}/reactivate")
def reactivate_code(
    code: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Reactivate a revoked invitation code - Admin only"""
    invitation = db.query(InvitationCode).filter(InvitationCode.code == code).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation code not found")
    
    invitation.is_active = True
    db.commit()
    
    return {"message": "Invitation code reactivated successfully"}


@router.post("/use/{code}")
def use_invitation_code(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark an invitation code as used by the current user"""
    invitation = db.query(InvitationCode).filter(
        InvitationCode.code == code.upper()
    ).first()
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid invitation code")
    
    if not invitation.is_active:
        raise HTTPException(status_code=400, detail="This invitation code has been revoked")
    
    if invitation.use_count >= invitation.max_uses:
        raise HTTPException(status_code=400, detail="This invitation code has reached its usage limit")
    
    if invitation.expires_at and datetime.now(UTC) > invitation.expires_at:
        raise HTTPException(status_code=400, detail="This invitation code has expired")
    
    # Mark as used
    invitation.use_count += 1
    if invitation.use_count == 1:  # First use
        invitation.used_by = current_user.id
        invitation.used_at = datetime.now(UTC)
    
    db.commit()
    
    return {"message": "Invitation code used successfully"}
