import { useCallback, useEffect, useRef } from 'react'

export type DelayedStep = (step: () => void, delay: number) => void

export function useDelayedStep(): DelayedStep {
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    []
  )

  return useCallback((step: () => void, delay: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(step, delay)
  }, [])
}
