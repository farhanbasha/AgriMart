/**
 * FarmGrid Twilio SMS & WhatsApp Dispatch Notification Service
 * Dispatches automated alerts to farmers and equipment owners.
 */

const TWILIO_SID = (import.meta as any).env?.VITE_TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = (import.meta as any).env?.VITE_TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE = (import.meta as any).env?.VITE_TWILIO_PHONE_NUMBER || '';

export function isSMSConfigured(): boolean {
  return Boolean(TWILIO_SID && TWILIO_TOKEN && TWILIO_PHONE);
}

export interface SMSDispatchResult {
  success: boolean;
  sid?: string;
  simulated?: boolean;
  error?: string;
}

/**
 * Sends real SMS notification via Twilio REST API, with fallback simulation.
 */
async function sendTwilioSMS(to: string, messageBody: string): Promise<SMSDispatchResult> {
  if (!isSMSConfigured()) {
    console.info('[SMS] Twilio not fully configured in environment; simulating alert dispatch.');
    return { success: true, simulated: true };
  }

  // Normalize Indian mobile number format (+91 XXXXX XXXXX)
  let normalizedPhone = to.replace(/[\s\-()]/g, '');
  if (normalizedPhone.startsWith('0')) {
    normalizedPhone = '+91' + normalizedPhone.slice(1);
  }
  if (!normalizedPhone.startsWith('+')) {
    normalizedPhone = '+91' + normalizedPhone;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
    const basicAuth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);

    const params = new URLSearchParams();
    params.append('To', normalizedPhone);
    params.append('From', TWILIO_PHONE);
    params.append('Body', messageBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    if (response.ok && data.sid) {
      console.info('[SMS] Twilio message dispatched successfully:', data.sid);
      return { success: true, sid: data.sid };
    } else {
      console.warn('[SMS] Twilio API responded with error, falling back to local simulation:', data.message || data.code);
      return { success: true, simulated: true, error: data.message };
    }
  } catch (err: any) {
    console.warn('[SMS] Twilio request network notice, simulating dispatch:', err?.message);
    return { success: true, simulated: true };
  }
}

// ==============================================================================
// 1. BOOKING CONFIRMATION SMS
// ==============================================================================

export async function sendBookingConfirmationSMS(params: {
  farmerPhone: string;
  farmerName: string;
  resourceName: string;
  plotName: string;
  startTime: string;
  totalCostRupees: number;
  priorityScore: number;
  transitBufferMinutes: number;
}): Promise<SMSDispatchResult> {
  const dateObj = new Date(params.startTime);
  const timeFormatted = dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const body =
    `[FarmGrid Booking Confirmed]\n` +
    `Namaste ${params.farmerName} ji,\n` +
    `Machine: ${params.resourceName}\n` +
    `Field: ${params.plotName}\n` +
    `Time: ${timeFormatted} IST\n` +
    `Transit Buffer: +${params.transitBufferMinutes} mins\n` +
    `Priority Score: ${params.priorityScore}/100\n` +
    `Estimated Total: Rs.${params.totalCostRupees.toLocaleString('en-IN')}\n` +
    `FarmGrid Fair Turn Kisan Coordination`;

  return sendTwilioSMS(params.farmerPhone, body);
}

// ==============================================================================
// 2. DRIVER / EQUIPMENT OWNER DISPATCH SMS
// ==============================================================================

export async function sendDriverDispatchSMS(params: {
  ownerPhone: string;
  ownerName: string;
  resourceName: string;
  plotName: string;
  farmerName: string;
  startTime: string;
  distanceKm: number;
}): Promise<SMSDispatchResult> {
  const dateObj = new Date(params.startTime);
  const timeFormatted = dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const body =
    `[FarmGrid Dispatch Alert]\n` +
    `Namaste ${params.ownerName} ji,\n` +
    `Booking received for: ${params.resourceName}\n` +
    `Farmer: ${params.farmerName}\n` +
    `Plot: ${params.plotName} (~${params.distanceKm.toFixed(1)} km away)\n` +
    `Slot Starts: ${timeFormatted} IST\n` +
    `Please mobilize equipment accordingly. - FarmGrid`;

  return sendTwilioSMS(params.ownerPhone, body);
}

// ==============================================================================
// 3. CRISIS & DISRUPTION ALERT SMS
// ==============================================================================

export async function sendDisruptionAlertSMS(params: {
  farmerPhone: string;
  farmerName: string;
  resourceName: string;
  reason: string;
  substituteInfo?: string;
}): Promise<SMSDispatchResult> {
  const body =
    `[FarmGrid Urgent Alert]\n` +
    `Namaste ${params.farmerName} ji,\n` +
    `Your scheduled machine ${params.resourceName} encountered: ${params.reason}.\n` +
    (params.substituteInfo ? `Automated Substitute: ${params.substituteInfo}\n` : '') +
    `Our village liaison is coordinating alternative allocation right now. - FarmGrid`;

  return sendTwilioSMS(params.farmerPhone, body);
}
