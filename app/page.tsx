"use client";

import { useEffect, useMemo, useState } from "react";
import { type Lead, type LeadSource, type LeadStatus, type PaymentStatus } from "./data/leads";

const statuses: Array<"Все" | LeadStatus> = ["Все", "Новая", "В работе", "Закрыта"];
const pipelineStatuses: LeadStatus[] = ["Новая", "В работе", "Закрыта"];
const paymentStatuses: PaymentStatus[] = ["Не оплачено", "Оплачено"];
const projects: Array<"Все" | LeadSource> = ["Все", "NordCut", "Valery's Coffee", "Ручная заявка"];

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function getPaymentStatus(lead: Lead) {
  return lead.paymentStatus ?? "Не оплачено";
}

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeStatus, setActiveStatus] = useState<"Все" | LeadStatus>("Все");
  const [activeProject, setActiveProject] = useState<"Все" | LeadSource>("Все");
  const [query, setQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadLeads() {
    try {
      const response = await fetch("/api/leads", { cache: "no-store" });
      const data = (await response.json()) as { leads: Lead[] };
      setLeads(data.leads);
      setSelectedLeadId((current) => current ?? data.leads[0]?.id ?? null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
    const interval = window.setInterval(loadLeads, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const statusMatches = activeStatus === "Все" || lead.status === activeStatus;
      const projectMatches = activeProject === "Все" || lead.project === activeProject;
      const queryMatches = `${lead.client} ${lead.project} ${lead.service}`.toLowerCase().includes(query.toLowerCase());

      return statusMatches && projectMatches && queryMatches;
    });
  }, [activeProject, activeStatus, leads, query]);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? filteredLeads[0] ?? leads[0];
  const openLeads = leads.filter((lead) => lead.status !== "Закрыта");
  const inWorkLeads = leads.filter((lead) => lead.status === "В работе");
  const inWorkRevenue = inWorkLeads.reduce((sum, lead) => sum + lead.budget, 0);
  const paidRevenue = leads.filter((lead) => getPaymentStatus(lead) === "Оплачено").reduce((sum, lead) => sum + lead.budget, 0);

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

  function getNextStatus(status: LeadStatus) {
    if (status === "Новая") return "В работе";
    if (status === "В работе") return "Закрыта";

    return null;
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
          <button onClick={loadLeads} type="button">
            Обновить
          </button>
        </header>

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
                    <small>{lead.project} · {lead.createdAt}</small>
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
            </aside>
          ) : null}
        </section>
      </section>
    </main>
  );
}
