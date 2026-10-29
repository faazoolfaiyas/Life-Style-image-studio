'use client';
import type { FormEventHandler } from 'react';
import { Sparkles } from 'lucide-react';

type AuthPageProps = {
  signup: boolean;
  email: string;
  password: string;
  busy: boolean;
  error: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onToggle: () => void;
};

export default function AuthPage({
  signup, email, password, busy, error,
  onEmailChange, onPasswordChange, onSubmit, onToggle,
}: AuthPageProps) {
  return (
    <main className="studio-bg auth-screen">
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true"><Sparkles size={20} /></span>
            <span>LifeStyle <span className="text-violet-300">Studio</span></span>
          </div>

          <div className="auth-heading">
            <p className="eyebrow">YOUR DIGITAL SHOWROOM</p>
            <h1 className="auth-title"><span className="gradient-text">{signup ? 'Create your account' : 'Welcome back'}</span></h1>
            <p className="auth-subtitle">{signup ? 'Start curating your product collection.' : 'Sign in to manage your collection.'}</p>
          </div>

          <div className="auth-fields">
            <div className="auth-field-group">
              <label htmlFor="studio-email" className="auth-label">Email <span className="auth-required" aria-hidden="true">*</span></label>
              <input
                id="studio-email"
                name="email"
                className="field auth-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                placeholder="Email"
                value={email}
                onChange={event => onEmailChange(event.target.value)}
              />
            </div>
            <div className="auth-field-group">
              <label htmlFor="studio-password" className="auth-label">Password <span className="auth-required" aria-hidden="true">*</span></label>
              <input
                id="studio-password"
                name="password"
                className="field auth-input"
                type="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                minLength={6}
                required
                placeholder="Password"
                value={password}
                onChange={event => onPasswordChange(event.target.value)}
              />
            </div>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="primary-btn auth-submit">
            {busy ? <><span className="mini-spinner" aria-hidden="true" />Please wait</> : signup ? 'Create account' : 'Sign in'}
          </button>
          <button type="button" onClick={onToggle} disabled={busy} className="auth-switch">
            {signup ? 'Sign in instead' : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  );
}
