import { useState } from 'react';
import { PokeballMark } from '@/components/layout/AppShell';
import { useAuth } from '@/contexts/AuthContext';

type Mode = 'signin' | 'signup' | 'reset';

export function LoginPage() {
  const { signInGoogle, signInEmail, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') await signInEmail(email, password);
      if (mode === 'signup') await signUp(name, email, password);
      if (mode === 'reset') {
        await resetPassword(email);
        setMessage('Link de redefinição enviado. Confira sua caixa de entrada.');
      }
    } catch (err: any) {
      setMessage(translateError(err?.code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <PokeballMark size={52} />
          <h1 className="font-display text-3xl font-extrabold">Pokédex TCG</h1>
          <p className="text-sm text-mist">Complete a Pokédex através das suas cartas.</p>
        </div>

        <div className="panel space-y-3 p-5">
          <button
            onClick={() => signInGoogle().catch((e) => setMessage(translateError(e?.code)))}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] py-2.5 text-sm font-medium transition hover:bg-white/10"
          >
            <GoogleMark /> Entrar com Google
          </button>

          <div className="flex items-center gap-3 py-1 text-[11px] text-mist">
            <span className="h-px flex-1 bg-white/10" /> ou <span className="h-px flex-1 bg-white/10" />
          </div>

          {mode === 'signup' && (
            <Field label="Nome" value={name} onChange={setName} placeholder="Como quer ser chamado" />
          )}
          <Field label="E-mail" value={email} onChange={setEmail} type="email" placeholder="voce@email.com" />
          {mode !== 'reset' && (
            <Field label="Senha" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
          )}

          <button
            onClick={handleSubmit}
            disabled={busy}
            className="w-full rounded-xl bg-flame py-2.5 font-display text-sm font-bold transition hover:bg-flame-soft disabled:opacity-50"
          >
            {busy ? 'Aguarde…' : mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
          </button>

          {message && <p className="text-center text-xs text-gold">{message}</p>}

          <div className="flex justify-between pt-1 text-xs text-mist">
            {mode !== 'signin' ? (
              <button onClick={() => setMode('signin')} className="hover:text-white">Já tenho conta</button>
            ) : (
              <button onClick={() => setMode('signup')} className="hover:text-white">Criar conta</button>
            )}
            <button onClick={() => setMode('reset')} className="hover:text-white">Esqueci a senha</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-mist">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm outline-none transition focus:border-flame/60"
      />
    </label>
  );
}

function translateError(code?: string) {
  const map: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/email-already-in-use': 'Esse e-mail já tem conta. Entre em vez de criar.',
    'auth/weak-password': 'A senha precisa de pelo menos 6 caracteres.',
    'auth/invalid-email': 'Esse e-mail não parece válido.',
    'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
  };
  return map[code ?? ''] ?? 'Não foi possível concluir. Tente de novo.';
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45 24.5c0-1.6-.1-2.8-.4-4H24v7.6h12c-.2 2-1.5 5-4.4 7l6.7 5.2c4-3.7 6.7-9.1 6.7-15.8Z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.5 28.4a13.5 13.5 0 0 1 0-8.7l-7.1-5.5a22 22 0 0 0 0 19.8Z" />
      <path fill="#EA4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.3 29.9 1 24 1 15.4 1 8.1 6 4.4 14.2l7.1 5.5C13.3 14.4 18.2 9.5 24 9.5Z" />
    </svg>
  );
}
