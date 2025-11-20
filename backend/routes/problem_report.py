from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import ProblemReport, User
from schemas import ProblemReportCreate, ProblemReportOut
from utils.session import get_current_user, get_current_admin_user
from typing import List, Optional
from datetime import datetime, UTC
import os
import base64

router = APIRouter(prefix="/api/problem-reports", tags=["problem_reports"])


@router.post("", response_model=ProblemReportOut)
def create_problem_report(
    description: str = Form(...),
    screenshot: Optional[str] = Form(None),
    target_type: Optional[str] = Form(None),
    target_id: Optional[int] = Form(None),
    target_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit a problem report"""
    # Create the problem report
    problem_report = ProblemReport(
        user_id=current_user.id,
        user_email=current_user.email,
        description=description,
        screenshot=screenshot,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        status="pending",
        created_time=datetime.now(UTC)
    )
    
    db.add(problem_report)
    db.commit()
    db.refresh(problem_report)
    
    return problem_report


@router.get("", response_model=List[ProblemReportOut])
def get_problem_reports(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get all problem reports - Admin only"""
    query = db.query(ProblemReport)
    
    if status:
        query = query.filter(ProblemReport.status == status)
    
    reports = query.order_by(desc(ProblemReport.created_time)).offset(skip).limit(limit).all()
    return reports


@router.patch("/{report_id}/status", response_model=ProblemReportOut)
def update_problem_report_status(
    report_id: int,
    status: str = Form(...),
    admin_notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update problem report status - Admin only"""
    report = db.query(ProblemReport).filter(ProblemReport.id == report_id).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Problem report not found")
    
    report.status = status
    
    if admin_notes is not None:
        report.admin_notes = admin_notes
    
    if status in ["resolved", "closed"]:
        report.resolved_time = datetime.now(UTC)
    
    db.commit()
    db.refresh(report)
    
    return report


@router.delete("/{report_id}")
def delete_problem_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a problem report - Admin only"""
    report = db.query(ProblemReport).filter(ProblemReport.id == report_id).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Problem report not found")
    
    db.delete(report)
    db.commit()
    
    return {"message": "Problem report deleted successfully"}
