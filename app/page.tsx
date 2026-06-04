"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { type Lead, type LeadEvent, type LeadSource, type LeadStatus, type PaymentStatus } from "./data/leads";

const statuses: Array<"Все" | LeadStatus> = ["Все", "Новая", "В работе", "Закрыта"];
const pipelineStatuses: LeadStatus[] = ["Новая", "В работе", "Закрыта"];
const paymentStatuses: PaymentStatus[] = ["Не оплачено", "Оплачено"];
const paymentFilters: Array<"Все" | PaymentStatus> = ["Все", "Не оплачено", "Оплачено"];
const projects: Array<"Все" | LeadSource> = ["Все", "NordCut", "Valery's Coffee", "Ручная заявка"];

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function getPaymentStatus(lead: Lead) {
  return lead.paymentStatus ?? "Не оплачено";
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function escapeCsvCell(value: string | number) {
  const stringValue = String(value ?? "");

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  return digits || phone.trim().toLowerCase();
}

function getPhoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }

  return digits;
}

function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [activeStatus, setActiveStatus] = useState<"Все" | LeadStatus>("Все");
  const [activeProject, setActiveProject] = useState<"Все" | LeadSource>("Все");
  const [activePayment, setActivePayment] = useState<"Все" | PaymentStatus>("Все");
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [taskText, setTaskText] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [deleteConfirmLeadId, setDeleteConfirmLeadId] = useState<number | null>(null);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [copiedPhoneLeadId, setCopiedPhoneLeadId] = useState<number | null>(null);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [editLead, setEditLead] = useState({
    budget: "",
    client: "",
    comment: "",
    phone: "",
    service: "",
  });
  const [editError, setEditError] = useState("");
  const [isSavingLeadDetails, setIsSavingLeadDetails] = useState(false);
  const [manualLead, setManualLead] = useState({
    budget: "",
    client: "",
    comment: "",
    phone: "",
    service: "",
  });
  const [manualError, setManualError] = useState("");
  const [isSavingManualLead, setIsSavingManualLead] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function loadLeads() {
    try {
      const response = await fetch("/api/leads", { cache: "no-store" });

      if (response.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      const data = (await response.json()) as { leads: Lead[]; events: LeadEvent[] };
      setLeads(data.leads);
      setEvents(data.events ?? []);
      setSelectedLeadId((current) => current ?? data.leads[0]?.id ?? null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    async function checkAuth() {
      const response = await fetch("/api/auth", { cache: "no-store" });
      const data = (await response.json()) as { authenticated: boolean };

      setIsAuthenticated(data.authenticated);

      if (data.authenticated) {
        await loadLeads();
      } else {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = window.setInterval(loadLeads, 5000);

    return () => window.clearInterval(interval);
  }, [isAuthenticated]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const statusMatches = activeStatus === "Все" || lead.status === activeStatus;
      const projectMatches = activeProject === "Все" || lead.project === activeProject;
      const paymentMatches = activePayment === "Все" || getPaymentStatus(lead) === activePayment;
      const queryMatches = `${lead.client} ${lead.project} ${lead.service}`.toLowerCase().includes(query.toLowerCase());

      return statusMatches && projectMatches && paymentMatches && queryMatches;
    });
  }, [activePayment, activeProject, activeStatus, leads, query]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? filteredLeads[0] ?? leads[0];
  const openLeads = leads.filter((lead) => lead.status !== "Закрыта");
  const inWorkLeads = leads.filter((lead) => lead.status === "В работе");
  const inWorkRevenue = inWorkLeads.reduce((sum, lead) => sum + lead.budget, 0);
  const paidRevenue = leads.filter((lead) => getPaymentStatus(lead) === "Оплачено").reduce((sum, lead) => sum + lead.budget, 0);
  const selectedLeadEvents = selectedLead ? events.filter((event) => event.leadId === selectedLead.id) : [];
  const projectStats = projects
    .filter((project): project is LeadSource => project !== "Все")
    .map((project) => {
      const projectLeads = leads.filter((lead) => lead.project === project);
      const activeLeads = projectLeads.filter((lead) => lead.status !== "Закрыта");
      const paidLeads = projectLeads.filter((lead) => getPaymentStatus(lead) === "Оплачено");
      const activeRevenue = activeLeads.reduce((sum, lead) => sum + lead.budget, 0);
      const paidProjectRevenue = paidLeads.reduce((sum, lead) => sum + lead.budget, 0);
      const conversion = projectLeads.length ? (paidLeads.length / projectLeads.length) * 100 : 0;

      return {
        project,
        activeCount: activeLeads.length,
        activeRevenue,
        conversion,
        paidCount: paidLeads.length,
        paidRevenue: paidProjectRevenue,
        totalCount: projectLeads.length,
      };
    });
  const todayDateKey = getTodayDateKey();
  const allClientStats = Object.values(
    leads.reduce<Record<string, {
      activeCount: number;
      lastLead: Lead;
      leadCount: number;
      paidRevenue: number;
      phone: string;
      projects: Set<LeadSource>;
      totalRevenue: number;
    }>>((acc, lead) => {
      const key = normalizePhone(lead.phone);
      const current = acc[key] ?? {
        activeCount: 0,
        lastLead: lead,
        leadCount: 0,
        paidRevenue: 0,
        phone: lead.phone,
        projects: new Set<LeadSource>(),
        totalRevenue: 0,
      };

      current.leadCount += 1;
      current.totalRevenue += lead.budget;
      current.projects.add(lead.project);

      if (lead.status !== "Закрыта") {
        current.activeCount += 1;
      }

      if (getPaymentStatus(lead) === "Оплачено") {
        current.paidRevenue += lead.budget;
      }

      if (lead.id > current.lastLead.id) {
        current.lastLead = lead;
        current.phone = lead.phone;
      }

      acc[key] = current;

      return acc;
    }, {}),
  ).sort((first, second) => second.totalRevenue - first.totalRevenue);
  const clientStats = allClientStats.slice(0, 6);
  const selectedClientStats = selectedLead ? allClientStats.find((client) => normalizePhone(client.phone) === normalizePhone(selectedLead.phone)) : undefined;
  const taskLeads = leads
    .filter((lead) => lead.status !== "Закрыта" && lead.nextAction && lead.nextActionDate)
    .filter((lead) => lead.nextActionDate <= todayDateKey)
    .sort((first, second) => first.nextActionDate.localeCompare(second.nextActionDate));
  const overdueTasks = taskLeads.filter((lead) => lead.nextActionDate < todayDateKey);
  const todayTasks = taskLeads.filter((lead) => lead.nextActionDate === todayDateKey);

  useEffect(() => {
    setTaskText(selectedLead?.nextAction ?? "");
    setTaskDate(selectedLead?.nextActionDate ?? "");
    setNoteText("");
    setNoteError("");
    setDeleteConfirmLeadId(null);
    setIsEditingLead(false);
    setEditError("");
    setEditLead({
      budget: selectedLead?.budget ? String(selectedLead.budget) : "",
      client: selectedLead?.client ?? "",
      comment: selectedLead?.comment ?? "",
      phone: selectedLead?.phone ?? "",
      service: selectedLead?.service ?? "",
    });
  }, [selectedLead?.id, selectedLead?.nextAction, selectedLead?.nextActionDate]);

  async function updateStatus(leadId: number, status: LeadStatus) {
    setLeads((current) => current.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)));

    await fetch("/api/leads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: leadId, status }),
    });

    await loadLeads();
  }

  async function updatePaymentStatus(leadId: number, paymentStatus: PaymentStatus) {
    setLeads((current) => current.map((lead) => (lead.id === leadId ? { ...lead, paymentStatus } : lead)));

    await fetch("/api/leads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: leadId, paymentStatus }),
    });

    await loadLeads();
  }

  async function saveTask() {
    if (!selectedLead) return;

    setLeads((current) =>
      current.map((lead) => (lead.id === selectedLead.id ? { ...lead, nextAction: taskText.trim(), nextActionDate: taskDate } : lead)),
    );

    await fetch("/api/leads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: selectedLead.id,
        nextAction: taskText.trim(),
        nextActionDate: taskDate,
      }),
    });

    await loadLeads();
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLead) return;

    if (!noteText.trim()) {
      setNoteError("Напишите заметку перед сохранением.");
      return;
    }

    setIsSavingNote(true);
    setNoteError("");

    try {
      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedLead.id,
          note: noteText.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setNoteError(data?.message ?? "Не удалось сохранить заметку.");
        return;
      }

      setNoteText("");
      await loadLeads();
    } finally {
      setIsSavingNote(false);
    }
  }

  async function removeSelectedLead() {
    if (!selectedLead) return;

    if (deleteConfirmLeadId !== selectedLead.id) {
      setDeleteConfirmLeadId(selectedLead.id);
      return;
    }

    setIsDeletingLead(true);

    try {
      const response = await fetch(`/api/leads?id=${selectedLead.id}`, {
        method: "DELETE",
      });

      if (!response.ok) return;

      setLeads((current) => current.filter((lead) => lead.id !== selectedLead.id));
      setEvents((current) => current.filter((event) => event.leadId !== selectedLead.id));
      setSelectedLeadId(null);
      setDeleteConfirmLeadId(null);
      await loadLeads();
    } finally {
      setIsDeletingLead(false);
    }
  }

  async function createManualLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const budget = Number(manualLead.budget.replace(/\D/g, ""));

    if (!manualLead.client.trim() || !manualLead.phone.trim() || !manualLead.service.trim()) {
      setManualError("Заполните имя, телефон и услугу.");
      return;
    }

    setIsSavingManualLead(true);
    setManualError("");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          budget,
          client: manualLead.client.trim(),
          comment: manualLead.comment.trim() || "Ручная заявка добавлена оператором CRM.",
          phone: manualLead.phone.trim(),
          project: "Ручная заявка",
          service: manualLead.service.trim(),
        }),
      });
      const data = (await response.json().catch(() => null)) as { lead?: Lead; message?: string } | null;

      if (!response.ok || !data?.lead) {
        setManualError(data?.message ?? "Не удалось создать заявку.");
        return;
      }

      setManualLead({
        budget: "",
        client: "",
        comment: "",
        phone: "",
        service: "",
      });
      setIsManualFormOpen(false);
      setSelectedLeadId(data.lead.id);
      await loadLeads();
    } finally {
      setIsSavingManualLead(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: loginPassword }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setLoginError(data?.message ?? "Не удалось войти.");
        return;
      }

      setLoginPassword("");
      setIsAuthenticated(true);
      await loadLeads();
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    setIsAuthenticated(false);
    setLeads([]);
    setEvents([]);
    setSelectedLeadId(null);
  }

  async function copySelectedPhone() {
    if (!selectedLead) return;

    try {
      await navigator.clipboard.writeText(selectedLead.phone);
      setCopiedPhoneLeadId(selectedLead.id);
      window.setTimeout(() => setCopiedPhoneLeadId(null), 1800);
    } catch {
      setCopiedPhoneLeadId(null);
    }
  }

  async function saveLeadDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLead) return;

    const budget = Number(editLead.budget.replace(/\D/g, ""));

    if (!editLead.client.trim() || !editLead.phone.trim() || !editLead.service.trim()) {
      setEditError("Заполните клиента, телефон и услугу.");
      return;
    }

    setIsSavingLeadDetails(true);
    setEditError("");

    try {
      const response = await fetch("/api/leads", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          details: {
            budget,
            client: editLead.client.trim(),
            comment: editLead.comment.trim(),
            phone: editLead.phone.trim(),
            service: editLead.service.trim(),
          },
          id: selectedLead.id,
        }),
      });
      const data = (await response.json().catch(() => null)) as { lead?: Lead; message?: string } | null;

      if (!response.ok || !data?.lead) {
        setEditError(data?.message ?? "Не удалось сохранить заявку.");
        return;
      }

      setLeads((current) => current.map((lead) => (lead.id === selectedLead.id ? data.lead! : lead)));
      setIsEditingLead(false);
      await loadLeads();
    } finally {
      setIsSavingLeadDetails(false);
    }
  }

  function exportCsv() {
    const headers = ["ID", "Клиент", "Телефон", "Проект", "Услуга", "Статус", "Оплата", "Сумма", "Задача", "Дата задачи", "Создана", "Комментарий"];
    const rows = leads.map((lead) => [
      lead.id,
      lead.client,
      lead.phone,
      lead.project,
      lead.service,
      lead.status,
      getPaymentStatus(lead),
      lead.budget,
      lead.nextAction ?? "",
      lead.nextActionDate ?? "",
      lead.createdAt,
      lead.comment,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `leadflow-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  function getNextStatus(status: LeadStatus) {
    if (status === "Новая") return "В работе";
    if (status === "В работе") return "Закрыта";

    return null;
  }

  const selectedPhoneDigits = selectedLead ? getPhoneDigits(selectedLead.phone) : "";
  const selectedPhoneHref = selectedPhoneDigits ? `+${selectedPhoneDigits}` : selectedLead?.phone ?? "";

  if (isAuthenticated === null) {
    return (
      <main className="authScreen">
        <section className="authCard">
          <span>LeadFlow CRM</span>
          <h1>Проверяем доступ</h1>
          <p>CRM готовит защищенную панель заявок.</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="authScreen">
        <section className="authCard">
          <span>LeadFlow CRM</span>
          <h1>Вход в CRM</h1>
          <p>Введите пароль администратора, чтобы открыть заявки, клиентов и выручку.</p>
          <form onSubmit={login}>
            <label>
              Пароль
              <input
                autoComplete="current-password"
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="CRM_ADMIN_PASSWORD"
                type="password"
                value={loginPassword}
              />
            </label>
            <button disabled={isLoggingIn} type="submit">
              {isLoggingIn ? "Проверяем" : "Войти"}
            </button>
            {loginError ? <small>{loginError}</small> : null}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="logo">
          <span>LF</span>
          <div>
            <strong>LeadFlow</strong>
            <small>центр заявок</small>
          </div>
        </div>
        <nav aria-label="Разделы CRM">
          <a className="active" href="#leads">Заявки</a>
          <a href="#analytics">Выручка</a>
          <a href="#tasks">Задачи</a>
          <a href="#clients">Клиенты</a>
          <a href="#how">Как работает</a>
        </nav>
        <div className="sidebarCard">
          <span>Подключено</span>
          <strong>NordCut и Valery's Coffee</strong>
          <p>Новые заявки приходят из форм сайтов и появляются здесь автоматически.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topPanel">
          <div>
            <p className="eyebrow">общая CRM для заявок</p>
            <h1>Заявки из Telegram-проектов</h1>
            <p className="topDescription">
              Эта панель собирает заявки с барбершопа NordCut и интернет-магазина Valery's Coffee. Telegram получает уведомление, а CRM сохраняет копию для контроля статуса и выручки.
            </p>
          </div>
          <div className="topActions">
            <button onClick={() => setIsManualFormOpen((current) => !current)} type="button">
              Новая заявка
            </button>
            <button onClick={exportCsv} type="button">
              Экспорт CSV
            </button>
            <button onClick={loadLeads} type="button">
              Обновить
            </button>
            <button onClick={logout} type="button">
              Выйти
            </button>
          </div>
        </header>

        {isManualFormOpen ? (
          <section className="manualLeadPanel" aria-label="Ручное добавление заявки">
            <div>
              <p className="eyebrow">ручной ввод</p>
              <h2>Добавить заявку без сайта</h2>
              <p>Для звонков, личных сообщений и клиентов, которых администратор внес вручную.</p>
            </div>
            <form onSubmit={createManualLead}>
              <label>
                Клиент
                <input
                  onChange={(event) => setManualLead((current) => ({ ...current, client: event.target.value }))}
                  placeholder="Например: Анна"
                  value={manualLead.client}
                />
              </label>
              <label>
                Телефон
                <input
                  onChange={(event) => setManualLead((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+7 999 000-00-00"
                  value={manualLead.phone}
                />
              </label>
              <label>
                Услуга
                <input
                  onChange={(event) => setManualLead((current) => ({ ...current, service: event.target.value }))}
                  placeholder="Например: консультация или заказ кофе"
                  value={manualLead.service}
                />
              </label>
              <label>
                Сумма
                <input
                  inputMode="numeric"
                  onChange={(event) => setManualLead((current) => ({ ...current, budget: event.target.value }))}
                  placeholder="5000"
                  value={manualLead.budget}
                />
              </label>
              <label className="wideField">
                Комментарий
                <input
                  onChange={(event) => setManualLead((current) => ({ ...current, comment: event.target.value }))}
                  placeholder="Что важно по заявке"
                  value={manualLead.comment}
                />
              </label>
              <div className="manualLeadActions">
                <span>{manualError}</span>
                <button disabled={isSavingManualLead} type="submit">
                  {isSavingManualLead ? "Сохраняем" : "Создать заявку"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="flowInfo" id="how">
          <article>
            <span>01</span>
            <strong>Клиент отправляет форму</strong>
            <p>На сайте барбершопа или кофе-магазина клиент оставляет телефон и детали заказа.</p>
          </article>
          <article>
            <span>02</span>
            <strong>Telegram получает уведомление</strong>
            <p>Владелец видит заявку в боте, как и раньше.</p>
          </article>
          <article>
            <span>03</span>
            <strong>CRM фиксирует сделку</strong>
            <p>Заявка появляется здесь, попадает в выручку и получает рабочий статус.</p>
          </article>
        </section>

        <section className="metrics" id="analytics">
          <article>
            <span>Всего заявок</span>
            <strong>{leads.length}</strong>
            <small>{isLoading ? "загружаем" : "из подключенных проектов"}</small>
          </article>
          <article>
            <span>Заявки в работе</span>
            <strong>{inWorkLeads.length}</strong>
            <small>активные обращения клиентов</small>
          </article>
          <article>
            <span>Выручка в работе</span>
            <strong>{formatMoney(inWorkRevenue)} ₽</strong>
            <small>сумма заявок со статусом в работе</small>
          </article>
          <article>
            <span>Оплачено</span>
            <strong>{formatMoney(paidRevenue)} ₽</strong>
            <small>фактически оплаченные заявки</small>
          </article>
        </section>

        <section className="taskOverview" id="tasks" aria-label="Задачи на сегодня">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">рабочий день</p>
              <h2>Кому нужно написать или позвонить</h2>
            </div>
            <span>{overdueTasks.length} просрочено, {todayTasks.length} запланировано на сегодня</span>
          </div>
          <div className="taskGrid">
            {taskLeads.length > 0 ? (
              taskLeads.map((lead) => (
                <button className={lead.nextActionDate < todayDateKey ? "taskCard overdue" : "taskCard"} key={lead.id} onClick={() => setSelectedLeadId(lead.id)} type="button">
                  <span>{lead.nextActionDate < todayDateKey ? "Просрочено" : "Сегодня"}</span>
                  <strong>{lead.client}</strong>
                  <small>{lead.phone}</small>
                  <p>{lead.nextAction}</p>
                  <b>{lead.project} · {lead.nextActionDate}</b>
                </button>
              ))
            ) : (
              <div className="emptyTasks">
                <strong>На сегодня задач нет</strong>
                <p>Добавьте следующее действие в карточке заявки, и CRM покажет его здесь в нужный день.</p>
              </div>
            )}
          </div>
        </section>

        <section className="projectAnalytics" aria-label="Эффективность проектов">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">аналитика</p>
              <h2>Эффективность проектов</h2>
            </div>
            <span>Сравнение заявок и оплаты по подключенным сайтам</span>
          </div>
          <div className="projectGrid">
            {projectStats.map((stat) => (
              <article className="projectCard" key={stat.project}>
                <header>
                  <strong>{stat.project}</strong>
                  <span>{stat.totalCount} заявок</span>
                </header>
                <div className="projectNumbers">
                  <div>
                    <small>В работе</small>
                    <b>{stat.activeCount}</b>
                  </div>
                  <div>
                    <small>Потенциал</small>
                    <b>{formatMoney(stat.activeRevenue)} ₽</b>
                  </div>
                  <div>
                    <small>Оплачено</small>
                    <b>{formatMoney(stat.paidRevenue)} ₽</b>
                  </div>
                  <div>
                    <small>Конверсия</small>
                    <b>{formatPercent(stat.conversion)}</b>
                  </div>
                </div>
                <div className="conversionBar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, stat.conversion)}%` }} />
                </div>
                <p>{stat.paidCount} из {stat.totalCount || 0} заявок оплачено</p>
              </article>
            ))}
          </div>
        </section>

        <section className="clientAnalytics" id="clients" aria-label="База клиентов">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">клиентская база</p>
              <h2>Повторные клиенты и ценность контактов</h2>
            </div>
            <span>CRM группирует заявки по телефону и показывает, какие клиенты уже приносили деньги бизнесу</span>
          </div>
          <div className="clientGrid">
            {clientStats.map((client) => (
              <article className="clientCard" key={normalizePhone(client.phone)}>
                <header>
                  <div>
                    <strong>{client.lastLead.client}</strong>
                    <span>{client.phone}</span>
                  </div>
                  <b>{client.leadCount}</b>
                </header>
                <div className="clientValues">
                  <div>
                    <small>Всего заявок</small>
                    <strong>{client.leadCount}</strong>
                  </div>
                  <div>
                    <small>В работе</small>
                    <strong>{client.activeCount}</strong>
                  </div>
                  <div>
                    <small>Потенциал</small>
                    <strong>{formatMoney(client.totalRevenue)} ₽</strong>
                  </div>
                  <div>
                    <small>Оплачено</small>
                    <strong>{formatMoney(client.paidRevenue)} ₽</strong>
                  </div>
                </div>
                <p>{Array.from(client.projects).join(", ")}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="contentGrid" id="leads">
          <div className="leadBoard">
            <div className="boardHeader">
              <div>
                <h2>Воронка заявок</h2>
                <p>Смотрите заявки по этапам, открывайте карточку клиента и переводите сделку дальше.</p>
              </div>
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по клиенту, проекту или услуге" value={query} />
            </div>

            <div className="filterRow">
              {statuses.map((status) => (
                <button className={activeStatus === status ? "active" : ""} key={status} onClick={() => setActiveStatus(status)} type="button">
                  {status}
                </button>
              ))}
            </div>

            <div className="sourceRow">
              {projects.map((project) => (
                <button className={activeProject === project ? "active" : ""} key={project} onClick={() => setActiveProject(project)} type="button">
                  {project}
                </button>
              ))}
            </div>

            <div className="paymentFilterRow">
              {paymentFilters.map((payment) => (
                <button className={activePayment === payment ? "active" : ""} key={payment} onClick={() => setActivePayment(payment)} type="button">
                  {payment}
                </button>
              ))}
            </div>

            <div className="kanbanBoard">
              {pipelineStatuses.map((status) => {
                const columnLeads = filteredLeads.filter((lead) => lead.status === status);
                const columnTotal = columnLeads.reduce((sum, lead) => sum + lead.budget, 0);

                return (
                  <section className="kanbanColumn" key={status}>
                    <header>
                      <div>
                        <strong>{status}</strong>
                        <span>{columnLeads.length} заявок</span>
                      </div>
                      <b>{formatMoney(columnTotal)} ₽</b>
                    </header>

                    <div className="kanbanCards">
                      {columnLeads.map((lead) => {
                        const nextStatus = getNextStatus(lead.status);

                        return (
                          <article className={selectedLead?.id === lead.id ? "kanbanCard active" : "kanbanCard"} key={lead.id}>
                            <button className="kanbanCardMain" onClick={() => setSelectedLeadId(lead.id)} type="button">
                              <span className={getPaymentStatus(lead) === "Оплачено" ? "paymentBadge paid" : "paymentBadge"}>{getPaymentStatus(lead)}</span>
                              <strong>{lead.client}</strong>
                              <small>{lead.project}</small>
                              <p>{lead.service}</p>
                              {lead.nextAction ? <em>{lead.nextActionDate ? `${lead.nextActionDate} · ` : ""}{lead.nextAction}</em> : null}
                              <b>{formatMoney(lead.budget)} ₽</b>
                            </button>
                            {nextStatus ? (
                              <button className="kanbanMove" onClick={() => updateStatus(lead.id, nextStatus)} type="button">
                                В {nextStatus.toLowerCase()}
                              </button>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="listTitle">
              <h3>Детальный список</h3>
              <span>{filteredLeads.length} заявок</span>
            </div>

            <div className="leadList">
              <div className="leadHeader" aria-hidden="true">
                <span>Статус</span>
                <span>Клиент</span>
                <span>Заявка</span>
                <span>Оплата</span>
                <span>Сумма</span>
              </div>
              {filteredLeads.map((lead) => (
                <button className={selectedLead?.id === lead.id ? "leadRow active" : "leadRow"} key={lead.id} onClick={() => setSelectedLeadId(lead.id)} type="button">
                  <span className="statusBadge">{lead.status}</span>
                  <div>
                    <strong>{lead.client}</strong>
                    <small>{lead.phone}</small>
                  </div>
                  <div>
                    <strong>{lead.service}</strong>
                    <small>{lead.nextAction ? `Задача: ${lead.nextAction}` : `${lead.project} · ${lead.createdAt}`}</small>
                  </div>
                  <span className={getPaymentStatus(lead) === "Оплачено" ? "paymentBadge paid" : "paymentBadge"}>{getPaymentStatus(lead)}</span>
                  <strong>{formatMoney(lead.budget)} ₽</strong>
                </button>
              ))}
            </div>
          </div>

          {selectedLead ? (
            <aside className="leadDetails">
              <div className="detailsHead">
                <span>#{selectedLead.id}</span>
                <span className={getPaymentStatus(selectedLead) === "Оплачено" ? "paymentBadge paid" : "paymentBadge"}>{getPaymentStatus(selectedLead)}</span>
              </div>
              <h2>{selectedLead.client}</h2>
              <p>{selectedLead.project}</p>

              <button className="editLeadToggle" onClick={() => setIsEditingLead((current) => !current)} type="button">
                {isEditingLead ? "Закрыть редактирование" : "Редактировать заявку"}
              </button>

              {isEditingLead ? (
                <form className="editLeadForm" onSubmit={saveLeadDetails}>
                  <label>
                    Клиент
                    <input onChange={(event) => setEditLead((current) => ({ ...current, client: event.target.value }))} value={editLead.client} />
                  </label>
                  <label>
                    Телефон
                    <input onChange={(event) => setEditLead((current) => ({ ...current, phone: event.target.value }))} value={editLead.phone} />
                  </label>
                  <label>
                    Услуга
                    <input onChange={(event) => setEditLead((current) => ({ ...current, service: event.target.value }))} value={editLead.service} />
                  </label>
                  <label>
                    Сумма
                    <input inputMode="numeric" onChange={(event) => setEditLead((current) => ({ ...current, budget: event.target.value }))} value={editLead.budget} />
                  </label>
                  <label>
                    Комментарий
                    <input onChange={(event) => setEditLead((current) => ({ ...current, comment: event.target.value }))} value={editLead.comment} />
                  </label>
                  {editError ? <span>{editError}</span> : null}
                  <button disabled={isSavingLeadDetails} type="submit">
                    {isSavingLeadDetails ? "Сохраняем" : "Сохранить изменения"}
                  </button>
                </form>
              ) : null}

              <dl>
                <div>
                  <dt>Услуга</dt>
                  <dd>{selectedLead.service}</dd>
                </div>
                <div>
                  <dt>Сумма</dt>
                  <dd>{formatMoney(selectedLead.budget)} ₽</dd>
                </div>
                <div>
                  <dt>Телефон</dt>
                  <dd>{selectedLead.phone}</dd>
                </div>
                <div>
                  <dt>Создана</dt>
                  <dd>{selectedLead.createdAt}</dd>
                </div>
                <div>
                  <dt>Статус</dt>
                  <dd>{selectedLead.status}</dd>
                </div>
                <div>
                  <dt>Оплата</dt>
                  <dd>{getPaymentStatus(selectedLead)}</dd>
                </div>
              </dl>

              <div className="commentBox">
                <span>Детали заявки</span>
                <p>{selectedLead.comment}</p>
              </div>

              <div className="contactActions">
                <a href={`tel:${selectedPhoneHref}`}>Позвонить</a>
                {selectedPhoneDigits ? (
                  <a href={`https://wa.me/${selectedPhoneDigits}`} rel="noreferrer" target="_blank">
                    WhatsApp
                  </a>
                ) : null}
                <button onClick={copySelectedPhone} type="button">
                  {copiedPhoneLeadId === selectedLead.id ? "Скопировано" : "Скопировать телефон"}
                </button>
              </div>

              {selectedClientStats ? (
                <div className="clientSummary">
                  <span>История клиента</span>
                  <div>
                    <strong>{selectedClientStats.leadCount}</strong>
                    <small>заявок всего</small>
                  </div>
                  <div>
                    <strong>{formatMoney(selectedClientStats.paidRevenue)} ₽</strong>
                    <small>оплачено</small>
                  </div>
                  <p>{selectedClientStats.activeCount} заявок сейчас в работе</p>
                </div>
              ) : null}

              <div className="statusActions">
                {statuses
                  .filter((status): status is LeadStatus => status !== "Все")
                  .map((status) => (
                    <button className={selectedLead.status === status ? "active" : ""} key={status} onClick={() => updateStatus(selectedLead.id, status)} type="button">
                      {status}
                    </button>
                  ))}
              </div>
              <div className="paymentActions">
                {paymentStatuses.map((paymentStatus) => (
                  <button
                    className={getPaymentStatus(selectedLead) === paymentStatus ? "active" : ""}
                    key={paymentStatus}
                    onClick={() => updatePaymentStatus(selectedLead.id, paymentStatus)}
                    type="button"
                  >
                    {paymentStatus}
                  </button>
                ))}
              </div>

              <div className="taskBox">
                <div>
                  <span>Следующее действие</span>
                  <p>{selectedLead.nextAction ? selectedLead.nextAction : "Добавьте задачу, чтобы не потерять клиента."}</p>
                </div>
                <label>
                  Задача
                  <input onChange={(event) => setTaskText(event.target.value)} placeholder="Например: перезвонить клиенту" value={taskText} />
                </label>
                <label>
                  Дата
                  <input onChange={(event) => setTaskDate(event.target.value)} type="date" value={taskDate} />
                </label>
                <button onClick={saveTask} type="button">
                  Сохранить задачу
                </button>
              </div>

              <div className="historyBox">
                <div className="historyHead">
                  <span>История</span>
                  <small>{selectedLeadEvents.length} событий</small>
                </div>
                <form className="noteForm" onSubmit={saveNote}>
                  <label>
                    Новая заметка
                    <textarea
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Например: клиент попросил перезвонить после 18:00"
                      value={noteText}
                    />
                  </label>
                  {noteError ? <span>{noteError}</span> : null}
                  <button disabled={isSavingNote} type="submit">
                    {isSavingNote ? "Сохраняем" : "Добавить заметку"}
                  </button>
                </form>
                <div className="historyList">
                  {selectedLeadEvents.length > 0 ? (
                    selectedLeadEvents.map((event) => (
                      <article className="historyItem" key={event.id}>
                        <div>
                          <strong>{event.title}</strong>
                          <p>{event.description}</p>
                        </div>
                        <time>{event.createdAt}</time>
                      </article>
                    ))
                  ) : (
                    <p className="emptyHistory">История появится после первого изменения заявки.</p>
                  )}
                </div>
              </div>

              <div className="dangerZone">
                <span>Опасная зона</span>
                <p>{deleteConfirmLeadId === selectedLead.id ? "Нажмите еще раз, чтобы окончательно удалить заявку." : "Удаляйте только тестовые, ошибочные или дублирующиеся заявки."}</p>
                <button disabled={isDeletingLead} onClick={removeSelectedLead} type="button">
                  {isDeletingLead ? "Удаляем" : deleteConfirmLeadId === selectedLead.id ? "Подтвердить удаление" : "Удалить заявку"}
                </button>
              </div>
            </aside>
          ) : null}
        </section>
      </section>
    </main>
  );
}
