import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-5 w-1 bg-primary" />
            <span className="text-sm font-semibold tracking-widest uppercase" style={{ letterSpacing: '0.18em' }}>
              RenGör
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Logga in på arbetsportalen</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
