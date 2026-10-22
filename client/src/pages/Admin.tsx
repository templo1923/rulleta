import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { exportCsv, getAdminData, getMe, login, updateCampaign, updateDeliveryStatus, updatePrizes, updateUserRole, type Prize, type SocialLink } from "@/lib/api";

const deliveryLabels: Record<Prize["deliveryType"], string> = {
  digital: "Digital",
  physical: "Físico",
  coupon: "Cupón",
  advice: "Asesoría",
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export default function Admin() {
  const [user, setUser] = useState<any>(undefined);
  const [data, setData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingDelivery, setUpdatingDelivery] = useState<number | null>(null);
  const [updatingRole, setUpdatingRole] = useState<number | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const load = async () => {
    const me = await getMe();
    setUser(me.user);
    if (me.user) {
      const payload = await getAdminData();
      setData(payload);
      setSettings(payload.campaign.settings);
      setPrizes(payload.campaign.prizes);
    }
  };

  useEffect(() => { load().catch(() => setUser(null)); }, []);

  const totalWeight = useMemo(() => prizes.filter(prize => prize.active !== 0).reduce((sum, prize) => sum + Math.max(0, Number(prize.weight || 0)), 0), [prizes]);
  const updateSetting = (key: string, value: any) => setSettings({ ...settings, [key]: value });
  const updatePrize = (index: number, patch: Partial<Prize>) => setPrizes(prizes.map((prize, i) => i === index ? { ...prize, ...patch } : prize));
  const updateSocial = (index: number, patch: Partial<SocialLink>) => updateSetting("socialLinks", (settings.socialLinks || []).map((link: SocialLink, i: number) => i === index ? { ...link, ...patch } : link));
  const addSocial = () => updateSetting("socialLinks", [...(settings.socialLinks || []), { label: "Nueva red", url: "https://", icon: "◎", active: true }]);
  const addWhatsApp = () => updateSetting("socialLinks", [...(settings.socialLinks || []), { label: "Comunidad WhatsApp", url: "https://chat.whatsapp.com/", icon: "◉", active: true }]);
  const removeSocial = (index: number) => updateSetting("socialLinks", (settings.socialLinks || []).filter((_: SocialLink, i: number) => i !== index));
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setNotice("Guardando…");
    try {
      await updateCampaign({ name: data.campaign.campaign.name, settings });
      await updatePrizes(prizes);
      setNotice("Cambios guardados correctamente.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally { setSaving(false); }
  };
  const changeDelivery = async (participantId: number, status: "pending" | "sent" | "delivered" | "cancelled") => {
    setUpdatingDelivery(participantId);
    try {
      await updateDeliveryStatus(participantId, status);
      setNotice("Estado de entrega actualizado.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo actualizar la entrega."); }
    finally { setUpdatingDelivery(null); }
  };

  if (user === undefined) return <div className="loading-page">Cargando panel…</div>;
  const submitLogin = async (event: React.FormEvent) => { event.preventDefault(); setLoggingIn(true); setLoginError(""); try { await login(loginEmail, loginPassword); setLoginPassword(""); await load(); } catch (error) { setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesión."); } finally { setLoggingIn(false); } };
  if (!user) return <main className="admin-gate"><form className="gate-card" onSubmit={submitLogin}><div className="brand-mark"><span>RF</span><strong>Ruleta Flex</strong></div><h1>Tu centro de control</h1><p>Ingresa con la cuenta administradora configurada en MySQL.</p><label>Correo<input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="admin@tudominio.com" autoComplete="username" required /></label><label>Contraseña<input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Tu contraseña" autoComplete="current-password" required /></label>{loginError && <div className="form-error">{loginError}</div>}<button className="primary-button" disabled={loggingIn}>{loggingIn ? "Verificando…" : "Iniciar sesión →"}</button><Link href="/" className="back-link">Volver a la campaña</Link></form></main>;
  const changeRole = async (userId: number, role: "user" | "admin") => {
    setUpdatingRole(userId);
    try { await updateUserRole(userId, role); setNotice("Acceso actualizado."); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo actualizar el acceso."); }
    finally { setUpdatingRole(null); }
  };

  if (!settings || !data) return <div className="loading-page">Cargando datos…</div>;

  return <main className="admin-page">
    <header className="admin-header"><div><div className="eyebrow">PANEL ADMINISTRATIVO</div><h1>Configura tu campaña</h1><p>Controla premios, probabilidades, existencias y entregas desde un solo lugar.</p></div><div className="header-actions"><Link href="/" className="ghost-button">Ver campaña ↗</Link><button disabled={saving} className="primary-button compact" onClick={save}>{saving ? "Guardando…" : "Guardar cambios"}</button></div></header>
    <section className="stats-grid"><div><strong>{data.totals.participants}</strong><span>Participantes</span></div><div><strong>{data.totals.wins}</strong><span>Premios asignados</span></div><div><strong>{data.totals.claimed}</strong><span>Reclamaciones</span></div></section>
    <section className="admin-card wide-card guide-card"><div className="card-heading"><div><div className="eyebrow">GUÍA DE USO</div><h2>Cómo administrar tu ruleta</h2><p>Consulta esta guía cada vez que configures una campaña o entregues un premio.</p></div><span className="guide-badge">AYUDA RÁPIDA</span></div><div className="guide-grid"><details open><summary>1. Configura la identidad</summary><p>En <strong>Identidad y mensajes</strong> cambia la marca, el logo, el texto del centro de la ruleta, el título, los mensajes y los textos de los botones. Estos cambios se muestran directamente en la ruleta pública.</p></details><details><summary>2. Crea y organiza los premios</summary><p>En <strong>Control de resultados</strong>, cada fila representa un resultado. Usa un nombre claro, un detalle corto, un ícono y selecciona el tipo: premio, para la próxima o gira de nuevo.</p></details><details><summary>3. Entiende el peso y el stock</summary><p><strong>Peso</strong> controla la probabilidad relativa: peso alto significa que sale más veces. <strong>Stock</strong> es la cantidad disponible: cuando llega a cero, el premio deja de salir. Stock vacío significa ilimitado. El límite diario restringe cuántas unidades pueden entregarse en un día.</p></details><details><summary>4. Revisa y entrega premios</summary><p>En <strong>Seguimiento de premios</strong> consulta quién ganó, su código de reclamación y el estado. Cambia la entrega a enviado, entregado o cancelado cuando corresponda. El código sirve para validar la entrega.</p></details><details><summary>5. Cómo participa una persona</summary><p>La persona completa nombre, WhatsApp y correo. El servidor registra la participación, realiza el giro y evita duplicados. Si gana, puede reclamar el premio y recibir un código único.</p></details><details><summary>6. Cómo dar acceso a otra persona</summary><p>La otra persona debe iniciar sesión al menos una vez. Luego aparecerá en <strong>Accesos</strong>. Cambia su rol a <strong>Administrador</strong> para permitirle configurar la campaña. Si eliges <strong>Sin acceso</strong>, no podrá entrar al panel.</p></details><details><summary>7. Antes de publicar una campaña</summary><p>Prueba los textos en móvil, revisa que los premios estén activos, confirma los pesos, verifica el stock, guarda los cambios y realiza un giro de prueba. Recuerda que la ruleta pública utiliza la configuración guardada.</p></details><details><summary>8. Recomendación de pesos</summary><p>Para empezar: premio principal <strong>1</strong>, premio secundario <strong>3</strong>, gira de nuevo <strong>4</strong> y para la próxima <strong>12</strong>. No tienen que sumar 100; el sistema calcula la proporción entre todos los premios activos.</p></details></div></section>
    <div className="admin-grid">
      <section className="admin-card"><div className="card-heading"><div><div className="eyebrow">IDENTIDAD Y MENSAJES</div><h2>La voz de la campaña</h2></div></div><div className="field-grid"><label>Marca<input value={settings.brand} onChange={e => updateSetting("brand", e.target.value)} /></label><label>Texto del logo<input value={settings.logoText} onChange={e => updateSetting("logoText", e.target.value)} /></label><label>Texto del centro<input value={settings.wheelCenterText ?? settings.brand} onChange={e => updateSetting("wheelCenterText", e.target.value)} /><small>Se muestra dentro de la ruleta.</small></label><label className="wide">Título principal<input value={settings.title} onChange={e => updateSetting("title", e.target.value)} /></label><label className="wide">Frase destacada<input value={settings.highlight} onChange={e => updateSetting("highlight", e.target.value)} /></label><label className="wide">Descripción<textarea value={settings.description} onChange={e => updateSetting("description", e.target.value)} /></label><label>Botón de registro<input value={settings.ctaText} onChange={e => updateSetting("ctaText", e.target.value)} /></label><label>Botón de giro<input value={settings.spinText} onChange={e => updateSetting("spinText", e.target.value)} /></label><label className="wide">Mensaje final<input value={settings.contactText} onChange={e => updateSetting("contactText", e.target.value)} /></label></div></section>
      <section className="admin-card"><div className="card-heading"><div><div className="eyebrow">REDES Y COMUNIDAD</div><h2>Canales de seguimiento</h2><p>Activa solo los canales que uses. El enlace debe incluir https:// y WhatsApp puede ser un enlace de comunidad o grupo.</p></div><div className="header-actions"><button className="ghost-button" onClick={addWhatsApp}>+ WhatsApp</button><button className="ghost-button" onClick={addSocial}>+ Añadir canal</button></div></div><div className="social-editor">{(settings.socialLinks || []).map((link: SocialLink, index: number) => <div className="social-row" key={`${link.label}-${index}`}><input className="social-icon" aria-label="Ícono" value={link.icon} onChange={e => updateSocial(index, { icon: e.target.value })} /><input aria-label="Nombre del canal" value={link.label} onChange={e => updateSocial(index, { label: e.target.value })} placeholder="Instagram, WhatsApp…" /><input className="social-url" aria-label="Enlace del canal" value={link.url} onChange={e => updateSocial(index, { url: e.target.value })} placeholder="https://…" /><label className="check-row"><input type="checkbox" checked={link.active !== false} onChange={e => updateSocial(index, { active: e.target.checked })} /> Visible</label><button type="button" className="remove-button" onClick={() => removeSocial(index)} aria-label={`Eliminar ${link.label}`}>×</button></div>)}</div></section>
      <section className="admin-card"><div className="eyebrow">ESTILO Y REGLAS</div><h2>Comportamiento de campaña</h2><div className="color-grid"><label>Fondo<input type="color" value={settings.backgroundColor} onChange={e => updateSetting("backgroundColor", e.target.value)} /></label><label>Principal<input type="color" value={settings.primaryColor} onChange={e => updateSetting("primaryColor", e.target.value)} /></label><label>Secundario<input type="color" value={settings.secondaryColor} onChange={e => updateSetting("secondaryColor", e.target.value)} /></label><label>Acento<input type="color" value={settings.accentColor} onChange={e => updateSetting("accentColor", e.target.value)} /></label></div><div className="toggle-row"><label><input type="checkbox" checked={settings.allowBonus} onChange={e => updateSetting("allowBonus", e.target.checked)} /> Permitir giro extra</label><label><input type="checkbox" checked={settings.allowAdvice} onChange={e => updateSetting("allowAdvice", e.target.checked)} /> Ofrecer asesoría</label><label><input type="checkbox" checked={settings.requirePhoto} onChange={e => updateSetting("requirePhoto", e.target.checked)} /> Exigir foto</label></div></section>
      <section className="admin-card wide-card"><div className="card-heading"><div><div className="eyebrow">PREMIOS</div><h2>Control de resultados</h2><p>Peso = probabilidad relativa. Stock = cantidad total. Límite diario = máximo entregado hoy. Vacío significa ilimitado.</p></div><button className="ghost-button" onClick={() => setPrizes([...prizes, { id: null, title: "Nuevo premio", subtitle: "Detalle del premio", icon: "✦", kind: "win", internalCode: "NUEVO_PREMIO", deliveryType: "digital", weight: 1, stock: null, maxDaily: null, active: 1, sortOrder: prizes.length }])}>+ Añadir premio</button></div><div className="prize-legend"><span>Icono</span><span>Nombre</span><span>Detalle</span><span>Tipo</span><span>Código interno</span><span>Entrega</span><span>Peso</span><span>Stock total</span><span>Límite diario</span><span>Estado</span><span>Probabilidad</span></div><div className="prize-editor">{prizes.map((prize, index) => { const probability = totalWeight > 0 ? ((Math.max(0, Number(prize.weight || 0)) / totalWeight) * 100).toFixed(1) : "0.0"; return <div className="prize-row" key={prize.id ?? `new-${index}`}><input className="icon-input" aria-label="Ícono" value={prize.icon} onChange={e => updatePrize(index, { icon: e.target.value })} /><input aria-label="Título" value={prize.title} onChange={e => updatePrize(index, { title: e.target.value })} placeholder="Nombre del premio" /><input aria-label="Detalle" value={prize.subtitle} onChange={e => updatePrize(index, { subtitle: e.target.value })} placeholder="Detalle" /><select aria-label="Tipo" value={prize.kind} onChange={e => updatePrize(index, { kind: e.target.value as Prize["kind"] })}><option value="win">Premio</option><option value="retry">Para la próxima</option><option value="again">Gira de nuevo</option></select><input aria-label="Código interno" value={prize.internalCode || ""} onChange={e => updatePrize(index, { internalCode: e.target.value.toUpperCase() })} placeholder="Código" /><select aria-label="Entrega" value={prize.deliveryType} onChange={e => updatePrize(index, { deliveryType: e.target.value as Prize["deliveryType"] })}>{Object.entries(deliveryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="Peso" type="number" min="0" value={prize.weight} onChange={e => updatePrize(index, { weight: Number(e.target.value) })} placeholder="Peso" /><input aria-label="Stock" type="number" min="0" value={prize.stock ?? ""} onChange={e => updatePrize(index, { stock: e.target.value ? Number(e.target.value) : null })} placeholder="∞" /><input aria-label="Máximo diario" type="number" min="0" value={prize.maxDaily ?? ""} onChange={e => updatePrize(index, { maxDaily: e.target.value ? Number(e.target.value) : null })} placeholder="Día" /><label className="check-row"><input type="checkbox" checked={prize.active !== 0} onChange={e => updatePrize(index, { active: e.target.checked ? 1 : 0 })} /> Activo</label><span className="probability-badge">{probability}%</span></div>; })}</div></section>
      <section className="admin-card wide-card"><div className="card-heading"><div><div className="eyebrow">ACCESOS</div><h2>Quién puede entrar al panel</h2><p>Solo las cuentas con rol Administrador pueden configurar esta ruleta. El primer acceso crea al administrador inicial.</p></div></div><div className="access-list">{(data.users || []).map((account: any) => <div className="access-row" key={account.id}><div><strong>{account.name || "Cuenta sin nombre"}</strong><small>{account.email || "Sin correo"}</small></div><select disabled={updatingRole === account.id} value={account.role} onChange={e => changeRole(account.id, e.target.value as "user" | "admin")}><option value="admin">Administrador</option><option value="user">Sin acceso</option></select></div>)}</div></section>
      <section className="admin-card wide-card"><div className="card-heading"><div><div className="eyebrow">PARTICIPANTES Y ENTREGAS</div><h2>Seguimiento de premios</h2></div><button className="ghost-button" onClick={exportCsv}>Exportar CSV ↓</button></div><div className="table-wrap"><table><thead><tr><th>Participante</th><th>Premio / código</th><th>Estado</th><th>Asesoría</th><th>Entrega</th><th>Fecha</th></tr></thead><tbody>{(data.participants || []).slice(0, 100).map((row: any) => <tr key={row.id}><td><strong>{row.name}</strong><br />{row.email}<br />{row.whatsapp}</td><td>{row.prizeTitle || "Pendiente"}<br /><small>{row.claimCode || "Sin reclamar"}</small></td><td><span className={`status status-${row.status}`}>{row.status}</span></td><td>{row.advice ? <><strong>Sí</strong><br /><small>{row.platform || "Plataforma pendiente"}</small>{row.photoUrl && <><br /><a href={row.photoUrl} target="_blank" rel="noreferrer">Ver foto</a></>}</> : "No"}</td><td>{row.status === "claimed" ? <select disabled={updatingDelivery === row.id} value={row.deliveryStatus || "pending"} onChange={e => changeDelivery(row.id, e.target.value as "pending" | "sent" | "delivered" | "cancelled")}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : "—"}</td><td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div></section>
    </div>{notice && <div className="save-toast">{notice}</div>}
  </main>;
}
