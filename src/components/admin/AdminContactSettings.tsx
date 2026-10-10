'use client';

import { useEffect, useMemo, useState } from 'react';
import { Phone, PhoneCall, MessageCircle, Save, RotateCcw, CheckCircle2, AlertTriangle, Lock, QrCode, Globe, Smartphone, ExternalLink, BellRing } from 'lucide-react';
import { useCRM } from '@/context/CRMContext';
import { CONTACT_DEFAULTS, formatPhone, phoneProblem, telHref, toE164Digits, waHref } from '@/lib/contact-format';
import { invalidateSiteContact } from '@/lib/contact';

/**
 * Website Settings → Contact numbers. One place to change the numbers guests see:
 * the primary number (call buttons, footer, guest pages, QR standees), an optional second
 * number, and the WhatsApp number behind every WhatsApp button. Admins edit; others view.
 */

interface Contact {
  phone: string;
  phoneSecondary: string;
  whatsapp: string;
  /** Empty = same as the website numbers */
  frontDeskPhone: string;
  frontDeskWhatsapp: string;
}

const same = (a: string, b: string) => toE164Digits(a) === toE164Digits(b);

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  error,
  disabled,
  icon: Icon,
  optional,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  disabled?: boolean;
  icon: typeof Phone;
  optional?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center justify-between text-xs font-bold text-forest-900 mb-1.5">
        <span>
          {label} {!optional && <span className="text-rose-600">*</span>}
          {optional && <span className="font-medium text-forest-500">(optional)</span>}
        </span>
      </label>
      <div className={`flex items-stretch rounded-xl border bg-white overflow-hidden focus-within:ring-2 focus-within:ring-forest-800/30 ${error ? 'border-rose-400' : 'border-sand-300'}`}>
        <span className="flex items-center gap-1.5 px-3 bg-sand-50 border-r border-sand-200 text-forest-700 text-sm font-semibold">
          <Icon className="w-4 h-4" />
        </span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => value && !phoneProblem(value, { required: false }) && onChange(formatPhone(value))}
          placeholder="+91 98xxx xxxxx"
          className="flex-1 min-w-0 px-3 py-3 text-[15px] font-mono tracking-wide text-forest-950 outline-none disabled:bg-sand-50 disabled:text-forest-700"
        />
      </div>
      <p className={`mt-1.5 text-[11.5px] ${error ? 'text-rose-700 font-semibold' : 'text-forest-600'}`}>{error || hint}</p>
    </div>
  );
}

export default function AdminContactSettings() {
  const { currentUser, showToast } = useCRM();
  const isAdmin = currentUser?.role === 'admin';
  const [saved, setSaved] = useState<Contact | null>(null);
  const [form, setForm] = useState<Contact>({ phone: '', phoneSecondary: '', whatsapp: '', frontDeskPhone: '', frontDeskWhatsapp: '' });
  const [sameAsPrimary, setSameAsPrimary] = useState(true);
  // Concierge / in-house guests use the website numbers unless set separately
  const [deskSame, setDeskSame] = useState(true);
  const [deskWaSame, setDeskWaSame] = useState(true);

  const applyLoaded = (c: Contact) => {
    setSaved(c);
    setForm(c);
    setSameAsPrimary(same(c.whatsapp, c.phone));
    setDeskSame(!c.frontDeskPhone && !c.frontDeskWhatsapp);
    setDeskWaSame(!c.frontDeskWhatsapp || same(c.frontDeskWhatsapp, c.frontDeskPhone));
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    fetch('/api/contact', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        applyLoaded({
          phone: j?.contact?.phone || CONTACT_DEFAULTS.phone,
          phoneSecondary: j?.contact?.phoneSecondary || '',
          whatsapp: formatPhone(j?.contact?.whatsapp || CONTACT_DEFAULTS.whatsapp),
          frontDeskPhone: j?.contact?.frontDeskPhone || '',
          frontDeskWhatsapp: j?.contact?.frontDeskWhatsapp ? formatPhone(j.contact.frontDeskWhatsapp) : '',
        });
      })
      .catch(() => showToast('Could not load the contact numbers.', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  const effective: Contact = useMemo(
    () => ({
      ...form,
      whatsapp: sameAsPrimary ? form.phone : form.whatsapp,
      frontDeskPhone: deskSame ? '' : form.frontDeskPhone,
      frontDeskWhatsapp: deskSame ? '' : deskWaSame ? form.frontDeskPhone : form.frontDeskWhatsapp,
    }),
    [form, sameAsPrimary, deskSame, deskWaSame]
  );
  // What in-house guests actually get
  const desk = {
    phone: effective.frontDeskPhone || effective.phone,
    whatsapp: effective.frontDeskWhatsapp || effective.whatsapp,
  };
  const errors = {
    phone: phoneProblem(effective.phone),
    phoneSecondary:
      phoneProblem(effective.phoneSecondary, { required: false }) ||
      (effective.phoneSecondary && toE164Digits(effective.phoneSecondary) === toE164Digits(effective.phone) ? 'Same as the primary number.' : null),
    whatsapp: sameAsPrimary ? null : phoneProblem(effective.whatsapp),
    frontDeskPhone: deskSame ? null : phoneProblem(form.frontDeskPhone),
    frontDeskWhatsapp: deskSame || deskWaSame ? null : phoneProblem(form.frontDeskWhatsapp),
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const dirty =
    !!saved &&
    (!same(effective.phone, saved.phone) ||
      !same(effective.phoneSecondary, saved.phoneSecondary) ||
      !same(effective.whatsapp, saved.whatsapp) ||
      !same(effective.frontDeskPhone, saved.frontDeskPhone) ||
      !same(effective.frontDeskWhatsapp, saved.frontDeskWhatsapp));

  const save = async () => {
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(effective),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not save the numbers.');
      applyLoaded({
        ...json.contact,
        whatsapp: formatPhone(json.contact.whatsapp),
        frontDeskWhatsapp: json.contact.frontDeskWhatsapp ? formatPhone(json.contact.frontDeskWhatsapp) : '',
      });
      invalidateSiteContact({ ...json.contact });
      setTouched(false);
      showToast('Contact numbers saved. The website shows them now.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the numbers.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const show = (k: keyof typeof errors) => (touched || form[k] ? errors[k] : null);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-3xl border border-sand-200 shadow-xs overflow-hidden">
        <div className="bg-[#142820] text-white px-6 py-5 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-[#C5A059]/20 blur-3xl pointer-events-none" />
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#E8D3A2] font-bold">Website settings</p>
          <h2 className="font-serif text-2xl font-bold">Contact numbers</h2>
          <p className="text-[13px] text-[#B9C9B1] mt-0.5 max-w-xl">
            The numbers guests see and tap. Changes show on the website, guest portal and in-room concierge within seconds.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-0">
          {/* Form */}
          <div className="p-6 space-y-5">
            {!isAdmin && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-sand-50 border border-sand-200 text-xs text-forest-800">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" /> Only an admin account can change these numbers.
              </div>
            )}
            {loading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-sand-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <NumberField
                  id="contact-primary"
                  label="Primary number"
                  hint="Website call buttons and footer (and in-house guests, unless set below)."
                  icon={PhoneCall}
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  error={show('phone')}
                  disabled={!isAdmin}
                />
                <NumberField
                  id="contact-secondary"
                  label="Second number"
                  hint="Shown after the primary number in the website footer."
                  icon={Phone}
                  optional
                  value={form.phoneSecondary}
                  onChange={(v) => setForm({ ...form, phoneSecondary: v })}
                  error={show('phoneSecondary')}
                  disabled={!isAdmin}
                />
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-xs font-bold text-forest-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sameAsPrimary}
                      disabled={!isAdmin}
                      onChange={(e) => {
                        setSameAsPrimary(e.target.checked);
                        if (!e.target.checked && !form.whatsapp) setForm({ ...form, whatsapp: form.phone });
                      }}
                      className="w-4 h-4 accent-[#142820]"
                    />
                    WhatsApp on the primary number
                  </label>
                  {!sameAsPrimary && (
                    <NumberField
                      id="contact-whatsapp"
                      label="WhatsApp number"
                      hint="Website WhatsApp buttons (floating bar, menu, booking and inquiry forms)."
                      icon={MessageCircle}
                      value={form.whatsapp}
                      onChange={(v) => setForm({ ...form, whatsapp: v })}
                      error={show('whatsapp')}
                      disabled={!isAdmin}
                    />
                  )}
                </div>

                {/* In-house guests: concierge, guest portal, self check-in */}
                <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <BellRing className="w-4 h-4 text-forest-700 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-forest-950">In-house guests (concierge)</p>
                      <p className="text-[11.5px] text-forest-600">
                        The numbers guests staying with you call and message from the in-room concierge, guest portal and self check-in, plus the welcome message and invoices.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 text-xs font-bold text-forest-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deskSame}
                      disabled={!isAdmin}
                      onChange={(e) => {
                        setDeskSame(e.target.checked);
                        if (!e.target.checked && !form.frontDeskPhone) setForm({ ...form, frontDeskPhone: form.phone });
                      }}
                      className="w-4 h-4 accent-[#142820]"
                    />
                    Same as the website numbers
                  </label>
                  {!deskSame && (
                    <>
                      <NumberField
                        id="contact-desk"
                        label="Front desk number"
                        hint="“Call front desk” in the concierge, guest portal and self check-in."
                        icon={BellRing}
                        value={form.frontDeskPhone}
                        onChange={(v) => setForm({ ...form, frontDeskPhone: v })}
                        error={show('frontDeskPhone')}
                        disabled={!isAdmin}
                      />
                      <label className="flex items-center gap-2.5 text-xs font-bold text-forest-900 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={deskWaSame}
                          disabled={!isAdmin}
                          onChange={(e) => {
                            setDeskWaSame(e.target.checked);
                            if (!e.target.checked && !form.frontDeskWhatsapp) setForm({ ...form, frontDeskWhatsapp: form.frontDeskPhone });
                          }}
                          className="w-4 h-4 accent-[#142820]"
                        />
                        WhatsApp on the front desk number
                      </label>
                      {!deskWaSame && (
                        <NumberField
                          id="contact-desk-wa"
                          label="Front desk WhatsApp"
                          hint="Room-service, transfer and checkout requests sent from the concierge."
                          icon={MessageCircle}
                          value={form.frontDeskWhatsapp}
                          onChange={(v) => setForm({ ...form, frontDeskWhatsapp: v })}
                          error={show('frontDeskWhatsapp')}
                          disabled={!isAdmin}
                        />
                      )}
                    </>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-sand-200">
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving || !dirty}
                      className="min-h-[44px] px-5 rounded-xl bg-[#142820] hover:bg-[#1E3A2F] disabled:opacity-40 text-white text-sm font-bold inline-flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save numbers'}
                    </button>
                    {dirty && saved && (
                      <button
                        type="button"
                        onClick={() => {
                          applyLoaded(saved);
                          setTouched(false);
                        }}
                        className="min-h-[44px] px-4 rounded-xl border border-sand-300 text-sm font-bold text-forest-800 hover:bg-sand-50 inline-flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" /> Undo changes
                      </button>
                    )}
                    <span className="text-[12px] text-forest-600 inline-flex items-center gap-1.5">
                      {dirty ? (
                        <><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Unsaved changes</>
                      ) : (
                        <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Live on the website</>
                      )}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Live preview */}
          <div className="p-6 bg-sand-50/70 border-t lg:border-t-0 lg:border-l border-sand-200 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-forest-600">What guests see</p>

            <div className="rounded-2xl bg-[#142820] p-2 flex items-center gap-2 text-white shadow-md">
              <a href={waHref(effective.whatsapp, 'Hello Savera Homestay!')} target="_blank" rel="noopener noreferrer" className="flex-1 min-h-[40px] rounded-full bg-[#25D366] text-xs font-bold inline-flex items-center justify-center gap-1.5">
                <MessageCircle className="w-4 h-4 fill-white" /> WhatsApp
              </a>
              <span className="flex-[1.3] min-h-[40px] rounded-full bg-[#C85A32] text-xs font-bold inline-flex items-center justify-center">Check Dates</span>
              <a href={telHref(effective.phone)} className="flex-1 min-h-[40px] rounded-full bg-white/10 border border-white/25 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                <Phone className="w-4 h-4" /> Call
              </a>
            </div>
            <p className="text-[11px] text-forest-600 -mt-2">Website quick-action bar. Tap to test on this device.</p>

            <div className="rounded-2xl bg-white border border-sand-200 divide-y divide-sand-100 text-[13px]">
              <div className="flex items-center gap-3 px-4 py-3">
                <Globe className="w-4 h-4 text-forest-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-forest-600">Website footer</p>
                  <p className="font-semibold text-forest-950 truncate">
                    {formatPhone(effective.phone) || '—'}
                    {effective.phoneSecondary && !errors.phoneSecondary ? ` / ${formatPhone(effective.phoneSecondary)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Smartphone className="w-4 h-4 text-forest-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-forest-600">Concierge &amp; guest portal: call / WhatsApp front desk</p>
                  <p className="font-semibold text-forest-950">
                    {formatPhone(desk.phone) || '—'}
                    {!same(desk.whatsapp, desk.phone) && formatPhone(desk.whatsapp) ? ` · WhatsApp ${formatPhone(desk.whatsapp)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-forest-600">Website WhatsApp chats open with</p>
                  <p className="font-semibold text-forest-950">{formatPhone(effective.whatsapp) || '—'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[12px] text-amber-950">
              <QrCode className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Room QR standees carry no phone numbers, so nothing needs reprinting when a number changes. Guests reach you through the concierge the QR opens.
              </p>
            </div>
            <a href={waHref(effective.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-[#C85A32] inline-flex items-center gap-1 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Open this WhatsApp chat to check it
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
