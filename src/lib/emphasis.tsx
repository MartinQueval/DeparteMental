const PLACEHOLDER = '{value}'

interface EmphasisProps {
  template: string
  value: string
}

export function Emphasis({ template, value }: EmphasisProps) {
  const [before, after = ''] = template.split(PLACEHOLDER)

  return (
    <>
      {before}
      <strong>{value}</strong>
      {after}
    </>
  )
}
