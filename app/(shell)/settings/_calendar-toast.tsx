'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function CalendarToast() {
  const params = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const status = params.get('calendar')
    if (status === 'connected') {
      toast.success('Google Calendar connected')
      router.replace('/settings')
    } else if (status === 'error') {
      toast.error('Calendar connection failed — try again')
      router.replace('/settings')
    }
  }, [params, router])

  return null
}
