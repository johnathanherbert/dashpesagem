'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useFirebase } from '@/components/auth-provider';
import { ConsultaRapidaView } from '@/components/consulta-rapida-view';

export default function MobilePage() {
  const { user, userData } = useFirebase();

  return (
    <ProtectedRoute>
      <ConsultaRapidaView
        currentUserEmail={user?.email || userData?.email}
        isEmbedded={false}
      />
    </ProtectedRoute>
  );
}
