"use client";

import { useState } from "react";

import type { TramiteType } from "@/lib/tramites";
import { CopiarPegar } from "./CopiarPegar";
import { InboxClientes } from "./InboxClientes";

type Tab = "copiar" | "inbox";

export function Apartado4Tabs({ tipo }: { tipo: TramiteType }) {
  const [tab, setTab] = useState<Tab>("copiar");

  return (
    <div className="grid gap-6">
      <div role="tablist" className="flex border-b border-line">
        <Btn label="Copiar y pegar" activo={tab === "copiar"} onClick={() => setTab("copiar")} />
        <Btn label="Capturas de clientes" activo={tab === "inbox"} onClick={() => setTab("inbox")} />
      </div>

      {tab === "copiar" && <CopiarPegar tipo={tipo} />}
      {tab === "inbox" && <InboxClientes tipo={tipo} />}
    </div>
  );
}

function Btn({
  label,
  activo,
  onClick,
}: {
  label: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={`-mb-px min-h-[44px] border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        activo
          ? "border-ink text-ink"
          : "border-transparent text-ink-3 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
