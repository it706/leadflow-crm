import { NextRequest, NextResponse } from "next/server";
import { addLead, getLeads, updateLeadPaymentStatus, updateLeadStatus, type IncomingLead, type LeadStatus, type PaymentStatus } from "../../data/leads";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRM_WEBHOOK_SECRET;

  if (!secret) return true;

  return request.headers.get("x-crm-secret") === secret;
}

export async function GET() {
  return NextResponse.json({ leads: await getLeads() });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as IncomingLead | null;

  if (!payload?.client || !payload?.phone || !payload?.service) {
    return NextResponse.json({ message: "Invalid lead data" }, { status: 400 });
  }

  const lead = await addLead(payload);

  return NextResponse.json({ ok: true, lead }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as { id?: number; status?: LeadStatus; paymentStatus?: PaymentStatus } | null;
  const statuses: LeadStatus[] = ["Новая", "В работе", "Закрыта"];
  const paymentStatuses: PaymentStatus[] = ["Не оплачено", "Оплачено"];

  if (!payload?.id) {
    return NextResponse.json({ message: "Invalid lead id" }, { status: 400 });
  }

  if (payload.status && statuses.includes(payload.status)) {
    const lead = await updateLeadStatus(payload.id, payload.status);

    if (!lead) {
      return NextResponse.json({ message: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, lead });
  }

  if (payload.paymentStatus && paymentStatuses.includes(payload.paymentStatus)) {
    const lead = await updateLeadPaymentStatus(payload.id, payload.paymentStatus);

    if (!lead) {
      return NextResponse.json({ message: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, lead });
  }

  return NextResponse.json({ message: "Invalid status data" }, { status: 400 });
}
