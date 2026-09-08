"use client";

import { useState } from "react";

import { NOTIFICATION_PREFS, type ProfileData } from "@/lib/profile";

export function ProfileView({ initial }: { initial: ProfileData }) {
  const [form, setForm] = useState<ProfileData>(initial);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [prefs, setPrefs] = useState(NOTIFICATION_PREFS);

  const setField = (key: keyof ProfileData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrorText(null);
  };

  const togglePref = (id: string) => {
    setPrefs((p) =>
      p.map((pref) =>
        pref.id === id ? { ...pref, enabled: !pref.enabled } : pref,
      ),
    );
  };

  const save = async () => {
    setSaving(true);
    setErrorText(null);
    try {
      const res = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.fullName,
          email: form.email,
          phone: form.phone,
          company: form.company,
          nuit: form.nuit,
          address: form.address,
          city: form.city,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorText(data.error ?? "Não foi possível guardar o perfil.");
        return;
      }
      setForm((f) => ({ ...f, email: data.email ?? f.email }));
    } catch {
      setErrorText("Erro de rede ao guardar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display-2 text-2xl font-semibold tracking-tight">
          Perfil
        </h1>
        <p className="text-muted">Dados pessoais e configurações da conta.</p>
      </div>

      <div className="payment-block">
        <div className="payment-block-head">
          <div>
            <span className="order-label">Conta</span>
            <h3>Dados pessoais</h3>
          </div>
        </div>

        <div className="profile-form">
          <div className="ticket-form-grid">
            <label className="profile-field">
              Nome completo
              <input
                className="profile-input"
                value={form.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
              />
            </label>
            <label className="profile-field">
              Email
              <input
                className="profile-input"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </label>
            <label className="profile-field">
              Telefone
              <input
                className="profile-input"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </label>
            <label className="profile-field">
              Empresa
              <input
                className="profile-input"
                value={form.company}
                onChange={(e) => setField("company", e.target.value)}
              />
            </label>
            <label className="profile-field">
              NUIT
              <input
                className="profile-input"
                value={form.nuit}
                onChange={(e) => setField("nuit", e.target.value)}
              />
            </label>
            <label className="profile-field">
              Morada
              <input
                className="profile-input"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </label>
            <label className="profile-field">
              Cidade
              <input
                className="profile-input"
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
              />
            </label>
          </div>
          {errorText && (
            <p className="form-error" role="alert">
              {errorText}
            </p>
          )}
          <div className="ticket-actions">
            <button className="button" type="button" onClick={save} disabled={saving}>
              {saving ? "A guardar…" : "Guardar alterações"}
            </button>
          </div>
        </div>
      </div>

      <div className="payment-block">
        <div className="payment-block-head">
          <div>
            <span className="order-label">Segurança</span>
            <h3>Palavra-passe</h3>
          </div>
        </div>
        <div className="profile-form">
          <div className="ticket-form-grid">
            <label className="profile-field">
              Palavra-passe atual
              <input className="profile-input" type="password" placeholder="••••••••" />
            </label>
            <label className="profile-field">
              Nova palavra-passe
              <input className="profile-input" type="password" placeholder="••••••••" />
            </label>
          </div>
          <div className="ticket-actions">
            <button className="outline-button" type="button">
              Atualizar palavra-passe
            </button>
          </div>
        </div>
      </div>

      <div className="payment-block">
        <div className="payment-block-head">
          <div>
            <span className="order-label">Preferências</span>
            <h3>Notificações</h3>
          </div>
        </div>
        <div className="pref-list">
          {prefs.map((pref) => (
            <div className="pref-row" key={pref.id}>
              <div>
                <strong>{pref.label}</strong>
                <p className="payment-tx-meta">{pref.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pref.enabled}
                onClick={() => togglePref(pref.id)}
                className={`switch ${pref.enabled ? "on" : ""}`}
              >
                <span />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
