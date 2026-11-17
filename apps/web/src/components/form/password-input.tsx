'use client';

import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Eye, EyeClosed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const SHOW_PASSWORD = 'Mostrar senha';

// Visível, a senha fica fora do corretor ortográfico, que pode enviar o texto a um serviço externo,
// e volta a ficar oculta no envio do formulário.
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = wrapperRef.current?.closest('form');
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener('submit', hide);
    return () => form.removeEventListener('submit', hide);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        className={cn('pr-10 [&::-ms-reveal]:hidden', className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={SHOW_PASSWORD}
        title={SHOW_PASSWORD}
        aria-pressed={visible}
        aria-controls={props.id}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 text-muted-foreground"
      >
        {visible ? <Eye aria-hidden /> : <EyeClosed aria-hidden />}
      </Button>
    </div>
  );
}
