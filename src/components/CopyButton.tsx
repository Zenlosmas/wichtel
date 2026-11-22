import { useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/format';

type CopyButtonProps = {
  text: string;
  label: string;
  copiedLabel?: string;
  className?: string;
};

export function CopyButton({
  text,
  label,
  copiedLabel = 'Kopiert',
  className = 'btn btn-ghost',
}: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function handleClick() {
    void copyText(text).then((ok) => {
      setState(ok ? 'ok' : 'fail');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState('idle'), 2200);
    });
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {state === 'ok' ? copiedLabel : state === 'fail' ? 'Kopieren fehlgeschlagen' : label}
    </button>
  );
}
