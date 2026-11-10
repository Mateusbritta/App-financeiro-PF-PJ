'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setAviso('');
    setCarregando(true);
    const supabase = createClient();
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setErro('E-mail ou senha incorretos.');
      else {
        // /comecar aceita convites pendentes e segue para o painel
        router.replace('/comecar');
        router.refresh();
      }
    } else {
      if (senha.length < 8) {
        setErro('Use uma senha com pelo menos 8 caracteres.');
        setCarregando(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      if (error) setErro(error.message);
      else if (data.session) {
        router.replace('/comecar');
        router.refresh();
      } else setAviso('Conta criada! Confirme o e-mail que enviamos e depois entre.');
    }
    setCarregando(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl text-white">◔</div>
        <h1 className="text-xl font-bold">App Financeiro</h1>
        <p className="text-sm text-slate-500">Boletos, gastos e impostos sob controle.</p>
      </div>
      <form onSubmit={enviar} className="card space-y-3">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="senha">Senha</label>
          <input id="senha" className="input" type="password" required autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        {aviso && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{aviso}</p>}
        <button className="btn-primary w-full" disabled={carregando}>
          {carregando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
        <button type="button" className="w-full text-center text-sm text-slate-500 hover:underline" onClick={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')}>
          {modo === 'entrar' ? 'Ainda não tenho conta' : 'Já tenho conta'}
        </button>
      </form>
    </main>
  );
}
