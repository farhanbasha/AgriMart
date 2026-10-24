"""
Pydantic schemas for Twilio SMS & WhatsApp Dispatch Notifications.
"""

from typing import Optional
from pydantic import BaseModel, Field


class SMSDispatchRequest(BaseModel):
    to_phone: str = Field(..., min_length=6, max_length=25)
    message_body: str = Field(..., min_length=1, max_length=1600)


class SMSDispatchResponse(BaseModel):
    success: bool
    sid: Optional[str] = None
    simulated: bool = False
    mode: str = "SIMULATED"
    to: Optional[str] = None
    error: Optional[str] = None
