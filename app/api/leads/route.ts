import { NextRequest, NextResponse } from "next/server";
import {
  addLead,
  addLeadNote,
  archiveLead,
  getLeadEvents,
  getLeads,
  updateLeadArchive,
  updateLeadDetails,
  updateLeadPaymentStatus,
  updateLeadStatus,
  updateLeadTask,
  type IncomingLead,
  type LeadArchivePayload,
  type LeadDetailsPayload,
  type LeadNotePayload,
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

  const payload = (await request.json().catch(() => null)) as ({ id?: number; details?: LeadDetailsPayload; status?: LeadStatus; paymentStatus?: PaymentStatus } & LeadTaskPayload & LeadNotePayload & LeadArchivePayload) | null;
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

  if (typeof payload.archived === "boolean") {
    const lead = await updateLeadArchive(payload.id, payload.archived);

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

  if (typeof payload.note === "string") {
    const lead = await addLeadNote(payload.id, { note: payload.note });

    if (!lead) {
      return NextResponse.json({ message: "Lead not found or empty note" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, lead });
  }

  if (typeof payload.nextAction === "string" || typeof payload.nextActionDate === "string" || typeof payload.nextActionTime === "string") {
    const lead = await updateLeadTask(payload.id, {
      nextAction: payload.nextAction,
      nextActionDate: payload.nextActionDate,
      nextActionTime: payload.nextActionTime,
    });

    if (!lead) {
      return NextResponse.json({ message: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, lead });
  }

  return NextResponse.json({ message: "Invalid status data" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const id = Number(request.nextUrl.searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ message: "Invalid lead id" }, { status: 400 });
  }

  const lead = await archiveLead(id);

  if (!lead) {
    return NextResponse.json({ message: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lead });
}
