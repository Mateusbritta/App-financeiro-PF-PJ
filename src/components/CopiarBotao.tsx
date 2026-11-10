'use client';

import { useState } from 'react';

export default function CopiarBotao({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        } catch {}
      }}
    >
      {copiado ? 'Copiado ✓' : rotulo}
    </button>
  );
}
