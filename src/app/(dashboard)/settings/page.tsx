import { Settings } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Inställningar" subtitle="Konfigurera portalen och integrationer" />
      <div className="card empty py-14">
        <Settings />
        <p className="empty-title">Inställningspaneler kommer snart</p>
        <p className="empty-text">SMS-mallen redigeras under Administration → SMS-mallar.</p>
      </div>
    </div>
  )
}
