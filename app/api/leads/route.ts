import { NextRequest, NextResponse } from "next/server";
import {
  addLead,
  getLeadEvents,
  getLeads,
  updateLeadDetails,
  updateLeadPaymentStatus,
  updateLeadStatus,
  updateLeadTask,
  type IncomingLead,
  type LeadDetailsPayload,
  type LeadStatus,
  type LeadTaskPayload,
  type PaymentStatus,
} from "../../data/leads";
import { isAdminRequest } from "../../data/auth";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRM_WEBHOOK_SECRET;

  if (!secret) return true;

  return request.headers.get("x-crm-secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [leads, events] = await Promise.all([getLeads(), getLeadEvents()]);

  return NextResponse.json({ leads, events });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request) && !isAdminRequest(request)) {
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
  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as ({ id?: number; details?: LeadDetailsPayload; status?: LeadStatus; paymentStatus?: PaymentStatus } & LeadTaskPayload) | null;
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

  if (payload.details) {
    const lead = await updateLeadDetails(payload.id, payload.details);

    if (!lead) {
      return NextResponse.json({ message: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, lead });
  }

  if (typeof payload.nextAction === "string" || typeof payload.nextActionDate === "string") {
    const lead = await updateLeadTask(payload.id, {
      nextAction: payload.nextAction,
      nextActionDate: payload.nextActionDate,
    });

    if (!lead) {
      return NextResponse.json({ message: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, lead });
  }

  return NextResponse.json({ message: "Invalid status data" }, { status: 400 });
}
