import type { ReactNode } from 'react'
import {
  Card,
  Heading,
  Icon,
  Stack,
  Text,
  useBreakpointDown,
  type CanopIconName,
} from 'canopui'

interface ModeHeaderProps {
  icon: CanopIconName
  title: string
  description: string
  denseOnMobile?: boolean
  children?: ReactNode
}

export function ModeHeader({
  icon,
  title,
  description,
  denseOnMobile = false,
  children,
}: ModeHeaderProps) {
  const compact = useBreakpointDown('sm')

  if (compact && denseOnMobile) {
    return (
      <Card radius="xl" density="dense">
        <Stack gap="xs">
          <Stack direction="row" gap="sm" alignItems="center">
            <Icon name={icon} variant="solid" size="md" color="primary" />
            <Heading level={2} size={5} gutterBottom={false}>
              {title}
            </Heading>
          </Stack>
          <Text variant="body-sm" tone="muted">
            {description}
          </Text>
          {children}
        </Stack>
      </Card>
    )
  }

  return (
    <Card radius="xl">
      <Stack gap="sm" alignItems="center">
        <Icon name={icon} variant="solid" size="xl" color="primary" />
        <Heading level={2} size={compact ? 4 : 3} align="center" gutterBottom={false}>
          {title}
        </Heading>
        <Text variant="lead" tone="muted" align="center">
          {description}
        </Text>
        {children}
      </Stack>
    </Card>
  )
}
