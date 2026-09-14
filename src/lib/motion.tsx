import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useEnterAnimation, useStagger } from 'canopui'

const STRETCH = { display: 'flex' } as const

interface ViewInProps {
  children: ReactNode
}

export function ViewIn({ children }: ViewInProps) {
  const enter = useEnterAnimation()

  return (
    <motion.div initial={enter.initial} animate={enter.animate} transition={enter.transition}>
      {children}
    </motion.div>
  )
}

interface CascadeProps {
  children: ReactNode
}

export function Cascade({ children }: CascadeProps) {
  const cascade = useStagger()

  return <motion.div {...cascade.container}>{children}</motion.div>
}

interface CascadeItemProps {
  children: ReactNode
  stretch?: boolean
}

export function CascadeItem({ children, stretch = false }: CascadeItemProps) {
  const cascade = useStagger()

  return (
    <motion.div variants={cascade.item.variants} style={stretch ? STRETCH : undefined}>
      {children}
    </motion.div>
  )
}
