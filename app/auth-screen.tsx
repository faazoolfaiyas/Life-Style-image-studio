'use client';

import type { FormEvent } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

type Props = {
  signup: boolean;
  email: string;
  password: string;
  busy: boolean;
  error: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggle: () => void;
};

export default function AuthScreen({
  signup,
  email,
  password,
  busy,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onToggle,
}: Props) {
  return (
    <main className="studio-bg auth-screen">
      <div className="auth-frame">
        <section className="auth-surface" aria-labelledby="auth-title">
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true"><Sparkles size={20} strokeWidth={1.8} /></span>
            <span>LifeStyle <span className="text-violet-300">Studio</span></span>
          </div>

          <div className="auth-heading">
            <p className="eyebrow">YOUR DIGITAL SHOWROOM</p>
            <h1 id="auth-title" className="auth-title">{signup ? 'Create your account' : 'Welcome back'}</h1>
            <p className="auth-subtitle">
              {signup ? 'Start curating your product collection.' : 'Sign in to manage your collection.'}
            </p>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            <div className="auth-field">
              <label htmlFor="studio-email">Email <span className="required-mark" aria-hidden="true">*</span></label>
              <input
                id="studio-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="Email"
                required
                disabled={busy}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="studio-password">Password <span className="required-mark" aria-hidden="true">*</span></label>
              <input
                id="studio-password"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                minLength={6}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Password"
                required
                disabled={busy}
              />
            </div>

            {error && <p className="auth-feedback" role="status" aria-live="polite">{error}</p>}

            <button type="submit" className="auth-submit" disabled={busy} aria-busy={busy}>
              {busy ? <span className="mini-spinner" aria-hidden="true" /> : null}
              <span>{busy ? 'Please wait' : signup ? 'Create account' : 'Sign in'}</span>
              {!busy && <ArrowRight size={19} aria-hidden="true" />}
            </button>
          </form>

          <button type="button" className="auth-switch" onClick={onToggle} disabled={busy}>
            {signup ? 'Sign in instead' : 'Create account'}
          </button>
        </section>
      </div>
    </main>
  );
}
