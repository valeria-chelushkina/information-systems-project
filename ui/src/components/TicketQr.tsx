import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { TicketQrProps } from '@/typedefs/ui.typedefs';

export function TicketQr({ token }: TicketQrProps) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSource(null);

    void QRCode.toDataURL(token, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0d0a11', light: '#ffffff' },
    })
      .then((value) => {
        if (active) {
          setSource(value);
        }
      })
      .catch(() => {
        if (active) {
          setSource(null);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (!source) {
    return <span className="ticket-qr__placeholder" />;
  }

  return <img className="ticket-qr__image" src={source} alt="Ticket QR code" />;
}
