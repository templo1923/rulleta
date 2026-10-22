import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { claimPrize, getCampaign, registerParticipant, spinParticipant, type CampaignPayload, type Prize } from "@/lib/api";

function labelLines(title: string) {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > 12 && current) {
      lines.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines.slice(0, 3).map(line => line.toUpperCase());
}

function Wheel({ prizes, rotation, centerText, centerBrand }: { prizes: Prize[]; rotation: number; centerText: string; centerBrand: string }) {
  const colors = ["#34236f", "#f7c948", "#ef623b", "#18c6d8"];
  const count = Math.max(prizes.length, 1);
  const segment = 360 / count;
  return <div className="wheel-shell">
    <div className="wheel-pointer" />
    <svg className="wheel-svg" style={{ transform: `rotate(${rotation}deg)` }} viewBox="0 0 240 240" role="img" aria-label="Ruleta de premios">
      <circle cx="120" cy="120" r="115" fill="#21154f" />
      <circle cx="120" cy="120" r="108" fill="none" stroke="#f06a3b" strokeWidth="3" />
      {Array.from({ length: 20 }).map((_, i) => { const a = i * 18 * Math.PI / 180; return <circle key={i} cx={120 + Math.sin(a) * 111} cy={120 - Math.cos(a) * 111} r="3.2" fill={i % 2 ? "#f7c948" : "#18c6d8"} className="bulb" />; })}
      {prizes.map((prize, index) => {
        const start = index * segment - 90;
        const end = (index + 1) * segment - 90;
        const r = 100;
        const x0 = 120 + r * Math.cos(start * Math.PI / 180);
        const y0 = 120 + r * Math.sin(start * Math.PI / 180);
        const x1 = 120 + r * Math.cos(end * Math.PI / 180);
        const y1 = 120 + r * Math.sin(end * Math.PI / 180);
        const mid = (index + 0.5) * segment;
        const lines = labelLines(prize.title);
        return <g key={prize.id}>
          <path d={`M120 120 L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`} fill={colors[index % colors.length]} stroke="#fff" strokeWidth="1" />
          <g transform={`rotate(${mid} 120 120)`}>
            {lines.map((line, lineIndex) => <text key={line} x="120" y={42 + lineIndex * 7} textAnchor="middle" fill={index % 4 === 1 || index % 4 === 3 ? "#19123c" : "#fff"} fontSize="5.8" fontWeight="800" textLength="26" lengthAdjust="spacingAndGlyphs">{line}</text>)}
            <text x="120" y="70" textAnchor="middle" fontSize="13">{prize.icon}</text>
          </g>
        </g>;
      })}
    </svg>
    <div className="wheel-center"><span>{centerText}</span><small>{centerBrand}</small></div>
  </div>;
}

export default function Home() {
  const [data, setData] = useState<CampaignPayload | null>(null);
  const [stage, setStage] = useState<"data" | "spin" | "claim" | "retry" | "done">("data");
  const [form, setForm] = useState({ name: "", whatsapp: "", email: "" });
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [participationToken, setParticipationToken] = useState("");
  const [prize, setPrize] = useState<Prize | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [bonus, setBonus] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [advice, setAdvice] = useState(false);
  const [platform, setPlatform] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { getCampaign().then(setData).catch(e => setError(e.message)); }, []);
  const settings = data?.settings;
  const cssVars = useMemo(() => settings ? ({ "--campaign-primary": settings.primaryColor, "--campaign-secondary": settings.secondaryColor, "--campaign-accent": settings.accentColor, "--campaign-bg": settings.backgroundColor, "--campaign-card": settings.cardColor } as React.CSSProperties) : undefined, [settings]);
  if (!data || !settings) return <div className="loading-page">Cargando campaña<span>•</span><span>•</span><span>•</span>{error && <small>{error}</small>}</div>;
  const start = async () => { setError(""); try { if (!form.name.trim() || form.whatsapp.replace(/\D/g, "").length < 7 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) throw new Error("Completa nombre, WhatsApp y correo con datos válidos."); const result = await registerParticipant({ campaignId: data.campaign.id, name: form.name, whatsapp: form.whatsapp, email: form.email }); setParticipantId(result.participantId); setParticipationToken(result.participationToken); setStage("spin"); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar."); } };
  const spin = async (isBonus = false) => { if (!participantId || !participationToken || spinning) return; setError(""); setSpinning(true); try { const result = await spinParticipant({ campaignId: data.campaign.id, participantId, participationToken, bonus: isBonus }); const index = result.prizeIndex >= 0 ? result.prizeIndex : data.prizes.findIndex(item => item.id === result.prize.id); if (index < 0) throw new Error("El resultado no coincide con los premios visibles."); setRotation(rotation + 360 * 7 + (360 - (index + 0.5) * (360 / data.prizes.length))); window.setTimeout(() => { setPrize(result.prize); setSpinning(false); if (result.prize.kind === "win") setStage("claim"); else if (result.prize.kind === "again") setStage("spin"); else setStage("retry"); }, 5700); } catch (e) { setSpinning(false); setError(e instanceof Error ? e.message : "No se pudo realizar el giro."); } };
  const claim = async () => { if (!participantId || !participationToken || !prize || prize.id === null) return; setError(""); try { const result = await claimPrize({ campaignId: data.campaign.id, participantId, participationToken, prizeId: prize.id, photoBase64: photo, advice, platform }); setPrize(result.prize); setClaimCode(result.claimCode); setStage("done"); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo reclamar."); } };
  const handlePhoto = (file?: File) => { if (!file) return; if (file.size > settings.maxPhotoMb * 1024 * 1024) { setError(`La foto no puede superar ${settings.maxPhotoMb} MB.`); return; } const reader = new FileReader(); reader.onload = () => setPhoto(String(reader.result)); reader.readAsDataURL(file); };
  return <main className="campaign-page" style={cssVars}>
    <header className="campaign-top"><div className="brand-mark"><span>{settings.logoText}</span><strong>{settings.brand}</strong></div><Link href="/admin" className="admin-link">Panel</Link></header>
    <section className="campaign-layout"><div className="hero-copy"><div className="eyebrow">{settings.eyebrow}</div><h1>{settings.title}</h1><p className="highlight">{settings.highlight}</p><p className="description">{settings.description}</p><div className="trust-row"><span>● Premio controlado</span><span>● Un giro por persona</span></div></div>
      <div className="game-column"><Wheel prizes={data.prizes} rotation={rotation} centerText={settings.logoText} centerBrand={settings.wheelCenterText || settings.brand} />
        <div className="campaign-card">
          {stage === "data" && <><div className="step-label">PASO 1 DE 2 · TUS DATOS</div><h2>Regístrate para girar</h2><label>Nombre completo<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tu nombre" /></label><label>WhatsApp<input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="Ej: 3001234567" /></label><label>Correo<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="tucorreo@ejemplo.com" /></label><p className="helper">Usaremos tu correo solo para coordinar la entrega del premio.</p><button className="primary-button" onClick={start}>{settings.ctaText} <span>↗</span></button></>}
          {stage === "spin" && <><div className="step-label">PASO 2 DE 2 · TU TURNO</div><h2>{bonus ? "Tu giro adicional" : "Tu oportunidad está lista"}</h2><p className="helper">La ruleta elegirá un resultado de forma segura y registrará tu participación.</p><button disabled={spinning} className="primary-button" onClick={() => spin(bonus)}>{spinning ? "Girando…" : settings.spinText} <span>↻</span></button></>}
          {stage === "claim" && prize && <><div className="result-icon">{prize.icon}</div><div className="step-label">RESULTADO · PREMIO</div><h2>¡Felicitaciones!</h2><div className="prize-name">{prize.title}</div><p className="helper">Puedes dejar una foto opcional y solicitar asesoría de nuestros servicios.</p><label className="upload-box">{photo ? "Foto seleccionada ✓" : "Subir foto opcional"}<input type="file" accept="image/*" onChange={e => handlePhoto(e.target.files?.[0])} /></label>{settings.allowAdvice && <label className="check-row"><input type="checkbox" checked={advice} onChange={e => setAdvice(e.target.checked)} /> Me interesa recibir asesoría gratis</label>}{advice && <select value={platform} onChange={e => setPlatform(e.target.value)}><option value="">Elige una plataforma</option><option>CallPOS</option><option>Leodora</option><option>FullGEN</option><option>Fullentretenimiento</option><option>Diseño gráfico</option><option>Otra</option></select>}<button className="success-button" onClick={claim}>{settings.claimText} <span>✓</span></button></>}
          {stage === "retry" && <><div className="result-icon">🍀</div><div className="step-label">RESULTADO</div><h2>Para la próxima</h2><p className="helper">Aún puedes tener una oportunidad extra. Síguenos en nuestras redes y vuelve a intentarlo.</p>{settings.socialLinks.filter(link => link.active !== false && link.url.trim()).length > 0 && <div className="social-list">{settings.socialLinks.filter(link => link.active !== false && link.url.trim()).map(link => <a key={link.label} href={/^https?:\/\//.test(link.url) ? link.url : "#"} target="_blank" rel="noreferrer"><span>{link.icon}</span>{link.label}</a>)}</div>}{settings.allowBonus && <button className="primary-button" onClick={() => { setBonus(true); setStage("spin"); }}>{settings.retryText} <span>↻</span></button>}</>}
          {stage === "done" && <><div className="result-icon">✓</div><div className="step-label">PARTICIPACIÓN REGISTRADA</div><h2>{settings.endText}</h2><div className="prize-name">{prize?.title}</div><p className="helper">{settings.contactText}</p>{claimCode && <div className="done-note"><strong>Código de reclamación: {claimCode}</strong><br />Preséntalo para validar la entrega del premio.</div>}</>}
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    </section>
    <footer>{settings.footer} <span>·</span> <Link href="/admin">Administrar campaña</Link></footer>
  </main>;
}
