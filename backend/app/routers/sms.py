"""
SMS gateway router for dispatching real or simulated rural SMS notifications.
"""

from fastapi import APIRouter
from ..schemas.sms import SMSDispatchRequest, SMSDispatchResponse
from ..services.sms_service import AgriMartSMSService

router = APIRouter(prefix="/api/v1/sms", tags=["SMS Gateway"])


@router.post("/send", response_model=SMSDispatchResponse)
def send_sms_endpoint(req: SMSDispatchRequest):
    """Dispatch an SMS alert via Twilio REST API or fallback simulation."""
    return AgriMartSMSService.send_sms(req.to_phone, req.message_body)
