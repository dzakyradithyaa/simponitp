"use client";

import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  UserRound,
  ShieldCheck,
} from "lucide-react";

import { useEffect, useState } from "react";

import { Wordmark } from "@/components/Brand";
import { Notice } from "@/components/ui";
import { api } from "@/lib/api";

const headlines = [
  "Memetakan bumi.",
  "Memahami wilayah.",
  "Mengelola potensi.",
  "Membangun masa depan.",
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeHeadline, setActiveHeadline] = useState(0);

  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).has("expired"));
  }, []);

  // Headline animation
  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveHeadline((prev) => (prev + 1) % headlines.length);
    }, 4000);

    return () => window.clearInterval(interval);
  }, []);

  // Prevent page scrolling
  useEffect(() => {
    const oldBody = document.body.style.overflow;
    const oldHtml = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = oldBody;
      document.documentElement.style.overflow = oldHtml;
    };
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      await api.post("/auth/login", {
        username,
        password,
        remember,
      });

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      {/* EARTH EXPERIENCE */}
      <section className="earth-section">
        <div className="space-background" />
        <div className="red-glow" />

        {/* EARTH */}
        <div className="earth-stage">
          <div className="earth-atmosphere" />

          <div className="earth-object">
            <div className="earth-surface" />
            <div className="earth-clouds" />

            <div className="earth-light" />
            <div className="earth-shadow" />
          </div>
        </div>

        {/* DRONE */}
        <div className="drone-object">
          <div className="drone-beam" />

          <svg
            viewBox="0 0 180 100"
            className="drone-svg"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
          >
            <path
              d="M65 43 L35 22 L17 22 M115 43 L145 22 L163 22"
              stroke="#d4d4d4"
              strokeWidth="5"
              strokeLinecap="round"
            />

            <path
              d="M65 54 L37 75 L21 75 M115 54 L143 75 L159 75"
              stroke="#d4d4d4"
              strokeWidth="5"
              strokeLinecap="round"
            />

            <g fill="#242424" stroke="#a3a3a3" strokeWidth="2">
              <ellipse cx="17" cy="18" rx="17" ry="4" />
              <ellipse cx="163" cy="18" rx="17" ry="4" />
              <ellipse cx="21" cy="79" rx="17" ry="4" />
              <ellipse cx="159" cy="79" rx="17" ry="4" />
            </g>

            <g fill="#444">
              <circle cx="35" cy="22" r="7" />
              <circle cx="145" cy="22" r="7" />
              <circle cx="37" cy="75" r="7" />
              <circle cx="143" cy="75" r="7" />
            </g>

            <path
              d="M67 36 Q90 23 113 36 L123 53 Q90 70 57 53 Z"
              fill="#e5e5e5"
              stroke="#777"
              strokeWidth="2"
            />

            <path d="M76 36 Q90 28 104 36 L99 48 L81 48 Z" fill="#991b1b" />

            <rect x="81" y="58" width="18" height="12" rx="4" fill="#333" />
            <circle cx="90" cy="65" r="4" fill="#dc2626" />
            <circle cx="90" cy="43" r="3" fill="#ef4444" />
          </svg>

          <div className="drone-label">
            <span className="drone-status" />
            AERIAL MAPPING
          </div>
        </div>

        {/* HERO */}
        <div className="hero-caption">
          <h1 key={activeHeadline} className="headline-animation">
            {headlines[activeHeadline]}
          </h1>

          <p className="hero-subtitle">
            Sistem informasi spasial untuk pengelolaan dan pemantauan wilayah
            secara terintegrasi.
          </p>
        </div>

        {/* EARTH FOOTER */}
        <div className="hero-footer">
          <span>SISTEM INFORMASI MONITORING PEMBANGUNAN TERITORIAL</span>
          <span>© 2026</span>
        </div>
      </section>

      {/* LOGIN SECTION */}
      <section className="login-section">
        {/* LOGIN CONTENT */}
        <div className="login-wrapper">
          {/* BRAND */}
          <div className="brand-area">
            <Wordmark />
          </div>

          {/* HEADING */}
          <div className="login-heading">
            <span className="eyebrow">SECURE AUTHENTICATION</span>

            <h2>Selamat Datang</h2>

            <p>
              Masuk ke akun Anda untuk melanjutkan pengelolaan dan pemantauan
              data lahan.
            </p>
          </div>

          {/* FORM */}
          <form onSubmit={submit} className="login-form">
            {expired && !error && (
              <Notice>Sesi Anda berakhir. Silakan masuk kembali.</Notice>
            )}

            {error && <Notice kind="error">{error}</Notice>}

            {/* USERNAME */}
            <div className="form-field">
              <label htmlFor="username">Username</label>

              <div className="input-wrapper">
                <UserRound size={18} />

                <input
                  id="username"
                  type="text"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div className="form-field">
              <label htmlFor="password">Password</label>

              <div className="input-wrapper">
                <KeyRound size={18} />

                <input
                  id="password"
                  type={show ? "text" : "password"}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShow((prev) => !prev)}
                  aria-label={
                    show ? "Sembunyikan password" : "Tampilkan password"
                  }
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* REMEMBER */}
            <div className="remember-area">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />

                <span>Ingat saya di perangkat ini</span>
              </label>
            </div>

            <p className="session-info">
              Sesi standar berakhir setelah 1 jam tidak aktif.
            </p>

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="login-button"
            >
              {busy ? (
                <>
                  <LoaderCircle size={18} className="spin" />
                  Memeriksa...
                </>
              ) : (
                <>
                  Masuk ke Dashboard
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* SECURITY */}
          <div className="security-info">
            <ShieldCheck size={19} />

            <span>
              Akses aman dan terproteksi oleh sistem keamanan platform.
            </span>
          </div>
        </div>

        {/* LOGIN FOOTER - ALWAYS AT BOTTOM */}
        <footer className="login-footer">
          <span>© 2026 SIMPONI TP</span>
          <span>ALL RIGHTS RESERVED</span>
        </footer>
      </section>

      {/* GLOBAL STYLES */}
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          width: 100%;
          height: 100%;
          margin: 0;
          overflow: hidden !important;
        }

        .login-screen {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          width: 100%;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          background: #fff;
          font-family: Arial, Helvetica, sans-serif;
        }

        /* =========================
           EARTH EXPERIENCE
        ========================= */

        .earth-section {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          isolation: isolate;
          background: #090909;
          color: white;
        }

        .space-background {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at 50% 42%,
            #282020 0%,
            #171313 42%,
            #090909 75%,
            #050505 100%
          );
        }

        .red-glow {
          position: absolute;
          top: 20%;
          left: 50%;
          width: 550px;
          height: 550px;
          transform: translateX(-50%);
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(153, 27, 27, 0.17),
            transparent 70%
          );
          pointer-events: none;
        }

        /* EARTH */

        .earth-stage {
          position: absolute;
          top: 43%;
          left: 50%;
          width: min(70%, 520px);
          aspect-ratio: 1;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .earth-atmosphere {
          position: absolute;
          inset: -3%;
          border-radius: 50%;
          box-shadow: 0 0 22px 4px rgba(255, 255, 255, 0.12),
            0 0 55px 8px rgba(180, 30, 30, 0.22);
          z-index: 3;
          pointer-events: none;
        }

        .earth-object {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 50%;
          background: #101923;
          box-shadow: inset -45px -10px 70px rgba(0, 0, 0, 0.95),
            inset 10px 0 30px rgba(255, 255, 255, 0.12),
            0 0 70px rgba(180, 30, 30, 0.15);
        }

        .earth-surface,
        .earth-clouds {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background-size: 200% 100%;
          background-repeat: repeat-x;
          pointer-events: none;
          backface-visibility: hidden;
        }

        .earth-surface {
          background-image: url("https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg");
          background-position: 0% center;
          animation: earthTextureRotate 90s linear infinite;
        }

        .earth-clouds {
          background-image: url("https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg");
          background-position: 0% center;
          opacity: 0.2;
          mix-blend-mode: screen;
          animation: cloudTextureRotate 75s linear infinite;
        }

        /* Animasi dipindahkan ke CSS agar React tidak render ulang setiap frame. */
        @keyframes earthTextureRotate {
          from {
            background-position: 0% center;
          }
          to {
            background-position: 100% center;
          }
        }

        @keyframes cloudTextureRotate {
          from {
            background-position: 0% center;
          }
          to {
            background-position: 100% center;
          }
        }

        .earth-light {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(
            circle at 28% 35%,
            transparent 25%,
            rgba(0, 0, 0, 0.12) 52%,
            rgba(0, 0, 0, 0.85) 100%
          );
          pointer-events: none;
        }

        .earth-shadow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: linear-gradient(
            90deg,
            transparent 30%,
            rgba(0, 0, 0, 0.12) 55%,
            rgba(0, 0, 0, 0.55) 100%
          );
          pointer-events: none;
        }

        /* =========================
           DRONE
        ========================= */

        .drone-object {
          position: absolute;
          z-index: 5;
          width: 150px;
          height: 100px;
          top: 15%;
          right: 9%;
          animation: droneFloat 5s ease-in-out infinite;
          pointer-events: none;
        }

        .drone-svg {
          position: relative;
          width: 100%;
          height: 85px;
          z-index: 3;
          filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.7));
        }

        @keyframes droneFloat {
          0%,
          100% {
            transform: translateY(0) rotate(-2deg);
          }

          50% {
            transform: translateY(-10px) rotate(2deg);
          }
        }

        .drone-beam {
          position: absolute;
          z-index: 1;
          top: 75px;
          left: 50%;
          width: 2px;
          height: 240px;
          transform: translateX(-50%);
          transform-origin: top;
          background: linear-gradient(
            to bottom,
            rgba(239, 68, 68, 0.85),
            rgba(239, 68, 68, 0.25),
            transparent
          );
          box-shadow: 0 0 12px rgba(220, 38, 38, 0.6);
          animation: scanBeam 3.5s ease-in-out infinite;
        }

        .drone-label {
          position: absolute;
          top: -17px;
          right: -35px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.75);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          white-space: nowrap;
        }

        .drone-status {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 8px #ef4444;
        }

        @keyframes scanBeam {
          0%,
          100% {
            opacity: 0.25;
          }

          50% {
            opacity: 1;
          }
        }

        /* =========================
           HERO
        ========================= */

        .hero-caption {
          position: absolute;
          z-index: 5;
          left: 9%;
          bottom: 13%;
          max-width: 80%;
        }

        .hero-caption h1 {
          margin: 0;
          font-size: clamp(38px, 4vw, 58px);
          font-weight: 750;
          line-height: 1.12;
          letter-spacing: -2px;
          color: #fff;
          min-height: 1.12em;
        }

        .headline-animation {
          animation: headlineReveal 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) both;
        }

        @keyframes headlineReveal {
          from {
            opacity: 0;
            transform: translateY(18px);
            filter: blur(5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        .hero-subtitle {
          max-width: 470px;
          margin: 20px 0 0;
          color: rgba(255, 255, 255, 0.68);
          font-size: 15px;
          font-weight: 400;
          line-height: 1.8;
        }

        .hero-footer {
          position: absolute;
          bottom: 30px;
          left: 9%;
          right: 9%;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          color: rgba(255, 255, 255, 0.48);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 1px;
        }

        /* =========================
           LOGIN SECTION
        ========================= */

        .login-section {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
          background: #fff;
          padding: 30px 48px 0;
        }

        .login-wrapper {
          width: 100%;
          max-width: 390px;
          margin: auto;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .brand-area {
          margin-bottom: 34px;
        }

        .login-heading {
          margin-bottom: 28px;
        }

        .eyebrow {
          color: #a91f1f;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .login-heading h2 {
          margin: 12px 0 10px;
          color: #171717;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -1px;
          line-height: 1.2;
        }

        .login-heading p {
          max-width: 350px;
          margin: 0;
          color: #737373;
          font-size: 14px;
          line-height: 1.7;
        }

        /* FORM */

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .form-field label {
          display: block;
          margin-bottom: 9px;
          color: #262626;
          font-size: 13px;
          font-weight: 600;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-wrapper > svg {
          position: absolute;
          left: 14px;
          color: #999;
          pointer-events: none;
        }

        .input-wrapper input {
          width: 100%;
          height: 48px;
          padding: 0 45px;
          border: 1px solid #e5e5e5;
          border-radius: 9px;
          outline: none;
          background: #fafafa;
          color: #171717;
          font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }

        .input-wrapper input:focus {
          border-color: #b42323;
          background: white;
          box-shadow: 0 0 0 3px rgba(180, 35, 35, 0.08);
        }

        .input-wrapper input::placeholder {
          color: #aaa;
        }

        .input-wrapper button {
          position: absolute;
          right: 12px;
          display: grid;
          place-items: center;
          padding: 5px;
          border: 0;
          border-radius: 5px;
          background: transparent;
          color: #999;
          cursor: pointer;
        }

        .input-wrapper button:hover {
          color: #a91f1f;
        }

        /* REMEMBER */

        .remember-area label {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #555;
          font-size: 13px;
          cursor: pointer;
        }

        .remember-area input {
          width: 16px;
          height: 16px;
          margin: 0;
          accent-color: #a91f1f;
        }

        .session-info {
          margin: -9px 0 0;
          padding-left: 25px;
          color: #888;
          font-size: 12px;
          line-height: 1.5;
        }

        /* BUTTON */

        .login-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          width: 100%;
          height: 49px;
          margin-top: 3px;
          border: 0;
          border-radius: 9px;
          background: #a91f1f;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.25s;
        }

        .login-button:hover:not(:disabled) {
          background: #821919;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(169, 31, 31, 0.2);
        }

        .login-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* SECURITY */

        .security-info {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-top: 25px;
          padding: 13px;
          border: 1px solid #eee;
          border-radius: 9px;
          background: #fafafa;
          color: #737373;
          font-size: 12px;
          line-height: 1.6;
        }

        .security-info svg {
          flex-shrink: 0;
          color: #a91f1f;
        }

        /* FOOTER - PINNED TO BOTTOM */

        .login-footer {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
          max-width: 390px;
          margin-top: 0;
          padding: 16px 0 calc(16px + env(safe-area-inset-bottom));
          border-top: 1px solid #eee;
          color: #999;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.3px;
        }

        /* =========================
           MOBILE
        ========================= */

        @media (max-width: 650px) {
          .login-screen {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100vh;
            height: 100dvh;
            min-height: 0;
            overflow: hidden;
          }

          .earth-section {
            position: relative;
            flex: 0 0 34%;
            width: 100%;
            min-height: 0;
            overflow: hidden;
          }

          .red-glow {
            top: 0;
            width: 300px;
            height: 300px;
          }

          .earth-stage {
            top: 43%;
            width: clamp(125px, 34vw, 175px);
          }

          .earth-atmosphere {
            inset: -4%;
            box-shadow: 0 0 15px 3px rgba(255, 255, 255, 0.12),
              0 0 35px 5px rgba(180, 30, 30, 0.2);
          }

          .earth-object {
            box-shadow: inset -20px -5px 35px rgba(0, 0, 0, 0.95),
              inset 5px 0 15px rgba(255, 255, 255, 0.12),
              0 0 35px rgba(180, 30, 30, 0.15);
          }

          /* DRONE */

          .drone-object {
            width: 82px;
            height: 58px;
            top: 9%;
            right: 10%;
          }

          .drone-svg {
            height: 55px;
          }

          .drone-beam {
            top: 48px;
            height: 100px;
          }

          .drone-label {
            top: -8px;
            right: -34px;
            gap: 5px;
            font-size: 8px;
            letter-spacing: 0.7px;
          }

          .drone-status {
            width: 5px;
            height: 5px;
          }

          /* HERO */

          .hero-caption {
            left: 7%;
            right: 7%;
            bottom: 7%;
            max-width: 86%;
          }

          .hero-caption h1 {
            font-size: clamp(23px, 6vw, 31px);
            font-weight: 750;
            letter-spacing: -0.8px;
            line-height: 1.15;
          }

          .hero-subtitle {
            max-width: 350px;
            margin-top: 7px;
            font-size: 11px;
            line-height: 1.45;
          }

          .hero-footer {
            display: none;
          }

          /* LOGIN AREA */

          .login-section {
            flex: 1 1 66%;
            width: 100%;
            height: auto;
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 8px 25px 0;
            border-radius: 21px 21px 0 0;
            background: #fff;
            box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.17);
            z-index: 10;
          }

          .login-wrapper {
            width: 100%;
            max-width: 390px;
            flex: 1 1 auto;
            min-height: 0;
            margin: 0 auto;
            justify-content: center;
          }

          /* BRAND */

          .brand-area {
            margin-bottom: 12px;
          }

          /* HEADING */

          .login-heading {
            margin-bottom: 13px;
          }

          .eyebrow {
            font-size: 10px;
            letter-spacing: 1.3px;
          }

          .login-heading h2 {
            margin: 6px 0 5px;
            font-size: 25px;
            letter-spacing: -0.7px;
          }

          .login-heading p {
            font-size: 12px;
            line-height: 1.5;
          }

          /* FORM */

          .login-form {
            gap: 10px;
          }

          .form-field label {
            margin-bottom: 5px;
            font-size: 12px;
          }

          .input-wrapper input {
            height: 39px;
            padding: 0 40px;
            font-size: 13px;
            border-radius: 8px;
          }

          .input-wrapper > svg {
            width: 16px;
            height: 16px;
            left: 12px;
          }

          .input-wrapper button {
            right: 9px;
          }

          .input-wrapper button svg {
            width: 16px;
            height: 16px;
          }

          /* REMEMBER */

          .remember-area label {
            gap: 7px;
            font-size: 11px;
          }

          .remember-area input {
            width: 14px;
            height: 14px;
          }

          .session-info {
            margin: -5px 0 0;
            padding-left: 21px;
            font-size: 10px;
          }

          /* BUTTON */

          .login-button {
            height: 42px;
            margin-top: 1px;
            font-size: 13px;
            border-radius: 8px;
          }

          .login-button svg {
            width: 16px;
            height: 16px;
          }

          /* SECURITY */

          .security-info {
            gap: 9px;
            margin-top: 12px;
            padding: 9px 10px;
            font-size: 10px;
            line-height: 1.45;
            border-radius: 8px;
          }

          .security-info svg {
            width: 16px;
            height: 16px;
          }

          /* FOOTER */

          .login-footer {
            flex-shrink: 0;
            width: 100%;
            max-width: 390px;
            margin-top: 0;
            padding: 9px 0 calc(9px + env(safe-area-inset-bottom));
            font-size: 9px;
            letter-spacing: 0.2px;
          }
        }

        /* =========================
           SMALL MOBILE
        ========================= */

        @media (max-width: 380px) {
          .earth-section {
            flex-basis: 32%;
          }

          .earth-stage {
            width: 125px;
          }

          .hero-caption {
            left: 6%;
            bottom: 6%;
          }

          .hero-caption h1 {
            font-size: 23px;
          }

          .hero-subtitle {
            font-size: 10px;
            margin-top: 5px;
          }

          .login-section {
            flex-basis: 68%;
            padding-left: 19px;
            padding-right: 19px;
          }

          .brand-area {
            margin-bottom: 9px;
          }

          .login-heading {
            margin-bottom: 10px;
          }

          .login-heading h2 {
            font-size: 23px;
          }

          .login-heading p {
            font-size: 11px;
          }

          .login-form {
            gap: 8px;
          }

          .input-wrapper input {
            height: 37px;
          }

          .login-button {
            height: 40px;
          }

          .security-info {
            margin-top: 9px;
            padding: 8px;
          }

          .login-footer {
            padding-top: 8px;
            font-size: 8px;
          }
        }

        /* =========================
           VERY SHORT MOBILE
        ========================= */

        @media (max-width: 650px) and (max-height: 650px) {
          .earth-section {
            flex-basis: 29%;
          }

          .login-section {
            flex-basis: 71%;
            padding-top: 4px;
          }

          .earth-stage {
            width: 110px;
          }

          .hero-caption h1 {
            font-size: 22px;
          }

          .hero-subtitle {
            font-size: 10px;
            margin-top: 4px;
          }

          .brand-area {
            margin-bottom: 7px;
          }

          .login-heading {
            margin-bottom: 8px;
          }

          .login-heading h2 {
            font-size: 22px;
            margin: 5px 0 4px;
          }

          .login-heading p {
            font-size: 11px;
            line-height: 1.4;
          }

          .login-form {
            gap: 7px;
          }

          .form-field label {
            margin-bottom: 4px;
          }

          .input-wrapper input {
            height: 35px;
          }

          .login-button {
            height: 38px;
          }

          .security-info {
            margin-top: 8px;
            padding: 7px 9px;
          }

          .login-footer {
            padding-top: 7px;
            padding-bottom: calc(7px + env(safe-area-inset-bottom));
          }
        }

        /* =========================
           SHORT DESKTOP
        ========================= */

        @media (min-width: 651px) and (max-height: 750px) {
          .login-section {
            padding-top: 16px;
            padding-bottom: 0;
          }

          .brand-area {
            margin-bottom: 19px;
          }

          .login-heading {
            margin-bottom: 18px;
          }

          .login-heading h2 {
            font-size: 29px;
          }

          .login-form {
            gap: 12px;
          }

          .security-info {
            margin-top: 15px;
            padding: 10px;
          }

          .login-footer {
            padding-top: 10px;
            padding-bottom: 10px;
          }
        }

        /* =========================
           REDUCED MOTION
        ========================= */

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </main>
  );
}
