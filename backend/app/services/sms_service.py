"""
AgriMart Twilio SMS & WhatsApp Dispatch Service.
Handles server-side SMS notifications to farmers and equipment owners
with automatic simulation fallback when credentials are not configured.
"""

import base64
import json
import urllib.parse
import urllib.request
from backend.app.core.config import settings
from backend.app.core.security import normalize_indian_phone
from backend.app.schemas.sms import SMSDispatchResponse


class AgriMartSMSService:
    """Server-side Twilio SMS dispatch service."""

    @classmethod
    def is_configured(cls) -> bool:
        return settings.is_sms_configured

    @classmethod
    def send_sms(cls, to_phone: str, message_body: str) -> SMSDispatchResponse:
        normalized_phone = normalize_indian_phone(to_phone)
        if not normalized_phone:
            return SMSDispatchResponse(
                success=False,
                simulated=True,
                mode="SIMULATED",
                error="Invalid recipient phone number",
            )

        if not cls.is_configured():
            return SMSDispatchResponse(
                success=True,
                simulated=True,
                mode="SIMULATED",
                to=normalized_phone,
            )

        sid = settings.TWILIO_ACCOUNT_SID
        token = settings.TWILIO_AUTH_TOKEN
        from_phone = settings.TWILIO_PHONE_NUMBER

        url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
        auth_bytes = f"{sid}:{token}".encode("utf-8")
        basic_auth = base64.b64encode(auth_bytes).decode("ascii")

        form_data = urllib.parse.urlencode(
            {
                "To": normalized_phone,
                "From": from_phone,
                "Body": message_body,
            }
        ).encode("utf-8")

        req = urllib.request.Request(url, data=form_data, method="POST")
        req.add_header("Authorization", f"Basic {basic_auth}")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")

        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                resp_body = resp.read().decode("utf-8")
                parsed = json.loads(resp_body)
                if parsed.get("sid"):
                    return SMSDispatchResponse(
                        success=True,
                        sid=parsed["sid"],
                        simulated=False,
                        mode="LIVE_TWILIO",
                        to=normalized_phone,
                    )
                return SMSDispatchResponse(
                    success=True,
                    simulated=True,
                    mode="SIMULATED_FALLBACK",
                    to=normalized_phone,
                    error=parsed.get("message"),
                )
        except Exception as e:
            return SMSDispatchResponse(
                success=True,
                simulated=True,
                mode="SIMULATED_FALLBACK",
                to=normalized_phone,
                error=str(e),
            )
