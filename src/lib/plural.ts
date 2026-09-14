import { useCallback } from 'react'
import { useTranslation, type CanopLocale, type CanopTranslateVars } from 'canopui'

export type Pluralize = (key: string, count: number, vars?: CanopTranslateVars) => string

function pluralForm(locale: CanopLocale, count: number): 'one' | 'other' {
  return new Intl.PluralRules(locale).select(count) === 'one' ? 'one' : 'other'
}

export function usePlural(): Pluralize {
  const { locale, t } = useTranslation()

  return useCallback<Pluralize>(
    (key, count, vars) => t(`${key}.${pluralForm(locale, count)}`, { count, ...vars }),
    [locale, t]
  )
}
