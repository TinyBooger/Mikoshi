from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database import get_db
from models import ProblemReport, User, UserMessage
from schemas import ProblemReportCreate, ProblemReportOut, ProblemReportUserOut
from utils.audit_logger import audit_request
from utils.email_utils import BRAND_NAME
from utils.session import get_current_user, get_current_admin_user
from utils.content_review_queue import enqueue_character_review
from typing import List, Optional
from datetime import datetime, UTC
import os
import base64

router = APIRouter(prefix="/api/problem-reports", tags=["problem_reports"])


@router.post("", response_model=ProblemReportOut)
def create_problem_report(
    request: Request,
    description: Optional[str] = Form(None),
    screenshot: Optional[str] = Form(None),
    target_type: Optional[str] = Form(None),
    target_id: Optional[int] = Form(None),
    target_name: Optional[str] = Form(None),
    target_string_id: Optional[str] = Form(None),
    reason: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit a problem report"""
    # Create the problem report
    problem_report = ProblemReport(
        user_id=current_user.id,
        user_email=current_user.email,
        description=description or '',
        screenshot=screenshot,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        target_string_id=target_string_id,
        reason=reason,
        status="pending",
        created_time=datetime.now(UTC)
    )
    
    db.add(problem_report)
    db.commit()
    db.refresh(problem_report)

    if target_type == "character" and target_id:
        reason = f"User report #{problem_report.id}: {(description or '').strip()[:300]}"
        enqueue_character_review(
            db,
            character_id=target_id,
            source="user_report",
            reason=reason,
            triggered_by_report_id=problem_report.id,
        )
        db.commit()

    audit_request(
        request,
        action="create_problem_report",
        user_id=current_user.id,
        metadata={
            "report_id": problem_report.id,
            "target_type": target_type,
            "target_id": target_id,
            "target_name": target_name,
            "reason": reason,
            "has_screenshot": bool(screenshot),
        },
    )

    return problem_report


@router.get("/mine", response_model=List[ProblemReportUserOut])
def get_my_problem_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the signed-in user's general issue reports and their public responses."""
    reports = (
        db.query(ProblemReport)
        .filter(
            ProblemReport.user_id == current_user.id,
            ProblemReport.target_type.is_(None),
        )
        .order_by(desc(ProblemReport.created_time))
        .all()
    )
    return [
        {
            "id": report.id,
            "description": report.description,
            "reason": report.reason,
            "status": report.status,
            "created_time": report.created_time,
            "resolved_time": report.resolved_time,
            "user_note": report.user_note,
        }
        for report in reports
    ]


@router.get("", response_model=List[ProblemReportOut])
def get_problem_reports(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Get bug/website problem reports (not entity reports) - Admin only"""
    query = db.query(ProblemReport).filter(ProblemReport.target_type.is_(None))

    if status:
        query = query.filter(ProblemReport.status == status)

    reports = query.order_by(desc(ProblemReport.created_time)).offset(skip).limit(limit).all()
    return reports


@router.patch("/{report_id}/status", response_model=ProblemReportOut)
def update_problem_report_status(
    report_id: int,
    request: Request,
    status: Optional[str] = Form(None),
    admin_notes: Optional[str] = Form(None),
    user_note: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Update problem report status - Admin only"""
    report = db.query(ProblemReport).filter(ProblemReport.id == report_id).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Problem report not found")

    if status is None and admin_notes is None and user_note is None:
        raise HTTPException(status_code=400, detail="No report updates provided")

    previous_status = report.status
    resolving = status == "resolved" and previous_status != "resolved"

    if resolving:
        if user_note is None:
            raise HTTPException(
                status_code=400,
                detail="A public reply step is required when resolving a problem report",
            )
        if not report.user_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot notify the reporter because their account is unavailable",
            )

    if status is not None:
        if status not in ["pending", "in-progress", "resolved", "closed"]:
            raise HTTPException(status_code=400, detail="Invalid problem report status")
        report.status = status
    
    if admin_notes is not None:
        report.admin_notes = admin_notes

    if user_note is not None:
        report.user_note = user_note
    
    if status is not None and status != previous_status:
        if status in ["resolved", "closed"]:
            report.resolved_time = datetime.now(UTC)
        else:
            report.resolved_time = None

    if resolving and user_note.strip():
        db.add(UserMessage(
            user_id=report.user_id,
            msg_type="system",
            title=f"{BRAND_NAME}问题报告 #{report.id} 已解决",
            body=user_note.strip(),
            extra={"problem_report_id": report.id},
            created_by=current_admin.id,
        ))

    db.commit()
    db.refresh(report)

    audit_request(
        request,
        action="admin_update_problem_report",
        user_id=current_admin.id,
        metadata={
            "report_id": report_id,
            "reporter_id": report.user_id,
            "status": report.status,
            "admin_notes": admin_notes,
            "user_note": user_note,
        },
    )

    return report


@router.delete("/{report_id}")
def delete_problem_report(
    report_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Delete a problem report - Admin only"""
    report = db.query(ProblemReport).filter(ProblemReport.id == report_id).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Problem report not found")

    report_snapshot = {
        "report_id": report.id,
        "reporter_id": report.user_id,
        "target_type": report.target_type,
        "target_id": report.target_id,
        "reason": report.reason,
        "status": report.status,
    }

    db.delete(report)
    db.commit()

    audit_request(
        request,
        action="admin_delete_problem_report",
        user_id=current_admin.id,
        metadata=report_snapshot,
    )
    
    return {"message": "Problem report deleted successfully"}
