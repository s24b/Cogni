'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleGoogle() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Check your email to confirm your account.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error(error.message)
      }
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.svg" alt="Cogni" width={52} height={52} priority />
          <div className="text-center">
            <h1 className="text-2xl font-heading font-bold text-foreground md:text-3xl">
              Sign in to Cogni
            </h1>
            <p className="text-sm text-muted-foreground mt-1 md:text-base">
              Your personal AI study system
            </p>
          </div>
        </div>

        {/* Google OAuth — primary */}
        <Button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          size="lg"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        {/* Email / password form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            {loading
              ? 'Loading…'
              : mode === 'signin'
              ? 'Sign in with email'
              : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                onClick={() => setMode('signup')}
                className="text-primary underline-offset-4 hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => setMode('signin')}
                className="text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
      </div>

      {/* Branded panel — desktop only */}
      <div className="hidden md:flex md:w-[420px] lg:w-[480px] shrink-0 flex-col items-center justify-center gap-8 bg-primary px-12 py-16 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 right-8 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex flex-col items-center gap-6 text-center">
          <Image
            src="/logo.svg"
            alt="Cogni"
            width={80}
            height={80}
            priority
            className="brightness-0 invert"
          />
          <div>
            <p className="font-heading text-3xl font-bold text-white lg:text-4xl">Cogni</p>
            <p className="mt-2 text-base text-white/70 lg:text-lg">
              Your personal AI study system.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-3 text-left">
            {[
              'Learns how your professors test',
              'Builds your study plan automatically',
              'Adapts as your mastery grows',
            ].map(line => (
              <div key={line} className="flex items-center gap-3 text-sm text-white/80 lg:text-base">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
